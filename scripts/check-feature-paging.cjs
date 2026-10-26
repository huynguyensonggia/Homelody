const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/landing.js', 'utf8');
const paging = source.slice(source.indexOf('(function setupDrinkBakeryPaging()'), source.indexOf('  (function setupVisitMap()'));

function setup({ reduced = false, modal = false, start = 936 } = {}) {
  let y = start, now = 0, nextId = 0;
  const frames = new Map(), listeners = {};
  class Element {
    constructor(id, top, height) { this.id = id; this.top = top; this.offsetHeight = height; this.listeners = {}; }
    getBoundingClientRect() { return { top: this.top - y }; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    closest(selector) {
      if (selector === '#do-uong, #banh-nha-lam') return this.id === 'do-uong' || this.id === 'banh-nha-lam' ? this : null;
      return null;
    }
  }
  const drinks = new Element('do-uong', 1000, 1000), bakery = new Element('banh-nha-lam', 2000, 900);
  const outside = new Element('story', 2900, 1000);
  const header = { offsetHeight: 64, classList: { contains: () => false } };
  const window = {
    get scrollY() { return y; }, innerHeight: 844,
    matchMedia: () => ({ matches: reduced }),
    scrollTo: ({ top }) => { y = top; },
    addEventListener: (type, callback) => { listeners[type] = callback; }
  };
  vm.runInNewContext(paging, {
    window, Element, document: {
      getElementById: id => id === 'do-uong' ? drinks : bakery,
      querySelector: selector => selector === '[data-header]' ? header : modal ? {} : null
    }, performance: { now: () => now }, getComputedStyle: () => ({ overflowY: 'visible' }),
    requestAnimationFrame: callback => { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  function settle() {
    while (frames.size) { now += 100; const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(now)); }
  }
  function wheel(deltaY, target = drinks, extra = {}) {
    const event = { target, deltaY, deltaX: 0, deltaMode: 0, preventDefault() { this.prevented = true; }, ...extra };
    listeners.wheel(event); return event;
  }
  function touch(section, dx, dy) {
    const origin = { clientX: 100, clientY: 200 };
    section.listeners.touchstart({ touches: [origin], target: section });
    const event = { touches: [{ clientX: 100 - dx, clientY: 200 - dy }], cancelable: true, preventDefault() { this.prevented = true; } };
    section.listeners.touchmove(event); return event;
  }
  return { drinks, bakery, outside, wheel, touch, settle, listeners, get y() { return y; }, advance: ms => { now += ms; } };
}

let s = setup();
assert.ok(s.wheel(80).prevented); s.settle(); assert.equal(s.y, 1936);
s.advance(800); assert.ok(s.wheel(-80, s.bakery).prevented); s.settle(); assert.equal(s.y, 936);
console.log('PASS wheel moves between the two section origins in both directions');

for (const [name, options, target, delta, extra] of [
  ['outside section', {}, 'outside', 80, {}],
  ['bakery onward', { start: 1936 }, 'bakery', 80, {}],
  ['drinks backward', {}, 'drinks', -80, {}],
  ['horizontal gesture', {}, 'drinks', 10, { deltaX: 80 }],
  ['browser zoom', {}, 'drinks', 80, { ctrlKey: true }],
  ['open dialog', { modal: true }, 'drinks', 80, {}]
]) {
  s = setup(options); const before = s.y;
  assert.ok(!s.wheel(delta, s[target], extra).prevented); s.settle(); assert.equal(s.y, before);
  console.log('PASS preserves native input: ' + name);
}
s = setup(); s.wheel(80); s.settle();
assert.ok(s.wheel(80, s.bakery).prevented); assert.equal(s.y, 1936);
console.log('PASS residual wheel momentum does not skip past the destination');
s = setup({ reduced: true }); s.wheel(80); s.settle(); assert.equal(s.y, 1936);
console.log('PASS reduced motion reaches the same destination');
s = setup(); assert.ok(s.touch(s.drinks, 0, 40).prevented); s.settle(); assert.equal(s.y, 1936);
s.listeners.resize(); assert.ok(s.touch(s.bakery, 0, -40).prevented); s.settle(); assert.equal(s.y, 936);
console.log('PASS synthetic vertical touch gestures move in both directions');
s = setup(); assert.ok(!s.touch(s.drinks, 80, 5).prevented); s.settle(); assert.equal(s.y, 936);
s.drinks.listeners.touchcancel();
console.log('PASS horizontal touch and cancellation preserve native behavior');
