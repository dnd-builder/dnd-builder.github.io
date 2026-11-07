// แถบเทิร์นแบบ BG3 — นับ Action / Bonus Action / Reaction / Movement ต่อเทิร์น (เก็บใน c.play.turn)
import { D, thFeature } from '../data.js';
import { h, sheet, toast, sign, uid } from '../util.js';
import { featureCard, classFeatureCard, spellDetail, TYPE_LABEL, LEVEL_TH } from './parts.js';
import { featFull, traitFull } from '../packs.js';
import { showTerm } from './glossary.js';
import { dmgRange, dmgText, spellMath, featureMath, formula, explain, attackBody } from './explain.js';
import { col, ABIL_SHORT } from '../rules.js';
import { FX_PRESET, COND_FX, roundsOf } from '../fx.js';

const INCAP = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];
const NO_MOVE = ['Grappled', 'Restrained', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];
export const BASIC = [
  ['dash', 'Dash', 'ได้ Movement เพิ่มอีกเท่าของ Speed'],
  ['disengage', 'Disengage', 'เดินออกจากระยะศัตรูโดยไม่โดน Opportunity Attack'],
  ['dodge', 'Dodge', 'ศัตรูตีเรามี Disadvantage · เซฟ DEX มี Advantage (จนถึงต้นเทิร์นหน้า)'],
  ['help', 'Help', 'ช่วยเพื่อนให้ได้ Advantage ในการทอยครั้งถัดไป'],
  ['hide', 'Hide', 'ทอย DEX (Stealth) เพื่อซ่อนตัว'],
  ['influence', 'Influence', 'โน้มน้าว / หลอก / ข่มขู่ครีเจอร์'],
  ['ready', 'Ready', 'เตรียมท่ารอเงื่อนไข แล้วใช้ Reaction ตอนเกิดเหตุ'],
  ['search', 'Search', 'ทอย WIS เพื่อหา / สังเกตบางอย่าง'],
  ['study', 'Study', 'ทอย INT เพื่อนึกความรู้ / วิเคราะห์'],
  ['utilize', 'Utilize', 'ใช้สิ่งของที่ต้องใช้ Action เช่น ไขกลไก'],
];
// ทรัพยากรที่ใช้แล้วกิน Bonus Action / ให้ Action เพิ่ม (id ไม่รวม prefix คลาสที่ 2)
const RES_ECON = { rage: 'b', sw: 'b', surge: 'surge', bardic: 'b', wild: 'b', fe: 'b', innate: 'b', adrenaline: 'b' };
export const KIND_TH = { a: 'Action', b: 'Bonus Action', r: 'Reaction' };

const fresh = round => ({ round, a: 0, aMax: 1, b: 0, r: 0, move: 0, dash: 0, atk: 0, slot: 0, once: {} });
export const incap = P => P.conditions.some(k => INCAP.includes(k));
const speedMax = (P, x) => (P.conditions.some(k => NO_MOVE.includes(k)) ? 0 : x.speed * (1 + P.turn.dash));
const closeAll = () => document.querySelectorAll('#sheet-root .bs-backdrop').forEach(b => b.click());

export function leftOf(P) {
  const t = P.turn, no = incap(P);
  return { a: no ? 0 : Math.max(0, t.aMax - t.a), b: no || t.b ? 0 : 1, r: no || t.r ? 0 : 1 };
}

/** ใช้ Action/Bonus/Reaction 1 ครั้ง — คืนข้อความสั้นไว้ต่อท้าย toast (ขึ้นต้น ⚠ = เกิน) */
export function spend(P, kind) {
  const t = P.turn;
  if (!t || !kind) return '';
  if (kind === 'surge') { t.aMax++; return 'Action Surge: ได้ Action เพิ่ม 1'; }
  if (incap(P)) return '⚠ ติด Incapacitated — ใช้ Action/Bonus/Reaction ไม่ได้';
  if (kind === 'a') { if (t.a >= t.aMax) return '⚠ Action เทิร์นนี้หมดแล้ว'; t.a++; t.atk = 0; return 'ใช้ Action'; }
  if (kind === 'b') { if (t.b) return '⚠ Bonus Action เทิร์นนี้ใช้ไปแล้ว'; t.b = 1; return 'ใช้ Bonus Action'; }
  if (kind === 'r') { if (t.r) return '⚠ Reaction ใช้ไปแล้ว (ได้คืนตอนเริ่มเทิร์นเรา)'; t.r = 1; return 'ใช้ Reaction'; }
  return '';
}

/** ทอยโจมตีด้วยอาวุธ = Attack action (นับ Extra Attack ให้) */
export function attack(P, x) {
  const t = P.turn;
  if (!t) return '';
  t.hit = 1;
  const per = x.atkPer || 1;
  if (t.atk > 0 && t.atk < per) { t.atk++; const m = `โจมตี ${t.atk}/${per}`; if (t.atk >= per) t.atk = 0; return m; }
  const m = spend(P, 'a');
  if (m.startsWith('⚠')) return m;
  if (per > 1) { t.atk = 1; return `Attack action · โจมตี 1/${per}`; }
  return 'ใช้ Attack action';
}

/** ใช้ Spell Slot ในเทิร์นเรา (กฎ 2024: 1 สลอตต่อเทิร์น) */
export function slot(P) {
  const t = P.turn;
  if (!t) return '';
  if (t.slot) return '⚠ เทิร์นนี้ใช้ Spell Slot ไปแล้ว (กฎ 2024: ร่ายด้วยสลอตได้ 1 ครั้งต่อเทิร์น)';
  t.slot = 1;
  return '';
}

/** กดใช้ทรัพยากร (จุด) — ถ้าเป็นของที่กิน Bonus Action / Action Surge ให้มาร์คแถบเทิร์นเอง */
export function resUsed(P, id, x) {
  const i = id.indexOf('-');
  const k = i > 0 && D.cls[id.slice(0, i)] ? id.slice(i + 1) : id;
  if (k === 'rage') addFx(P, { key: 'rage' });
  if (!P.turn) return '';
  const econ = RES_ECON[k] || (x && featureActions(x).find(f => f.r?.id === id)?.k);
  return spend(P, econ);
}

export const castKind = s => (/^Bonus Action/i.test(s.time) ? 'b' : /^Reaction/i.test(s.time) ? 'r' : /^Action/i.test(s.time) ? 'a' : null);

function slotPools(x, P) {
  const seen = new Map();
  for (const b of x.casting) for (const [lv, n] of Object.entries(b.slots || {})) {
    const key = (b.pact ? 'p' : '') + lv;
    if (!seen.has(key)) seen.set(key, { key, lv: +lv, pact: !!b.pact, left: n - (P.slots[key] || 0) });
  }
  return [...seen.values()];
}
const canCast = (s, pools) => !s.level || pools.some(p => p.lv >= s.level && p.left > 0);

