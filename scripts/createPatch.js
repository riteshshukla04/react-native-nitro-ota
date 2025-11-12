#!/usr/bin/env node
/**
 * make-patch.js
 * Creates a patch file from all current changes (staged and unstaged)
 * 
 * Usage:
 *   node scripts/make-patch.js [output-filename]
 * 
 * If no filename is provided, generates one with timestamp.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get output filename from args or generate timestamp-based name
const outputFile = process.argv[2] || (() => {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `patch-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.patch`;
})();

try {
  // Check if we're in a git repository
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });

  // Create diff of all changes (staged + unstaged + untracked)
  console.log("Creating patch from all changes...");
  
  // Stage untracked files temporarily (without content)
  execSync("git add -N .", { stdio: "ignore" });
  
  // Generate the patch
  const patch = execSync("git diff HEAD --binary", { 
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024 // 100MB buffer
  });

  if (!patch.trim()) {
    console.log("No changes found. Nothing to patch.");
    process.exit(0);
  }

  // Write patch file
  const outputPath = path.resolve(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, patch, "utf8");

  console.log(`✅ Patch created successfully: ${outputPath}`);
  console.log(`   To apply: node scripts/apply-patch.js ${outputFile}`);

} catch (err) {
  console.error("❌ Error creating patch:");
  console.error(err.message);
  process.exit(1);
}