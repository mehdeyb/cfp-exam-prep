// Backup round-trip: seed progress, export a backup, wipe, restore it, and confirm
// the progress comes back. Run before every push: node tools/backup-check.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 9000 + Math.floor(Math.random() * 500);
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  let code = 1, browser;
  try {
    await new Promise(r => setTimeout(r, 800));
    browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();
    page.on('dialog', d => d.accept());
    await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window._dataReady === true, null, { timeout: 60000 });
    const seeded = await page.evaluate(() => {
      const firstQ = (typeof allQuestions === 'function' ? allQuestions()[0] : null); const pid = firstQ ? firstQ.id : 'probe-q';
      DATA.answerCounter = 777;
      DATA.questionStats = Object.assign({}, DATA.questionStats, { [pid]: { correct: 2, total: 3, lastSeenAt: 123 } }); window._probeId = pid;
      DATA.sessions = (DATA.sessions || []).concat([{ id: 'probe-session', t: 1, n: 5 }]);
      persist();
      return { firstQ: pid };
    });
    const backup = await page.evaluate(() => buildBackupText()); const pid = seeded.firstQ;
    if (!backup || backup.length < 100) throw new Error('backup text is empty');
    // Wipe the in-memory and saved progress, as if it were lost.
    await page.evaluate(() => { DATA = defaultData(); persist(); });
    await page.evaluate(b => { document.getElementById('restoreText').value = b; }, backup);
    await page.evaluate(() => restoreFromBackup());
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window._dataReady === true, null, { timeout: 60000 });
    const got = await page.evaluate(PID => ({
      counter: DATA.answerCounter,
      probe: DATA.questionStats && DATA.questionStats[PID] ? DATA.questionStats[PID].total : null,
      session: (DATA.sessions || []).some(s => s && s.id === "probe-session"),
    }), pid);
    if (got.counter === 777 && got.probe === 3 && got.session) { console.log('OK: backup restores progress intact'); code = 0; }
    else console.log('FAIL: backup did not restore progress', JSON.stringify(got));
  } catch (e) {
    console.log('FAIL: backup check could not run:', e.message);
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  process.exit(code);
})();