/** ปุ่มใต้การ์ดสเปล: ร่ายแล้วหักสลอต + มาร์คแถบเทิร์น */
export function castActions(s, x, P, done) {
  if (x.noCast) return [{ label: '🐾 ร่ายไม่ได้ตอนอยู่ในร่างสัตว์', onClick: () => false }];
  const go = key => {
    const k0 = castKind(s);
    if (P.turn) {
      const L = leftOf(P), warn = [];
      if (k0 && !L[k0] && !(k0 === 'a' && P.turn.atk)) warn.push(`${KIND_TH[k0]} เทิร์นนี้หมดแล้ว`);
      if (key && k0 !== 'r' && P.turn.slot) warn.push('เทิร์นนี้ใช้ Spell Slot ไปแล้ว (กฎ 2024: 1 สลอตต่อเทิร์น)');
      if (s.concentration && P.conc && P.conc !== s.id) warn.push(`ตอนนี้ใช้สมาธิกับ ${D.spell[P.conc]?.name} อยู่ — ร่ายอันนี้แล้วอันเก่าจะหลุด`);
      if (warn.length && !confirm(`⚠ ${warn.join('\n⚠ ')}\n\nร่ายต่อไหม?`)) return false;
    }
    if (key) P.slots[key] = (P.slots[key] || 0) + 1;
    const k = castKind(s), msgs = [];
    if (P.turn) { if (key && k !== 'r') msgs.push(slot(P)); msgs.push(spend(P, k)); }
    if (s.concentration) { const old = P.conc && D.spell[P.conc]; if (old && old.id !== s.id) { msgs.push(`สมาธิ ${old.name} หลุด`); dropFx(P, e => e.conc === old.id); } P.conc = s.id; msgs.push('🧠 เริ่มใช้สมาธิ'); }
    const rd = roundsOf(s.duration);
    if (rd) { addFx(P, { key: s.id, name: s.name, left: rd, conc: s.concentration ? s.id : null }); msgs.push(`⏳ นับ ${rd} รอบ`); }
    const m = msgs.filter(Boolean);
    toast(`✨ ร่าย ${s.name}${key ? ` (${key.startsWith('p') ? 'Pact ' : ''}Slot Lv ${key.replace('p', '')})` : ''}${m.length ? ' · ' + m.join(' · ') : ''}`);
    done();
  };
  if (!s.level) return [{ label: 'ร่าย', primary: true, onClick: () => go(null) }];
  const ok = slotPools(x, P).filter(p => p.lv >= s.level && p.left > 0).sort((a, b) => a.lv - b.lv);
  if (!ok.length) return [{ label: 'สลอตหมดแล้ว', onClick: () => false }];
  const acts = [{ label: `ร่าย (Slot Lv ${ok[0].lv})`, primary: true, onClick: () => go(ok[0].key) }];
  if (ok.length > 1) acts.push({ label: 'ใช้สลอตสูงกว่า…', onClick: () => {
    let close;
    close = sheet('เลือกระดับสลอต', h('div.menu-list', ok.slice(1).map(p => h('button.menu-item', { onclick: () => { close(); go(p.key); } },
      `${p.pact ? 'Pact ' : ''}Slot Lv ${p.lv} · เหลือ ${p.left}`))));
  } });
  return acts;
}

/** ของที่ต้องจำว่าใช้ไปแล้วในเทิร์นนี้ (1 ครั้งต่อเทิร์น) */
export function onceItems(x) {
  const L = [];
  if (x.CLs.rogue) { const d = col(D.cls.rogue, 'Sneak Attack', x.CLs.rogue) || `${Math.ceil(x.CLs.rogue / 2)}d6`; L.push(['sneak', 'Sneak Attack', `+${d} (${dmgRange(d)}) — ต้องมี Advantage หรือเพื่อนอยู่ข้างเป้า`]); }
  if (x.picks?.blessedStrikes === 'Divine Strike') L.push(['divine-strike', 'Divine Strike', `+${x.CLs.cleric >= 14 ? '2d8' : '1d8'} Necrotic/Radiant ตอนตีโดนด้วยอาวุธ`]);
  if (x.picks?.elementalFury === 'Primal Strike') L.push(['primal-strike', 'Primal Strike', `+${x.CLs.druid >= 15 ? '2d8' : '1d8'} Cold/Fire/Lightning/Thunder ตอนตีโดนด้วยอาวุธหรือร่างสัตว์`]);
  if (x.featIds.includes('savage-attacker')) L.push(['savage', 'Savage Attacker', 'ทอยดาเมจอาวุธ 2 รอบ เลือกอันสูง']);
  if (x.featIds.includes('boon-of-combat-prowess')) L.push(['prowess', 'Peerless Aim', 'ตีพลาด → เปลี่ยนเป็นโดน']);
  return L;
}

// ---------- แถบบนใบตัวละคร ----------
export function turnBar(c, x, P, save, redraw) {
  const t = P.turn;
  if (!t) return h('div.turn', h('button.turn-start', { onclick: () => { P.turn = fresh(1); save(); redraw(); } }, '⚔️ เริ่มต่อสู้ — นับ Action / Bonus / Reaction'), fxRow(P, save, redraw));
  const L = leftOf(P), sp = speedMax(P, x), mv = Math.max(0, sp - t.move), no = incap(P);
  const ch = () => { save(); redraw(); };
  const pill = (cls, label, val, on, onclick) => h(`button.tpill.${cls}${on ? '' : '.used'}`, { onclick, 'aria-label': label, 'aria-pressed': on ? 'false' : 'true' },
    h('i'), h('small', label), val != null ? h('b', val) : null);
  const notes = [`รอบ ${t.round}`];
  if (t.atk > 0) notes.push(`⚔️ ตีต่อได้อีก ${x.atkPer - t.atk}`);
  if (t.slot) notes.push('ใช้สลอตแล้ว');
  for (const [id, name] of onceItems(x)) if (t.once[id]) notes.push(`${name} ✓`);
  if (no) notes.push('⚠ Incapacitated');
  else if (!sp) notes.push('⚠ Speed 0');
  return h('div.turn',
    h('div.turn-bar',
      pill('t-a', 'Action', t.aMax > 1 ? `${L.a}/${t.aMax}` : null, L.a > 0, () => { if (no) return; t.a = t.a >= t.aMax ? 0 : t.a + 1; t.atk = 0; ch(); }),
      pill('t-b', 'Bonus', null, L.b > 0, () => { if (no) return; t.b = t.b ? 0 : 1; ch(); }),
      pill('t-r', 'React', null, L.r > 0, () => { if (no) return; t.r = t.r ? 0 : 1; ch(); }),
      pill('t-m', `${mv}ft`, null, mv > 0, () => moveSheet(x, P, ch)),
      h('button.tbtn', { onclick: () => openPanel(c, x, P, save, redraw), 'aria-label': 'เหลืออะไรทำได้อีก' }, '📋'),
      h('button.tbtn.next', { onclick: () => nextTurn(x, P, save, redraw), 'aria-label': 'เทิร์นใหม่' }, '⏭')),
    h('p.turn-note', notes.join(' · ')),
    fxRow(P, save, redraw));
}

