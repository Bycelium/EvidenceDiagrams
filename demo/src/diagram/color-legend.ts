import {
  triangleColor,
  trianglePosition,
  type ColorOptions,
  type EvidenceSummary,
  type TrianglePosition,
} from '@bycelium/evidence-diagrams';

export interface PaletteMessages {
  readonly heading: string;
  readonly open: string;
  readonly close: string;
  readonly settings: string;
  readonly canvasAria: string;
  readonly canvasFallback: string;
  readonly saturation: string;
  readonly uncertain: string;
  readonly dissonance: string;
  readonly against: string;
  readonly for: string;
}

export type LegendProjectionOptions = ColorOptions & {
  minPriorDecibans: number;
  maxPriorDecibans: number;
  saturationThresholdDecibans: number;
};

export type LegendTheme = {
  boundary: string;
  foreground: string;
  markerStroke: string;
};

export type LegendLabels = {
  uncertain: string;
  against: string;
  dissonance: string;
  for: string;
};

export type LegendProjection = {
  topHalfWidth: number;
  halfWidthAt: (height: number) => number;
  colorPosition: (position: TrianglePosition) => TrianglePosition;
  legendPosition: (position: TrianglePosition) => TrianglePosition;
};

function projectionGeometry(options: LegendProjectionOptions): {
  priorHalfWidth: number;
  threshold: number;
  topHalfWidth: number;
} {
  const minimum = options?.minPriorDecibans;
  const maximum = options?.maxPriorDecibans;
  const threshold = options?.saturationThresholdDecibans;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
    throw new RangeError('Legend priors must be finite and ordered.');
  }
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new RangeError('The legend saturation threshold must be finite and positive.');
  }

  const priorHalfWidth = maximum / 2 - minimum / 2;
  const topHalfWidth = priorHalfWidth < threshold
    ? (priorHalfWidth / threshold) / (1 + priorHalfWidth / threshold)
    : 1 / (1 + threshold / priorHalfWidth);
  return { priorHalfWidth, threshold, topHalfWidth };
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function legendThemeForPreference(dark = false): LegendTheme {
  return dark ? {
    boundary: '#b8c0c9',
    foreground: '#e1e5e9',
    markerStroke: '#202327',
  } : {
    boundary: '#334155',
    foreground: '#334155',
    markerStroke: '#0f172a',
  };
}

/** Maps the library's triangular color coordinates onto the widening legend. */
export function createLegendProjection(options: LegendProjectionOptions): LegendProjection {
  const { priorHalfWidth, threshold, topHalfWidth } = projectionGeometry(options);

  function directionalSaturation(orientation: number): number {
    if (orientation === 1) return 1;
    const radius = priorHalfWidth + threshold;
    const saturation = Number.isFinite(radius)
      ? (orientation * radius - priorHalfWidth) / threshold
      : orientation - (1 - orientation) * priorHalfWidth / threshold;
    const tolerance = 8 * Number.EPSILON * Math.max(1, priorHalfWidth / threshold);
    return saturation <= tolerance ? 0 : Math.min(saturation, 1);
  }

  return {
    topHalfWidth,

    halfWidthAt(height: number) {
      return topHalfWidth + (1 - topHalfWidth) * height;
    },

    colorPosition({ x, height }: TrianglePosition) {
      const yellowWeight = Math.min(
        height,
        Math.max(0, topHalfWidth + (1 - topHalfWidth) * height - Math.abs(x)),
      );
      return { x, height: yellowWeight };
    },

    legendPosition({ x, height }: TrianglePosition) {
      const orientation = height === 1 ? 0 : Math.abs(clamp(x / (1 - height)));
      const saturation = directionalSaturation(orientation);
      return { x, height: height + (1 - height) * saturation };
    },
  };
}

/** Draws the shared evidence palette and the current evidence summary marker. */
export function drawColorLegend(canvas: HTMLCanvasElement, {
  width,
  summary,
  resultantColor,
  colorOptions,
  labels,
  theme = legendThemeForPreference(),
}: {
  width: number;
  summary: EvidenceSummary;
  resultantColor: string;
  colorOptions: LegendProjectionOptions;
  labels: LegendLabels;
  theme?: LegendTheme;
}): void {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('The color legend requires a 2D canvas context.');
  const height = Math.round(width * .66);
  const pixelRatio = globalThis.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const topY = 25;
  const bottomY = height - 25;
  const fullHalfWidth = width / 2 - 14;
  const legendHeight = bottomY - topY;
  const projection = createLegendProjection(colorOptions);
  for (let y = Math.ceil(topY); y <= bottomY; y += 1) {
    const legendPosition = (y - topY) / legendHeight;
    const halfWidth = fullHalfWidth * projection.halfWidthAt(legendPosition);
    for (let x = Math.ceil(centerX - halfWidth); x <= Math.floor(centerX + halfWidth); x += 1) {
      context.fillStyle = triangleColor(projection.colorPosition({
        x: (x - centerX) / fullHalfWidth,
        height: legendPosition,
      }), colorOptions);
      context.fillRect(x, y, 1, 1);
    }
  }

  context.strokeStyle = theme.boundary;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(centerX - fullHalfWidth * projection.topHalfWidth, topY);
  context.lineTo(centerX + fullHalfWidth * projection.topHalfWidth, topY);
  context.lineTo(centerX + fullHalfWidth, bottomY);
  context.lineTo(centerX - fullHalfWidth, bottomY);
  context.closePath();
  context.stroke();

  const position = projection.legendPosition(trianglePosition(summary, colorOptions));
  const x = centerX + position.x * fullHalfWidth;
  const y = topY + position.height * legendHeight;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fillStyle = resultantColor;
  context.fill();
  context.strokeStyle = theme.markerStroke;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = theme.foreground;
  context.font = '700 10px system-ui';
  context.textAlign = 'center';
  context.fillText(labels.uncertain, centerX, 10);
  context.textAlign = 'left';
  context.fillText(labels.against, 0, height - 5);
  context.textAlign = 'center';
  context.fillText(labels.dissonance, centerX, height - 5);
  context.textAlign = 'right';
  context.fillText(labels.for, width, height - 5);
  context.textAlign = 'start';
}
