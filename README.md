# Matteuppgifter

En webbapp för att skapa utskrivbara övningsblad i addition, subtraktion,
multiplikation och division. Allt körs i webbläsaren — ingen backend, ingen
inloggning, inga uppgifter lämnar din dator.

**Testa den:** https://s-valenzuela.github.io/matteuppgifter/

## Funktioner

- Fyra räknesätt, var för sig eller blandat, med eget talområde per
  räknesätt (eller ett gemensamt via nivå-chips: 0–10, 0–20, 10–20, 0–100).
- Multiplikation kan begränsas till valda tabeller (t.ex. bara tvåans och
  femmans).
- Division kan tvingas gå jämnt upp, eller tillåtas ge en rest ("5 r 2").
- Två layouter: vågrätt (`12 + 7 = ____`) eller uppställning (talen
  staplade med ett streck ovanför svaret).
- Svarsstil: tomt streck, linje eller ruta — eller ett facit på egna sidor
  sist i dokumentet.
- Seedad slumpgenerator: samma inställningar + samma seed ger alltid exakt
  samma blad, så ett blad kan återskapas.
- Dela eller bokmärk ett blad via länk (`?add=0:20&seed=...`) — inställningarna
  sparas också i webbläsarens `localStorage` så senaste bladet finns kvar
  vid nästa besök.
- Ljust och mörkt tema (följer systemets `prefers-color-scheme`),
  tangentbordsnavigerbart, respekterar `prefers-reduced-motion`.
- Installerbar som app (PWA) och fungerar offline efter första besöket.

## Snabbstart

```bash
npm install
npm run dev
```

Öppna länken som skrivs ut (`http://localhost:5173/matteuppgifter/`).

## Skript

| Kommando               | Gör vad                                             |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Startar utvecklingsservern med hot reload.           |
| `npm run build`         | Typkontrollerar och bygger till `dist/`.             |
| `npm run preview`       | Serverar den byggda `dist/`-mappen lokalt.           |
| `npm test`              | Kör hela testsviten en gång (Vitest).                |
| `npm run test:watch`    | Kör testsviten i bevakningsläge.                     |
| `npm run typecheck`     | Kör bara TypeScript-kompilatorns typkontroll.        |
| `npm run lint`          | Kör ESLint.                                          |
| `npm run format`        | Formaterar om koden med Prettier.                    |
| `npm run format:check`  | Kontrollerar formatteringen utan att ändra filer.    |

## Teknik

Vite + TypeScript, utan UI-ramverk (vanilla DOM). PDF:er byggs med
[jsPDF](https://github.com/parallax/jsPDF) direkt i webbläsaren — samma
renderare används för både förhandsvisningen (i en `<iframe>` mot en
`blob:`-URL) och nedladdningen, så de kan aldrig visa olika resultat.
Tester körs med [Vitest](https://vitest.dev/).

```
src/
├─ main.ts        # startar upp och kopplar ihop lagren nedan
├─ types.ts        # delade typer (Config, Problem, ...)
├─ core/           # ren, seedad uppgiftsgenerering (rng, generate, validate)
├─ pdf/            # rutnätsberäkning (layout.ts) + jsPDF-rendering (render.ts, format.ts)
├─ ui/             # formulär, förhandsvisning, snabbstartsknappar
└─ state/          # AppState <-> URL-query och <-> localStorage
```

Se [PLAN.md](./PLAN.md) för den fullständiga projektplanen: arkitektur,
uppgiftsgenereringens regler, PDF-layoutens mått och milstolparna bladet
byggdes i.

## Driftsättning

`.github/workflows/deploy.yml` bygger och publicerar `dist/` till GitHub
Pages via GitHub Actions vid push till `main`. `.github/workflows/ci.yml`
kör typkontroll, lint, formatteringskontroll, tester och bygge på varje
push/PR.

`vite.config.ts` sätter `base: '/matteuppgifter/'` så länkar och
tillgångar fungerar under projektsidans undersökväg.
