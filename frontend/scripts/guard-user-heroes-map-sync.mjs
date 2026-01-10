#!/usr/bin/env node
/**
 * guard-user-heroes-map-sync.mjs
 * 
 * Ensures that whenever userHeroes is set, userHeroesById is also set.
 * Prevents cache desync between list and map.
 * 
 * Covers both mutation styles:
 * 1) set({ userHeroes: ... }) - direct object
 * 2) set((s) => { return { userHeroes: ... } }) - functional return
 * 
 * Usage:
 *   node scripts/guard-user-heroes-map-sync.mjs
 * 
 * Add to CI:
 *   "scripts": { "guard:user-heroes-map": "node scripts/guard-user-heroes-map-sync.mjs" }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, "..", "stores", "gameStore.ts");

if (!fs.existsSync(filePath)) {
  console.error("[guard:user-heroes-map] ❌ stores/gameStore.ts not found");
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");

// We enforce:
// 1) any set({ ... userHeroes: ... }) block must also include userHeroesById
// 2) any set((s)=>{ ... return { userHeroes: ... } }) must return userHeroesById alongside it
// Intentionally simple + conservative (regex-based CI guard).

const hits = [];

// (1) Direct object set({ ... userHeroes: ... })
const reDirect = /set\s*\(\s*\{[\s\S]*?userHeroes\s*:/g;

// (2) Functional set((s)=>{ ... return { userHeroes: ... } ... })
const reFnReturn = /set\s*\(\s*\(\s*s\s*\)\s*=>\s*\{[\s\S]*?return\s*\{[\s\S]*?userHeroes\s*:/g;

function collectMatches(re, kind) {
  let m;
  while ((m = re.exec(src))) {
    const start = m.index;
    const snippet = src.slice(start, start + 320);
    hits.push({ start, snippet, kind });
  }
}

collectMatches(reDirect, "set({ ... })");
collectMatches(reFnReturn, "set((s)=>{ return { ... } })");

// A match is bad if it doesn't include userHeroesById in the nearby snippet.
const bad = hits.filter((h) => !h.snippet.includes("userHeroesById"));

// Also allow setUserHeroesState (which is the approved helper)
const reallyBad = bad.filter((h) => !h.snippet.includes("setUserHeroesState"));

if (reallyBad.length) {
  console.error("\n[guard:user-heroes-map] ❌ Found set({ userHeroes: ... }) not accompanied by userHeroesById.\n");
  for (const b of reallyBad) {
    console.error(`- ${b.kind} near index ${b.start}:\n${b.snippet.slice(0, 200)}...\n---`);
  }
  console.error(
    "Fix: set both userHeroes and userHeroesById together, or use setUserHeroesState(set, heroes).\n"
  );
  process.exit(1);
}

console.log("[guard:user-heroes-map] ✅ userHeroes/userHeroesById sync enforced.");
