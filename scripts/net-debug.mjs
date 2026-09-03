import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("response", (r) => { if (r.status() >= 400) console.log("FAIL", r.status(), r.url().slice(0, 160)); });
await page.goto("http://localhost:3000/ranking/webtoon", { waitUntil: "networkidle" });
const t0 = Date.now();
// hydration probe: wait until React attached (button click toggles aria-pressed via state)
const btn = page.getByRole("button", { name: "Tier S" }).first();
for (let i = 0; i < 20; i++) {
  await btn.click();
  await page.waitForTimeout(300);
  const url = page.url();
  if (/tier=S/.test(url)) { console.log("navigated after", i + 1, "clicks,", Date.now() - t0, "ms", url); break; }
  if (i === 19) console.log("never navigated; url", url);
}
await browser.close();
