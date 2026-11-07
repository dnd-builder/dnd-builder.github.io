// Content Pack: ของที่ผู้ใช้เพิ่มเอง (Subclass / Background / Feat / Spell)
// เก็บใน localStorage แล้ว "ผสม" เข้ากับข้อมูล SRD ใน D ทุกครั้งที่แพ็กเปลี่ยน
import { D } from './data.js';
import { uid } from './util.js';

const KEY = 'hh.packs.v1';
export const TYPES = ['subclasses', 'backgrounds', 'feats', 'spells'];
export const TYPE_LABEL = { subclasses: 'Subclass', backgrounds: 'Background', feats: 'Feat', spells: 'Spell' };
export const TYPE_ICON = { subclasses: 'crown', backgrounds: 'background', feats: 'feat', spells: 'spell' };

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export const listPacks = () => Object.values(readAll()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const getPack = id => readAll()[id] || null;

export function newPack(name = 'แพ็กใหม่') {
  return { id: 'pk-' + uid(), name, author: '', desc: '', enabled: true, createdAt: Date.now(), items: emptyItems() };
}
const emptyItems = () => Object.fromEntries(TYPES.map(t => [t, []]));

export function savePack(p) {
  const all = readAll();
  p.updatedAt = Date.now();
  p.items = { ...emptyItems(), ...p.items };
  all[p.id] = p;
  const ok = writeAll(all);
  applyPacks();
  return ok;
}
export function removePack(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
  applyPacks();
}

/** id ของไอเทมในแพ็ก: slug ชื่อ + ท้ายสุ่ม → ไม่ชนกับ SRD และแพ็กอื่น */
export function itemId(name) {
  const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return (s || 'item') + '-' + Math.random().toString(36).slice(2, 6);
}

export const featIdOf = name => {
  const n = String(name || '').replace(/\s*\(.*\)/, '').trim().toLowerCase();
  return D.featByName?.[n]?.id || n.replace(/\s+/g, '-');
};

// ---------- คอนเทนต์เปิด (OGL) ----------
const META = 'hh.meta.v1';
const metaGet = () => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; } };
/** หนังสือที่มีของให้ใช้ → [{id, title, n}] */
export const OPEN_GROUPS = [['subclasses', 'ซับคลาส'], ['backgrounds', 'Background'], ['feats', 'Feat'], ['species', 'เผ่า'], ['spells', 'สเปล']];
export function openDocs() {
  const o = {};
  for (const [g] of OPEN_GROUPS) for (const x of D.open?.[g] || []) ((o[x.src] ||= {})[g] = (o[x.src][g] || 0) + 1);
  return Object.entries(o).map(([id, n]) => ({ id, n, title: docTitle(id), label: OPEN_GROUPS.filter(([g]) => n[g]).map(([g, l]) => `${l} ${n[g]}`).join(' · ') }));
}
export const docTitle = id => D.open?.docs?.[id]?.title || id;
/** เปิดใช้หนังสือนี้ไหม (ไม่ใส่ = ดูสวิตช์รวม) — ค่าเริ่มต้นเปิดทั้งหมด */
export const openOn = id => { const m = metaGet(); return m.openAll !== false && (!id || !m.openOff?.includes(id)); };
export function setOpen(id, on) {
  const m = metaGet();
  if (!id) m.openAll = on;
  else { const off = new Set(m.openOff || []); on ? off.delete(id) : off.add(id); m.openOff = [...off]; if (on) m.openAll = true; }
  try { localStorage.setItem(META, JSON.stringify(m)); } catch {}
  applyPacks();
}
/** กลุ่มไฟล์แปลเต็ม (data/th/full/<กลุ่ม>.json) ของคอนเทนต์ OGL */
export const openSpellFull = src => 'open-spells-' + (src === 'toh' ? 'toh' : src?.startsWith('dmag') ? 'dmag' : 'small');
export const featFull = id => String(id).startsWith('open:') ? ['open-feats', id] : ['feats', id];
export const traitFull = (sp, tid) => sp.open ? ['open-species', [sp.id, tid]] : ['species', [sp.id, tid]];
/** ป้ายแหล่งที่มา: 📖 หนังสือ OGL / 📦 แพ็ก */
export const srcTag = x => (x?.open ? '📖 ' : '📦 ') + x?.pack;
function openSub(s) {
  const pack = docTitle(s.src), th = D.open.th.subclasses?.[s.id] || {};
  return {
    ...s, pack, open: s.src, th: { s: th.s || '' },
    features: s.features.map(f => ({ ...f, pack, open: s.src, subName: s.name,
      th: { t: th.f?.[f.id]?.t || f.t, s: th.f?.[f.id]?.s || '', tip: th.f?.[f.id]?.tip }, full: ['open-subclasses', [s.id, f.id]] }))
  };
}

