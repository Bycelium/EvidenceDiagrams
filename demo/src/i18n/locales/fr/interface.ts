import type { ActionMessages } from '../../../main.ts';
import type { MeasureMessages } from '../../../diagram/evidence-summary.ts';
import type { PaletteMessages } from '../../../diagram/color-legend.ts';
import type { ThemeMessages } from '../../../components/theme-control.ts';

export const measure: MeasureMessages = {
  "dissonance": "Dissonance"
};

export const palette: PaletteMessages = {
  "heading": "Couleurs de la synthèse",
  "open": "Légende",
  "close": "Fermer la légende",
  "settings": "Réglages des couleurs",
  "canvasAria": "Légende des couleurs de la synthèse : le gris de l’incertitude occupe le haut selon la crédibilité initiale ; l’opposition est rouge en bas à gauche, la dissonance jaune en bas au centre et le soutien vert en bas à droite. Le point indique la synthèse actuelle.",
  "canvasFallback": "Couleurs de la synthèse.",
  "saturation": "Poids requis pour une couleur intense",
  "uncertain": "Incertitude",
  "dissonance": "Dissonance",
  "against": "Oppose",
  "for": "Supporte"
};

export const action: ActionMessages = {
  "reset": "Réinitialiser"
};

export const theme: ThemeMessages = {
  "switchToLight": "Passer au thème clair",
  "switchToDark": "Passer au thème sombre"
};