function moveSheet(x, P, ch) {
  const t = P.turn, sp = speedMax(P, x);
  let close;
  const btn = (label, fn) => h('button.btn', { onclick: () => { fn(); ch(); close(); } }, label);
  const dash = k => () => { const m = spend(P, k); if (!m.startsWith('⚠')) t.dash++; toast(m.startsWith('⚠') ? m : `Dash: Movement +${x.speed} ft`); };
  close = sheet(`Movement · เหลือ ${Math.max(0, sp - t.move)}/${sp} ft`, h('div.move-sheet',
    sp === 0 ? h('p.tip', '⚠ Speed เป็น 0 จาก Condition ที่ติดอยู่') : null,
    h('p.muted.small', 'เดินไปเท่าไหร่ก็กดหักไว้ — แบ่งเดินก่อน/หลังโจมตีได้'),
    h('div.row.wrap', [5, 10, 15, 20, 30].map(n => btn(`−${n}`, () => { t.move = Math.min(sp, t.move + n); }))),
    h('div.row.wrap', btn('คืน +5', () => { t.move = Math.max(0, t.move - 5); }), btn('รีเซ็ต', () => { t.move = 0; })),
    h('div.row.wrap', btn('Dash (ใช้ Action)', dash('a')),
      (x.CLs.rogue || 0) >= 2 ? btn('Dash (Bonus · Cunning Action)', dash('b')) : null,
      P.conditions.includes('Prone') ? btn(`ลุกขึ้น (−${Math.floor(x.speed / 2)} ft)`, () => { t.move += Math.floor(x.speed / 2); P.conditions = P.conditions.filter(k => k !== 'Prone'); }) : null)));
}

// ---------- ฟีเจอร์ที่ใช้ Action / Bonus / Reaction ----------
/** ทุกฟีเจอร์ (คลาส ซับคลาส แพ็ก feat species) ที่ th.t เป็น action|magic|bonus|reaction — ไม่สนว่าเหลือใช้ไหม */
export function featureActions(x) {
  const out = [], seen = new Set();
  const add = (name, th, card, cid) => {
    const k = { action: 'a', magic: 'a', bonus: 'b', reaction: 'r' }[th?.t];
    if (!k || seen.has(name)) return;
    seen.add(name);
    out.push({ k, name, th, card, math: () => featureMath(name, x, cid), r: x.res.find(r => r.name.split(' (')[0] === name) || null });
  };
  if (x.cls) for (const f of x.feats) add(f.name, f.pack ? f.th : thFeature(x.cls.id, f.id, f.src === 'sub'), () => classFeatureCard(x.cls, f, f.src === 'sub'), x.cls.id);
  for (const mc of x.mcFeats) for (const f of mc.feats) add(f.name, f.pack ? f.th : thFeature(mc.cls.id, f.id, f.src === 'sub'), () => classFeatureCard(mc.cls, f, f.src === 'sub'), mc.cls.id);
  for (const id of new Set(x.featIds)) { const f = D.feat[id]; if (f) add(f.name, D.th.feats?.[id], () => featureCard({ name: f.name, text: f.text, th: D.th.feats?.[id], tag: f.category, full: featFull(id), pack: f.pack, open: f.open })); }
  if (x.sp) for (const tr of x.sp.traits) { const th = D.th.species?.[x.sp.id]?.f?.[tr.id] || (x.sp.open ? { t: tr.t } : null); add(tr.name, th, () => featureCard({ name: tr.name, text: tr.text, th, full: traitFull(x.sp, tr.id), pack: x.sp.open ? x.sp.pack : null, open: x.sp.open })); }
  return out;
}
export const resLeft = (P, r) => (r ? r.max - (P.res[r.id] || 0) : null);

/** เปิดการ์ดฟีเจอร์ + ปุ่ม "ใช้" (หักจำนวนครั้ง + มาร์คแถบเทิร์นถ้ากำลังสู้) */
export function useFeature(P, it, done) {
  const left = resLeft(P, it.r);
  const acts = [];
  if (left === 0) acts.push({ label: 'ใช้ครบแล้ว — รอพักก่อน', onClick: () => false });
  else if (it.r || P.turn) acts.push({ label: `ใช้ (${KIND_TH[it.k]})`, primary: true, onClick: () => {
    const m = P.turn ? spend(P, it.k) : '';
    if (!m.startsWith('⚠') && it.r) { P.res[it.r.id] = (P.res[it.r.id] || 0) + 1; if (/(^|-)rage$/.test(it.r.id)) addFx(P, { key: 'rage' }); }
    toast([it.name, m, it.r ? `เหลือ ${resLeft(P, it.r)}/${it.r.max}` : ''].filter(Boolean).join(' · ')); done();
  } });
  acts.push(pinAct(P, 'feat:' + it.name, done));
  sheet(it.name, h('div', ...(it.math?.() || []), it.card()), acts);
}

/** การ์ด Action พื้นฐานที่ทุกคนทำได้ */
export function basicSheet(P, [id, name, s], done) {
  sheet(name + ' action', h('p.th', s), [
    { label: 'ความหมายเต็ม', onClick: () => { showTerm(id); } },
    pinAct(P, 'basic:' + id, done),
    ...(P.turn ? [{ label: 'ใช้ (Action)', primary: true, onClick: () => { const m = spend(P, 'a'); if (id === 'dash' && !m.startsWith('⚠')) P.turn.dash++; if (id === 'dodge' && !m.startsWith('⚠')) addFx(P, { key: 'dodge' }); toast(`${name} · ${m}`); done(); } }] : [])]);
}

