#!/usr/bin/env node
/**
 * guard-no-direct-tier-imports.mjs
 * 
 * Ensures UI files (app/, components/) import from lib/progression.ts,
 * NOT directly from lib/tier.ts.
 * 
 * Usage:
 *   node scripts/guard-no-direct-tier-imports.mjs
 * 
 * Add to CI:
 *   "scripts": { "guard:tier": "node scripts/guard-no-direct-tier-imports.mjs" }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const targets = [
  path.join(root, "app"),
  path.join(root, "components"),
];

const bad = [];
const importRe = /from\s+['"]([^'"]+)['"]/g;

function scanFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];

    // Disallow any import ending with /tier or /lib/tier in UI
    if (
      spec.includes("/lib/tier") ||
      spec.endsWith("/tier") ||
      spec.endsWith("/tier.ts") ||
      spec === "../lib/tier" ||
      spec === "./tier"
    ) {
      bad.push({ filePath: path.relative(root, filePath), spec });
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) scanFile(p);
  }
}

for (const t of targets) walk(t);

if (bad.length) {
  console.error("\n[guard:no-direct-tier-imports] ❌ Direct imports from tier.ts detected.\n");
  for (const b of bad) {
    console.error(`  - ${b.filePath}: imports "${b.spec}"`);
  }
  console.error("\n  Use: import { ... } from '../lib/progression'\n");
  process.exit(1);
}

console.log("[guard:no-direct-tier-imports] ✅ No direct tier imports found in UI.");
