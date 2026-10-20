export default async function run(page, ui) {
  await page
    .locator("#lookup-name")
    .fill("Đỗ Phạm Tuấn Khang", { timeout: 15000 });
  await page.locator("#lookup-password").fill("210001");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4500);
  const hasModal = await page
    .getByRole("button", { name: "Đóng thư cảm ơn" })
    .count();
  if (hasModal) {
    await page.getByRole("button", { name: "Đóng thư cảm ơn" }).click();
    await page.waitForTimeout(1000);
  }
  const hasOverview = await page
    .getByRole("button", { name: "Tổng quan" })
    .count();
  if (hasOverview) {
    await page.getByRole("button", { name: "Tổng quan" }).first().click();
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("h3")).find(
      (e) => e.textContent?.indexOf("Radar Điểm") === 0,
    );
    if (el)
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "d:/PROJECT/kết-quả-khảo-sát/.c3.png" });
  return { ok: true, hasModal, hasOverview };
}
