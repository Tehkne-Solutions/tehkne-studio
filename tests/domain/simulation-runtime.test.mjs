import test from "node:test";
import assert from "node:assert/strict";
import { runFunctionalBoot } from "../../dist/packages/simulation-runtime/src/index.js";

const healthy = [
  { id: "mb", type: "Motherboard", name: "Motherboard", available: true, reason: "platform initialization" },
  { id: "cpu", type: "Processor", name: "CPU", available: true, reason: "instruction execution" },
  { id: "ram", type: "MemoryModule", name: "RAM", available: true, reason: "memory initialization" },
  { id: "storage", type: "StorageDevice", name: "Storage", available: true, reason: "boot media" }
];

test("S1.5 functional boot reaches RUNNING when all dependencies are available", () => {
  const result = runFunctionalBoot(healthy);
  assert.equal(result.status, "success");
  assert.equal(result.finalStage, "RUNNING");
  assert.equal(result.fault, null);
  assert.deepEqual(result.timeline.map((step) => step.stage), [
    "POWERING", "POST", "MEMORY_CHECK", "STORAGE_CHECK", "BOOT", "RUNNING"
  ]);
});

test("S1.5 functional boot fails specifically at MEMORY_CHECK when RAM is unavailable", () => {
  const result = runFunctionalBoot(
    healthy.map((dependency) => dependency.id === "ram" ? { ...dependency, available: false } : dependency)
  );
  assert.equal(result.status, "failure");
  assert.equal(result.fault?.entityId, "ram");
  assert.equal(result.fault?.stage, "MEMORY_CHECK");
  assert.equal(result.fault?.code, "MEMORY_UNAVAILABLE");
  assert.equal(result.timeline.at(-1)?.stage, "FAULT");
});