// ---------- แผง "เหลืออะไรทำได้อีก" ----------
function collect(c, x, P, save, redraw) {
  const items = { a: [], b: [], r: [] }, seen = new Set();
  const done = () => { save(); closeAll(); redraw(); };
  for (const it of featureActions(x)) {
    const left = resLeft(P, it.r);
    if (left === 0) continue;
    items[it.k].push({ name: it.name, s: it.th.s, note: it.r ? `เหลือ ${left}` : null, tag: TYPE_LABEL[it.th.t], open: () => useFeature(P, it, done) });
  }

  // สเปลที่ร่ายได้ตอนนี้ (Cantrip เสมอ · สเปลมีเลเวลต้องมีสลอตเหลือ)
  const pools = slotPools(x, P);
  if (!x.noCast) for (const b of x.casting) for (const id of [...(b.cantrips || []), ...(b.always || []), ...(b.prepared || [])]) {
    const s = D.spell[id], k = s && castKind(s);
    if (!k || seen.has('sp:' + id) || !canCast(s, pools)) continue;
    seen.add('sp:' + id);
    items[k].push({ name: s.name, s: D.th.spells?.[id], tag: LEVEL_TH(s.level), spell: true, open: () => spellDetail(s, castActions(s, x, P, done), spellMath(s, b, x)) });
  }
  return { items, done };
}

export function attackSheet(x, P, kind, title, done) {
  let close;
  close = sheet(title, h('div.card.list', x.attacks.map(a => h('div.atk', { onclick: () => {
    const m = kind === 'a' ? attack(P, x) : spend(P, kind);
    const r = dmgRange(a.dmg);
    toast(`⚔️ ${a.name}: ทอย d20 ${sign(a.hit)} · ดาเมจ ${a.dmg}${r ? ` (${r})` : ''}${m ? ' · ' + m : ''}`);
    close(); done();
  } }, h('div', h('b', a.name), h('small', a.props || '')), h('span.atk-hit', sign(a.hit)), h('span.atk-dmg', a.dmg, dmgRange(a.dmg) ? h('small.rng', ` (${dmgRange(a.dmg)})`) : null)))));
}

export function openPanel(c, x, P, save, redraw) {
  const t = P.turn, L = leftOf(P);
  const { items, done } = collect(c, x, P, save, redraw);
  const row = it => h('button.titem', { onclick: it.open },
    h('div', h('b', it.name), it.tag ? h('i.tag', it.tag) : null, it.s ? h('small', it.s) : null), it.note ? h('span.badge', it.note) : null);
  const out = [];
  const surge = x.res.find(r => /^surge$|-surge$/.test(r.id));
  if (L.a > 0 || t.atk > 0) {
    const light = x.attacks.filter(a => /\bLight\b/.test(a.props || '')).length >= 2;
    const head = [];
    if (t.atk > 0) head.push({ name: `⚔️ โจมตีต่อ (เหลือ ${x.atkPer - t.atk} ครั้ง)`, s: 'ยังอยู่ใน Attack action เดิม', open: () => attackSheet(x, P, 'a', 'โจมตีต่อ', done) });
    if (L.a > 0) head.push({ name: 'โจมตี (Attack action)', s: x.atkPer > 1 ? `ตีได้ ${x.atkPer} ครั้ง (Extra Attack)` : 'ตีด้วยอาวุธ 1 ครั้ง', open: () => attackSheet(x, P, 'a', 'เลือกอาวุธ', done) });
    out.push(h('h3.tsec.t-a', `🟢 Action${t.aMax > 1 ? ` (เหลือ ${L.a})` : ''}`), h('div.titems', [...head, ...(L.a > 0 ? items.a : [])].map(row)));
    if (L.a > 0) out.push(h('details.orig', h('summary', 'Action พื้นฐาน (Dash, Dodge, Hide…)'), h('div.titems', BASIC.map(b => row({ name: b[1], s: b[2], open: () => basicSheet(P, b, done) })))));
    if (light && L.b > 0) items.b.unshift({ name: 'โจมตีมือรอง (Light)', s: 'หลังโจมตีด้วยอาวุธ Light ตีด้วยอาวุธ Light อีกอันได้ (ไม่บวกค่าพลังในดาเมจ)', open: () => attackSheet(x, P, 'b', 'โจมตีมือรอง', done) });
  }
  if (surge && surge.max - (P.res[surge.id] || 0) > 0 && !incap(P)) out.unshift(h('div.titems', row({ name: '⚡ Action Surge', s: 'ได้ Action เพิ่มอีก 1 ในเทิร์นนี้', note: `เหลือ ${surge.max - (P.res[surge.id] || 0)}`,
    open: () => { P.res[surge.id] = (P.res[surge.id] || 0) + 1; toast(spend(P, 'surge')); done(); } })));
  if (L.b > 0 && items.b.length) out.push(h('h3.tsec.t-b', '🔺 Bonus Action'), h('div.titems', items.b.map(row)));
  if (L.r > 0) out.push(h('h3.tsec.t-r', '🟣 Reaction'), h('div.titems', [{ name: 'Opportunity Attack', s: 'ศัตรูเดินออกจากระยะเอื้อม → ตีได้ 1 ครั้ง', open: () => attackSheet(x, P, 'r', 'Opportunity Attack', done) }, ...items.r].map(row)));
  const once = onceItems(x);
  if (once.length) out.push(h('h3.tsec', '1 ครั้งต่อเทิร์น'), h('div.chips', once.map(([id, name]) => h('button.chip' + (t.once[id] ? '.on' : ''), { onclick: e => {
    t.once[id] = !t.once[id]; e.currentTarget.classList.toggle('on', !!t.once[id]); save(); redraw(); } }, name))),
  h('p.muted.small', once.map(o => `${o[1]}: ${o[2]}`).join(' · ')));
  if (!L.a && !L.b && !L.r && !t.atk) out.unshift(h('p.tip', incap(P) ? '⚠ ติด Incapacitated — ทำอะไรไม่ได้ในเทิร์นนี้' : 'เทิร์นนี้ใช้ Action / Bonus / Reaction หมดแล้ว — เดินที่เหลือได้ แล้วกด ⏭ เทิร์นใหม่'));
  out.push(h('details.orig', h('summary', 'ท่าทั่วไป (Grapple, Shove, กระโดด, ดื่มยา…)'), h('div.titems', MOVES.map(m => row({ name: m.name, s: m.s, tag: MOVE_TAG[m.k], open: () => moveCard(m, x, P, done) })))));
  out.push(h('p.muted.small', `👣 เดินได้อีก ${Math.max(0, speedMax(P, x) - t.move)} ft · แตะแต่ละอันเพื่อดูคำอธิบายและกดใช้`));
  sheet(`เหลืออะไรทำได้อีก · รอบ ${t.round}`, h('div.tpanel', ...out), [
    { label: 'จบการต่อสู้', onClick: () => { endCombat(P); save(); redraw(); toast('จบการต่อสู้แล้ว'); } },
  ]);
}

