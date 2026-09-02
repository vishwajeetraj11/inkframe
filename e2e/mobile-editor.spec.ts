import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 700 } });

test("mobile editor keeps every workspace available and touch safe", async ({ page }) => {
  await page.goto("/editor");

  const workspaceNav = page.getByRole("navigation", { name: "Editor workspace" });
  await expect(workspaceNav).toBeVisible();
  await expect(page.getByText("Program monitor")).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.width);

  for (const label of ["Media", "Canvas", "Timeline", "Inspector"]) {
    const target = workspaceNav.getByRole("button", { name: label });
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  const navBox = await workspaceNav.boundingBox();
  expect(Math.round((navBox?.y ?? 0) + (navBox?.height ?? 0))).toBe(700);

  await workspaceNav.getByRole("button", { name: "Timeline" }).click();
  const addText = page.getByTitle("Add text layer");
  await expect(addText).toBeVisible();
  expect((await addText.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await addText.click();

  await workspaceNav.getByRole("button", { name: "Canvas" }).click();
  await expect(page.getByText("3.00s", { exact: true })).toBeVisible();

  await workspaceNav.getByRole("button", { name: "Inspector" }).click();
  await expect(page.getByRole("textbox", { name: "Text" })).toHaveValue("New text");

  // Next.js's development-only debug bubble occupies the bottom-left corner.
  // Force the click here so the test exercises the production interaction.
  await workspaceNav
    .getByRole("button", { name: "Media" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("button", { name: /Import footage/i })).toBeVisible();
  await page.locator("#media-upload").setInputFiles(
    "public/starter-assets/berlin-wall/brandenburg-gate-crowds-1989.jpg",
  );
  await page.getByRole("button", { name: /Delete brandenburg-gate-crowds-1989/i }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toBeVisible();
  await page.waitForTimeout(450);
  const toastBox = await toast.boundingBox();
  expect(Math.round((toastBox?.y ?? 0) + (toastBox?.height ?? 0))).toBeLessThanOrEqual(
    Math.round(navBox?.y ?? 0) - 12,
  );

  await workspaceNav.getByRole("button", { name: "Timeline" }).click();
  await page.getByTitle("Add timeline track").click();
  const menu = page.getByRole("menu", { name: "Add track" });
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  expect(menuBox?.x).toBeGreaterThanOrEqual(0);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
});
