/* STON 서비스워커 — 홈 화면 앱(PWA) 설치 지원 */
const CACHE = "ston-v3";   // ← 버전 올림: 활성화 시 옛 캐시(ston-v2 등) 전부 삭제 → 최신 코드 강제

self.addEventListener("install", (e) => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 네트워크 우선 — 항상 최신, 오프라인일 때만 캐시 폴백.
   index.html 등 HTML은 네트워크 실패 시에만 캐시 사용 → 평소엔 늘 최신 코드 */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