// ---------- เอฟเฟกต์นับรอบ (เฟส 4E) — c.play.fx = [{id, key, name, left, conc?, cond?, save?}] ----------
const fxList = P => (P.fx = P.fx || []);
/** ใส่เอฟเฟกต์ (key ซ้ำ = ต่อเวลาใหม่แทนของเดิม) */
export function addFx(P, e) {
  const p = FX_PRESET[e.key] || {};
  const it = { id: uid(), key: e.key || null, name: e.name || p.name || 'เอฟเฟกต์', left: e.left ?? p.rounds ?? 10, conc: e.conc || null, cond: e.cond || null, save: e.save || null };
  const L = fxList(P), i = e.key ? L.findIndex(z => z.key === e.key) : -1;
  if (i >= 0) L[i] = { ...it, id: L[i].id }; else L.push(it);
  if (it.cond && !P.conditions.includes(it.cond)) P.conditions.push(it.cond);
  return it;
}
/** เอาเอฟเฟกต์ออก (ถ้าผูก Condition ไว้ เอา Condition ออกด้วย) */
export function dropFx(P, pred) {
  const L = fxList(P), gone = L.filter(pred);
  P.fx = L.filter(e => !gone.includes(e));
  for (const e of gone) if (e.cond && !P.fx.some(z => z.cond === e.cond)) P.conditions = P.conditions.filter(k => k !== e.cond);
  return gone;
}
/** จบการต่อสู้: เอฟเฟกต์ที่เหลือ ≤ 1 รอบ (Dodge / Reckless) และ Rage จบตาม */
export function endCombat(P) {
  P.turn = null;
  dropFx(P, e => e.left <= 1 || e.key === 'rage');
}
const fxTh = e => FX_PRESET[e.key]?.th || (e.cond ? COND_FX[e.cond]?.th : '') || (D.spell[e.key] ? D.th.spells?.[e.key] : '') || '';
const roundsTxt = n => (n >= 10 && n % 10 === 0 ? `${n} รอบ (${n / 10} นาที)` : `${n} รอบ`);

function fxRow(P, save, redraw) {
  const L = fxList(P);
  if (!L.length && !P.turn) return null;
  const ch = () => { save(); redraw(); };
  return h('div.fx-row.no-swipe',
    L.map(e => h('button.fx-chip' + (e.left <= 1 ? '.end' : ''), { onclick: () => fxSheet(P, e, ch) },
      e.conc ? '🧠 ' : e.cond ? '⚠ ' : '⏳ ', e.name, ' ', h('b', String(e.left)))),
    h('button.fx-chip.add', { onclick: () => addFxSheet(P, ch), 'aria-label': 'เพิ่มเอฟเฟกต์' }, '+ เอฟเฟกต์'));
}

function fxSheet(P, e, ch) {
  const th = fxTh(e);
  sheet(e.name, h('div.explain',
    h('p.formula', `เหลืออีก ${roundsTxt(e.left)}`),
    th ? h('p.th', th) : null,
    e.cond ? h('p.small', `⚠ ผูกกับ Condition ${e.cond} — หมดเวลาแล้วเอาออกให้เอง`) : null,
    e.save ? h('p.small', `🎲 ท้ายเทิร์นเราทอยเซฟ ${ABIL_SHORT[e.save]} ซ้ำได้ ผ่านแล้วหลุด (เว็บจะเตือนตอนกด ⏭)`) : null,
    e.conc ? h('p.small', '🧠 เป็นเวท Concentration — สมาธิหลุดเมื่อไหร่ เอฟเฟกต์นี้หายไปด้วย') : null,
    h('p.muted.small', 'ตัวเลขลดลง 1 ทุกครั้งที่กด ⏭ เทิร์นใหม่ (1 รอบ = 6 วินาที · 1 นาที = 10 รอบ)'),
    h('div.row.wrap',
      h('button.btn', { onclick: () => { e.left = Math.max(1, e.left - 1); ch(); } }, '−1 รอบ'),
      h('button.btn', { onclick: () => { e.left++; ch(); } }, '+1 รอบ'))), [
    { label: 'เอาออก', onClick: () => { dropFx(P, z => z === e); if (e.conc && P.conc === e.conc) P.conc = null; ch(); toast(`${e.name} หมดแล้ว`); } },
    { label: 'ปิด', primary: true },
  ]);
}

function addFxSheet(P, ch) {
  const presets = [['bless', 'Bless'], ['bane', 'Bane'], ['haste', 'Haste'], ['dodge', 'Dodge'], ['reckless', 'Reckless Attack'], ['rage', 'Rage'], ['shield-of-faith', 'Shield of Faith'], ['blur', 'Blur']];
  const st = { key: null, name: '', left: 10, cond: '', save: '' };
  const nameI = h('input', { placeholder: 'ชื่อ เช่น Frightened จากมังกร', oninput: e => { st.name = e.target.value; st.key = null; } });
  const leftI = h('input', { type: 'number', min: 1, max: 999, value: 10, oninput: e => { st.left = +e.target.value || 1; } });
  const condS = h('select', { onchange: e => { st.cond = e.target.value; if (st.cond && !st.name) { st.name = st.cond; nameI.value = st.cond; } } },
    h('option', { value: '' }, '— ไม่ผูก —'), Object.keys(COND_FX).map(k => h('option', { value: k }, k)));
  const saveS = h('select', { onchange: e => { st.save = e.target.value; } },
    h('option', { value: '' }, '— ไม่ต้อง —'), Object.entries(ABIL_SHORT).map(([k, v]) => h('option', { value: k }, `เซฟ ${v}`)));
  sheet('+ เอฟเฟกต์บนตัวเรา', h('div.fx-add',
    h('p.muted.small', 'เลือกแบบสำเร็จรูป หรือพิมพ์เอง — เว็บนับถอยหลังทุกครั้งที่กด ⏭ แล้วเตือนตอนหมด'),
    h('div.chips', presets.map(([k, n]) => h('button.chip', { onclick: ev => {
      st.key = k; st.name = n; nameI.value = n; st.left = FX_PRESET[k].rounds; leftI.value = st.left;
      ev.currentTarget.parentNode.querySelectorAll('.on').forEach(b => b.classList.remove('on')); ev.currentTarget.classList.add('on');
    } }, n))),
    h('label.fld', h('span', 'ชื่อ'), nameI),
    h('label.fld', h('span', 'นานกี่รอบ (1 นาที = 10)'), leftI),
    h('label.fld', h('span', 'ติด Condition ด้วย'), condS),
    h('label.fld', h('span', 'ทอยเซฟซ้ำท้ายเทิร์น'), saveS)), [
    { label: 'ยกเลิก' },
    { label: 'เพิ่ม', primary: true, onClick: () => {
      if (!st.name.trim()) { toast('ใส่ชื่อก่อน'); return false; }
      addFx(P, { key: st.key, name: st.name.trim(), left: st.left, cond: st.cond || null, save: st.save || null });
      ch(); toast(`⏳ ${st.name} · ${roundsTxt(st.left)}`);
    } },
  ]);
}

