// แคชไฟล์ไว้ให้เปิดเว็บได้แม้เน็ตหลุดตอนเล่น
const V = 'hh-v34';
const CORE = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/main.js', 'js/util.js', 'js/md.js', 'js/data.js', 'js/rules.js', 'js/fx.js', 'js/store.js',
  'js/views/parts.js', 'js/views/glossary.js', 'js/views/packs.js', 'js/packs.js', 'js/views/wizard.js', 'js/views/sheet.js', 'js/views/card.js', 'js/views/turn.js', 'js/views/home.js', 'js/views/levelup.js', 'js/views/explain.js', 'js/views/help.js',
  'data/icons.json', 'data/subclass-list.json', 'data/srd/animals.json',
  ...['classes', 'spells', 'species', 'backgrounds', 'feats', 'weapons', 'weaponProps', 'mastery', 'armor', 'gear', 'legal', 'glossary', 'weights'].map(k => `data/srd/${k}.json`),
  ...['classes', 'species', 'backgrounds', 'feats', 'spells', 'options', 'mastery', 'misc', 'glossary', 'help'].map(k => `data/th/${k}.json`),
  ...['options', 'feats', 'mastery', 'classes', 'species', 'spells', 'glossary'].map(k => `data/th/full/${k}.json`)];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ไฟล์ของเว็บ: ใช้เน็ตก่อน (ได้เวอร์ชันใหม่) ถ้าเน็ตหลุดค่อยใช้แคช
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('fonts.g'))) {
      const copy = res.clone();
      caches.open(V).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
