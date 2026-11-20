import { V86 } from "./libv86.mjs";

const decoder = new TextDecoder();
let vm;
async function load(name) {
  const response = await fetch(new URL(name, import.meta.url));
  if (!response.ok) throw new Error(name + " 加载失败 (HTTP " + response.status + ")");
  return response.arrayBuffer();
}
async function capture() {
  async function read(name) {
    try { return decoder.decode((await vm.read_file("/" + name))?.subarray(0, 65536)); }
    catch { return ""; }
  }
  const [stdout, stderr] = await Promise.all([read("stdout"), read("stderr")]);
  return {stdout, stderr};
}
async function start(source, stdin) {
  const [wasm, bios, vga, kernel, initrd] = await Promise.all([
    load("v86.wasm").then(WebAssembly.compile), load("seabios.bin"), load("vgabios.bin"),
    load("buildroot.bin"), load("compiler.cpio.gz"),
  ]);
  vm = new V86({
    wasm_fn: async imports => (await WebAssembly.instantiate(wasm, imports)).exports,
    bios: {buffer: bios}, vga_bios: {buffer:vga}, bzimage: {buffer:kernel}, initrd:{buffer:initrd},
    cmdline:"quiet console=ttyS0 rdinit=/guest-init panic=-1", memory_size:96 * 1024 * 1024,
    filesystem:{}, autostart:false, disable_keyboard:true, disable_mouse:true, disable_speaker:true,
  });
  let line = "";
  vm.add_listener("serial0-output-byte", async byte => {
    if (byte === 13) return;
    if (byte !== 10) {
      if (line.length < 512) line += String.fromCharCode(byte);
      return;
    }
    const current = line;
    line = "";
    if (current === "OSLAB COMPILE" || current === "OSLAB RUN") {
      self.postMessage({type:"stage", phase:current === "OSLAB RUN" ? "run" : "compile"});
    } else if (current === "OSLAB ERROR") {
      self.postMessage({type:"error", message:"Linux 客体初始化失败。"});
    } else {
      const match = /^OSLAB DONE (run|compile) (\d+)$/.exec(current);
      if (match) self.postMessage({type:"result", phase:match[1], exitCode:Number(match[2]), ...await capture()});
    }
  });
  vm.add_listener("emulator-loaded", async () => {
    try {
      const encoder = new TextEncoder();
      await vm.create_file("/main.c", encoder.encode(source));
      await vm.create_file("/stdin", encoder.encode(stdin));
      vm.run();
    } catch (error) {
      self.postMessage({type:"error", message:error.message});
    }
  });
}
self.onmessage = async ({data}) => {
  try {
    if (data.type === "start") await start(data.source, data.stdin);
    else if (data.type === "timeout") self.postMessage({type:"timeout", ...await capture()});
  } catch (error) {
    self.postMessage({type:"error", message:error.message});
  }
};
