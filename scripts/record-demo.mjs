import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("docs/demo-recordings");

async function pause(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await pause(1800);

  await page.getByRole("button", { name: "Run guided workflow" }).click();
  await pause(1600);

  const approveButtons = page.getByRole("button", { name: "Approve", exact: true });
  const approveCount = await approveButtons.count();
  for (let i = 0; i < approveCount; i += 1) {
    await approveButtons.nth(i).click();
    await pause(220);
  }

  await pause(800);
  await page.getByRole("button", { name: /Approve requirements/ }).click();
  await pause(2200);

  await page.getByRole("button", { name: /Approve plan & run agents/ }).click();
  await page.getByRole("heading", { name: "Review outputs" }).waitFor({
    timeout: 20000,
  });
  await pause(3200);

  // Approve outputs individually, leaving the first one for a targeted revision.
  const outputApprovals = page.getByRole("button", { name: "Approve output", exact: true });
  for (let i = 1; i < await outputApprovals.count(); i += 1) {
    await outputApprovals.nth(i).click();
  }
  await page.getByRole("button", { name: "Request revision", exact: true }).first().click();
  await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
  await pause(1800);

  await page.getByPlaceholder(/Expand the UI screens list/).fill(
    "Clarify the acceptance criteria for this planning output.",
  );
  await pause(1200);

  await page.getByRole("button", { name: /Apply feedback/ }).click();
  await page.getByRole("heading", { name: "Review outputs", exact: true }).waitFor();
  await pause(1800);
  await page.getByRole("button", { name: "Approve output", exact: true }).first().click();
  await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
  await page.getByRole("button", { name: "Skip revisions & finalize approved plan", exact: true }).click();
  await page.getByRole("heading", { name: "Final project plan" }).waitFor({
    timeout: 10000,
  });
  await pause(3200);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("No video was recorded.");
  }

  const rawPath = await video.path();
  const finalPath = path.join(outputDir, "projectpilot-ai-demo.webm");
  await fs.rename(rawPath, finalPath);
  console.log(finalPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
