#!/usr/bin/env node
/**
 * Guard: Cinematics Codec Enforcement
 * 
 * Ensures all cinematic videos are in supported format:
 * - Video: H.264 (avc1)
 * - Audio: AAC (or no audio)
 * - Container: MP4
 * 
 * Uses ffprobe if available, falls back to extension check.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_PATH = path.resolve(__dirname, '../assets/videos');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}FAIL:${RESET} ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`${GREEN}PASS:${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}WARN:${RESET} ${msg}`);
}

console.log('\n============================================');
console.log('Guard: Cinematics Codec Enforcement');
console.log('============================================\n');

// Check if ffprobe is available
let ffprobeAvailable = false;
try {
  execSync('which ffprobe', { stdio: 'pipe' });
  ffprobeAvailable = true;
  console.log('Using ffprobe for codec detection\n');
} catch {
  warn('ffprobe not available - using file extension check only');
  console.log('Install ffmpeg for full codec validation\n');
}

// Check 1: Videos directory exists
console.log('Check 1: Videos directory exists...');
if (!fs.existsSync(VIDEOS_PATH)) {
  warn(`Videos directory not found: ${VIDEOS_PATH}`);
  console.log('No cinematics to validate.\n');
  pass('No cinematics present (OK)');
  process.exit(0);
}
pass('Videos directory exists');

// Check 2: Find all video files
console.log('\nCheck 2: Scanning for video files...');
const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
const videoFiles = [];

for (const ext of videoExtensions) {
  const files = glob.sync(path.join(VIDEOS_PATH, '**', `*.${ext}`));
  videoFiles.push(...files);
}

if (videoFiles.length === 0) {
  pass('No video files found (OK)');
  process.exit(0);
}
console.log(`Found ${videoFiles.length} video file(s)`);

// Check 3: Validate each video
console.log('\nCheck 3: Validating video codecs...');
const violations = [];
const validated = [];

for (const file of videoFiles) {
  const filename = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  
  // Skip temp/reencoded marker files
  if (filename.includes('_h264') || filename.includes('_reencoded')) {
    continue;
  }
  
  if (ffprobeAvailable) {
    try {
      // Get video codec
      const videoCodec = execSync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${file}"`,
        { stdio: 'pipe', encoding: 'utf8' }
      ).trim();
      
      // Get audio codec (may be empty)
      let audioCodec = '';
      try {
        audioCodec = execSync(
          `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${file}"`,
          { stdio: 'pipe', encoding: 'utf8' }
        ).trim();
      } catch {
        audioCodec = 'none';
      }
      
      // Validate codecs
      const isValidVideo = videoCodec === 'h264';
      const isValidAudio = audioCodec === 'aac' || audioCodec === 'none' || audioCodec === '';
      const isValidContainer = ext === '.mp4';
      
      if (!isValidVideo || !isValidAudio || !isValidContainer) {
        violations.push({
          file: filename,
          video: videoCodec,
          audio: audioCodec,
          container: ext,
          issues: [
            !isValidVideo && `video codec '${videoCodec}' (expected h264)`,
            !isValidAudio && `audio codec '${audioCodec}' (expected aac)`,
            !isValidContainer && `container '${ext}' (expected .mp4)`,
          ].filter(Boolean),
        });
      } else {
        validated.push(filename);
      }
    } catch (error) {
      violations.push({
        file: filename,
        issues: ['Failed to probe file'],
      });
    }
  } else {
    // Fallback: just check extension
    if (ext !== '.mp4') {
      violations.push({
        file: filename,
        container: ext,
        issues: [`container '${ext}' (expected .mp4)`],
      });
    } else {
      validated.push(filename);
    }
  }
}

// Report results
if (validated.length > 0) {
  console.log(`\n  Validated: ${validated.length} file(s)`);
}

if (violations.length > 0) {
  console.log(`\n  ${RED}Violations:${RESET}`);
  for (const v of violations) {
    console.log(`    - ${v.file}: ${v.issues.join(', ')}`);
  }
  fail(`${violations.length} video(s) have unsupported codec/container`);
}

pass(`All ${validated.length} cinematic(s) are H.264/AAC/MP4`);

console.log('\n============================================');
console.log(`${GREEN}Cinematics Codec guard PASSED!${RESET}`);
console.log('============================================\n');
