import fs from 'node:fs';
import assert from 'node:assert/strict';
process.env.XOE_REVIEW_LIBRARY='1';
const { openGame, closeGame, wait: realWait, press, pressName, phaseOf, bodyText, setupPilot, walkStory, practiceDesk, toMap, closeChapterCard, dismissReminder } = await import('./review-v19.mjs');
const wait = async (s, ms) => {
  if (process.env.XOE_FAST_CLOCK === '1') { await s.page.clock.runFor(ms); await realWait(s, 30); }
  else await realWait(s, ms);
};
const devices = (process.env.REVIEW_DEVICES || 'portrait,desktop').split(',');
const results = [];

async function shot(s, device, name) {
  const path = `review/${device}-${name}.png`;
  await s.page.screenshot({ path });
  return path;
}

async function bootToMap(s) {
  assert.equal((await setupPilot(s)).ok, true);
  await walkStory(s);
  await practiceDesk(s);
  assert.equal(await toMap(s), true);
  await closeChapterCard(s);
  await dismissReminder(s);
  assert.equal(await phaseOf(s), 'colony-map');
}

for (const device of devices) {
  const r = { device, shots: [], errors: [] };

  // Starter long on the desk (default URL, after reaching the map).
  try {
    const s = await openGame({ device });
    await bootToMap(s);
    const body = await bodyText(s);
    assert.match(body, /Starter long|0\.1 XOE|P\/L/);
    r.shots.push(await shot(s, device, 'starter-long'));
    await closeGame(s);
  } catch (e) {
    r.errors.push(`starter-long: ${e}`);
  }

  // Harbor Commons
  try {
    const s = await openGame({ device, query: '?town=harbor-commons' });
    await bootToMap(s);
    await s.page.getByRole('heading', { name: 'Harbor Commons' }).waitFor({ timeout: 8000 });
    r.shots.push(await shot(s, device, 'harbor-commons'));
    const body = await bodyText(s);
    assert.match(body, /Notice board/i);
    assert.match(body, /Mira|Dockkeep/);
    await closeGame(s);
  } catch (e) {
    r.errors.push(`harbor-commons: ${e}`);
  }

  // Aurora Port
  try {
    const s = await openGame({ device, query: '?town=aurora-port' });
    await bootToMap(s);
    await s.page.getByRole('heading', { name: 'Aurora Port' }).waitFor({ timeout: 8000 });
    r.shots.push(await shot(s, device, 'aurora-port'));
    const body = await bodyText(s);
    assert.match(body, /Notice board/i);
    assert.match(body, /Wren|Port warden/);
    await closeGame(s);
  } catch (e) {
    r.errors.push(`aurora-port: ${e}`);
  }

  // Moon approach + power payoff (qa=1 unlocks the moon gate).
  try {
    const s = await openGame({ device, query: '?qa=1' });
    await bootToMap(s);
    assert.equal(await pressName(s, 'Choose moon path'), true);
    await wait(s, 200);
    assert.equal(await press(s, s.page.getByRole('button', { name: /^Xelm/ })), true);
    assert.equal(await pressName(s, 'Lock moon path · Xelm'), true);
    await wait(s, 200);
    assert.equal(await phaseOf(s), 'moon-approach');
    r.shots.push(await shot(s, device, 'moon-approach'));
    const use = s.page.getByRole('button', { name: /^Use / });
    if (await use.count()) {
      await press(s, use);
      await wait(s, 250);
    }
    const powered = await bodyText(s);
    assert.match(powered, /lights the path|Power used|gate is open/i);
    r.shots.push(await shot(s, device, 'moon-approach-powered'));
    await closeGame(s);
  } catch (e) {
    r.errors.push(`moon-approach: ${e}`);
  }

  // Credits (display-only review jump, no ledger write).
  try {
    const s = await openGame({ device, query: '?credits=1' });
    assert.equal((await setupPilot(s)).ok, true);
    await s.page.getByRole('heading', { name: 'Credits' }).waitFor({ timeout: 8000 });
    r.shots.push(await shot(s, device, 'credits'));
    const body = await bodyText(s);
    assert.match(body, /Thank you for flying/);
    assert.match(body, /practice/i);
    await closeGame(s);
  } catch (e) {
    r.errors.push(`credits: ${e}`);
  }

  results.push(r);
  console.log(device, JSON.stringify({ shots: r.shots, errors: r.errors }));
}

fs.writeFileSync('review/progress-scenes-v19.json', JSON.stringify(results, null, 2));
if (results.some((r) => r.errors.length)) process.exitCode = 1;
