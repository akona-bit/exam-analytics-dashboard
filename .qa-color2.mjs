export default async function run(page, ui) {
  await page
    .locator("#lookup-name")
    .fill("Đỗ Phạm Tuấn Khang", { timeout: 15000 });
  await page.locator("#lookup-password").fill("210001");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  const modal = await page
    .getByRole("button", { name: "Đóng thư cảm ơn" })
    .count();
  if (modal)
    await page.getByRole("button", { name: "Đóng thư cảm ơn" }).click();
  await page.waitForTimeout(1200);
  const overview = await page
    .getByRole("button", { name: "Tổng quan" })
    .count();
  if (overview)
    await page.getByRole("button", { name: "Tổng quan" }).first().click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".card")).map(
      (c) => (c.querySelector("h2,h3") || {}).textContent || "",
    );
    return {
      cards: cards.slice(0, 8),
      body: document.body.innerText.slice(0, 150),
    };
  });
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("*")).find(
      (e) => e.textContent?.trim() === "Radar Điểm Theo Trung Vị Lớp",
    );
    if (el)
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "d:/PROJECT/kết-quả-khảo-sát/.c2.png" });
  return { ok: true, modal, overview, info };
}
