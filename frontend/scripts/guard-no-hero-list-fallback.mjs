#!/usr/bin/env node
/**
 * guard-no-hero-list-fallback.mjs
 * 
 * Ensures that when SINGLE_HERO_ENDPOINT_AVAILABLE = true, there is NO runtime
 * path to list-fetch inside getUserHeroById. The fallback code may exist but
 * must be unreachable.
 * 
 * Usage:
 *   node scripts/guard-no-hero-list-fallback.mjs
 * 
 * Add to CI/pre-commit:
 *   "scripts": { "guard:hero": "node scripts/guard-no-hero-list-fallback.mjs" }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiPath = path.resolve(__dirname, "..", "lib", "api.ts");

let src;
try {
  src = fs.readFileSync(apiPath, "utf8");
} catch (e) {
  console.error(`[guard:no-hero-list-fallback] Could not read ${apiPath}`);
  process.exit(1);
}

function fail(msg) {
  console.error(`\n[guard:no-hero-list-fallback] ❌ ${msg}\n`);
  process.exit(1);
}

// 1) Flag must be a literal `true as const` / `false as const` so runtime path is knowable.
const flagMatch = src.match(
  /const\s+SINGLE_HERO_ENDPOINT_AVAILABLE\s*=\s*(true|false)\s+as\s+const\s*;/
);
if (!flagMatch) {
  fail(
    "Could not find SINGLE_HERO_ENDPOINT_AVAILABLE literal (expected `true as const` or `false as const`)."
  );
}
const flagValue = flagMatch[1]; // "true" | "false"

if (flagValue !== "true") {
  console.log("[guard:no-hero-list-fallback] ℹ️  Flag is false — fallback may be reachable (allowed).");
  process.exit(0);
}

// 2) Extract getUserHeroById function body (best-effort, but stable for your style).
const fnStart = src.indexOf("export async function getUserHeroById");
if (fnStart === -1) fail("Could not find `export async function getUserHeroById`.");

const fnSlice = src.slice(fnStart);
const braceOpen = fnSlice.indexOf("{");
if (braceOpen === -1) fail("Could not find opening `{` for getUserHeroById.");

let i = braceOpen;
let depth = 0;
let inStr = null; // ' or " or `
let escaped = false;

for (; i < fnSlice.length; i++) {
  const ch = fnSlice[i];

  if (inStr) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === inStr) {
      inStr = null;
      continue;
    }
    continue;
  } else {
    if (ch === "'" || ch === '"' || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++; // include closing brace
        break;
      }
    }
  }
}

const fnBody = fnSlice.slice(0, i);
if (!fnBody.includes("SINGLE_HERO_ENDPOINT_AVAILABLE")) {
  fail("getUserHeroById does not reference SINGLE_HERO_ENDPOINT_AVAILABLE.");
}

// 3) Must have an explicit early-exit guard when flag is true.
const ifIdx = fnBody.indexOf("if (SINGLE_HERO_ENDPOINT_AVAILABLE)");
if (ifIdx === -1) {
  fail("Missing `if (SINGLE_HERO_ENDPOINT_AVAILABLE)` guard in getUserHeroById.");
}

// 4) Ensure inside the enabled-flag block, control flow ALWAYS exits (return or throw).
// Best-effort checks for your current structure (try { return res.data } catch { throw ... }).
const enabledBlock = fnBody.slice(ifIdx);

// Find end of the enabled if-block (best-effort: first matching closing brace after it)
const enabledOpen = enabledBlock.indexOf("{");
if (enabledOpen === -1) fail("Could not find `{` after `if (SINGLE_HERO_ENDPOINT_AVAILABLE)`.");

let j = enabledOpen;
let d2 = 0;
let inStr2 = null;
let esc2 = false;

for (; j < enabledBlock.length; j++) {
  const ch = enabledBlock[j];

  if (inStr2) {
    if (esc2) {
      esc2 = false;
      continue;
    }
    if (ch === "\\") {
      esc2 = true;
      continue;
    }
    if (ch === inStr2) {
      inStr2 = null;
      continue;
    }
    continue;
  } else {
    if (ch === "'" || ch === '"' || ch === "`") {
      inStr2 = ch;
      continue;
    }
    if (ch === "{") d2++;
    if (ch === "}") {
      d2--;
      if (d2 === 0) {
        j++; // include closing brace
        break;
      }
    }
  }
}

const enabledIfBlock = enabledBlock.slice(0, j);

// Must contain a return in the success path
const hasReturn = /return\s+res\.data\s*;/.test(enabledIfBlock) || /return\s+/.test(enabledIfBlock);
// Must contain a throw in the catch path (or otherwise guarantee exit)
const hasThrow = /catch\s*\([^)]*\)\s*\{[\s\S]*throw\s+new\s+Error\s*\(/.test(enabledIfBlock) || /throw\s+/.test(enabledIfBlock);

if (!hasReturn) {
  fail("When SINGLE_HERO_ENDPOINT_AVAILABLE is true, enabled-branch must return (no fallthrough).");
}
if (!hasThrow) {
  fail("When SINGLE_HERO_ENDPOINT_AVAILABLE is true, enabled-branch must throw on failure (no list fallback).");
}

// 5) Now enforce: any list fetch patterns MUST NOT appear inside the enabled-flag block.
// They may exist AFTER the block (unreachable at runtime when flag is true).
const listPatterns = [
  /getUserHeroes\s*\(/,
  /api\.get\(\s*`\/user\/\$\{encodeURIComponent\(u\)\}\/heroes`\s*\)/,
  /api\.get\(\s*["']\/user\/\$\{encodeURIComponent\(u\)\}\/heroes["']\s*\)/,
  /\/user\/\$\{encodeURIComponent\(u\)\}\/heroes/,
];

for (const re of listPatterns) {
  if (re.test(enabledIfBlock)) {
    fail(
      `Flag is true, but list-fetch pattern appears inside enabled-branch (runtime reachable): ${re}`
    );
  }
}

console.log(
  "[guard:no-hero-list-fallback] ✅ Flag is true and there is no runtime path to list fetch (fallback may exist but is unreachable)."
);
