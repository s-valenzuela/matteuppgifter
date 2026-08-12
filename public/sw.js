// Cachar appskalet (dokumentet + de byggda tillgångarna det länkar till)
// redan i 'install', så att appen fungerar offline redan efter det FÖRSTA
// besöket — inte först efter besök nummer två (en sida som laddades INNAN
// en service worker blir aktiv styrs inte av den, så att bara luta sig mot
// runtime-cachning i 'fetch' hade krävt ett andra besök innan något fanns i
// cachen). Se avsnitt 8 i PLAN.md.
//
// Filnamnen på de byggda JS/CSS-tillgångarna är hashade av Vite och okända
// här i förväg, så i stället för en hårdkodad lista hämtas dokumentet självt
// och tillgångarnas URL:er plockas ut ur dess src/href-attribut.
const CACHE_NAME = 'matteuppgifter-v1';
const SHELL_URL = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// "Stale-while-revalidate": svarar direkt med ett cachat exemplar om det
// finns (utan att först vänta in eller ens försöka ett nätverksanrop), och
// uppdaterar cachen i bakgrunden. Enklare och pålitligare offline än
// "network-first" — den senare beror på att ett misslyckat fetch() faktiskt
// avvisas snabbt när nätet är nere, vilket visade sig bete sig oförutsägbart
// i praktiken.
//
// cache.match() slår upp med URL:en som sträng, INTE med event.request
// direkt: en riktig <script type="module">/<link rel=stylesheet>-begäran
// (mode "cors") missade annars sin cachade träff helt — trots att exakt
// samma URL låg där — medan en manuellt hopplockad Request (eller en
// no-cors-begäran, t.ex. en bild) matchade fint. Upptäcktes genom att
// faktiskt logga inifrån service workern och jämföra: matchning på URL
// istället för på Request-objektet löste det, se
// https://github.com/s-valenzuela/matteuppgifter (avsnitt 8 i PLAN.md).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(url.href, { ignoreVary: true, ignoreMethod: true });
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(url.href, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      const network = await networkFetch;
      if (network) {
        return network;
      }
      throw new Error('Offline och inget sparat i cache för denna resurs.');
    }),
  );
});

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const shellResponse = await fetch(SHELL_URL);
    if (!shellResponse.ok) return;
    const shellHtml = await shellResponse.clone().text();
    await cache.put(SHELL_URL, shellResponse);

    const assetUrls = extractSameOriginAssetUrls(shellHtml);
    await Promise.all(
      assetUrls.map(async (assetUrl) => {
        try {
          const res = await fetch(assetUrl);
          if (res.ok) {
            await cache.put(assetUrl, res);
          }
        } catch {
          // En enskild tillgång som inte går att hämta just nu ska inte
          // stoppa resten av förcachningen.
        }
      }),
    );
  } catch {
    // Offline redan vid installation (t.ex. utveckling utan nät) — då
    // fungerar 'fetch'-hanteraren ändå som ett fallback nästa gång det
    // finns nät.
  }
}

/** Plockar ut src="..."/href="..." från dokumentet, för att förcacha exakt de byggda tillgångarna. */
function extractSameOriginAssetUrls(html) {
  const urls = new Set();
  const attrPattern = /\b(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = attrPattern.exec(html))) {
    const value = match[1];
    if (value.startsWith('/') && !value.startsWith('//')) {
      urls.add(new URL(value, self.location.origin).href);
    }
  }
  return [...urls];
}
