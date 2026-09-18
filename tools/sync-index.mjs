// 保持 index.html 与 三轨学习计划.html 逐字节一致。
// 为什么要有这个：GitHub Pages 的根地址默认找 index.html，但中文文件名在 URL 里会被
// 编码成 %E4%B8%89... 又长又难输入；所以发布件里两份都放，本地仍然双击中文名那份。
// 用法: node mobile/sync-index.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "gh-pages");
const SRC  = path.resolve(HERE, "..", "plans", "three-track", "三轨学习计划.html");
const DST  = path.join(SITE, "index.html");

if (!fs.existsSync(SRC)) { console.error("找不到源文件：" + SRC); process.exit(1); }
if (!fs.existsSync(SITE)) fs.mkdirSync(SITE, { recursive: true });

const src = fs.readFileSync(SRC);
const same = fs.existsSync(DST) && Buffer.compare(fs.readFileSync(DST), src) === 0;

if (process.argv.includes("--check")) {
  console.log(same ? "OK  index.html 与源文件一致" : "DRIFT  index.html 与源文件不一致，需要跑一次同步");
  process.exit(same ? 0 : 1);
}
if (!same) {
  fs.writeFileSync(DST, src);
  console.log("已同步 index.html  (" + src.length + " bytes)");
} else {
  console.log("无需同步，index.html 已是最新");
}
