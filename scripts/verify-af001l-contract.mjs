import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [packageText, defaultPlaywright, hardwarePlaywright, hardwareSpec, workflow] = await Promise.all([
  read("package.json"), read("playwright.config.ts"), read("playwright.af001l.config.ts"), read("tests/hardware/asset-forge-af001l.spec.ts"), read(".github/workflows/asset-forge-af001l-target-hardware.yml")
]);
const pkg = JSON.parse(packageText);
assert.equal(pkg.scripts["bench:af001l:hardware"], "playwright test --config=playwright.af001l.config.ts");
assert.equal(pkg.scripts["verify:af001l:contract"], "node scripts/verify-af001l-contract.mjs");
assert.match(defaultPlaywright, /testDir:\s*"\.\/tests\/browser"/); assert.doesNotMatch(defaultPlaywright, /tests\/hardware/);
assert.match(hardwarePlaywright, /testDir:\s*"\.\/tests\/hardware"/); assert.match(hardwarePlaywright, /workers:\s*1/); assert.match(hardwarePlaywright, /headless:\s*false/); assert.match(hardwarePlaywright, /--enable-gpu/); assert.match(hardwarePlaywright, /--ignore-gpu-blocklist/);
for (const token of [
  "AF001L_HARDWARE_ID", "AF001L_PHYSICAL_ATTESTATION", "AF001L_RUNNER_NAME", "AF001L_RUNNER_OS", "AF001L_RUNNER_ARCH", "AF001L_RUNNER_CONTEXT", "PHYSICAL_HARDWARE_CONFIRMED", "self-hosted:tehkne-af001l", "WEBGL_debug_renderer_info", "swiftshader", "llvmpipe", "software renderer",
  "TS_ELEC_MOTOR_DC_A", "0.6.6-hero-candidate", "0.6.5-hero-candidate", "243_848", "3_292",
  "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c", "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552", "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8", "glb-json-v1",
  "MAX_AVERAGE_FRAME_MS = 100", "MAX_P95_FRAME_MS = 150", "MIN_BENCHMARK_SAMPLES = 30", "three-quarter", "front", "side", "rear", "bearing", "terminals", "TARGET_HARDWARE_PASS"
]) assert.ok(hardwareSpec.includes(token), `AF-001L hardware spec missing contract token: ${token}`);
assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /pull_request:/); assert.match(workflow, /runs-on:\s*\[self-hosted,\s*tehkne-af001l\]/); assert.match(workflow, /AF001L_RUNNER_CONTEXT:\s*["']?self-hosted:tehkne-af001l["']?/); assert.match(workflow, /AF001L_RUNNER_NAME:\s*\$\{\{\s*runner\.name\s*\}\}/); assert.match(workflow, /AF001L_RUNNER_OS:\s*\$\{\{\s*runner\.os\s*\}\}/); assert.match(workflow, /AF001L_RUNNER_ARCH:\s*\$\{\{\s*runner\.arch\s*\}\}/); assert.match(workflow, /npm run verify:af001l:contract/); assert.match(workflow, /npm run bench:af001l:hardware/); assert.match(workflow, /test-results\/af001l-hardware-evidence/); assert.match(workflow, /actions\/upload-artifact@v7/);
const hardwareJob = workflow.split("target-hardware:")[1] ?? ""; assert.ok(hardwareJob, "AF-001L target-hardware job is required"); assert.doesNotMatch(hardwareJob, /runs-on:\s*ubuntu-/i); assert.doesNotMatch(hardwareJob, /runs-on:\s*windows-/i); assert.doesNotMatch(hardwareJob, /runs-on:\s*macos-/i);
console.log("AF-001L contract PASS · physical self-hosted target-hardware gate only · headful GPU + strict v0.6.6 fingerprint + v0.6.5 source attestation + GPU attestation + six views + <100/<150 thresholds · GOLDEN_ASSET promotion remains blocked until physical evidence exists · Tehkné Solutions");
