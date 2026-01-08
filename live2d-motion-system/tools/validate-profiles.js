#!/usr/bin/env node

/**
 * Live2D Motion Profile Validator
 * 
 * Validates JSON motion profiles against schema v2.0 requirements.
 * 
 * CONSTRAINTS:
 * - READ-ONLY: Never modifies profile files
 * - BUILD-TIME: Not integrated into runtime
 * - STANDALONE: No Unity or Expo dependencies
 * 
 * Usage:
 *   node validate-profiles.js [path-to-profiles]
 * 
 * Exit Codes:
 *   0 = All profiles valid
 *   1 = One or more profiles invalid
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SCHEMA_VERSION = '2.0.0';
const RESTRICTED_STATES = ['idle', 'banner'];
const DISALLOWED_WAVEFORMS = ['square', 'sawtooth'];
const DEPRECATED_PARAMETERS = [
  'ParamBustX',
  'ParamBustY',
  'ParamBaseX',
  'ParamBaseY',
];
const REQUIRED_RATING_CLAMPS = [
  'ParamChestSoftX',
  'ParamChestSoftY',
];
const VALID_STATES = [
  'idle',
  'combat',
  'banner',
  'summon',
  'victory',
  'defeat',
  'dialogue',
  'special',
];
const VALID_WAVEFORMS = [
  'sine',
  'cosine',
  'triangle',
  'sawtooth',
  'square',
  'perlin',
];

// Validation results
let totalProfiles = 0;
let passedProfiles = 0;
let failedProfiles = 0;
const errors = [];

/**
 * Validate a single profile
 * @param {string} filePath - Path to JSON file
 * @returns {boolean} - True if valid
 */
function validateProfile(filePath) {
  const profileErrors = [];
  const fileName = path.basename(filePath);

  // Read file
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    profileErrors.push(`Cannot read file: ${e.message}`);
    return { valid: false, errors: profileErrors };
  }

  // Parse JSON
  let profile;
  try {
    profile = JSON.parse(content);
  } catch (e) {
    profileErrors.push(`Invalid JSON: ${e.message}`);
    return { valid: false, errors: profileErrors };
  }

  // 1. Check required fields
  if (!profile.id) {
    profileErrors.push('Missing required field: id');
  }
  if (!profile.schemaVersion) {
    profileErrors.push('Missing required field: schemaVersion');
  }
  if (!profile.state) {
    profileErrors.push('Missing required field: state');
  }
  if (profile.duration === undefined) {
    profileErrors.push('Missing required field: duration');
  }
  if (!profile.parameters) {
    profileErrors.push('Missing required field: parameters');
  }

  // 2. Validate schema version
  if (profile.schemaVersion && profile.schemaVersion !== SCHEMA_VERSION) {
    profileErrors.push(
      `Invalid schema version: ${profile.schemaVersion} (expected ${SCHEMA_VERSION})`
    );
  }

  // 3. Validate state
  if (profile.state && !VALID_STATES.includes(profile.state.toLowerCase())) {
    profileErrors.push(
      `Invalid state: ${profile.state} (valid: ${VALID_STATES.join(', ')})`
    );
  }

  // 4. Validate duration
  if (profile.duration !== undefined) {
    if (profile.duration < 0.1 || profile.duration > 60) {
      profileErrors.push(
        `Duration out of range: ${profile.duration} (valid: 0.1-60)`
      );
    }
  }

  // 5. Validate global modifiers
  if (profile.globalModifiers) {
    const { intensity, speed } = profile.globalModifiers;
    if (intensity !== undefined && (intensity < 0 || intensity > 2)) {
      profileErrors.push(
        `Global intensity out of range: ${intensity} (valid: 0.0-2.0)`
      );
    }
    if (speed !== undefined && (speed < 0.1 || speed > 3)) {
      profileErrors.push(
        `Global speed out of range: ${speed} (valid: 0.1-3.0)`
      );
    }
  }

  // 6. Check rating clamps (MANDATORY)
  if (!profile.ratingClamps) {
    profileErrors.push('CRITICAL: Missing required field: ratingClamps');
  } else {
    for (const clamp of REQUIRED_RATING_CLAMPS) {
      if (!profile.ratingClamps[clamp]) {
        profileErrors.push(`CRITICAL: Missing required rating clamp: ${clamp}`);
      }
    }
  }

  // 7. Check for deprecated parameters
  if (profile.parameters) {
    for (const param of Object.keys(profile.parameters)) {
      if (DEPRECATED_PARAMETERS.includes(param)) {
        profileErrors.push(
          `CRITICAL: Deprecated parameter used: ${param} (use approved names)`
        );
      }
    }
  }

  // 8. Validate waveforms for state safety
  const state = profile.state?.toLowerCase();
  const isRestrictedState = RESTRICTED_STATES.includes(state);

  if (profile.parameters && isRestrictedState) {
    for (const [paramName, motion] of Object.entries(profile.parameters)) {
      if (motion && motion.waveform) {
        const waveform = motion.waveform.toLowerCase();
        if (DISALLOWED_WAVEFORMS.includes(waveform)) {
          profileErrors.push(
            `CRITICAL: Disallowed waveform '${waveform}' for state '${state}' ` +
            `on parameter '${paramName}'. Only sine, cosine, perlin, triangle allowed.`
          );
        }
      }
    }
  }

  // 9. Validate individual parameters
  if (profile.parameters) {
    for (const [paramName, motion] of Object.entries(profile.parameters)) {
      if (!motion) continue;

      // Check waveform validity
      if (motion.waveform && !VALID_WAVEFORMS.includes(motion.waveform.toLowerCase())) {
        profileErrors.push(
          `Invalid waveform '${motion.waveform}' on parameter '${paramName}'`
        );
      }

      // Check amplitude range
      if (motion.amplitude !== undefined) {
        if (motion.amplitude < -1 || motion.amplitude > 1) {
          profileErrors.push(
            `Amplitude out of range on '${paramName}': ${motion.amplitude} (valid: -1.0 to 1.0)`
          );
        }
      }

      // Check frequency range
      if (motion.frequency !== undefined) {
        if (motion.frequency < 0.01 || motion.frequency > 10) {
          profileErrors.push(
            `Frequency out of range on '${paramName}': ${motion.frequency} (valid: 0.01-10.0)`
          );
        }
      }
    }
  }

  return {
    valid: profileErrors.length === 0,
    errors: profileErrors,
  };
}

