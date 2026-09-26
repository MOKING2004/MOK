/* ============================================
   Service Worker — برنامه هفتگی
   کش کامل + آفلاین + آپدیت هوشمند
   ============================================ */

const CACHE_VERSION = 'barnameh-v1.0.0';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_FONTS = `${CACHE_VERSION}-fonts`;

/* فایل‌هایی که در نصب اولیه کش می‌شن */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

/* نصب: کش کردن فایل‌های اصلی */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* فعال‌سازی: پاک کردن کش‌های قدیمی */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* استراتژی کش */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Google Fonts → Cache First (چون تغییر نمی‌کنن) */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  /* HTML / صفحه اصلی → Network First (همیشه آخرین نسخه) */
  if (request.mode === 'navigate' ||
      request.destination === 'document' ||
      url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request, CACHE_STATIC));
    return;
  }

  /* بقیه → Stale While Revalidate (سریع + آپدیت پس‌زمینه) */
  event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
});

/* ============ استراتژی‌ها ============ */

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;

    /* اگر صفحه HTML بود و کش نبود، index رو برگردون */
    const fallback = await cache.match('./index.html') ||
                     await cache.match('./');
    if (fallback) return fallback;

    return new Response(
      '<h1 style="font-family:sans-serif;text-align:center;padding:40px;direction:rtl">آفلاین هستی 📴</h1>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('', { status: 408 });
}

/* پیام‌ها از سمت کلاینت */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
