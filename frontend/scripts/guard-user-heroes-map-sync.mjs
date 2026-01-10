#!/usr/bin/env node
/**
 * guard-user-heroes-map-sync.mjs
 * 
 * Ensures that whenever userHeroes is set, userHeroesById is also set.
 * Prevents cache desync between list and map.
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
  console.error("[guard:userHeroesById] ❌ gameStore.ts not found");
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");

// Find any "set({ userHeroes:" or "set((s) => ({ userHeroes:" occurrences
const hits = [];

// Pattern 1: set({ userHeroes: ... })
const re1 = /set\s*\(\s*\{[^}]*userHeroes\s*:/g;
let m;
while ((m = re1.exec(src))) {
  const start = m.index;
  const snippet = src.slice(start, start + 300);
  hits.push({ start, snippet, type: 'set({' });
}

// Pattern 2: set((s) => ({ userHeroes: ... }))
const re2 = /set\s*\(\s*\([^)]*\)\s*=>\s*\(?[^}]*userHeroes\s*:/g;
while ((m = re2.exec(src))) {
  const start = m.index;
  const snippet = src.slice(start, start + 400);
  hits.push({ start, snippet, type: 'set((s) =>' });
}

// Check each hit for userHeroesById
const bad = hits.filter(h => !h.snippet.includes("userHeroesById"));

// Also check for setUserHeroesState usage (which is allowed)
const allowedPatterns = bad.filter(h => !h.snippet.includes("setUserHeroesState"));

if (allowedPatterns.length) {
  console.error("\n[guard:userHeroesById] ❌ Found set({ userHeroes: ... }) not accompanied by userHeroesById.\n");
  for (const b of allowedPatterns) {
    console.error(`- Near index ${b.start} (${b.type}):\n${b.snippet.slice(0, 150)}...\n---`);
  }
  console.error("Fix: use setUserHeroesState(set, heroes) OR set both userHeroes and userHeroesById together.\n");
  process.exit(1);
}

console.log("[guard:userHeroesById] ✅ userHeroes/userHeroesById sync enforced.");
