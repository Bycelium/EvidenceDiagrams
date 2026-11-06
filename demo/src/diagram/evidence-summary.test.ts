import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderCollapsedEvidenceSummary,
  summarizeCollapsedEvidence,
} from './evidence-summary.ts';

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style: Record<string, string> & { setProperty: (name: string, value: string) => void };
  attributes: Record<string, string> = {};
  className = '';
  textContent: string | null = null;
  hidden = false;

  constructor(tagName: string) {
    this.tagName = tagName;
    this.style = Object.assign(Object.create(null) as Record<string, string>, {
      setProperty: (name: string, value: string) => { this.style[name] = value; },
    });
  }

  append(...children: FakeElement[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}

test('collapsed evidence summary separates accumulated support and opposition', () => {
  const summary = summarizeCollapsedEvidence([8, -3, 5, -7], 20);
  assert.equal(summary.supportDecibans, 13);
  assert.equal(summary.oppositionDecibans, 10);
  assert.equal(summary.netWeightDecibans, 3);
  assert.equal(summary.absoluteWeightDecibans, 23);
  assert.equal(summary.supportPercent, 65);
  assert.equal(summary.oppositionPercent, 50);
});

test('collapsed evidence summary has a stable zero extent', () => {
  assert.deepEqual(summarizeCollapsedEvidence([], 20), {
    netWeightDecibans: 0,
    absoluteWeightDecibans: 0,
    dissonance: 0,
    supportDecibans: 0,
    oppositionDecibans: 0,
    supportPercent: 0,
    oppositionPercent: 0,
  });
});

test('rendered arrows point outward and hide an empty side', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName: string) => new FakeElement(tagName),
  } as unknown as Document;
  try {
    const view = renderCollapsedEvidenceSummary({
      weights: [-4], displayExtent: 20,
    }) as unknown as FakeElement;
    assert.equal(view.tagName, 'span');
    const dissonance = view.children[1]!;
    const line = view.children[2]!;
    assert.equal(dissonance.className, 'collapsed-evidence-summary-total is-dissonance is-zero');
    const [opposition, support, center] = line.children as [FakeElement, FakeElement, FakeElement];
    assert.equal(opposition.className, 'collapsed-evidence-summary-arrow is-opposition');
    assert.deepEqual(
      opposition.children.map(({ className }) => className),
      ['collapsed-evidence-summary-arrow-tip', 'collapsed-evidence-summary-arrow-body'],
    );
    assert.equal(opposition.hidden, false);
    assert.equal(support.hidden, true);
    assert.deepEqual(
      support.children.map(({ className }) => className),
      ['collapsed-evidence-summary-arrow-body', 'collapsed-evidence-summary-arrow-tip'],
    );
    assert.equal(center.className, 'collapsed-evidence-summary-center');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('collapsed evidence summary preserves public aggregation validation', () => {
  assert.throws(() => summarizeCollapsedEvidence([1, Number.NaN], 20), /finite weightDecibans/);
});

test('collapsed arrows preserve tiny lengths, use the explicit extent, and clamp overflow', () => {
  assert.equal(summarizeCollapsedEvidence([0.1], 40).supportPercent, 0.25);
  assert.equal(summarizeCollapsedEvidence([5], 40).supportPercent, 12.5);
  assert.equal(summarizeCollapsedEvidence([5], 10).supportPercent, 50);
  assert.equal(summarizeCollapsedEvidence([100], 40).supportPercent, 100);
  assert.throws(() => summarizeCollapsedEvidence([1], 0), /finite positive/);
});
