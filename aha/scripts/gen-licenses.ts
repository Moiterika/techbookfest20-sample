/**
 * ライセンスファイル生成スクリプト
 *
 * 1. `bun node-module-license-output` を実行
 * 2. license-overrides.json に基づいて REVIEW / LICENSE ファイルをパッチ
 *
 * Usage: bun run scripts/gen-licenses.ts [--fetch]
 *   --fetch: licenseUrl から実際のライセンス本文を取得して licenseText を上書きする
 */

import { $ } from "bun";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const reviewPath = resolve(root, "THIRD-PARTY-LICENSE-REVIEW.md");
const licensePath = resolve(root, "THIRD-PARTY-LICENSE.md");
const overridesPath = resolve(root, "license-overrides.json");

// ---------- types ----------

interface Override {
  license: string;
  licenseUrl?: string;
  licenseText?: string;
}

type Overrides = Record<string, Override>;

// ---------- helpers ----------

/** パッケージ名からアンカー ID を生成 (ツール本体と同じロジック) */
function toAnchorId(pkg: string): string {
  return (
    "pkg-" +
    pkg
      .replace(/^@/, "")
      .replace(/\//g, "-")
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase()
  );
}

/** GitHub の raw URL に変換 */
function toRawUrl(url: string): string | null {
  // https://github.com/owner/repo/blob/branch/FILE
  const m = url.match(
    /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/,
  );
  if (!m) return null;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
}

async function fetchLicenseText(url: string): Promise<string | null> {
  const raw = toRawUrl(url);
  if (!raw) return null;
  try {
    const res = await fetch(raw);
    if (!res.ok) return null;
    return (await res.text()).trimEnd();
  } catch {
    return null;
  }
}

// ---------- patch REVIEW ----------

function patchReview(content: string, overrides: Overrides): string {
  for (const [pkg, ov] of Object.entries(overrides)) {
    // セクション見出しを探す
    const heading = `## ${pkg}`;
    const idx = content.indexOf(heading);
    if (idx === -1) continue;

    // セクションの終わりを探す (次の ## か EOF)
    const nextHeading = content.indexOf("\n## ", idx + heading.length);
    const end = nextHeading === -1 ? content.length : nextHeading;
    let section = content.slice(idx, end);

    // License 行を置換
    section = section.replace(
      /^- License: .+$/m,
      `- License: ${ov.license}`,
    );

    // Files 行を置換 — (none) → LICENSE (override) 等
    section = section.replace(
      /^- Files:\n(?:  - .+\n?)*/m,
      `- Files:\n  - LICENSE (override)\n`,
    );

    // Status の "Missing LICENSE/..." 部分を除去
    section = section.replace(
      / \/ Missing LICENSE\/NOTICE\/COPYRIGHT\/THIRD-PARTY-NOTICES\/THIRD-PARTY-LICENSES\/ThirdPartyNoticeText\/ThirdPartyText\/COPYING files/,
      "",
    );

    // Notes にオーバーライド元 URL を記録
    if (ov.licenseUrl) {
      section = section.replace(
        /^- Notes:.*$/m,
        `- Notes:\n  Overridden from: ${ov.licenseUrl}`,
      );
    }

    content = content.slice(0, idx) + section + content.slice(end);
  }
  return content;
}

// ---------- patch LICENSE (main) ----------

function patchLicense(content: string, overrides: Overrides): string {
  for (const [pkg, ov] of Object.entries(overrides)) {
    const anchorId = toAnchorId(pkg);
    const anchor = `<a id="${anchorId}"></a>`;
    const idx = content.indexOf(anchor);
    if (idx === -1) continue;

    // セクションの終わりを探す (次の <a id= か EOF)
    const nextAnchor = content.indexOf("\n<a id=", idx + anchor.length);
    const end = nextAnchor === -1 ? content.length : nextAnchor;

    // ライセンスセクションを再構築
    const lines = [
      `${anchor}`,
      `## ${pkg}`,
      `- Source: ${extractField(content.slice(idx, end), "Source") ?? ""}`,
      `- License: ${ov.license}`,
      `- Usage: Present in node_modules`,
      `- LICENSE (override)`,
      "",
      `### LICENSE (override)`,
      "```text",
      ov.licenseText ?? `See: ${ov.licenseUrl ?? "N/A"}`,
      "```",
      "",
    ];

    content = content.slice(0, idx) + lines.join("\n") + content.slice(end);
  }
  return content;
}

function extractField(section: string, field: string): string | null {
  const m = section.match(new RegExp(`^- ${field}: (.+)$`, "m"));
  return m ? m[1] : null;
}

// ---------- main ----------

async function main() {
  const doFetch = process.argv.includes("--fetch");

  // 1. ツール実行
  console.log("Running node-module-license-output ...");
  await $`bunx third-party-license`.cwd(root);
  console.log("Done.");

  // 2. オーバーライド読み込み
  const overrides: Overrides = JSON.parse(
    readFileSync(overridesPath, "utf-8"),
  );

  // 3. --fetch: licenseUrl からテキスト取得
  if (doFetch) {
    for (const [pkg, ov] of Object.entries(overrides)) {
      if (ov.licenseUrl && !ov.licenseText) {
        console.log(`Fetching license for ${pkg} ...`);
        const text = await fetchLicenseText(ov.licenseUrl);
        if (text) {
          ov.licenseText = text;
          console.log(`  OK (${text.length} chars)`);
        } else {
          console.warn(`  WARN: could not fetch ${ov.licenseUrl}`);
        }
      }
    }
    // 取得結果を overrides ファイルに書き戻す
    writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + "\n");
  }

  // 4. パッチ適用
  let review = readFileSync(reviewPath, "utf-8");
  let license = readFileSync(licensePath, "utf-8");

  review = patchReview(review, overrides);
  license = patchLicense(license, overrides);

  writeFileSync(reviewPath, review);
  writeFileSync(licensePath, license);

  console.log("Overrides applied.");
}

main();
