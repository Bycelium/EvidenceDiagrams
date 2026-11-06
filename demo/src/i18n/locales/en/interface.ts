import type { ActionMessages } from '../../../main.ts';
import type { MeasureMessages } from '../../../diagram/evidence-summary.ts';
import type { PaletteMessages } from '../../../diagram/color-legend.ts';
import type { ThemeMessages } from '../../../components/theme-control.ts';

export const measure: MeasureMessages = {
  "dissonance": "Dissonance"
};

export const palette: PaletteMessages = {
  "heading": "Combined evidence colors",
  "open": "Legend",
  "close": "Close legend",
  "settings": "Color settings",
  "canvasAria": "Combined evidence color legend: uncertain gray spans the top according to starting credibility; opposing evidence is red at bottom left, dissonance is yellow at bottom center, and supporting evidence is green at bottom right. The point shows the current combined result.",
  "canvasFallback": "Combined evidence colors.",
  "saturation": "Evidence needed for full color",
  "uncertain": "Uncertain",
  "dissonance": "Dissonance",
  "against": "Opposes",
  "for": "Supports"
};

export const action: ActionMessages = {
  "reset": "Reset"
};

export const theme: ThemeMessages = {
  "switchToLight": "Switch to light theme",
  "switchToDark": "Switch to dark theme"
};