/**
 * Scan directory for JSON files and validate each
 * @param {string} dirPath - Directory path
 */
function validateDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dirPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${dirPath}`);
    return;
  }

  console.log(`\n=== Validating ${jsonFiles.length} profiles in ${dirPath} ===\n`);

  for (const file of jsonFiles) {
    const filePath = path.join(dirPath, file);
    totalProfiles++;

    const result = validateProfile(filePath);

    if (result.valid) {
      console.log(`✅ PASS: ${file}`);
      passedProfiles++;
    } else {
      console.log(`❌ FAIL: ${file}`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
      failedProfiles++;
      errors.push({ file, errors: result.errors });
    }
  }
}

/**
 * Main entry point
 */
function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Live2D Motion Profile Validator v1.0.0              ║');
  console.log('║       Schema Version: 2.0.0                               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Get profiles directory
  const defaultPath = path.join(__dirname, '..', 'profiles', 'v2');
  const profilesPath = process.argv[2] || defaultPath;
  const isCustomPath = !!process.argv[2];

  // Validate profiles in specified path
  validateDirectory(profilesPath);

  // Also validate root profiles directory ONLY if using default path
  // (Skip when a custom path is provided for targeted validation)
  if (!isCustomPath) {
    const v1Path = path.join(__dirname, '..', 'profiles');
    const v1Files = fs.readdirSync(v1Path).filter(f => f.endsWith('.json'));
    if (v1Files.length > 0) {
      console.log('\n--- Also checking root profiles directory ---');
      for (const file of v1Files) {
        const filePath = path.join(v1Path, file);
        totalProfiles++;
        const result = validateProfile(filePath);
        if (result.valid) {
          console.log(`✅ PASS: ${file}`);
          passedProfiles++;
        } else {
          console.log(`❌ FAIL: ${file}`);
          for (const error of result.errors) {
            console.log(`   - ${error}`);
          }
          failedProfiles++;
        }
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                      VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total profiles:  ${totalProfiles}`);
  console.log(`  Passed:          ${passedProfiles}`);
  console.log(`  Failed:          ${failedProfiles}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failedProfiles > 0) {
    console.log('\n❌ VALIDATION FAILED - Fix errors before deployment\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL PROFILES VALID\n');
    process.exit(0);
  }
}

// Run
main();