// ---------- ผสมแพ็กเข้ากับข้อมูล ----------
let BASE = null;
export function applyPacks() {
  if (!BASE) BASE = { backgrounds: D.backgrounds, feats: D.feats, spells: D.spells, species: D.species, th: { feats: { ...D.th.feats }, spells: { ...D.th.spells }, backgrounds: { ...D.th.backgrounds }, species: { ...D.th.species } } };
  const bgs = [...BASE.backgrounds], feats = [...BASE.feats], spells = [...BASE.spells];
  D.th.feats = { ...BASE.th.feats };
  D.th.spells = { ...BASE.th.spells };
  D.th.backgrounds = { ...BASE.th.backgrounds };
  D.th.species = { ...BASE.th.species };
  const packSubs = {};
  D.packOf = {};   // id ไอเทม → ชื่อแพ็ก
  D.thFull = { spells: {} };
  for (const p of listPacks()) {
    if (!p.enabled) continue;
    const it = p.items || {};
    const mark = x => { D.packOf[x.id] = p.name; x.pack = p.name; return x; };
    for (const s of it.subclasses || []) {
      if (!D.cls[s.classId]) continue;
      mark(s);
      s.features = (s.features || []).map(f => ({ ...f, pack: p.name, subName: s.name })).sort((a, b) => a.level - b.level);
      (packSubs[s.classId] ||= []).push(s);
    }
    for (const b of it.backgrounds || []) {
      bgs.push(mark({ ...b, tool: b.tool || '—', equipment: bgEquipText(b) }));
      D.th.backgrounds[b.id] = { desc: b.th?.s || '' };
    }
    for (const f of it.feats || []) {
      feats.push(mark({ ...f, tag: f.category + ' Feat' + (f.prereq ? ` (Prerequisite: ${f.prereq})` : '') }));
      D.th.feats[f.id] = f.th || {};
    }
    for (const s of it.spells || []) {
      spells.push(mark({ ...s, components: s.components || '' }));
      if (s.th?.s) D.th.spells[s.id] = s.th.s;
      if (s.th?.full) D.thFull.spells[s.id] = s.th.full;
    }
  }
  // คอนเทนต์เปิด: ทำดัชนีไว้ทุกตัว (ตัวละครที่เลือกไว้ยังเปิดได้แม้ปิดหนังสือ) แต่ให้เลือกได้เฉพาะหนังสือที่เปิด
  D.openSub ||= Object.fromEntries((D.open?.subclasses || []).map(s => [s.id, openSub(s)]));
  const openSubs = {};
  for (const s of Object.values(D.openSub)) if (D.cls[s.classId] && openOn(s.src)) (openSubs[s.classId] ||= []).push(s);
  // Background / Feat จากหนังสือ OGL
  const openBg = (D.open?.backgrounds || []).map(b => ({ ...b, pack: docTitle(b.src), open: b.src, tool: b.tool || '—', equipment: bgEquipText(b) }));
  const openFeat = (D.open?.feats || []).map(f => ({ ...f, pack: docTitle(f.src), open: f.src, tag: `${f.category} Feat (Prerequisite: ${f.prereq})` }));
  for (const b of openBg) { D.th.backgrounds[b.id] = { desc: D.open.th.backgrounds?.[b.id]?.s || '' }; if (openOn(b.src)) bgs.push(b); }
  for (const f of openFeat) { const t = D.open.th.feats?.[f.id] || {}; D.th.feats[f.id] = { t: t.t || f.t, s: t.s || '', tip: t.tip }; if (openOn(f.src)) feats.push(f); }
  // เผ่าจากหนังสือ OGL (ไม่มีโบนัสค่าพลัง · Subrace = Lineage ให้เลือก)
  const openSp = (D.open?.species || []).map(x => ({ ...x, pack: docTitle(x.src), open: x.src }));
  const species = [...BASE.species];
  for (const x of openSp) {
    const t = D.open.th.species?.[x.id] || {};
    D.th.species[x.id] = { tag: t.tag || '', desc: t.s || '', f: t.f || {}, ln: t.ln || {} };
    if (openOn(x.src)) species.push(x);
  }
  // สเปลจากหนังสือ OGL (ชื่อซ้ำ SRD ถูกตัดตั้งแต่ตัวแปลง)
  const openSpell = (D.open?.spells || []).map(x => ({ ...x, pack: docTitle(x.src), open: x.src }));
  for (const x of openSpell) { const t = D.open.th.spells?.[x.id]; if (t) D.th.spells[x.id] = t; if (openOn(x.src)) spells.push(x); }
  D.species = species; D.sp = { ...Object.fromEntries(openSp.map(x => [x.id, x])), ...Object.fromEntries(species.map(x => [x.id, x])) };
  D.backgrounds = bgs; D.feats = feats; D.spells = spells;
  const idx = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  D.bg = { ...idx(openBg), ...idx(bgs) }; D.feat = { ...idx(openFeat), ...idx(feats) }; D.spell = { ...idx(openSpell), ...idx(spells) };   // ของ OGL ที่ปิดเล่มยังหาเจอ (ตัวละครเดิมเปิดได้)
  D.spellByName = { ...Object.fromEntries(openSpell.map(s => [s.name.toLowerCase(), s])), ...Object.fromEntries(spells.map(s => [s.name.toLowerCase(), s])) };
  D.featByName = Object.fromEntries(feats.map(f => [f.name.toLowerCase(), f]));
  // ซับคลาส: [SRD, ...รายชื่อ PHB 2024 (ใช้ข้อมูลแพ็กที่ชื่อตรงกัน ไม่งั้นเป็นซับคลาสว่าง), ...ซับคลาสแพ็กอื่น ๆ]
  D.subs = {};
  for (const k of D.classes) {
    const ps = [...(packSubs[k.id] || [])], list = [k.subclass];
    for (const name of D.subList?.[k.id] || []) {
      if (normName(name) === normName(k.subclass.name)) continue;
      const phb = phbId(name), i = ps.findIndex(x => normName(x.name) === normName(name));
      if (i >= 0) { const x = ps.splice(i, 1)[0]; x.phb = phb; list.push(x); } else list.push(stubSub(k.id, name, phb));
    }
    D.subs[k.id] = [...list, ...ps, ...(openSubs[k.id] || [])];
  }
}

