import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3000";
const targets = process.argv.slice(2);
const browser = await chromium.launch();
for (const t of targets) {
  const [path, name, mobile] = t.split("|");
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log("shot", name);
  await ctx.close();
}
await browser.close();
