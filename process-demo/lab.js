"use strict";

const byId = (id) => document.getElementById(id);
const source = byId("source");
const run = byId("run");
const output = byId("output");
const statusEl = byId("status");
const reset = byId("reset");
let original = "";
let running = false;
let lastRunSource = null;
let controller = null;

function renderEditor() {
  const value = source.value;
  const tokens = /(^\s*#.*$)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:if|else|int|void|return|NULL|const|char|pid_t)\b)|(\b[A-Za-z_]\w*(?=\s*\())/gm;
  const fragment = document.createDocumentFragment();
  let start = 0;
  for (const match of value.matchAll(tokens)) {
    fragment.append(value.slice(start, match.index));
    const span = document.createElement("span");
    span.className = ["pp", "cm", "st", "kw", "fn"][match.slice(1).findIndex((part) => part !== undefined)];
    span.textContent = match[0];
    fragment.append(span);
    start = match.index + match[0].length;
  }
  fragment.append(value.slice(start) + "\n");
  byId("highlight").replaceChildren(fragment);
  byId("gutter").textContent = value.split("\n").map((_, i) => i + 1).join("\n");
  reset.disabled = running || !original || value === original;
  if (!running && lastRunSource !== null && value !== lastRunSource) {
    setStatus("源码已修改", "idle");
  } else if (!running && lastRunSource !== null && value === lastRunSource) {
    setStatus(output.classList.contains("error") ? "运行有误" : "已运行", output.classList.contains("error") ? "error" : "success");
  }
}

function setStatus(label, state) {
  statusEl.textContent = label;
  statusEl.dataset.state = state;
}

async function runProgram() {
  if (running || !original) return;
  running = true;
  run.disabled = true;
  source.readOnly = true;
  reset.disabled = true;
  setStatus("运行中", "busy");
  if (window.matchMedia("(max-width:690px)").matches) {
    document.querySelector(".terminal").scrollIntoView({block: "nearest"});
  }
  const submitted = source.value;
  output.className = "idle";
  output.textContent = "正在编译并启动程序…";
  byId("exit").textContent = "";
  try {
    controller = new AbortController();
    const {signal} = controller;
    byId("stop").hidden = false;
    setStatus("准备环境", "busy");
    output.textContent = "正在加载浏览器里的 Linux 与 C 编译器…";
    const {runGuest} = await import("./guest/runner.mjs");
    signal.throwIfAborted();
    const result = await runGuest(submitted, {signal, onStage: (stage) => {
      const labels = {boot: "启动 Linux", compile: "编译中", run: "执行中", load: "加载环境"};
      if (labels[stage]) {
        setStatus(labels[stage], "busy");
        output.textContent = labels[stage] + "…";
      }
    }});
    signal.throwIfAborted();
    lastRunSource = submitted;
    const ok = !result.timedOut && result.exitCode === 0;
    const streams = [result.stdout, result.stderr].filter(Boolean);
    output.textContent = streams.join(streams.length === 2 && !streams[0].endsWith("\n") ? "\n" : "") || "（程序没有输出）";
    output.className = ok ? "" : "error";
    setStatus(ok ? "运行完成" : result.phase === "compile" ? "编译失败" : "运行有误", ok ? "success" : "error");
    byId("exit").textContent = Number.isInteger(result.exitCode) ? "exit " + result.exitCode : "";
  } catch (error) {
    lastRunSource = null;
    const aborted = controller?.signal.aborted;
    output.textContent = aborted ? "本次运行已停止。" : "执行未完成：" + error.message;
    output.className = aborted ? "idle" : "error";
    setStatus(aborted ? "已停止" : "执行未完成", aborted ? "idle" : "error");
  } finally {
    running = false;
    byId("stop").hidden = true;
    controller = null;
    source.readOnly = false;
    run.disabled = false;
    reset.disabled = source.value === original;
  }
}

source.addEventListener("input", renderEditor);
source.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runProgram();
  }

});
reset.addEventListener("click", () => {
  source.value = original;
  renderEditor();
  source.focus({preventScroll:true});
});
run.addEventListener("click", runProgram);
byId("stop").addEventListener("click", () => controller?.abort());

