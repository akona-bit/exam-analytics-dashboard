export default async function run(page, ui) {
  await page
    .locator("#lookup-name")
    .fill("Đỗ Phạm Tuấn Khang", { timeout: 15000 });
  await page.locator("#lookup-password").fill("210001");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4500);
  const modal = await page
    .getByRole("button", { name: "Đóng thư cảm ơn" })
    .count();
  if (modal)
    await page.getByRole("button", { name: "Đóng thư cảm ơn" }).click();
  await page.waitForTimeout(800);
  const cls = await page.getByRole("button", { name: "Toàn khóa" }).count();
  if (cls)
    await page.getByRole("button", { name: "Toàn khóa" }).first().click();
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("h4")).find((e) =>
      e.textContent?.includes("Chi Tiết 120 Câu Hỏi"),
    );
    if (el)
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "d:/PROJECT/kết-quả-khảo-sát/.g1.png" });
  return {
    ok: true,
    modal,
    cls,
    scroll: await page.evaluate(() => Math.round(window.scrollY)),
  };
}