// ---------- ⏭ เทิร์นใหม่: นับรอบ + เตือนท้ายเทิร์น/ต้นเทิร์น ----------
const hasF = (x, id) => x.feats?.some(f => f.id === id) || x.mcFeats?.some(mc => mc.feats.some(f => f.id === id));
export function nextTurn(x, P, save, redraw) {
  const prev = P.turn, items = [];
  const ch = () => { save(); redraw(); };
  const item = (title, body, btns) => {
    const box = h('div.nt-item', h('b', title), ...[].concat(body).filter(Boolean));
    if (btns?.length) box.append(h('div.row.wrap', btns.map(([label, fn, primary]) => h('button.btn.small' + (primary ? '.primary' : ''), { onclick: () => {
      const r = fn(); ch(); box.classList.add('done'); box.querySelectorAll('button').forEach(b => { b.disabled = true; }); if (r) box.append(h('p.small', '✓ ' + r));
    } }, label))));
    items.push(box);
  };

  // ท้ายเทิร์นที่แล้ว: เซฟซ้ำ
  for (const e of fxList(P).filter(z => z.save)) {
    const sv = x.saves.find(z => z.ab === e.save);
    item(`ท้ายเทิร์น: ทอยเซฟ ${ABIL_SHORT[e.save]} เพื่อหลุดจาก ${e.name}`, sv ? formula(`ทอยเซฟ ${ABIL_SHORT[e.save]}`, sv.bonus, sv.parts, x.rf('save', e.save)) : null, [
      ['ผ่าน — หลุดแล้ว', () => { dropFx(P, z => z === e); return `${e.name} หมดแล้ว`; }, true],
      ['ไม่ผ่าน', () => 'ยังติดอยู่'],
    ]);
  }
  // Rage (2024): จบถ้าเทิร์นที่แล้วไม่ได้โจมตี/บังคับให้ศัตรูเซฟ หรือไม่ได้ใช้ Bonus Action ต่อ
  if (fxList(P).some(z => z.key === 'rage') && prev && !prev.hit) item('🔥 Rage จะจบไหม?',
    h('p.small', 'เทิร์นที่แล้วเรายังไม่ได้ทอยโจมตีศัตรู — Rage อยู่ต่อได้ถ้าเทิร์นที่แล้วเราบังคับให้ศัตรูทอยเซฟ หรือใช้ Bonus Action ต่อเวลา'), [
      ['บังคับศัตรูเซฟแล้ว (อยู่ต่อ)', () => 'Rage อยู่ต่อ'],
      ['ใช้ Bonus Action ต่อ', () => { const m = spend(P, 'b'); return m.startsWith('⚠') ? m : 'ใช้ Bonus Action ต่อ Rage'; }],
      ['จบ Rage', () => { dropFx(P, z => z.key === 'rage'); return 'Rage จบแล้ว'; }],
    ]);

  // นับรอบ
  const expired = [];
  for (const e of fxList(P)) e.left--;
  for (const e of dropFx(P, z => z.left <= 0)) { expired.push(e.name); if (e.conc && P.conc === e.conc) P.conc = null; }
  P.turn = fresh((prev?.round || 0) + 1);
  if (expired.length) item('⌛ หมดเวลาแล้ว', h('p.small', expired.join(', ')));
  const soon = fxList(P).filter(z => z.left === 1).map(z => z.name);
  if (soon.length) item('⏳ เหลือรอบสุดท้าย', h('p.small', soon.join(', ')));

  // ต้นเทิร์น
  if (P.hp === 0) {
    const parts = P.exh ? [['Exhaustion', -2 * P.exh]] : [];
    const flags = hasF(x, 'survivor') ? [{ t: 'adv', why: 'Defy Death' }] : [];
    const d = P.death = P.death || { s: 0, f: 0 };
    item('💀 HP 0 — ทอย Death Saving Throw', [formula('ทอย d20 เปล่า ๆ', -2 * (P.exh || 0), parts, flags),
      h('p.small', `10 ขึ้นไป = ผ่าน · ต่ำกว่า 10 = ไม่ผ่าน · ได้ 20${flags.length ? ' (หรือ 18–20)' : ''} = ฟื้น 1 HP · ได้ 1 = ไม่ผ่าน 2 ช่อง`),
      h('p.muted.small', `ตอนนี้ ผ่าน ${d.s}/3 · ไม่ผ่าน ${d.f}/3`)], [
      ['ผ่าน', () => { d.s = Math.min(3, d.s + 1); return d.s >= 3 ? 'ผ่านครบ 3 — Stable แล้ว (ไม่ต้องทอยอีก)' : `ผ่าน ${d.s}/3`; }, true],
      ['ไม่ผ่าน', () => { d.f = Math.min(3, d.f + 1); return d.f >= 3 ? '💀 ไม่ผ่านครบ 3 — ตัวละครตาย' : `ไม่ผ่าน ${d.f}/3`; }],
      ['ได้ 20 — ฟื้น 1 HP', () => { P.hp = 1; P.death = { s: 0, f: 0 }; P.conditions = P.conditions.filter(k => k !== 'Unconscious'); return 'ฟื้นแล้ว HP 1'; }],
      ['ได้ 1', () => { d.f = Math.min(3, d.f + 2); return d.f >= 3 ? '💀 ไม่ผ่านครบ 3 — ตัวละครตาย' : `ไม่ผ่าน ${d.f}/3`; }],
    ]);
  } else if (hasF(x, 'survivor') && P.hp <= x.hpMax / 2) {
    const n = 5 + (x.m.con || 0);
    item('💪 Heroic Rally', h('p.small', `HP เหลือไม่ถึงครึ่ง (Bloodied) — ต้นเทิร์นฟื้น HP ${n} (5 + CON)`), [
      ['ฟื้น HP', () => { P.hp = Math.min(x.hpMax, P.hp + n); return `HP ${P.hp}`; }, true]]);
  }
  if (P.conc) items.push(h('p.muted.small', `🧠 ยังใช้สมาธิกับ ${D.spell[P.conc]?.name || P.conc} อยู่`));
  ch();
  const head = `เริ่มเทิร์นใหม่ · รอบ ${P.turn.round}`;
  if (!items.length) { toast(`${head} — Action / Bonus / Reaction / Movement คืนหมด`); return; }
  sheet(head, h('div.nt', h('p.muted.small', 'Action / Bonus Action / Reaction / Movement คืนหมดแล้ว'), ...items), [{ label: 'เริ่มเทิร์น', primary: true }]);
}

