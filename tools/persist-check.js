// Guard against lost progress: saves real progress through the app's own persist(),
// reloads the page, and fails unless the progress comes back. Covers the counter, a marker,
// question history, missed questions, flashcard history, and confidence records.
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
    // Seed real progress through the app's own structures.
    const seeded = await page.evaluate(() => {
      const qs = allQuestions().slice(0, 60);
      qs.forEach((q, i) => {
        const c = i % 3 !== 0;
        DATA.questionStats[q.id] = { seen: 2, correct: c ? 2 : 0, box: c ? 2 : 0, dueAt: Date.now() + 86400000, lastSeenAt: Date.now() - i * 3600000 };
        if (!c) { DATA.missed = DATA.missed || []; if (!DATA.missed.includes(q.id)) DATA.missed.push(q.id); DATA.confByQ[q.id] = { level: 'confident', correct: false, at: Date.now() }; }
      });
      allFlashcards().slice(0, 20).forEach((f, i) => { DATA.flashcardStats[f.id] = { seen: 2, correct: 1, box: 2, dueAt: 0, lastSeenAt: Date.now() - i * 1000 }; });
      DATA.answerCounter = 4242; DATA.persistMarker = 'kept';
      persist();
      return { questions: Object.keys(DATA.questionStats).length, missed: DATA.missed.length, conf: Object.keys(DATA.confByQ).length, cards: Object.keys(DATA.flashcardStats).length };
    });
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window._dataReady === true, null, { timeout: 60000 });
    const got = await page.evaluate(() => ({
      counter: DATA.answerCounter, marker: DATA.persistMarker,
      questions: Object.keys(DATA.questionStats).length, missed: (DATA.missed || []).length,
      conf: Object.keys(DATA.confByQ || {}).length, cards: Object.keys(DATA.flashcardStats || {}).length,
      loadFailed: typeof loadFailed !== 'undefined' && loadFailed === true
    }));
    const kept = got.counter === 4242 && got.marker === 'kept' && !got.loadFailed
      && got.questions === seeded.questions && got.missed === seeded.missed && got.conf === seeded.conf && got.cards === seeded.cards;
    if (kept && pageErrors.length === 0) {
      console.log('OK: progress survives a reload (' + got.questions + ' questions, ' + got.missed + ' missed, ' + got.cards + ' flashcards, ' + got.conf + ' confidence records)'); code = 0;
    } else {
      console.log('FAIL: progress did not survive a reload', JSON.stringify({ seeded, got }), pageErrors.slice(0, 3));
    }
  } catch (e) {
    console.log('FAIL: persistence check could not run:', e.message);
  } finally {
    if (browser) await browser.close();
    srv.kill();
  }
  process.exit(code);
})();
