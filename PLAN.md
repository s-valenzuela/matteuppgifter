# Projektplan: Matteuppgifter — PDF-generator för de fyra räknesätten

## 1. Mål

En webbapp där en användare (förälder/lärare) konfigurerar och genererar utskrivbara
övningsblad med uppgifter i addition, subtraktion, multiplikation och division.

Grundprinciper:

- **100 % klientsida.** All generering av uppgifter och PDF sker i webbläsaren. Inget
  backend, ingen databas, ingen inloggning, inga användardata lämnar datorn.
- **Statisk hosting.** Kan ligga på GitHub Pages (eller vilken statisk host som helst).
- **Snabbt flöde.** Från öppnad sida till utskriven PDF på under 30 sekunder, utan att
  behöva förstå alla inställningar.
- **Svenska** i gränssnitt och på bladen (med i18n-förberedd struktur).

### Icke-mål (första versionen)

- Konton, sparade elevresultat, statistik.
- Rättning i appen / interaktiva uppgifter på skärm.
- Andra områden än de fyra räknesätten (bråk, klockan, geometri) — se avsnitt 10.

---

## 2. Teknikval

| Område | Val | Motivering |
| --- | --- | --- |
| Språk | TypeScript | Uppgiftsgeneratorn har många småregler; typer fångar fel tidigt. |
| Byggverktyg | Vite | Snabbt, noll konfiguration, bygger till ren statisk `dist/`. |
| UI | Vanilla TS + små moduler (inget ramverk) | Appen är i praktiken ett formulär + en förhandsvisning. Ramverk ger mer beroenden än nytta här. |
| PDF | **jsPDF** | Skapar riktig PDF i webbläsaren, en fil att ladda ner, deterministisk A4-layout. Standardfonterna (Helvetica, WinAnsi) täcker å/ä/ö. |
| Tester | Vitest | Generatorlogiken är ren och lätt att enhetstesta. |
| Hosting | GitHub Pages via GitHub Actions | Bygger och deployar automatiskt vid push till `main`. |

### Varför jsPDF och inte "skriv ut sidan" (`window.print`)?

Utskriftsvägen är enklare att bygga men ger sämre resultat: webbläsaren lägger på egna
sidhuvuden/sidfötter, sidbrytningar blir svårstyrda, och mobila webbläsare beter sig olika.
jsPDF ger en nedladdningsbar fil med exakt kontroll över A4-layouten.

**Förhandsvisningen använder samma kod som nedladdningen:** vi genererar PDF:en, gör en
`blob:`-URL och visar den i en `<iframe>`. Då finns bara *en* renderare att underhålla och
förhandsvisningen kan aldrig skilja sig från resultatet.

*Fallback:* om `<iframe>`-visning av PDF inte fungerar (vissa mobila webbläsare) visas i
stället en "Ladda ner"-knapp direkt.

---

## 3. Arkitektur

Tre lager med enkelriktat beroende — UI känner till generatorn, generatorn känner inte till UI.

```
   ┌──────────────┐   Config    ┌──────────────┐  Problem[]  ┌──────────────┐
   │      UI      │ ──────────► │  Generator   │ ──────────► │  PDF-render  │
   │  (formulär)  │             │ (ren logik)  │             │   (jsPDF)    │
   └──────────────┘             └──────────────┘             └──────────────┘
          ▲                                                          │
          └──────────────────── Blob-URL / nedladdning ──────────────┘
```

### Filstruktur

```
/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ .github/workflows/deploy.yml      # bygg + deploy till Pages
├─ src/
│  ├─ main.ts                        # start, kopplar ihop lagren
│  ├─ types.ts                       # Config, Problem, Operation
│  ├─ core/
│  │  ├─ rng.ts                      # seedad slumpgenerator (mulberry32)
│  │  ├─ generate.ts                 # uppgiftsgenerering per räknesätt
│  │  └─ validate.ts                 # normalisering + varningar för omöjliga val
│  ├─ pdf/
│  │  ├─ layout.ts                   # rutnätsberäkning (mm), sidbrytning
│  │  └─ render.ts                   # jsPDF: uppgiftsblad + facit
│  ├─ ui/
│  │  ├─ form.ts                     # kontroller, tvåvägsbindning mot Config
│  │  ├─ preview.ts                  # iframe-förhandsvisning, debounce
│  │  └─ presets.ts                  # färdiga nivåer/snabbval
│  └─ state/
│     ├─ urlState.ts                 # Config <-> query string (delbar länk)
│     └─ storage.ts                  # localStorage (senast använda inställningar)
└─ test/
   ├─ generate.test.ts
   └─ layout.test.ts
```

### Datamodell (utkast)

