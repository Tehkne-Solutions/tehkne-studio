import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "package-lock.json",
  "apps/studio-web/app/api/health/route.ts",
  "playwright.config.ts",
  "tests/browser/alpha01.spec.ts"
];
for (const path of required) await access(resolve(path));

try {
  await access(resolve(".github/workflows/bootstrap-lock.yml"));
  throw new Error("S2.1 temporary write-enabled lock bootstrap must not ship");
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
if (rootPackage.packageManager !== "npm@11.17.0") throw new Error("S2.1 npm runtime pin missing");
if (rootPackage.overrides?.postcss !== "8.5.25") throw new Error("S2.1 PostCSS security override missing");
if (rootPackage.overrides?.sharp !== "0.35.3") throw new Error("S2.1 sharp security override missing");
if (rootPackage.devDependencies?.["@playwright/test"] !== "1.62.1") throw new Error("S2.1 Playwright pin missing");
if (rootPackage.scripts?.["security:audit"] !== "npm audit --audit-level=high") throw new Error("S2.1 security audit script missing");
if (!rootPackage.scripts?.["smoke:browser"]?.includes("playwright test")) throw new Error("S2.1 browser smoke script missing");
if (lock.lockfileVersion !== 3) throw new Error("S2.1 requires npm lockfile v3");
if (lock.version !== rootPackage.version) throw new Error("S2.1 package-lock root version mismatch");
if (lock.packages?.["node_modules/postcss"]?.version !== rootPackage.overrides.postcss) {
  throw new Error("S2.1 locked PostCSS version diverged from security policy");
}
if (lock.packages?.["node_modules/sharp"]?.version !== rootPackage.overrides.sharp) {
  throw new Error("S2.1 locked sharp version diverged from security policy");
}
if (lock.packages?.["node_modules/@playwright/test"]?.version !== rootPackage.devDependencies["@playwright/test"]) {
  throw new Error("S2.1 locked Playwright version diverged from browser evidence policy");
}

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "actions/checkout@v6",
  "actions/setup-node@v6",
  "node-version: 24",
  "contents: read",
  "npm ci --ignore-scripts",
  "npm run security:audit",
  "npm run verify:s1.12",
  "npm run verify:s2.1",
  "npx playwright install --with-deps chromium",
  "npm run smoke:browser",
  "s2-01-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.1 workflow contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.1 final CI must remain read-only");

const health = await readFile("apps/studio-web/app/api/health/route.ts", "utf8");
for (const token of [
  'status: "ok"',
  'releaseChannel: "alpha"',
  'releaseGate: "alpha-01"',
  "productionReady: false",
  "physicalPrototypeReady: false",
  'signature: "Tehkné Solutions"',
  '"Cache-Control": "no-store, max-age=0"'
]) {
  if (!health.includes(token)) throw new Error(`S2.1 health contract missing: ${token}`);
}
if (health.includes("productionReady: true") || health.includes("physicalPrototypeReady: true")) {
  throw new Error("S2.1 health contract must not overclaim readiness");
}

const browser = await readFile("tests/browser/alpha01.spec.ts", "utf8");
for (const token of [
  'request.get("/api/health")',
  'getByRole("button", { name: "Chamar Desktop PC" })',
  'command.fill("Abra o computador")',
  'getByRole("button", { name: "Chamar ARM-01" })',
  'getByLabel("ARM-01 Robotics Runtime")',
  'page.on("pageerror"',
  'message.type() === "error"',
  "expect(pageErrors",
  "expect(consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.1 browser evidence missing: ${token}`);
}

console.log("S2.1 hardening structure PASS · locked dependencies + zero-high audit + Node 24 read-only CI + runtime health + Chromium smoke · Tehkné Solutions");
