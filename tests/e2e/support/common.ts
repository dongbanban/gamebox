import { expect, type Page } from "@playwright/test";

export async function resetPage(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

export async function confirmDogLoadout(page: Page): Promise<void> {
  const panel = page.getByTestId("dog-loadout-panel");
  if (!(await panel.isVisible().catch(() => false))) {
    return;
  }

  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    await page.locator(
      `[data-testid="dog-loadout-option"][data-loadout-id="${itemId}"]`,
    ).click();
  }
  await page.getByTestId("dog-loadout-confirm").click();
  await expect(page.getByTestId("dog-loadout-summary")).toBeVisible();
}

export async function acceptBeforeUnload<T>(
  page: Page,
  action: () => Promise<T>,
): Promise<T> {
  const dialogPromise = page.waitForEvent("dialog");
  const actionPromise = action();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  return actionPromise;
}
