export default async function run(page, ui) {
  await page.locator("#lookup-name").fill("Đỗ Phạm Tuấn Khang", { timeout: 15000 });
  await page.locator("#lookup-password").fill("210001");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  const err = await page.evaluate(() => {
    const t = document.body.innerText;
    const i = t.indexOf("không chính xác");
    return i >= 0 ? t.slice(Math.max(0, i - 120), i + 80) : null;
  });
  const counts = await page.evaluate(() => ({
    pw: document.querySelectorAll("#lookup-password").length,
    submit: document.querySelectorAll('button[type="submit"]').length,
    value: (document.querySelector("#lookup-name") as HTMLInputElement)?.value,
  }));
  return { ok: true, err, counts };
}