export const normName = s => String(s || '').trim().toLowerCase();
export const slugName = s => normName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const phbId = name => 'phb:' + slugName(name);
/** ซับคลาสที่มีแค่ชื่อ (ยังไม่มีข้อมูล) */
export const stubSub = (classId, name, id = null) => ({ id: id || phbId(name), classId, name, stub: true, phb: id || null, features: [], spells: [] });
/** ชื่อซับคลาส PHB ที่ยังไม่มีข้อมูล (ไม่มีแพ็กที่เปิดใช้ชื่อตรงกัน) */
export const missingSubs = classId => (D.subs?.[classId] || []).filter(s => s.stub && s.phb);
/** ลิงก์ไปสร้าง/แก้ซับคลาสชื่อนี้ในแพ็ก */
/** ค้นชื่อนี้ที่ D&D Beyond (ไว้อ่านข้อมูลจากหนังสือที่ซื้อไว้) */
export const ddbHref = name => `https://www.dndbeyond.com/search?q=${encodeURIComponent(name)}`;
export const fillHref = (classId, name) => `#/packs/fill/${classId}/${encodeURIComponent(name)}`;

export function bgEquipText(b) {
  return `Choose A or B: (A) ${b.equipA || '—'}; or (B) ${Number(b.gpB) || 50} GP`;
}

