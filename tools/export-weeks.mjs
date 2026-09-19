// 从 App 的 RAW_WEEKS 反向导出周表，作为唯一真相源（避免"源表 vs App"两份数据打架）。
// 用法: node export-weeks.mjs [输出文件]
import fs from "node:fs";
import vm from "node:vm";

const APP = "D:/study/dsh_work/plans/three-track/三轨学习计划.html";
const OUT = process.argv[2] || "D:/study/dsh_work/plans/three-track/tools/weeks-source-6col.txt";

const src = fs.readFileSync(APP, "utf8");
const js = src.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1].replace(/\(function init\(\)\{[\s\S]*?\}\)\(\);\s*$/, "");
const appNode = { innerHTML: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], querySelector: () => null, appendChild() {}, remove() {}, click() {}, closest: () => null, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) };
const sb = { console: { log() {}, error() {}, warn() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { getElementById: () => appNode, querySelector: () => null, querySelectorAll: () => [], createElement: () => appNode, body: { appendChild() {} }, addEventListener() {}, execCommand: () => true }, window: { addEventListener() {}, scrollTo() {} }, navigator: {}, setTimeout, clearTimeout, Blob: class {}, URL: { createObjectURL: () => "b", revokeObjectURL() {} }, FileReader: class {} };
sb.globalThis = sb; const ctx = vm.createContext(sb);
vm.runInContext(js, ctx);

const rows = vm.runInContext("JSON.stringify(RAW_WEEKS)", ctx);
const arr = JSON.parse(rows);
let bad = 0;
arr.forEach((a, i) => {
  if (a.length !== 6) { console.log(`  W${i + 1} 字段数=${a.length}`); bad++; }
  if (a.some(x => !String(x || "").trim())) { console.log(`  W${i + 1} 有空字段`); bad++; }
});
if (bad) { console.error(`✗ App 数据本身有问题（${bad}），未导出`); process.exit(1); }

const lines = arr.map((a, i) => {
  const head = `["W${i + 1}", ` + a.map(x => JSON.stringify(x)).join(",\n ");
  return head + "]";
});
const text = "[\n" + lines.join(",\n\n") + "\n]\n";
fs.writeFileSync(OUT, text, "utf8");
console.log(`已导出 ${arr.length} 行 → ${OUT}`);
console.log("首行：" + lines[0].slice(0, 70));
console.log("末行：" + lines[lines.length - 1].slice(0, 70));
