import type { jsPDF } from 'jspdf';

const DEBOUNCE_MS = 300;

export interface PreviewController {
  /** Schemalägger en ny rendering. Debouncad — snabba ändringar i följd
   * ritar bara en gång. Tar en byggfunktion snarare än färdiga
   * problems/config så att den här modulen inte behöver veta om bladet är
   * ett räknesätts- eller klockblad — det avgörs av anroparen (main.ts). */
  update(buildDoc: () => jsPDF): void;
  destroy(): void;
}

/**
 * Ritar förhandsvisningen i en <iframe> från en blob-URL. Debouncad eftersom
 * jsPDF-rendering av ett flersidigt dokument är för tungt att göra på varje
 * tangenttryckning. Nedladdning/utskrift går INTE via den här kontrollern —
 * de renderar alltid ett fräscht dokument direkt från det aktuella
 * tillståndet i main.ts, så att de aldrig visar ett läge som hunnit ändras
 * sedan den debouncade förhandsvisningen senast ritade om.
 */
export function mountPreview(iframe: HTMLIFrameElement): PreviewController {
  let timeoutId: number | undefined;
  let currentObjectUrl: string | undefined;

  function renderNow(buildDoc: () => jsPDF): void {
    const doc = buildDoc();
    // jsPDF:s typer (types/index.d.ts) säger att output('bloburl') returnerar
    // ett URL-objekt, men i den faktiska implementationen är det bara
    // URL.createObjectURL()'s returvärde — en sträng, enligt webbstandarden.
    // Ett `.href`-anrop här ger `undefined`, vilket sätter iframe.src till
    // strängen "undefined" och laddar in sidan själv i förhandsvisningen.
    const nextUrl = doc.output('bloburl') as unknown as string;
    iframe.src = nextUrl;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
    currentObjectUrl = nextUrl;
  }

  return {
    update(buildDoc) {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => renderNow(buildDoc), DEBOUNCE_MS);
    },
    destroy() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    },
  };
}