```ts
type Operation = 'add' | 'sub' | 'mul' | 'div';

interface Range { min: number; max: number }

interface OperationConfig {
  enabled: boolean;
  operandRange: Range;        // t.ex. 0–10, 10–20, 0–100
  resultRange?: Range;        // valfri gräns på svaret (främst för addition)
  // per räknesätt:
  noNegative?: boolean;       // subtraktion: aldrig negativt svar
  exactDivision?: boolean;    // division: alltid jämnt (ingen rest)
  allowRemainder?: boolean;   // division: skriv svar som "kvot rest r"
  tables?: number[];          // multiplikation: begränsa till t.ex. [2,5,10]
}

interface Config {
  operations: Record<Operation, OperationConfig>;
  problemsPerPage: number;    // 10–60
  pages: number;              // 1–20
  columns: number | 'auto';
  fontSize: number;           // pt, 10–36
  layout: 'grid' | 'vertical';// vågrätt (3 + 4 = __) eller uppställning
  answerStyle: 'blank' | 'box' | 'line';
  includeAnswerKey: boolean;  // facit som extra sida/sidor
  avoidDuplicates: boolean;
  shuffle: boolean;           // blanda räknesätten om flera är valda
  header: { title: string; showName: boolean; showDate: boolean };
  seed: number;               // för reproducerbara blad
}
```

---

## 4. Uppgiftsgenerering — regler

Generatorn är **ren och seedad**: samma `Config` + samma `seed` ger alltid samma blad.
Det gör bladen delbara via länk och testerna deterministiska.

| Räknesätt | Metod | Varför |
| --- | --- | --- |
| Addition | dra `a`, `b` ur talområdet; om `resultRange` är satt, dra om tills `a+b` ryms | Låter en förälder styra "svaret får inte gå över 20". |
| Subtraktion | dra `a`, `b`; om `noNegative` och `b > a`, byt plats | Byte i stället för omdragning ger jämnare fördelning än att kasta uppgifter. |
| Multiplikation | dra faktorer ur talområdet, eller ur `tables` om satt | Gör det möjligt att öva "tvåans och femmans tabell". |
| Division | dra divisor `b` och kvot `q`, sätt `a = b * q` | Garanterar jämn division utan omdragningar. Med `allowRemainder` läggs en rest `r < b` till på `a`. |

**Detaljer att bevaka:**

- `b = 0` uteslutet vid division.
- Talområdet gäller **operanderna** som standard; `resultRange` är ett separat, valfritt tak.
- `avoidDuplicates` håller ett `Set` över nyckeln `op:a:b`. Om mängden möjliga uppgifter är
  mindre än antalet begärda (t.ex. 60 unika additioner i 0–5) ger `validate.ts` en varning i
  gränssnittet och fyller på med upprepningar i stället för att låsa sig i en loop.
- Kommutativa dubbletter (3+4 och 4+3) räknas som olika som standard, med en inställning för
  att slå ihop dem.
- Vid flera valda räknesätt fördelas uppgifterna jämnt och blandas om `shuffle` är på.

---

## 5. PDF-layout

- **Sidformat:** A4 stående (210 × 297 mm), marginal 15 mm. Liggande som senare tillägg.
- **Rubrikrad:** valfri titel + fält för `Namn: ______` och `Datum: ______`.
- **Rutnät:** antal kolumner beräknas från textstorlek och längsta uppgiftssträngen, eller
  sätts manuellt. Radhöjd följer textstorleken så att stor text ger luftigare blad automatiskt.
- **Uppgiftsnummer** (1., 2., 3. …) framför varje uppgift.
- **Två layouter:**
  - `grid` — vågrätt: `12 + 7 = ____`
  - `vertical` — uppställning med talen under varandra och streck, för större tal.
- **Sidbrytning:** när raderna tar slut skapas ny sida; `pages` styr hur många blad som genereras.
- **Facit:** samma rutnät med svaren ifyllda, på egna sidor sist, tydligt märkta "Facit".
- **Sidfot:** liten text med `sida X av Y` och seed-värdet (så att ett blad kan återskapas).

`layout.ts` innehåller ren mm-matematik utan jsPDF-beroende — den delen är enhetstestbar.

---

## 6. Gränssnitt

Ett enda skärmläge, tvådelat: **inställningar till vänster, förhandsvisning till höger**
(staplat på mobil). Förhandsvisningen uppdateras med ~300 ms debounce.

Innehåll i inställningspanelen:

1. **Räknesätt** — fyra kryssrutor med stora ikoner (+ − × ÷).
2. **Nivå** — snabbval som chips: `0–10`, `0–20`, `10–20`, `0–100`, `Tabeller 1–10`,
   samt `Eget område` med min/max. Nivå kan sättas gemensamt eller per räknesätt
   (en "avancerat"-växel öppnar per-räknesätt-vyn).
3. **Blad** — antal uppgifter per blad, antal blad, kolumner, textstorlek (slider med
   direkt effekt i förhandsvisningen), layout, svarsstil.
