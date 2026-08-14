import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/app/api/health/route.ts",
  "playwright.config.ts",
  "tests/browser/alpha01.spec.ts"
];
for (const path of required) await access(resolve(path));

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.packageManager !== "npm@11.17.0") throw new Error("S2.1 npm runtime pin missing");
if (rootPackage.overrides?.postcss !== "8.5.25") throw new Error("S2.1 PostCSS security override missing");
if (rootPackage.overrides?.sharp !== "0.35.3") throw new Error("S2.1 sharp security override missing");
if (rootPackage.devDependencies?.["@playwright/test"] !== "1.62.1") throw new Error("S2.1 Playwright pin missing");
if (rootPackage.scripts?.["security:audit"] !== "npm audit --audit-level=high") throw new Error("S2.1 security audit script missing");
if (!rootPackage.scripts?.["smoke:browser"]?.includes("playwright test")) throw new Error("S2.1 browser smoke script missing");

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "actions/checkout@v6",
  "actions/setup-node@v6",
  "node-version: 24",
  "contents: read",
  "npm run security:audit",
  "npm run verify:s1.12",
  "npx playwright install --with-deps chromium",
  "npm run smoke:browser"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.1 workflow contract missing: ${token}`);
}

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

console.log("S2.1 hardening structure PASS · security audit + Node 24 CI + runtime health + Chromium smoke · Tehkné Solutions");
