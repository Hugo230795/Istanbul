// Garde le kit de vol sur l'appareil pour l'ouvrir sans réseau (portée : le dossier vol/ seulement).
const VERSION = "kit-vol-2026-11-11-1";
const FICHIERS = ["./", "./index.html", "./manifest.webmanifest", "./icone-180.png", "./icone-192.png", "./icone-512.png"];
const POLICES = "https://fonts.googleapis.com/css2?family=Young+Serif&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap";

self.addEventListener("install", evenement => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(FICHIERS);
    // Polices : facultatives, la page a des polices de secours.
    try {
      const reponse = await fetch(POLICES);
      if (reponse.ok) {
        const css = await reponse.clone().text();
        await cache.put(POLICES, reponse);
        const fichiers = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(fichiers.map(u => fetch(u).then(r => r.ok && cache.put(u, r)).catch(() => {})));
      }
    } catch (erreur) { /* pas de polices hors ligne */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", evenement => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) if (nom.startsWith("kit-vol-") && nom !== VERSION) await caches.delete(nom);
    await self.clients.claim();
  })());
});

// Cache d'abord : rapide, et sans risque derrière le portail Wi-Fi d'un avion. La copie se met à jour en arrière-plan.
self.addEventListener("fetch", evenement => {
  const requete = evenement.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  const dossier = new URL("./", self.location).pathname;
  const local = url.origin === self.location.origin && url.pathname.startsWith(dossier);
  const police = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!local && !police) return;
  evenement.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const enCache = await cache.match(requete, { ignoreSearch: local, ignoreVary: true })
      || (requete.mode === "navigate" ? await cache.match("./") : undefined);
    const reseau = fetch(requete).then(reponse => {
      if (reponse.ok && !reponse.redirected && (reponse.type === "basic" || reponse.type === "cors")) cache.put(requete, reponse.clone());
      return reponse;
    });
    if (enCache) { evenement.waitUntil(reseau.catch(() => {})); return enCache; }
    return reseau;
  })());
});