4. **Extra** — facit, rubrik, namn-/datumfält, undvik dubbletter, seed + "slumpa om".
5. **Knappar** — `Ladda ner PDF`, `Skriv ut`, `Kopiera länk till dessa inställningar`,
   `Återställ`.

**Snabbstart:** tre färdiga knappar högst upp ("Addition 0–10", "Multiplikationstabeller",
"Blandat 0–100") som fyller i allt och genererar direkt.

**Tillgänglighet:** alla kontroller har `<label>`, formuläret går att nå med tangentbord,
fokusmarkering behålls, kontrastnivå AA, respekterar `prefers-reduced-motion` och
`prefers-color-scheme`.

**Persistens:** senaste konfigurationen sparas i `localStorage` och läses in vid start.
URL:en speglar konfigurationen (`?ops=add,mul&min=0&max=20&n=30&seed=12345`) så att ett
blad kan delas eller bokmärkas.

---

## 7. Kvalitet och tester

- **Enhetstester (Vitest)** på generatorn:
  - alla uppgifter ligger inom valt talområde,
  - subtraktion ger aldrig negativt svar när `noNegative` är på,
  - division går alltid jämnt när `exactDivision` är på och divisor ≠ 0,
  - `avoidDuplicates` ger unika uppgifter så länge mängden räcker,
  - samma seed ger identiskt resultat, olika seed ger olika.
- **Layouttester:** kolumn-/radberäkning ger aldrig överlapp eller innehåll utanför marginalen.
- **Rökprov:** generera PDF för ett antal konfigurationer och kontrollera att sidantalet stämmer
  och att filen inte är tom.
- **Manuell checklista:** utskrift på fysisk A4 i Chrome, Firefox och Safari; mobil i Safari iOS
  och Chrome Android.
- **CI:** GitHub Actions kör `typecheck`, `test` och `build` på varje push och PR.

---

## 8. Hosting och leverans

- `.github/workflows/deploy.yml`: bygger med Vite och publicerar `dist/` till GitHub Pages
  vid push till `main`. Pages sätts till "GitHub Actions" som källa.
- Sidan körs på den egna domänen matteuppgifter.se (`public/CNAME`) i stället för under
  GitHub Pages standardadress — `vite.config.ts` sätter därför `base: '/'`.
- Inga externa körtidsanrop — appen fungerar offline efter första besöket.
  Enkel service worker + web app manifest läggs till i M5 så den kan "installeras" och
  användas utan nät.

---

## 9. Milstolpar

| # | Milstolpe | Innehåll | Klart när |
| --- | --- | --- | --- |
| M0 | Grund | Vite + TS + Vitest, ESLint/Prettier, Actions för CI och Pages, tom sida deployad | Sidan syns på Pages-URL:en |
| M1 | Generator | `rng.ts`, `generate.ts`, `validate.ts` + tester för alla fyra räknesätten | Testerna gröna, uppgifter loggas i konsolen |
| M2 | PDF | `layout.ts` + `render.ts`: rutnät, rubrik, sidbrytning, facit | Nedladdad PDF ser rätt ut i A4 |
| M3 | UI | Formulär, live-förhandsvisning, nedladdning, snabbstartsknappar | Hela flödet fungerar utan att röra koden |
| M4 | Delning | Seed, URL-tillstånd, localStorage, "kopiera länk" | En länk återskapar exakt samma blad |
| M5 | Polering | Uppställningslayout, mobilanpassning, tillgänglighet, offline/PWA, README | Checklistan i avsnitt 7 avklarad |

Milstolparna är ordnade så att M1–M2 kan byggas och verifieras helt utan gränssnitt, och
M3 blir ett tunt lager ovanpå färdig, testad logik.

---

## 10. Möjliga tillägg efter M5

- Fler områden: tal som saknas (`3 + __ = 10`), jämförelser (`< > =`), klockan, bråk,
  enkla textuppgifter.
- Liggande A4, flera blad per ark, klippbara kort.
- "Elevserie": generera 10 olika blad på samma nivå i en och samma PDF.
- Tidsutmaning: 20 uppgifter med plats för tid högst upp.
- Räknesätt i uppställning med minnessiffror för större tal.
- Engelskt gränssnitt (strängarna hålls redan samlade från början).

## 11. Risker

| Risk | Hantering |
| --- | --- |
| jsPDF-fonter renderar å/ä/ö fel | Standardfonten är WinAnsi-kodad och täcker svenska tecken; verifieras i M2, annars bäddas en TTF in. |
| Förhandsvisning i `<iframe>` fungerar dåligt på mobil | Fallback till nedladdningsknapp; upptäcks och hanteras i M3. |
| Omöjliga konfigurationer (fler unika uppgifter än vad området rymmer) | `validate.ts` varnar i gränssnittet och begränsar i stället för att hänga. |
| Scope-glidning mot fler matteområden | Avsnitt 10 håller tilläggen utanför M0–M5. |
