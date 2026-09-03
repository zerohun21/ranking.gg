import { test, expect, type Page } from "@playwright/test";

const enc = (s: string) => encodeURIComponent(s);

async function guestLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /게스트|guest/i }).first().click();
  await expect(page.locator('header a[href="/login"]')).toBeHidden({ timeout: 20000 });
}

test.describe("ranking.gg smoke", () => {
  test("home renders hero, top10, stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/티어표 보기|View tier list/).first()).toBeVisible();
    await expect(page.getByText(/오늘의 통계|Today's stats/).first()).toBeVisible();
    await expect(page.getByText(/지금 급상승|Rising now/).first()).toBeVisible();
  });

  for (const cat of ["webtoon", "music"]) {
    test(`ranking ${cat} lists 50 rows and filters reflect in URL`, async ({ page, isMobile }) => {
      await page.goto(`/ranking/${cat}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/티어표|Tier List/);
      const rows = page.locator("main ul > li");
      await expect(rows).toHaveCount(50, { timeout: 20000 });
      if (!isMobile) {
        await page.waitForLoadState("networkidle"); // 하이드레이션 대기
        const tierS = page.getByRole("button", { name: "Tier S" }).first();
        await expect(tierS).toHaveAttribute("aria-pressed", "false");
        await tierS.click();
        await expect(page).toHaveURL(/tier=S/, { timeout: 15000 });
        await page.getByRole("button", { name: /티어 보드|Tier board/ }).click();
        await expect(page).toHaveURL(/view=board/, { timeout: 15000 });
      }
    });
  }

  test("search autocomplete + results page", async ({ page }) => {
    await page.goto("/search");
    const input = page.getByRole("searchbox").or(page.getByPlaceholder(/검색어|Type to search/)).first();
    await input.fill("사랑");
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10000 });
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("사랑");
  });

  test("guest login → rate → review → comment → battle vote → profile", async ({ page, request }) => {
    test.setTimeout(120000);
    // 1) pick a top content
    const hits = await (await request.get("/api/search?q=%EA%B3%A0%EC%88%98")).json();
    const hit = hits[0];
    expect(hit).toBeTruthy();
    await guestLogin(page);

    // 2) rate 5.0
    await page.goto(`/c/${hit.categorySlug}/${enc(hit.slug)}`);
    const before = await page.locator("text=/\\d+명 평가|\\d+ ratings/").first().textContent();
    const stars = page.getByRole("radiogroup", { name: "rating" }).first();
    const fifth = stars.getByRole("radio").nth(4);
    const box = await fifth.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.reload();
    const after = await page.locator("text=/\\d+명 평가|\\d+ ratings/").first().textContent();
    expect(after).not.toBe(before);

    // 3) review
    await page.getByPlaceholder(/솔직히 어땠나요|Honestly/).fill("1등이랑 비교가 되냐 ㅋㅋ 이건 S티어 맞다. 별 다섯 개 아깝지 않다.");
    await page.getByRole("button", { name: /^등록$|^Submit$/ }).first().click();
    await expect(page.locator("text=1등이랑 비교가 되냐").first()).toBeVisible({ timeout: 15000 });

    // 4) comment on first review thread
    const replyBtn = page.getByRole("button", { name: /답글|replies/i }).first();
    await replyBtn.click();
    const ta = page.getByPlaceholder(/댓글을 남겨보세요|Write a comment/).first();
    await ta.fill("2등이 말이 되냐");
    await ta.locator("xpath=following::button[1]").click();
    await expect(page.locator("text=2등이 말이 되냐").first()).toBeVisible({ timeout: 15000 });

    // 5) battle vote ×2
    await page.goto("/battle");
    for (let i = 0; i < 2; i++) {
      await page.locator('[role="button"][aria-pressed]').first().click();
      await expect(page.locator("text=/\\d+%/").first()).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: /다음 대결|Next battle/ }).click();
      await page.waitForTimeout(500);
    }

    // 6) profile reflects rating
    await page.locator("header button").last().click();
    await page.getByRole("menuitem", { name: /프로필|Profile/ }).click();
    await expect(page).toHaveURL(/\/u\//);
    await expect(page.locator("text=/평가 수|Ratings/").first()).toBeVisible();
  });

  test("theme + locale toggles", async ({ page }) => {
    await page.goto("/");
    const lang = page.locator('header button[aria-label="언어"], header button[aria-label="Language"]');
    const theme = page.locator('header button[aria-label="테마"], header button[aria-label="Theme"]');
    await lang.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15000 });
    await expect(page.getByText("Rising now").first()).toBeVisible();
    await theme.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await lang.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko", { timeout: 15000 });
  });

  test("community board + post page", async ({ page }) => {
    await page.goto("/community/webtoon");
    const first = page.locator("main ul li a").first();
    await first.click();
    await expect(page).toHaveURL(/\/community\/webtoon\/\d+/);
    await expect(page.locator("article h1")).toBeVisible();
  });

  test("user category exists (ramen)", async ({ page }) => {
    await page.goto("/ranking/ramen");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/라면|Ramen/);
    await expect(page.locator("main ul > li").first()).toBeVisible();
  });
});
