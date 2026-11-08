import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCredibilityAxis, type CredibilityAxisOptions } from '../../src/index.ts';

class FakeClassList {
  add(): void {}

  toggle(): void {}
}

class FakeStyle {
  left = '';

  setProperty(): void {}
}

class FakeElement {
  readonly children: unknown[] = [];
  readonly classList = new FakeClassList();
  readonly style = new FakeStyle();
  readonly dataset: Record<string, string> = {};
  className = '';
  textContent = '';
  hidden = false;
  isConnected = false;

  append(...children: unknown[]): void {
    this.children.push(...children);
  }

  setAttribute(): void {}
}

function withDocument<Result>(action: () => Result): Result {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => new FakeElement() },
  });
  try {
    return action();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

function axisOptions(domain: CredibilityAxisOptions['domain']): CredibilityAxisOptions {
  return {
    band: { lower: -3, upper: 3 },
    position: {
      left: 40, width: 20, center: 50, clippedMinimum: false, clippedMaximum: false,
    },
    domain,
    saturationThresholdDecibans: 15,
    plotWidth: 400,
    formatPercent: value => `${value * 100}%`,
  };
}

function ruler(axis: FakeElement): FakeElement {
  const value = axis.children.find((child): child is FakeElement => (
    child instanceof FakeElement && child.className.includes('inquiry-flow-ruler')
  ));
  assert.ok(value, 'axis includes a ruler');
  return value;
}

test('rejects nonfinite and nonincreasing credibility-axis domains before rendering', () => {
  assert.throws(
    () => renderCredibilityAxis(axisOptions({ minimum: 0, maximum: Number.POSITIVE_INFINITY })),
    /finite increasing representable span/u,
  );
  assert.throws(
    () => renderCredibilityAxis(axisOptions({ minimum: 4, maximum: 4 })),
    /finite increasing representable span/u,
  );
  assert.throws(
    () => renderCredibilityAxis(axisOptions({ minimum: -Number.MAX_VALUE, maximum: Number.MAX_VALUE })),
    /finite increasing representable span/u,
  );
});

test('renders bounded rulers for broad domains while retaining ordinary five-deciban ticks', () => {
  const ordinaryAxis = withDocument(() => renderCredibilityAxis(axisOptions({ minimum: -70, maximum: 70 }))) as unknown as FakeElement;
  const ordinaryRuler = ruler(ordinaryAxis);
  assert.equal(ordinaryRuler.children.length, 29);

  const narrowAxis = withDocument(() => renderCredibilityAxis({
    ...axisOptions({ minimum: -2, maximum: 2 }),
    plotWidth: 30,
  })) as unknown as FakeElement;
  const zeroTick = ruler(narrowAxis).children.find((child): child is FakeElement => (
    child instanceof FakeElement && child.style.left === '50%'
  ));
  assert.ok(zeroTick?.children.length, 'labels the in-domain zero tick before competing endpoints');

  const broadAxis = withDocument(() => renderCredibilityAxis(axisOptions({ minimum: -1e300, maximum: 1e300 }))) as unknown as FakeElement;
  const broadRuler = ruler(broadAxis);
  assert.ok(broadRuler.children.length <= 99);

  const relativeAxis = withDocument(() => renderCredibilityAxis({
    ...axisOptions({ minimum: -1000, maximum: 1000 }),
    ruler: { kind: 'relative-decibans', origin: Number.MAX_VALUE },
  })) as unknown as FakeElement;
  const relativeRuler = ruler(relativeAxis);
  assert.ok(relativeRuler.children.length <= 127);
});

test('rejects a nonfinite relative ruler origin', () => {
  assert.throws(() => withDocument(() => renderCredibilityAxis({
    ...axisOptions({ minimum: -10, maximum: 10 }),
    ruler: { kind: 'relative-decibans', origin: Number.NaN },
  })), /Relative deciban ruler origin must be finite/u);
});
