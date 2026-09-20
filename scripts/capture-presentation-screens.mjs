import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("docs/presentations/assets");

async function pause(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickIfVisible(page, pattern) {
  const button = page.getByRole("button", { name: pattern });
  if ((await button.count()) > 0) {
    await button.first().click();
    return true;
  }
  return false;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await pause(1000);
  await page.screenshot({ path: path.join(outDir, "01-new-project.png"), fullPage: true });

  await page.getByRole("button", { name: /Run guided workflow/ }).click();
  await pause(900);
  await page.screenshot({ path: path.join(outDir, "02-requirements.png"), fullPage: true });

  const approveButtons = page.getByRole("button", { name: /^Approve$/ });
  const count = await approveButtons.count();
  for (let i = 0; i < count; i += 1) {
    await approveButtons.nth(i).click();
    await pause(100);
  }
  await page.getByRole("button", { name: /Approve requirements/ }).click();
  await pause(1200);
  await page.screenshot({ path: path.join(outDir, "03-task-plan.png"), fullPage: true });

  await page.getByRole("button", { name: /Approve plan/ }).click();
  await page.getByRole("heading", { name: /Review outputs/ }).waitFor({ timeout: 25000 });
  await pause(1000);
  await page.screenshot({ path: path.join(outDir, "04-review-outputs.png"), fullPage: true });

  await browser.close();
  console.log(outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
