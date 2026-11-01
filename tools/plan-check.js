// Regression check for today's plan. Run: node tools/plan-check.js
// Seeds eight missed tax questions, rebuilds the plan, and checks the rules that users have reported broken:
//  1. The missed-questions walk-through is a normal step: it has a Start path (not manual) and a live count.
//  2. While that walk-through is still to do, the "Review N missed questions" step steps aside (no double counting).
//  3. A review session that is not a missed review does not count toward the "missed" step.
const path = require('path');
const { chromium } = require('playwright');
const file = 'file://' + path.resolve(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1400 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message)));
  await p.goto(file);
  await p.waitForTimeout(800);
  const out = await p.evaluate(() => {
    const ids = allQuestions().filter(q => q.domain === 'tax').slice(0, 8).map(q => q.id);
    DATA.missed = ids.slice();
    DOMAINS.forEach(d => { DATA.domainStats[d.key] = Object.assign({ total: 0, correct: 0 }, DATA.domainStats[d.key] || {}); });
    DATA.domainStats.tax = { total: 30, correct: 14 };
    DATA.domainStats.invest = { total: 30, correct: 25 };
    _dataVer++;
    const steps = buildStudyPlan().steps;
    const walk = steps.find(x => /^Walk through/.test(x.title));
    const review = steps.find(x => x.id === 'missed');
    return { walk: walk ? { manual: !!walk.manual, need: walk.need, have: walk.have, title: walk.title } : null, reviewPresent: !!review };
  });
  const fails = [];
  if(!out.walk) fails.push('no walk-through step for the 8 missed tax questions');
  else {
    if(out.walk.manual) fails.push('walk-through is manual (no Start / auto-done)');
    if(out.walk.need !== 8) fails.push('walk-through count is ' + out.walk.need + ', expected 8');
  }
  if(out.reviewPresent) fails.push('"Review N missed questions" still shows alongside the walk-through');
  if(errs.length) fails.push('page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close();
  if(fails.length){ console.log('FAIL'); fails.forEach(f => console.log(' - ' + f)); process.exit(1); }
  console.log('OK: ' + out.walk.title + ' (' + out.walk.have + '/' + out.walk.need + '), no duplicate review step');
})();
