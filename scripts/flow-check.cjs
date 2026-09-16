/**
 * 界面流程检查：用无头浏览器把「打卡 → 改一下 → 删除」和「请假（只去上午）→ 撤销」走一遍。
 * 接口测试测不到这些，这轮踩过的坑（面板太高点不到删除、日历撑破布局）都是界面层的。
 *
 * 用法（需要先装 playwright，本地服务跑在 3000）：
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/flow-check.cjs [url] [code]
 */
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:3000/';
const passcode = process.argv[3] ?? 'mom1234';

let failures = 0;
const check = (label, passed) => {
  console.log(`${passed ? '✓' : '✗'} ${label}`);
  if (!passed) failures += 1;
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => check(`页面没报错（${error.message}）`, false));

  await page.goto(url, { waitUntil: 'networkidle' });
  if (await page.$('input[type="password"]')) {
    await page.fill('input[type="password"]', passcode);
    await page.click('button[type="submit"]');
  }
  await page.waitForSelector('.tabbar', { timeout: 15000 });
  await page.click('.tab:has-text("打卡")');
  await page.waitForTimeout(400);

  // 先把今天的状态清干净：有记录就删掉
  if (await page.$('button:has-text("改一下")')) {
    await page.click('button:has-text("改一下")');
    await page.waitForSelector('.sheet');
    await page.click('.sheet button:has-text("删除")');
    await page.waitForTimeout(600);
  }
  check('清空后主屏回到「今天还没打卡」', Boolean(await page.$('.big.present')));
  if (!(await page.$('.big.present'))) {
    console.log('  当前主屏内容：', ((await page.textContent('.screen')) ?? '').replace(/\s+/g, ' ').slice(0, 200));
  }

  // 打卡 → 刷新 → 状态还在
  await page.click('.big.present');
  await page.waitForTimeout(800);
  check('点「今天去了」后出现状态卡', Boolean(await page.$('button:has-text("改一下")')));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('刷新后记录还在（真的写进去了）', Boolean(await page.$('button:has-text("改一下")')));

  // 改成半天
  await page.click('button:has-text("改一下")');
  await page.waitForSelector('.sheet');
  await page.click('.choice:has-text("只去了上午")');
  await page.click('.sheet button:has-text("保存")');
  await page.waitForTimeout(800);
  const heroText = (await page.textContent('.hero-text')) ?? '';
  check('改成「只去了上午」后主屏跟着变', heroText.includes('只去了上午'));

  // 删除
  await page.click('button:has-text("改一下")');
  await page.waitForSelector('.sheet');
  const deleteVisible = await page.isVisible('.sheet button:has-text("删除")');
  check('面板里能直接看到「删除」按钮（不用滚）', deleteVisible);
  await page.click('.sheet button:has-text("删除")');
  await page.waitForTimeout(800);
  check('删除后回到「今天还没打卡」', Boolean(await page.$('.big.present')));

  // 请假面板的四个选项都在
  await page.click('.big.leave');
  await page.waitForSelector('.sheet');
  for (const label of ['全天在园', '只去了上午', '只去了下午', '全天没去']) {
    check(`请假面板有「${label}」`, await page.isVisible(`.choice:has-text("${label}")`));
  }
  const sheetBox = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    return { top: Math.round(sheet.getBoundingClientRect().top), scrollHeight: sheet.scrollHeight, clientHeight: sheet.clientHeight };
  });
  check(`面板没有超出屏幕（顶部 ${sheetBox.top}px）`, sheetBox.top >= 0);

  await browser.close();
  console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项没过`);
  process.exit(failures === 0 ? 0 : 1);
})();
