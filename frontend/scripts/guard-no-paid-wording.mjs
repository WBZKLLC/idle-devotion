/**
 * Guard: No "Paid" wording in user-facing UI
 * 
 * Ensures all user-facing copy uses "Premium" instead of "Paid".
 * Blocks: "paid purchase", "paid cinematic" (case-insensitive)
 */

import fs from "fs";
import path from "path";

const ROOTS = [
  path.resolve(process.cwd(), "app"),
  path.resolve(process.cwd(), "components"),
];

const BLOCK = [
  /paid purchase/i,
  /\bpaid cinematic\b/i,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

let bad = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const txt = fs.readFileSync(file, "utf8");
    for (const pat of BLOCK) {
      if (pat.test(txt)) {
        bad.push({ file, pat: String(pat) });
        break;
      }
    }
  }
}

if (bad.length) {
  console.error("❌ guard-no-paid-wording: Found forbidden paid wording in UI.");
  for (const b of bad) console.error(`- ${b.file} matched ${b.pat}`);
  process.exit(1);
}
console.log("✅ guard-no-paid-wording: No forbidden paid wording found.");
