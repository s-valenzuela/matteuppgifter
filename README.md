# Matteuppgifter

En webbapp för att skapa utskrivbara övningsblad i matematik: räknesätt,
klockan, bråk och geometri. Allt körs i webbläsaren — ingen backend, ingen
inloggning, inga uppgifter lämnar din dator.

**Testa den:** https://matteuppgifter.se/

## Funktioner

### Fyra bladtyper

- **Räknesätt** — addition, subtraktion, multiplikation och division, var
  för sig eller blandat, med eget talområde per räknesätt (eller ett
  gemensamt via nivå-chips: 0–10, 0–20, 10–20, 0–100). Multiplikation kan
  begränsas till valda tabeller (t.ex. bara tvåans och femmans). Division
  kan tvingas gå jämnt upp, eller tillåtas ge en rest ("5 r 2"). "Saknat
  tal" gör att en slumpad del av uppgiften (inte bara svaret) är tom, t.ex.
  `3 + __ = 10`. Två layouter: vågrätt (`12 + 7 = ____`) eller uppställning
  (talen staplade med ett streck ovanför svaret).
- **Klockan** — läs av en urtavla och skriv tiden (i ord eller digitalt),
  eller rita visarna för en given tid. Välj vilka minutgrupper som ska
  förekomma (hel, halv, kvart, fem minuter) och om urtavlan ska ha siffror
  och minutstreck.
- **Bråk** — cirkel eller stapel, delad i lika stora delar. Läs av en
  färglagd figur och skriv bråket (eller andelen i procent), eller
  färglägg figuren utifrån ett givet bråk. Även en riktning utan figur,
  för äldre elever: räkna om ett bråk till procent för hand.
- **Geometri** — rektangel, triangel eller cirkel, med mått utsatta. Räkna
  ut arean eller omkretsen. Omkretstrianglar är alltid rätvinkliga med
  heltalssidor (så alla tre måtten är kända och svaret alltid går jämnt
  upp); areatrianglar har bas och höjd. Cirklar räknas med 3,14, avrundat
  till en decimal, med `~` när avrundningen faktiskt tappar information.
  Enheter (cm / cm²) kan slås av och på.

### Gemensamt för alla bladtyper

- Svarsstil: tomt streck, linje eller ruta — eller ett facit på egna sidor
  sist i dokumentet.
- Uppgift 1 kan lösas i förväg som ett exempel, med en notis i
  sidhuvudet.
- En instruktionsrad till eleven (t.ex. "Rita visarna." eller "Beräkna
  arean.") fylls i automatiskt utifrån bladtyp/riktning, men går att
  skriva över för hand.
- Tio snabbstartsknappar för vanliga kombinationer (en per bladtyp och
  vanlig nivå), som ett facit-på-tomt-blad-alternativ till att ställa in
  allt själv.
- Seedad slumpgenerator: samma inställningar + samma seed ger alltid
  exakt samma blad, så ett blad kan återskapas.
- Dela eller bokmärk ett blad via länk (`?add=0:20&seed=...`) —
  inställningarna sparas också i webbläsarens `localStorage` så senaste
  bladet finns kvar vid nästa besök.
- Ljust och mörkt tema (följer systemets `prefers-color-scheme`),
  tangentbordsnavigerbart, respekterar `prefers-reduced-motion`.
- Installerbar som app (PWA) och fungerar offline efter första besöket.

## Snabbstart

```bash
npm install
npm run dev
```

Öppna länken som skrivs ut (`http://localhost:5173/`).

## Skript

| Kommando                | Gör vad                                            |
| ------------------------ | ---------------------------------------------------- |
| `npm run dev`            | Startar utvecklingsservern med hot reload.           |
| `npm run build`          | Typkontrollerar och bygger till `dist/`.             |
| `npm run preview`        | Serverar den byggda `dist/`-mappen lokalt.           |
| `npm test`               | Kör hela testsviten en gång (Vitest).                |
| `npm run test:watch`     | Kör testsviten i bevakningsläge.                     |
| `npm run typecheck`      | Kör bara TypeScript-kompilatorns typkontroll.        |
| `npm run lint`           | Kör ESLint.                                          |
| `npm run format`         | Formaterar om koden med Prettier.                    |
| `npm run format:check`   | Kontrollerar formatteringen utan att ändra filer.    |

## Teknik

Vite + TypeScript, utan UI-ramverk (vanilla DOM). PDF:er byggs med
[jsPDF](https://github.com/parallax/jsPDF) direkt i webbläsaren — samma
renderare används för både förhandsvisningen (i en `<iframe>` mot en
`blob:`-URL) och nedladdningen, så de kan aldrig visa olika resultat.
jsPDF laddas på begäran via en kodklyvd `import()` (den behövs inte för
att rita upp och koppla in formuläret, bara för att faktiskt bygga en
PDF), så startskriptet förblir litet. Tester körs med
[Vitest](https://vitest.dev/).

```
src/
├─ main.ts               # startar upp och kopplar ihop lagren nedan
├─ types.ts              # delade typer (Config, Problem, ...) för alla fyra bladtyper
├─ core/                 # ren, seedad uppgiftsgenerering
│  ├─ generate.ts        #   räknesätt
│  ├─ clock.ts           #   klockan
│  ├─ fractions.ts       #   bråk
│  ├─ geometry.ts        #   geometri
│  ├─ rng.ts             #   delad deterministisk slumpgenerator
│  └─ validate.ts        #   rätar ut/varnar för orimliga inställningar
├─ pdf/                  # rutnätsberäkning (layout.ts) + jsPDF-rendering
│  ├─ render.ts          #   sidhuvud/sidfot, sidbrytning, en rita-funktion per bladtyp
│  ├─ layout.ts          #   ren mm-matematik för rutnätet, delad med render.ts
│  ├─ clockFace.ts       #   urtavlan som vektorgrafik
│  ├─ fractionShape.ts   #   cirkel-/stapelfiguren som vektorgrafik
│  ├─ geometryFigure.ts  #   rektangel/triangel/cirkel med måttetiketter
│  ├─ trig.ts            #   delad trigonometrisk hjälpfunktion (punkt på en cirkel)
│  └─ format.ts          #   siffer-/svarsformatering för räknesätt
├─ ui/                   # formulär, förhandsvisning, snabbstartsknappar
└─ state/                # AppState <-> URL-query och <-> localStorage
```

Se [PLAN.md](./PLAN.md) för den ursprungliga projektplanen: arkitektur,
uppgiftsgenereringens regler, PDF-layoutens mått och milstolparna
räknesättsbladet byggdes i (klockan, bråk och geometri tillkom som
separata omgångar efter det).

## Driftsättning

`.github/workflows/deploy.yml` bygger och publicerar `dist/` till GitHub
Pages via GitHub Actions vid push till `main`. `.github/workflows/ci.yml`
kör typkontroll, lint, formatteringskontroll, tester och bygge på varje
push/PR.

Sidan körs på den egna domänen [matteuppgifter.se](https://matteuppgifter.se/)
(`public/CNAME`), inte under GitHub Pages standardadress — `vite.config.ts`
sätter därför `base: '/'`.
