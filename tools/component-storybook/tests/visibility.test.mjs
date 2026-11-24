import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewController, createVisibilityCoordinator} from '../src/visibility.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
function fakePlayer() {
  return {
    paused: true, currentTime: 0, duration: 10, playCalls: 0, pauseCalls: 0, destroyCalls: 0,
    play() { this.paused = false; this.playCalls++; },
    pause() { this.paused = true; this.pauseCalls++; },
    seek(value) { this.currentTime = value; },
    destroy() { this.destroyCalls++; },
  };
}
function fixture(options = {}) {
  const players = [], errors = [];
  const controller = createPreviewController({
    mount: async () => { const player = fakePlayer(); players.push(player); return player; },
    onError: error => errors.push(error), ...options,
  });
  return {controller, players, errors};
}

test('Docs does not mount hidden examples and allows only the most visible preview', async () => {
  const coordinator = createVisibilityCoordinator();
  const fixtures = Array.from({length: 6}, () => fixture({releaseInactive: true}));
  const registrations = fixtures.map(item => coordinator.register(item.controller, {docs: true}));
  await flush(); assert.ok(fixtures.every(item => item.players.length === 0));
  registrations[0].intersection(.7); await flush();
  assert.equal(fixtures[0].players.length, 1);
  assert.equal(fixtures[0].players[0].paused, false);
  assert.ok(fixtures.slice(1).every(item => item.players.length === 0));
  registrations[1].intersection(.4); await flush();
  assert.equal(fixtures[1].players.length, 0, 'A smaller visible Docs preview must not consume another renderer');
  registrations[1].intersection(.9); await flush();
  assert.equal(fixtures[0].players[0].destroyCalls, 1);
  assert.equal(fixtures[1].players.length, 1);
  assert.equal(fixtures.flatMap(item => item.players).filter(player => !player.paused).length, 1);
  registrations.forEach(registration => registration.dispose());
});

test('a hidden browser tab releases Docs playback and cannot mount newly intersecting examples', async () => {
  const coordinator = createVisibilityCoordinator();
  const first = fixture({releaseInactive: true}), second = fixture({releaseInactive: true});
  const one = coordinator.register(first.controller, {docs: true});
  const two = coordinator.register(second.controller, {docs: true});
  one.intersection(1); await flush(); first.players[0].currentTime = 3.4;
  coordinator.documentVisibility(false);
  assert.equal(first.players[0].destroyCalls, 1);
  one.intersection(0); two.intersection(1); await flush();
  assert.equal(second.players.length, 0);
  coordinator.documentVisibility(true); await flush();
  assert.equal(second.players[0].paused, false);
  one.dispose(); two.dispose();
});

test('manual pause and playback position survive Docs unmount/remount', async () => {
  const {controller, players} = fixture({releaseInactive: true});
  controller.setActive(true); await flush();
  players[0].currentTime = 4.25; players[0].pause();
  controller.setActive(false); controller.setActive(true); await flush();
  assert.equal(players[0].destroyCalls, 1);
  assert.equal(players[1].currentTime, 4.25);
  assert.equal(players[1].playCalls, 0, 'Visibility policy must not undo a manual pause');
  assert.equal(players[1].paused, true);
  controller.dispose();
});

test('playing previews resume from the saved position when visible again', async () => {
  const {controller, players} = fixture({releaseInactive: true});
  controller.setActive(true); await flush(); players[0].currentTime = 2.75;
  controller.setActive(false); controller.setActive(true); await flush();
  assert.equal(players[1].currentTime, 2.75); assert.equal(players[1].playCalls, 1);
  controller.dispose();
});

test('scrolling away cancels a pending mount and stale completions never play', async () => {
  const jobs = [], errors = [];
  const controller = createPreviewController({mount: signal => {
    const job = {...deferred(), signal}; jobs.push(job); return job.promise;
  }, onError: error => errors.push(error), releaseInactive: true});
  controller.setActive(true); controller.setActive(false);
  assert.equal(jobs[0].signal.aborted, true);
  controller.setActive(true);
  const stale = fakePlayer(), current = fakePlayer();
  jobs[1].resolve(current); await flush();
  jobs[0].resolve(stale); await flush();
  assert.equal(stale.playCalls, 0); assert.equal(stale.destroyCalls, 1);
  assert.equal(current.playCalls, 1); assert.deepEqual(errors, []);
  controller.dispose(); assert.equal(current.destroyCalls, 1);
});

test('disconnect aborts pending loading, disposes a ready player once and suppresses late errors', async () => {
  const pending = deferred(), errors = []; let signal;
  const controller = createPreviewController({mount: value => { signal = value; return pending.promise; }, onError: error => errors.push(error)});
  controller.setActive(true); controller.dispose(); controller.dispose();
  assert.equal(signal.aborted, true);
  pending.reject(new Error('late load error')); await flush(); assert.deepEqual(errors, []);
  const ready = fixture(); ready.controller.setActive(true); await flush();
  ready.controller.dispose(); ready.controller.dispose();
  assert.equal(ready.players[0].destroyCalls, 1); assert.equal(ready.players[0].paused, true);
});

test('reduced motion shows a paused readable frame without autoplay', async () => {
  const {controller, players} = fixture({reducedMotion: true});
  controller.setActive(true); await flush();
  assert.equal(players[0].currentTime, 6); assert.equal(players[0].paused, true); assert.equal(players[0].playCalls, 0);
  controller.setActive(false); controller.setActive(true); await flush();
  assert.equal(players.length, 1); assert.equal(players[0].playCalls, 0);
  controller.dispose();
});

test('equal Docs visibility keeps the current player instead of rebuilding on scroll jitter', async () => {
  const coordinator = createVisibilityCoordinator(), first = fixture(), second = fixture();
  const one = coordinator.register(first.controller, {docs: true}), two = coordinator.register(second.controller, {docs: true});
  two.intersection(.5); await flush(); one.intersection(.5); await flush();
  assert.equal(first.players.length, 0); assert.equal(second.players.length, 1);
  two.dispose(); await flush(); assert.equal(first.players.length, 1);
  one.dispose();
});
