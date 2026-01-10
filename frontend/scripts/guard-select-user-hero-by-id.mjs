#!/usr/bin/env node
/**
 * guard-select-user-hero-by-id.mjs
 * 
 * Ensures selectUserHeroById uses O(1) map lookup as the primary path.
 * Prevents regression to array-only .find() lookup.
 * 
 * Usage:
 *   node scripts/guard-select-user-hero-by-id.mjs
 * 
 * Add to CI:
 *   "scripts": { "guard:select-hero": "node scripts/guard-select-user-hero-by-id.mjs" }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, "..", "stores", "gameStore.ts");

if (!fs.existsSync(filePath)) {
  console.error("[guard:selectUserHeroById] ❌ gameStore.ts not found");
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");

// Locate selectUserHeroById block
const selectorMatch = src.match(
  /selectUserHeroById\s*:\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\},/m
);

if (!selectorMatch) {
  console.error("[guard:selectUserHeroById] ❌ selectUserHeroById not found");
  process.exit(1);
}

const body = selectorMatch[1];

// Guard conditions
const usesMap = body.includes("userHeroesById");
const usesFind = body.includes(".find(");
const mapIndex = body.indexOf("userHeroesById");
const findIndex = body.indexOf(".find(");

if (!usesMap) {
  console.error(`
[guard:selectUserHeroById] ❌ selectUserHeroById does NOT reference userHeroesById.

This selector must be O(1). Do not revert to array-only lookup.

Expected pattern:
  const hit = userHeroesById[key];
`);
  process.exit(1);
}

if (usesFind && mapIndex > findIndex) {
  console.error(`
[guard:selectUserHeroById] ❌ .find() is executed before map lookup.

Map lookup must be primary. Array find may exist ONLY as fallback.
`);
  process.exit(1);
}

console.log("[guard:selectUserHeroById] ✅ O(1) selector enforced.");