// ---------- ฝังของจากแพ็กไปกับตัวละคร (ลิงก์แชร์/ไฟล์สำรอง) ----------
export function usedPackItems(chars) {
  const want = { subclasses: new Set(), backgrounds: new Set(), feats: new Set(), spells: new Set() };
  for (const c of chars) {
    if (c.subclassId) want.subclasses.add(c.subclassId);
    for (const o of Object.values(c.mc || {})) if (o?.subclassId) want.subclasses.add(o.subclassId);
    if (c.bgId) want.backgrounds.add(c.bgId);
    const bg = D.bg[c.bgId];
    if (bg) want.feats.add(featIdOf(bg.feat));
    if (c.choices?.bgFeat) want.feats.add(c.choices.bgFeat);
    if (c.speciesOpt?.feat) want.feats.add(c.speciesOpt.feat);
    if (c.choices?.fightingStyle) want.feats.add(c.choices.fightingStyle);
    (c.feats || []).forEach(f => want.feats.add(f.id || f));
    const sp = c.spells || {};
    [...(sp.cantrips || []), ...(sp.prepared || []), ...(sp.book || [])].forEach(id => want.spells.add(id));
  }
  // ซับคลาสที่เลือกตามชื่อ PHB (phb:<slug>) → ใช้ของในแพ็กที่ชื่อตรงกัน
  const subWanted = x => want.subclasses.has(x.id) || want.subclasses.has(phbId(x.name));
  // สเปลประจำซับคลาสจากแพ็ก
  for (const p of listPacks()) for (const s of p.items?.subclasses || []) if (subWanted(s))
    for (const r of s.spells || []) String(r.list || '').split(',').forEach(n => { const x = D.spellByName[n.trim().toLowerCase()]; if (x && D.packOf[x.id]) want.spells.add(x.id); });
  const out = [];
  for (const p of listPacks()) {
    const items = {};
    let n = 0;
    for (const t of TYPES) { items[t] = (p.items?.[t] || []).filter(x => t === 'subclasses' ? subWanted(x) : want[t].has(x.id)); n += items[t].length; }
    if (n) out.push({ id: p.id, name: p.name, author: p.author || '', items });
  }
  return out;
}

/** รวมของที่ฝังมากับตัวละครเข้าแพ็กในเครื่อง (ไม่ทับของที่มีอยู่แล้ว) — คืนจำนวนที่เพิ่ม */
export function mergeEmbedded(packs) {
  if (!Array.isArray(packs) || !packs.length) return 0;
  const all = readAll();
  let added = 0;
  for (const ep of packs) {
    if (!ep?.id || !ep.items) continue;
    const p = all[ep.id] || { ...newPack(ep.name || 'แพ็กจากเพื่อน'), id: ep.id, author: ep.author || '', desc: 'ได้มาพร้อมตัวละครที่เพื่อนแชร์' };
    p.items = { ...emptyItems(), ...p.items };
    for (const t of TYPES) for (const x of ep.items[t] || []) {
      if (!x?.id || p.items[t].some(y => y.id === x.id)) continue;
      p.items[t].push(x); added++;
    }
    p.updatedAt = Date.now();
    all[p.id] = p;
  }
  writeAll(all);
  applyPacks();
  return added;
}

// ---------- ไฟล์แพ็ก ----------
export function exportPack(p) {
  const data = { app: 'hero-hall', kind: 'pack', v: 1, at: new Date().toISOString(), pack: p };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pack-${(p.name || 'pack').replace(/[\\/:*?"<>|]+/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** อ่านไฟล์แพ็ก — คืน pack (ยังไม่บันทึก) หรือ throw ข้อความไทย */
export async function readPackFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('ไฟล์นี้ไม่ใช่ JSON'); }
  const p = data?.pack || (data?.items && data?.name ? data : null);
  if (!p) throw new Error(data?.chars ? 'นี่เป็นไฟล์สำรองตัวละคร — นำเข้าที่หน้าแรกแทน' : 'ไม่พบข้อมูลแพ็กในไฟล์นี้');
  p.items = { ...emptyItems(), ...p.items };
  for (const t of TYPES) p.items[t] = (p.items[t] || []).filter(x => x && x.id && x.name);
  if (!p.id) p.id = 'pk-' + uid();
  return p;
}

export function importPack(p, asCopy) {
  if (asCopy) p = { ...p, id: 'pk-' + uid(), name: p.name + ' (สำเนา)' };
  p.createdAt ||= Date.now();
  if (p.enabled == null) p.enabled = true;
  savePack(p);
  return p;
}

export const countItems = p => TYPES.reduce((n, t) => n + (p.items?.[t]?.length || 0), 0);
