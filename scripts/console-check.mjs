import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
for (const path of process.argv.slice(2)) {
  const page = await browser.newPage();
  const msgs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) msgs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => msgs.push(`pageerror: ${e.message.slice(0, 300)}`));
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => msgs.push("nav: " + e.message));
  await page.waitForTimeout(1500);
  console.log(`== ${path} ==`);
  for (const m of [...new Set(msgs)]) console.log(m);
  await page.close();
}
await browser.close();
