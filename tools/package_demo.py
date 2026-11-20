"""Build share/fork-demo.html and its zip from the process-demo sources."""

import base64
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "process-demo"
GUEST = DEMO / "guest"
ASSETS = ("buildroot.bin", "v86.wasm", "compiler.cpio.gz", "seabios.bin", "vgabios.bin")


def read(path):
    return path.read_text(encoding="utf-8")


def encode(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old!r} in the source")
    return text.replace(old, new)


def embed(name, value):
    data = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    return f'<script type="application/json" id="{name}">{data}</script>'


def bundle_worker():
    library = replace_once(
        read(GUEST / "libv86.mjs"),
        "export{};; export default module.exports.V86; export let {V86, CPU} = module.exports;",
        "const {V86} = module.exports;",
    )
    worker = replace_once(
        read(GUEST / "vm-worker.mjs"),
        'import { V86 } from "./libv86.mjs";',
        "let offlineAssets;",
    )
    worker = replace_once(
        worker,
        '''  const response = await fetch(new URL(name, import.meta.url));
  if (!response.ok) throw new Error(name + " 加载失败 (HTTP " + response.status + ")");
  return response.arrayBuffer();''',
        "  return offlineAssets[name].arrayBuffer();",
    )
    worker = replace_once(
        worker,
        'if (data.type === "start") await start(data.source, data.stdin);',
        '''if (data.type === "start") {
      offlineAssets = data.assets;
      await start(data.source, data.stdin);
    }''',
    )
    # The classic worker shares a scope with v86. Keep adapter bindings local.
    return library + "\n{\n" + worker + "\n}\n"


LOADER = '''
function readEmbedded(id) {
  return JSON.parse(document.getElementById(id).textContent);
}
let offlineBundle;
function getOfflineBundle() {
  if (offlineBundle) return offlineBundle;
  const assets = {};
  for (const [name, base64] of Object.entries(readEmbedded("vm-assets"))) {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    assets[name] = new Blob([bytes]);
  }
  const worker = new Blob([readEmbedded("vm-worker")], {type: "text/javascript"});
  offlineBundle = {assets, workerUrl: URL.createObjectURL(worker)};
  return offlineBundle;
}
'''


def bundle_application():
    runner = replace_once(
        read(GUEST / "runner.mjs"), "export function runGuest(", "function runGuest("
    )
    runner = replace_once(
        runner,
        'new Worker(new URL("./vm-worker.mjs", import.meta.url), { type: "module" })',
        "new Worker(getOfflineBundle().workerUrl)",
    )
    runner = replace_once(
        runner, 'type: "start", source, stdin', 'type: "start", source, stdin, assets: getOfflineBundle().assets'
    )
    app = replace_once(
        read(DEMO / "lab.js"), '    const {runGuest} = await import("./guest/runner.mjs");\n', ""
    )
    app = replace_once(
        app,
        '''    const response = await fetch("main.c");
    if (!response.ok) throw new Error("源码加载失败");
    original = (await response.text()).trimEnd();''',
        '    original = readEmbedded("c-source").trimEnd();',
    )
    app = app.replace("。请从本地预览链接打开。", "。请用桌面版 Chrome 打开这个 HTML 文件。")
    return "\n".join(('"use strict";', LOADER, runner, app))


def build_html():
    html = replace_once(read(DEMO / "index.html"), '<script src="lab.js" defer></script>', "")
    html = replace_once(html, '<link rel="stylesheet" href="lab.css">', f'<style>{read(DEMO / "lab.css")}</style>')
    html = replace_once(html, 'src="slide-18.png"', f'src="data:image/png;base64,{encode(DEMO / "slide-18.png")}"')
    assets = {name: encode(GUEST / name) for name in ASSETS}
    notices = [GUEST / "SOURCES.md", *GUEST.glob("licenses/*"), *GUEST.glob("build/*")]
    sources = {path.relative_to(GUEST).as_posix(): read(path) for path in sorted(notices) if path.is_file()}
    payload = [
        embed("vm-assets", assets),
        embed("vm-worker", bundle_worker()),
        embed("c-source", read(DEMO / "main.c")),
        embed("third-party-notices-and-sources", sources),
        f"<script>\n{bundle_application()}\n</script>",
        "</body>",
    ]
    return replace_once(html, "</body>", "\n".join(payload))


def main():
    output = ROOT / "share"
    output.mkdir(exist_ok=True)
    with TemporaryDirectory(dir=output) as staging:
        page = Path(staging) / "fork-demo.html"
        archive = Path(staging) / "fork-demo.zip"
        page.write_text(build_html(), encoding="utf-8")
        with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=6) as package:
            package.write(page, page.name)
        for path in (page, archive):
            path.replace(output / path.name)
            print((output / path.name).relative_to(ROOT))


if __name__ == "__main__":
    main()