// ---------- ท่าทั่วไปที่ทุกคนทำได้ (เฟส 4E) ----------
export const MOVE_TAG = { atk: 'แทนการโจมตี 1 ครั้ง', a: 'Action', b: 'Bonus Action', move: 'ใช้ระยะเดิน', free: 'ฟรี' };
export const MOVES = [
  { id: 'grapple', k: 'atk', name: 'Grapple (จับล็อก)', s: 'ใช้แทนการโจมตี 1 ครั้งใน Attack action — เป้าทอยเซฟ ไม่ผ่าน = ติด Grappled (Speed 0)' },
  { id: 'shove', k: 'atk', name: 'Shove (ผลัก / ทำล้ม)', s: 'ใช้แทนการโจมตี 1 ครั้ง — เป้าทอยเซฟ ไม่ผ่าน = ผลักออก 5 ฟุต หรือทำให้ล้ม (Prone)' },
  { id: 'escape', k: 'a', name: 'หลุดจากการจับ', s: 'ถ้าเราโดน Grapple อยู่ ใช้ Action ทอย Athletics หรือ Acrobatics เพื่อหลุด' },
  { id: 'jump', k: 'move', name: 'กระโดด', s: 'กระโดดไกล / กระโดดสูง — ระยะที่กระโดดหักจากระยะเดิน' },
  { id: 'throw', k: 'atk', name: 'ขว้างของ (Improvised)', s: 'ขว้างของที่ไม่ใช่อาวุธ เช่น ขวด เก้าอี้ ก้อนหิน' },
  { id: 'stabilize', k: 'a', name: 'ปฐมพยาบาลเพื่อนที่ล้ม', s: 'เพื่อน HP 0 อยู่ข้าง ๆ — ทอย Medicine ให้ได้ 10 เพื่อให้เขาหยุดทอย Death Save' },
  { id: 'potion', k: 'b', name: 'ดื่มยา / ป้อนยา', s: 'ดื่มยาเองหรือป้อนให้เพื่อนที่อยู่ติดกัน ใช้ Bonus Action (กฎ 2024)' },
  { id: 'draw', k: 'free', name: 'ชัก / เก็บอาวุธ', s: 'ทุกครั้งที่โจมตี ชักหรือเก็บอาวุธได้ฟรี 1 ชิ้น' },
];
const plusN = n => (n < 0 ? '−' : '+') + Math.abs(n);

/** การ์ดท่าทั่วไป: สูตรด้วยตัวเลขของเรา + ปุ่มใช้ */
export function moveCard(m, x, P, done) {
  const M = ab => x.m[ab] || 0, dc = 8 + M('str') + x.pb, exh = P.exh ? [['Exhaustion', -2 * P.exh]] : [];
  const sk = n => x.skills.find(z => z.name === n);
  const body = [h('p.th', m.s)];
  if (m.id === 'grapple' || m.id === 'shove') body.push(
    h('div.formula', h('div.f-main', h('span', 'เป้าทอยเซฟ STR หรือ DEX (มันเลือก)'), h('b', `DC ${dc}`)), h('div.f-parts', h('span', '8'), h('span', `STR ${plusN(M('str'))}`), h('span', `Proficiency ${plusN(x.pb)}`))),
    h('p.small', 'เป้าต้องตัวใหญ่กว่าเราไม่เกิน 1 ขนาด และอยู่ในระยะเอื้อม'),
    m.id === 'grapple' ? h('p.small', 'จับได้ต้องมีมือว่าง 1 ข้าง · เดินลากเป้าไปด้วยได้ แต่ระยะเดินเสียเพิ่ม 1 ฟุตทุก 1 ฟุต (ถ้าเป้าไม่ได้ตัวเล็กกว่าเรา 2 ขนาด) · เป้าหลุดเองถ้าเราติด Incapacitated หรือห่างเกินระยะเอื้อม') :
      h('p.small', 'ผลักเป้าออกไป 5 ฟุต หรือทำให้มันล้ม (Prone) — ศัตรูที่ล้มอยู่ เพื่อนในระยะ 5 ฟุตตีมันมี Advantage'));
  if (m.id === 'escape') { const a = sk('Athletics'), b = sk('Acrobatics');
    body.push(formula('ทอย Athletics', a.bonus, a.parts, x.rf('check', 'str', 'Athletics')), formula('ทอย Acrobatics', b.bonus, b.parts, x.rf('check', 'dex', 'Acrobatics')),
      h('p.small', 'เลือกอันที่บวกเยอะกว่า · DC = DC ของคนที่จับเรา (DM บอก)')); }
  if (m.id === 'jump') { const S = x.score.str;
    body.push(h('div.formula', h('div.f-main', h('span', 'กระโดดไกล (วิ่งมาก่อน 10 ฟุต)'), h('b', `${S} ft`)), h('div.f-parts', h('span', `= ค่า STR ${S}`), h('span', `ยืนกระโดดเฉย ๆ ได้ครึ่งเดียว ${Math.floor(S / 2)} ft`))),
      h('div.formula', h('div.f-main', h('span', 'กระโดดสูง (วิ่งมาก่อน 10 ฟุต)'), h('b', `${Math.max(0, 3 + M('str'))} ft`)), h('div.f-parts', h('span', `= 3 + STR ${plusN(M('str'))}`), h('span', `ยืนกระโดดเฉย ๆ ได้ครึ่งเดียว ${Math.floor(Math.max(0, 3 + M('str')) / 2)} ft`))),
      h('p.small', 'ทุก 1 ฟุตที่กระโดดหักจากระยะเดิน 1 ฟุต · จะกระโดดเกินนี้ DM อาจให้ทอย Athletics')); }
  if (m.id === 'throw') { const hit = M('str') - 2 * (P.exh || 0), d = `1d4${M('str') ? plusN(M('str')).replace('−', '-') : ''}`;
    body.push(formula('ทอยโจมตี', hit, [['STR', M('str')], ...exh], x.rf('atk', 'str')),
      h('div.formula', h('div.f-main', h('span', 'ดาเมจ'), h('b', ...dmgText(d))), h('div.f-parts', h('span', 'ระยะ 20/60 ฟุต · ไม่ได้บวก Proficiency (ไม่ใช่อาวุธ)'))),
      h('p.small', 'ถ้าของนั้นหน้าตาเหมือนอาวุธ (เช่น ขาเก้าอี้ ≈ Club) DM อาจให้ใช้ค่าของอาวุธนั้นแทน')); }
  if (m.id === 'stabilize') { const a = sk('Medicine');
    body.push(formula('ทอย Medicine (Help action)', a.bonus, a.parts, x.rf('check', 'wis', 'Medicine')), h('p.small', 'ได้ 10 ขึ้นไป = เพื่อน Stable: หยุดทอย Death Save แต่ยังสลบอยู่ (HP 0) · ถ้ามี Healer\'s Kit ใช้แทนได้ไม่ต้องทอย')); }
  if (m.id === 'potion') body.push(h('div.formula', h('div.f-main', h('span', 'Potion of Healing'), h('b', ...dmgText('2d4+2'))), h('div.f-parts', h('span', 'Greater 4d4+4 (8–20) · Superior 8d4+8 (16–40) · Supreme 10d4+20 (30–60)'))));
  if (m.id === 'draw') body.push(h('p.small', 'ชักอาวุธออกมาหรือเก็บเข้าฝัก 1 ชิ้นต่อการโจมตี 1 ครั้ง · ถ้าจะสลับหลายชิ้น ชิ้นต่อไปใช้ "หยิบ/ใช้ของชิ้นเล็ก" ที่ฟรี 1 อย่างต่อเทิร์น'));
  const acts = [pinAct(P, 'move:' + m.id, done)];
  if (P.turn && ['atk', 'a', 'b'].includes(m.k)) acts.push({ label: m.k === 'atk' ? 'ใช้ (แทนการโจมตี)' : `ใช้ (${KIND_TH[m.k]})`, primary: true, onClick: () => {
    const msg = m.k === 'atk' ? attack(P, x) : spend(P, m.k);
    toast([m.name, msg].filter(Boolean).join(' · ')); done();
  } });
  sheet(m.name, h('div.explain', body), acts);
}

