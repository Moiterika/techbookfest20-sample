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

// ─── 1. htmx.org バンドル ──────────────────────

console.log("Bundling htmx.org...");

const htmxEntry = path.resolve("scripts/.tmp-htmx-entry.ts");
fs.writeFileSync(htmxEntry, `import "htmx.org";\n`);

const htmxResult = await Bun.build({
  entrypoints: [htmxEntry],
  outdir: jsDir,
  naming: "htmx.min.js",
  minify: true,
  target: "browser",
});

fs.unlinkSync(htmxEntry);

if (!htmxResult.success) {
  console.error("htmx bundle failed:", htmxResult.logs);
  process.exit(1);
}
console.log(`  → ${path.relative(".", path.join(jsDir, "htmx.min.js"))}`);

// ─── 2. Alpine.js バンドル ─────────────────────

console.log("Bundling Alpine.js...");

const alpineEntry = path.resolve("scripts/.tmp-alpine-entry.ts");
fs.writeFileSync(
  alpineEntry,
  `import Alpine from "alpinejs";\nAlpine.start();\n`,
);

const alpineResult = await Bun.build({
  entrypoints: [alpineEntry],
  outdir: jsDir,
  naming: "alpine.min.js",
  minify: true,
  target: "browser",
});

fs.unlinkSync(alpineEntry);

if (!alpineResult.success) {
  console.error("Alpine bundle failed:", alpineResult.logs);
  process.exit(1);
}
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