const slides = byId("slides");
const dialog = byId("slide-dialog");
byId("pdf-link").href = slides.href;
slides.addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  dialog.showModal();
});
byId("close-slide").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});

async function initialize() {
  try {
    const response = await fetch("main.c");
    if (!response.ok) throw new Error("源码加载失败");
    original = (await response.text()).trimEnd();
    source.value = original;
    renderEditor();
    source.disabled = false;
    run.disabled = false;
    output.className = "idle";
  } catch (error) {
    renderEditor();
    setStatus("初始化失败", "error");
    output.textContent = "页面加载失败：" + error.message + "。请从本地预览链接打开。";
  }
}
initialize();

const menu = byId("menu-toggle");
const sidebar = document.querySelector(".sidebar");
const sectionLinks = Array.from(document.querySelectorAll(".section-links a"));
const sections = sectionLinks.map((link) => document.getElementById(link.hash.slice(1)));
const search = byId("doc-search");
const results = byId("search-results");

function showMenu(open) {
  sidebar.classList.toggle("menu-open", open);
  menu.setAttribute("aria-expanded", String(open));
}

menu.addEventListener("click", () => showMenu(menu.getAttribute("aria-expanded") !== "true"));
byId("course-nav").addEventListener("click", (event) => {
  if (event.target.closest("a")) showMenu(false);
});
sidebar.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    showMenu(false);
    menu.focus();
  }
});

function selectCurrentSection() {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const atEnd = window.scrollY > 0 && window.scrollY >= maxScroll - 2;
  let current = atEnd ? sections.at(-1) : sections.filter((section) => section.getBoundingClientRect().top < 80).at(-1) || sections[0];
  const target = sections.find((section) => "#" + section.id === location.hash);
  if (target) {
    // Several links can land at the same scroll position near the end of a page.
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - margin;
    const destination = Math.min(maxScroll, Math.max(0, top));
    if (Math.abs(window.scrollY - destination) <= 2) current = target;
  }
  for (const link of sectionLinks) {
    if (link.hash === "#" + current.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("scroll", selectCurrentSection, {passive: true});
window.addEventListener("resize", selectCurrentSection);
window.addEventListener("hashchange", selectCurrentSection);
selectCurrentSection();

function updateSearch() {
  const query = search.value.trim().toLowerCase();
  results.replaceChildren();
  results.hidden = !query;
  if (!query) return;
  for (const link of sectionLinks) {
    const haystack = (link.textContent + " " + link.dataset.keywords).toLowerCase();
    if (query.split(/\s+/).every((word) => haystack.includes(word))) {
      const hit = document.createElement("a");
      hit.href = link.hash;
      hit.textContent = link.textContent;
      results.append(hit);
    }
  }
  if (!results.childElementCount) {
    const empty = document.createElement("p");
    empty.textContent = "没有找到匹配的小节";
    empty.setAttribute("role", "status");
    results.append(empty);
  }
}
search.addEventListener("input", updateSearch);
search.addEventListener("focus", updateSearch);
const searchBox = search.closest(".search-box");
searchBox.addEventListener("focusout", (event) => {
  if (!searchBox.contains(event.relatedTarget)) results.hidden = true;
});
searchBox.addEventListener("keydown", (event) => {
  const hits = Array.from(results.querySelectorAll("a"));
  if (event.key === "Escape") {
    search.focus();
    results.hidden = true;
  } else if (event.key === "Enter" && event.target === search && !results.hidden && hits.length) {
    event.preventDefault();
    hits[0].click();
  } else if (["ArrowDown", "ArrowUp"].includes(event.key) && hits.length && !results.hidden) {
    event.preventDefault();
    const index = hits.indexOf(document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const first = step > 0 ? 0 : hits.length - 1;
    const next = index < 0 ? first : (index + step + hits.length) % hits.length;
    hits[next].focus();
  }
});
results.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  results.hidden = true;
  search.value = "";
  document.getElementById(link.hash.slice(1)).focus({preventScroll: true});
});
