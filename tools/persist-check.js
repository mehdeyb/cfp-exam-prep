// Guard against lost progress: saves a marker through the app's own persist(),
// reloads the page, and fails unless the marker and answer counter come back.
// Run before every push: node tools/persist-check.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8790 + Math.floor(Math.random() * 500);
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  let code = 1, browser;
  try {
    await new Promise(r => setTimeout(r, 800));
    browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    const url = 'http://localhost:' + PORT + '/index.html';
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window._dataReady === true, null, { timeout: 60000 });
    await page.evaluate(() => { DATA.answerCounter = 4242; DATA.persistMarker = 'kept'; persist(); });
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window._dataReady === true, null, { timeout: 60000 });
    const got = await page.evaluate(() => ({ counter: DATA.answerCounter, marker: DATA.persistMarker, loadFailed: !!window.loadFailed }));
    if (got.counter === 4242 && got.marker === 'kept' && !got.loadFailed && pageErrors.length === 0) {
      console.log('OK: progress survives a reload'); code = 0;
    } else {
      console.log('FAIL: progress did not survive a reload', JSON.stringify(got), pageErrors.slice(0, 3));
    }
  } catch (e) {
    console.log('FAIL: persistence check could not run:', e.message);
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  process.exit(code);
})();