// ---------- Hotbar ของโปรด (เฟส 4E) — c.play.hotbar = ['feat:<ชื่อ>', 'spell:<id>', 'atk:<id>', 'basic:<id>', 'move:<id>'] ----------
const bar = P => (P.hotbar = P.hotbar || []);
export function pinAct(P, ref, done) {
  const on = bar(P).includes(ref);
  return { label: on ? '📌 เอาออกจากแถบ' : '📌 ปักหมุด', onClick: () => {
    P.hotbar = on ? bar(P).filter(r => r !== ref) : [...bar(P), ref];
    toast(on ? 'เอาออกจากแถบของโปรดแล้ว' : '📌 ปักไว้ที่แถบของโปรดแล้ว (ใต้แถบเทิร์น)'); done();
  } };
}

/** แปลง ref → {label, icon, off, open} — ไม่เจอ (เช่น ลบอาวุธไปแล้ว) = null */
function resolveRef(ref, x, P, done) {
  const i = ref.indexOf(':'), t = ref.slice(0, i), id = ref.slice(i + 1);
  if (t === 'feat') {
    const it = featureActions(x).find(f => f.name === id);
    return it && { label: id, icon: '★', off: resLeft(P, it.r) === 0, open: () => useFeature(P, it, done) };
  }
  if (t === 'spell') {
    const s = D.spell[id], b = s && x.casting.find(z => [...(z.cantrips || []), ...(z.always || []), ...(z.prepared || [])].includes(id));
    return b && { label: s.name, icon: '✨', off: !canCast(s, slotPools(x, P)), open: () => spellDetail(s, [...castActions(s, x, P, done), pinAct(P, ref, done)], spellMath(s, b, x)) };
  }
  if (t === 'atk') {
    const a = x.attacks.find(z => z.id === id);
    return a && { label: a.name, icon: '⚔️', open: () => explain(a.name, attackBody(a, x), [pinAct(P, ref, done),
      ...(P.turn ? [{ label: 'ใช้โจมตี', primary: true, onClick: () => { toast(`⚔️ ${a.name} · ${attack(P, x) || 'โจมตี'}`); done(); } }] : [])]) };
  }
  if (t === 'basic') { const b = BASIC.find(z => z[0] === id); return b && { label: b[1], icon: '●', open: () => basicSheet(P, b, done) }; }
  if (t === 'move') { const m = MOVES.find(z => z.id === id); return m && { label: m.name.split(' (')[0], icon: '🤸', open: () => moveCard(m, x, P, done) }; }
  return null;
}

export function hotbar(c, x, P, save, redraw) {
  const done = () => { save(); closeAll(); redraw(); };
  const L = bar(P).map(r => resolveRef(r, x, P, done)).filter(Boolean);
  if (!L.length) return null;
  return h('div.hotbar.no-swipe', L.map(r => h('button.hb' + (r.off ? '.off' : ''), { onclick: r.open }, h('i', r.icon), r.label)),
    h('button.hb.hb-edit', { onclick: () => editBar(x, P, save, redraw), 'aria-label': 'จัดแถบของโปรด' }, '✎'));
}

/** จัดลำดับ / เอาออก */
function editBar(x, P, save, redraw) {
  const list = h('div.card.list');
  const fill = () => {
    const B = bar(P);
    list.replaceChildren(...B.map((ref, i) => {
      const r = resolveRef(ref, x, P, () => {});
      const mv = d => { const j = i + d; [B[i], B[j]] = [B[j], B[i]]; save(); redraw(); fill(); };
      return h('div.hb-row', h('span', r ? `${r.icon} ${r.label}` : `(หาไม่เจอ) ${ref.split(':')[1]}`),
        h('button.icon-btn', { disabled: i === 0, 'aria-label': 'เลื่อนขึ้น', onclick: () => mv(-1) }, '↑'),
        h('button.icon-btn', { disabled: i === B.length - 1, 'aria-label': 'เลื่อนลง', onclick: () => mv(1) }, '↓'),
        h('button.icon-btn', { 'aria-label': 'เอาออก', onclick: () => { B.splice(i, 1); save(); redraw(); fill(); } }, '✕'));
    }));
    if (!B.length) list.replaceChildren(h('p.muted.small', 'ไม่มีอะไรปักไว้แล้ว — กด 📌 ปักหมุด ในการ์ดอาวุธ เวท หรือความสามารถ'));
  };
  fill();
  sheet('จัดแถบของโปรด', h('div', h('p.muted.small', 'ซ้ายสุดคืออันแรก · เพิ่มได้จากปุ่ม 📌 ในการ์ด'), list));
}
