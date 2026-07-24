/* STON 서비스워커 — 홈 화면 앱(PWA) + 오프라인 대비 */
const CACHE = "ston-v4";

self.addEventListener("install", (e) => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 네트워크 우선 — 항상 최신 코드. 신호가 없을 때만 캐시로 대체해서 현장에서도 열리게 */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = req.url;
  /* 데이터 통신(파이어베이스/카카오 등)은 건드리지 않음 */
  if (!url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("index.html")))
  );
});
