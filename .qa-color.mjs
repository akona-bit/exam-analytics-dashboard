export default async function run(page, ui) {
  await page
    .locator("#lookup-name")
    .fill("Đỗ Phạm Tuấn Khang", { timeout: 15000 });
  await page.locator("#lookup-password").fill("210001");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  await page
    .getByRole("button", { name: "Đóng thư cảm ơn" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Tổng quan' }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll(".recharts-wrapper")).find(
      (x) => x.querySelector(".recharts-polar-grid"),
    );
    if (r) window.scrollBy(0, r.getBoundingClientRect().top - 110);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "d:/PROJECT/kết-quả-khảo-sát/.c1.png" });
  return { ok: true };
}
