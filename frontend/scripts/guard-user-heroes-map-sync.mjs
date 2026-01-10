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

// Strategy: find all occurrences of "userHeroes:" that appear to be in a set() context
// Look backwards to see if it's inside a set({ or set((s) => { return {

// Find all "userHeroes:" occurrences
const userHeroesRe = /userHeroes\s*:/g;
let m;

while ((m = userHeroesRe.exec(src))) {
  const pos = m.index;
  
  // Look at context before this match (up to 200 chars back)
  const before = src.slice(Math.max(0, pos - 200), pos);
  
  // Check if this looks like it's inside a set() call
  const isInSet = before.includes('set(') || before.includes('set((');
  
  // Skip if this is in the interface definition or initial state
  const isInterfaceOrInitial = before.includes('interface') || 
                               before.includes('create<GameState>') ||
                               before.includes('setUserHeroesState');
  
  if (isInSet && !isInterfaceOrInitial) {
    // Get snippet around the match
    const snippet = src.slice(Math.max(0, pos - 50), pos + 200);
    hits.push({ pos, snippet });
  }
}

// A match is bad if it doesn't include userHeroesById nearby
const bad = hits.filter((h) => !h.snippet.includes("userHeroesById"));

if (bad.length) {
  console.error("\n[guard:user-heroes-map] ❌ Found set({ userHeroes: ... }) not accompanied by userHeroesById.\n");
  for (const b of bad) {
    console.error(`- Near index ${b.pos}:\n${b.snippet.slice(0, 180)}...\n---`);
  }
  console.error(
    "Fix: set both userHeroes and userHeroesById together, or use setUserHeroesState(set, heroes).\n"
  );
  process.exit(1);
}

console.log("[guard:user-heroes-map] ✅ userHeroes/userHeroesById sync enforced.");
