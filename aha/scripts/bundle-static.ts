/**
 * bundle-static.ts
 *
 * GoTH 向けに JS アセットをバンドル・出力する。
 *
 * 出力先: goth/static/js/
 *   - htmx.min.js    — htmx.org をバンドル
 *   - alpine.min.js   — Alpine.js をバンドル
 *
 * CSS は別途 @tailwindcss/cli で生成（package.json の gen:css 参照）
 *
 * Usage: bun run scripts/bundle-static.ts
 */

import * as path from "path";
import * as fs from "fs";

const gothStatic = path.resolve("../goth/static");
const jsDir = path.join(gothStatic, "js");

fs.mkdirSync(jsDir, { recursive: true });

// ─── 1. htmx.org — 公式 min ビルドをコピー ───────────
// Bun.build でバンドルするとグローバル変数 htmx がリネームされるため、
// 公式の htmx.min.js をそのままコピーする。

console.log("Copying htmx.org (official min build)...");

const htmxMin = path.resolve("node_modules/htmx.org/dist/htmx.min.js");
fs.copyFileSync(htmxMin, path.join(jsDir, "htmx.min.js"));
console.log(`  → ${path.relative(".", path.join(jsDir, "htmx.min.js"))}`);

// ─── 2. Alpine.js — CDN ビルドをコピー ─────────────
// Bun.build で ESM バンドルすると CDN ビルドと互換性のない出力になるため、
// alpinejs の公式 CDN ビルド (cdn.min.js) をそのままコピーする。
// CDN ビルドは defer 読み込みで自動的に Alpine.start() を呼ぶ。

console.log("Copying Alpine.js (CDN build)...");

const alpineCdn = path.resolve("node_modules/alpinejs/dist/cdn.min.js");
fs.copyFileSync(alpineCdn, path.join(jsDir, "alpine.min.js"));
console.log(`  → ${path.relative(".", path.join(jsDir, "alpine.min.js"))}`);

// ─── 3. react-barcode カスタムエレメント バンドル ──────

console.log("Bundling react-barcode custom element...");

const barcodeResult = await Bun.build({
  entrypoints: [path.resolve("src/components/ReactBarcodeWrapper.tsx")],
  outdir: jsDir,
  naming: "react-barcode.min.js",
  minify: true,
  target: "browser",
});

if (!barcodeResult.success) {
  console.error("react-barcode bundle failed:", barcodeResult.logs);
  process.exit(1);
}
console.log(`  → ${path.relative(".", path.join(jsDir, "react-barcode.min.js"))}`);

// ─── 完了 ─────────────────────────────────

console.log("\nDone! JS assets are in ../goth/static/js/");
console.log("  js/htmx.min.js");
console.log("  js/alpine.min.js");
console.log("  js/react-barcode.min.js");
