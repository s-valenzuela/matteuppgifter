import type { Preset } from './presets';

/**
 * Under den här bredden döljs de icke-utvalda snabbstartsvalen bakom
 * expandern som standard (öppnas fortfarande manuellt) — brett nog för en
 * extern skärm att visa alla sju bladtypernas alternativ utan att sidhuvudet
 * svämmar över på en bärbar dators skärm.
 */
const WIDE_VIEWPORT_QUERY = '(min-width: 1200px)';

/**
 * Bygger snabbstartsraden: de "featured" presetsen (en per bladtyp, se
 * ui/presets.ts) direkt synliga, resten bakom en <details>-expander så att
 * fler presets kan läggas till utan att sidhuvudet växer i all oändlighet.
 * <details> ger fri gratis tangentbords-/skärmläsarstöd utan egen JS-logik
 * för öppet/stängt tillstånd — bara startläget sätts här, utifrån
 * skärmbredden vid sidladdning.
 */
export function mountQuickstart(
  container: HTMLElement,
  presets: readonly Preset[],
  onSelect: (preset: Preset) => void,
): void {
  const featured = presets.filter((p) => p.featured);
  const rest = presets.filter((p) => !p.featured);

  const featuredRow = document.createElement('div');
  featuredRow.className = 'quickstart-row';
  for (const preset of featured) {
    featuredRow.appendChild(createPresetButton(preset, onSelect));
  }
  container.appendChild(featuredRow);

  if (rest.length === 0) {
    return;
  }

  const details = document.createElement('details');
  details.className = 'quickstart-more';

  const summary = document.createElement('summary');
  summary.textContent = 'Fler snabbstartsval';
  details.appendChild(summary);

  const restRow = document.createElement('div');
  restRow.className = 'quickstart-row';
  for (const preset of rest) {
    restRow.appendChild(createPresetButton(preset, onSelect));
  }
  details.appendChild(restRow);

  // Bara ett engångsval vid sidladdning, inte en resize-lyssnare — en
  // användare som redan öppnat eller stängt expandern för hand ska inte få
  // sitt val omkullkastat av att fönstret råkar ändra storlek.
  details.open = window.matchMedia(WIDE_VIEWPORT_QUERY).matches;

  container.appendChild(details);
}

function createPresetButton(preset: Preset, onSelect: (preset: Preset) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = preset.label;
  button.addEventListener('click', () => onSelect(preset));
  return button;
}
