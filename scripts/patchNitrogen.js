#!/usr/bin/env node
/**
 * apply-patch.js
 * Applies a patch file to the current directory
 * 
 * Usage:
 *   node scripts/apply-patch.js <patchfile>
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get patch file from arguments
const patchFile = process.argv[2];

if (!patchFile) {
  console.error("Usage: node scripts/apply-patch.js <patchfile>");
  console.error("Example: node scripts/apply-patch.js patches/my-fix.patch");
  process.exit(1);
}

try {
  // Check if we're in a git repository
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });

  // Check if patch file exists
  const patchPath = path.resolve(process.cwd(), patchFile);
  if (!fs.existsSync(patchPath)) {
    console.error(`❌ Patch file not found: ${patchPath}`);
    process.exit(1);
  }

  console.log(`Applying patch: ${patchFile}`);

  // Apply the patch
  execSync(`git apply --binary --3way --whitespace=nowarn "${patchPath}"`, {
    stdio: "inherit",
    encoding: "utf8"
  });

  console.log("✅ Patch applied successfully!");

} catch (err) {
  console.error("❌ Failed to apply patch");
  console.error(err.message);
  process.exit(1);
}