// โหลดข้อมูล SRD (อังกฤษ) + คำอธิบายไทย แล้วทำดัชนี
export const D = {};

const SRD = ['classes', 'spells', 'species', 'backgrounds', 'feats', 'weapons', 'weaponProps', 'mastery', 'armor', 'gear', 'legal', 'glossary', 'weights'];
const TH = ['classes', 'species', 'backgrounds', 'feats', 'spells', 'options', 'mastery', 'misc', 'glossary', 'help'];

const OPEN = ['subclasses', 'backgrounds', 'feats', 'species', 'spells'];   // คอนเทนต์เปิด (OGL) data/open/<กลุ่ม>.json
const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });

export async function loadData() {
  const [srd, th, icons, subList, open] = await Promise.all([
    Promise.all(SRD.map(k => get(`data/srd/${k}.json`))),
    Promise.all(TH.map(k => get(`data/th/${k}.json`).catch(() => ({})))),
    get('data/icons.json'),
    get('data/subclass-list.json').catch(() => ({})),
    Promise.all([get('data/open/docs.json'), ...OPEN.map(k => get(`data/open/${k}.json`)), ...OPEN.map(k => get(`data/th/open/${k}.json`).catch(() => ({})))]).catch(() => null),
  ]);
  // คอนเทนต์เปิด (OGL 1.0a จาก Open5e) → ผสมใน applyPacks()
  D.open = { docs: open?.[0] || {}, th: {} };
  OPEN.forEach((k, i) => { D.open[k] = open?.[1 + i] || []; D.open.th[k] = open?.[1 + OPEN.length + i] || {}; });
  D.subList = subList;   // ชื่อซับคลาส PHB 2024 ครบ 48 (ชื่ออย่างเดียว) → {classId: [ชื่อ]}
  SRD.forEach((k, i) => (D[k] = srd[i]));
  D.th = {};
  TH.forEach((k, i) => (D.th[k] = th[i]));
  D.icons = icons;
  const idx = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  D.cls = idx(D.classes);
  D.sp = idx(D.species);
  D.bg = idx(D.backgrounds);
  D.feat = idx(D.feats);
  D.spell = idx(D.spells);
  D.spellByName = Object.fromEntries(D.spells.map(s => [s.name.toLowerCase(), s]));
  D.weapon = idx(D.weapons);
  D.armorById = idx(D.armor);
  D.masteryById = idx(D.mastery);
  D.glossaryById = idx(D.glossary);
  return D;
}

/** คำแปลเต็ม (data/th/full/<กลุ่ม>.json) — โหลดตอนกดเปิดครั้งแรก */
const FULL = {};
export function loadFull(g) {
  return (FULL[g] ||= get(`data/th/full/${g}.json`).catch(() => { delete FULL[g]; return {}; }));
}

/** คำอธิบายไทยของฟีเจอร์คลาส/ซับคลาส */
export function thFeature(classId, featId, sub = false) {
  const c = D.th.classes?.[classId];
  return (sub ? c?.sub?.f : c?.f)?.[featId];
}

/** สัตว์ SRD (ใช้ในแท็บ EXTRAS) — โหลดตอนต้องใช้ครั้งแรก */
export async function loadAnimals() {
  if (!D.animals) { D.animals = await get('data/srd/animals.json'); D.animal = Object.fromEntries(D.animals.map(a => [a.id, a])); }
  return D.animals;
}
