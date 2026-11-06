import type { EvidenceSummary } from '@bycelium/evidence-diagrams';
import { drawColorLegend } from '../diagram/color-legend.ts';

type CredibilityPalette = {
  color: string;
  colorOptions: {
    saturationThresholdDecibans: number;
    minPriorDecibans: number;
    maxPriorDecibans: number;
  };
};

type LegendControllerOptions = {
  dialog: HTMLDialogElement;
  openButton: HTMLButtonElement;
  container: HTMLElement;
  canvas: HTMLCanvasElement;
};

export function createLegendController(options: LegendControllerOptions): {
  render(evidenceSummary?: EvidenceSummary, palette?: CredibilityPalette): void;
  setOpen(open: boolean): void;
} {
  const {
    dialog,
    openButton,
    container,
    canvas,
  } = options;
  let renderState: { evidenceSummary: EvidenceSummary; palette: CredibilityPalette } | undefined;

  function render(evidenceSummary?: EvidenceSummary, palette?: CredibilityPalette): void {
    if (evidenceSummary && palette) renderState = { evidenceSummary, palette };
    if (!dialog.open || !renderState) return;
    drawColorLegend(canvas, {
      width: Math.max(200, Math.min(360, container.clientWidth)),
      summary: renderState.evidenceSummary,
      resultantColor: renderState.palette.color,
      colorOptions: renderState.palette.colorOptions,
    });
  }

  function setOpen(open: boolean): void {
    if (open) {
      dialog.show();
      openButton.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => render());
      return;
    }
    if (dialog.open) dialog.close();
    openButton.setAttribute('aria-expanded', 'false');
  }

  openButton.addEventListener('click', () => setOpen(!dialog.open));
  dialog.addEventListener('close', () => openButton.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setOpen(false);
  });
  return { render, setOpen };
}
