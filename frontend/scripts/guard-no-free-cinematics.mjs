/**
 * guard-no-free-cinematics.mjs
 * 
 * CI Guard: Blocks free cinematic preview UI in app/ screens.
 * 
 * Cinematics are a PAID FEATURE. The modal and assets can exist in 
 * components/ and constants/ for future monetization, but NO screen
 * in app/ should expose free access to preview/play cinematics.
 * 
 * Blocked patterns:
 * - "Preview 5+ Cinematic" text
 * - HeroCinematicModal imports/usage
 * - showCinematic state
 * - handlePreview handlers
 * 
 * Usage: node scripts/guard-no-free-cinematics.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "app"); // /app/frontend/app

const BLOCK_PATTERNS = [
  /Preview\s*5\+\s*Cinematic/i,
  /HeroCinematicModal/,
  /showCinematic/i,
  /setShowCinematic/i,
  /handlePreview.*Cinematic/i,
  /openCinematic/i,
  /cinematicVideoSource/i,
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
let bad = [];

for (const file of files) {
  const txt = fs.readFileSync(file, "utf8");
  for (const pat of BLOCK_PATTERNS) {
    if (pat.test(txt)) {
      bad.push({ file: path.relative(process.cwd(), file), pat: String(pat) });
      break; // Only report first match per file
    }
  }
}

if (bad.length) {
  console.error("❌ guard-no-free-cinematics: Cinematic preview UI is present in app/ screens.");
  console.error("");
  console.error("Cinematics are a PAID FEATURE and must not be freely accessible.");
  console.error("Remove all cinematic UI from screens before committing.");
  console.error("");
  for (const b of bad) {
    console.error(`  ├─ ${b.file}`);
    console.error(`  │  matched: ${b.pat}`);
  }
  console.error("");
  process.exit(1);
}

console.log("✅ guard-no-free-cinematics: No free cinematic preview UI in app/ screens.");
