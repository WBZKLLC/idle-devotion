/**
 * guard-no-inline-power.mjs
 * 
 * CI Guard: Blocks inline power formulas in app/ screens.
 * 
 * All power calculations MUST use the canonical helpers:
 * - computeCombatStats() from lib/combatStats.ts
 * - computePower() from lib/power.ts
 * 
 * This ensures Premium Cinematic bonuses are applied consistently.
 * 
 * Blocked patterns:
 * - base_hp + base_atk * 3 + base_def * 2
 * - current_hp + current_atk *
 * - .base_hp + .base_atk
 * 
 * Usage: node scripts/guard-no-inline-power.mjs
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "app"); // /app/frontend/app

const BLOCK_PATTERNS = [
  // Common inline power formulas
  /base_hp\s*\+\s*base_atk\s*\*\s*3/i,
  /base_hp\s*\+\s*base_atk\s*\*\s*2/i,
  /current_hp\s*\+\s*current_atk\s*\*/i,
  /\.base_hp\s*\+\s*\.base_atk/i,
  /\.current_hp\s*\+\s*\.current_atk/i,
  // Direct stat formula patterns (not via helpers)
  /heroData\.base_hp\s*\+\s*heroData\.base_atk/i,
  /hero\.current_hp\s*\+\s*hero\.current_atk/i,
];

// Files that are allowed (migration period or special cases)
const ALLOWLIST = [
  // None for now - all screens should use helpers
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
  const relPath = path.relative(process.cwd(), file);
  if (ALLOWLIST.some(a => relPath.includes(a))) continue;
  
  const txt = fs.readFileSync(file, "utf8");
  for (const pat of BLOCK_PATTERNS) {
    if (pat.test(txt)) {
      bad.push({ file: relPath, pat: String(pat) });
      break; // Only report first match per file
    }
  }
}

if (bad.length) {
  console.error("❌ guard-no-inline-power: Inline power formulas detected in app/ screens.");
  console.error("");
  console.error("All power calculations MUST use canonical helpers:");
  console.error("  - computeCombatStats(hero, heroData) from lib/combatStats.ts");
  console.error("  - computePower(stats) from lib/power.ts");
  console.error("");
  console.error("This ensures Premium Cinematic bonuses (+10% HP, +5% ATK) are applied consistently.");
  console.error("");
  for (const b of bad) {
    console.error(`  ├─ ${b.file}`);
    console.error(`  │  matched: ${b.pat}`);
  }
  console.error("");
  process.exit(1);
}

console.log("✅ guard-no-inline-power: No inline power formulas in app/ screens.");
