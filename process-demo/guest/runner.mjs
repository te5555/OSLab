const runtime = "Linux 6.8 · TinyCC · i386";

/** Run C source in a fresh, browser-local Linux VM. Each call owns one worker. */
export function runGuest(source, { stdin = "", signal, onStage, runtimeMs = 8000 } = {}) {
  if (signal?.aborted) return Promise.reject(new DOMException("执行已取消。", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./vm-worker.mjs", import.meta.url), { type: "module" });
    let timer;
    let phase = "boot";
    let timedOut = false;
    function finish(action, value) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
      action(value);
    }
    function cancel() {
      finish(reject, new DOMException("执行已取消。", "AbortError"));
    }
    function finishTimeout(result = {}) {
      finish(resolve, {stdout: result.stdout || "", stderr: (result.stderr || "") + "执行超时，虚拟机已停止。\n",
        exitCode: 124, phase, runtime, timedOut: true});
    }
    function setDeadline(ms) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        worker.postMessage({ type: "timeout" });
        timer = setTimeout(finishTimeout, 750);
      }, ms);
    }
    signal?.addEventListener("abort", cancel, {once:true});
    worker.onerror = event => finish(reject, new Error(event.message || "浏览器虚拟机启动失败。"));
    worker.onmessage = ({ data }) => {
      if (timedOut) {
        if (data.type === "timeout" || data.type === "result") finishTimeout(data);
        return;
      }
      if (data.type === "error") return finish(reject, new Error(data.message));
      if (data.type === "result") {
        const {stdout, stderr, phase, exitCode} = data;
        return finish(resolve, {stdout, stderr, phase, exitCode, runtime, timedOut: false});
      }
      if (data.type === "stage") {
        phase = data.phase;
        setDeadline(phase === "run" ? runtimeMs : 30000);
        onStage?.(phase);
      }
    };
    setDeadline(60000);
    onStage?.(phase);
    worker.postMessage({type: "start", source, stdin});
  });
}
