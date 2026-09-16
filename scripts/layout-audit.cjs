/**
 * 布局体检：用无头浏览器在手机尺寸下量一遍，找出超出屏幕的元素。
 * 这台开发机看不到画面，靠它来判断"哪里溢出了"。
 *
 * 用法（需要先装 playwright，并且本地服务跑在 3000）：
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/layout-audit.cjs [url] [code]
 */
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:3000/';
const passcode = process.argv[3] ?? 'mom1234';

const VIEWPORTS = [
  { width: 390, height: 844, name: 'iPhone 14' },
  { width: 320, height: 568, name: 'iPhone SE' },
];

const TABS = [
  ['打卡', 'home'],
  ['日历', 'calendar'],
  ['统计', 'stats'],
  ['设置', 'settings'],
];

async function audit(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('*')]
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          name: typeof element.className === 'string' && element.className ? element.className : element.tagName,
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      })
      .filter((item) => item.right > viewportWidth + 1 || item.left < -1)
      .slice(0, 10);

    const tabbar = document.querySelector('.tabbar');
    const sheet = document.querySelector('.sheet');
    const box = (element) => {
      const r = element.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      offenders,
      tabbar: tabbar ? box(tabbar) : null,
      sheet: sheet ? { ...box(sheet), scrollHeight: sheet.scrollHeight } : null,
      // 标签栏中间那个点，最上层到底是谁？被盖住的话这里会指出来
      tabProbe: [...document.querySelectorAll('.tab')].map((tab) => {
        const r = tab.getBoundingClientRect();
        const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return {
          label: tab.textContent.trim(),
          box: box(tab),
          topmost: top ? `${top.tagName}.${typeof top.className === 'string' ? top.className : ''}` : 'none',
        };
      }),
      tabbarPointerEvents: tabbar ? getComputedStyle(tabbar).pointerEvents : null,
      innerTabPointerEvents: tabbar?.firstElementChild
        ? getComputedStyle(tabbar.firstElementChild).pointerEvents
        : null,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  // 登录一次就够，后面的视口复用同一份 cookie，免得触发登录限流
  let storageState;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log(`  [页面报错] ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') console.log(`  [控制台] ${message.text()}`);
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    if (await page.$('input[type="password"]')) {
      await page.fill('input[type="password"]', passcode);
      await page.click('button[type="submit"]');
      await page.waitForSelector('.tabbar', { timeout: 15000 });
    }
    storageState ??= await context.storageState();

    for (const [label, key] of TABS) {
      await page.click(`.tab:has-text("${label}")`, { force: true });
      await page.waitForTimeout(500);
      const entry = { viewport: viewport.name, screen: key, ...(await audit(page)) };
      report.push(entry);
      console.log(
        `  ${key.padEnd(12)} 文档宽 ${entry.documentWidth} / 视口宽 ${entry.viewport.width}` +
          `  溢出元素 ${entry.offenders.length} 个` +
          `  标签栏 ${entry.tabbar ? `${entry.tabbar.top}~${entry.tabbar.bottom}` : '无'}` +
          `  最上层 ${entry.tabProbe[1]?.topmost ?? '?'}`,
      );
      if (entry.offenders.length) {
        console.log(`    溢出：${entry.offenders.map((o) => `${o.name}(右${o.right})`).join('  ')}`);
      }
    }

    // 打开请假面板看看高度
    await page.click('.tab:has-text("打卡")');
    await page.waitForTimeout(400);
    const openButton = (await page.$('.big.leave')) ?? (await page.$('button:has-text("改一下")'));
    if (openButton) {
      await openButton.click();
      await page.waitForTimeout(500);
      report.push({ viewport: viewport.name, screen: 'leave-sheet', ...(await audit(page)) });
    }

    await context.close();
    console.log(`已完成 ${viewport.name}`);
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})();
