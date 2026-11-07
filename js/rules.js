// กฎและการคำนวณค่าตัวละคร (D&D 2024 / SRD 5.2.1) — ทุกอย่างคำนวณจากข้อมูลตัวละครดิบ
import { rollFlags } from './fx.js';
import { D } from './data.js';
import { featIdOf, normName, stubSub } from './packs.js';

export const MAX_LEVEL = 20;
export const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABIL_EN = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export const ABIL_SHORT = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
export const ABIL_TH = { str: 'แรง ยก ผลัก ตีหนัก', dex: 'ว่องไว แม่นยำ หลบหลีก', con: 'ถึก อึด เลือดเยอะ', int: 'ความรู้ เหตุผล', wis: 'สังเกต สัญชาตญาณ', cha: 'เสน่ห์ พูดจา ความมั่นใจ' };

export const SKILLS = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'],
  ['Deception', 'cha'], ['History', 'int'], ['Insight', 'wis'], ['Intimidation', 'cha'],
  ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'],
  ['Stealth', 'dex'], ['Survival', 'wis'],
];
export const SKILL_AB = Object.fromEntries(SKILLS);

export const LANGS = ['Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'];
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const SPELL_AB = { bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };
export const FIGHTING_STYLE_AT = { fighter: 1, paladin: 2, ranger: 2 };
export const MASTERY_AT = { barbarian: 1, fighter: 1, paladin: 1, ranger: 1, rogue: 1 };
export const EXPERTISE = { // [ระดับ, จำนวน, รายการจำกัด]
  rogue: [[1, 2], [6, 2]], bard: [[2, 2], [9, 2]], ranger: [[2, 1], [9, 2]],
  wizard: [[2, 1, ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']]],
};

/** จำนวน Expertise / Metamagic ทั้งหมดที่ได้ถึงเลเวลคลาสนั้น */
// ฟีเจอร์ SRD ที่ต้องเลือก 1 จาก 2 (เฟส 5) — เก็บใน chOf(c, cls)[key]
export const SRD_PICKS = [
  { cls: 'cleric', at: 7, key: 'blessedStrikes', feat: 'Blessed Strikes', opts: [
    ['Divine Strike', 'ตีโดนด้วยอาวุธ 1 ครั้งต่อเทิร์น ได้ดาเมจ Necrotic หรือ Radiant เพิ่ม 1d8 (Lv14 เพิ่มเป็น 2d8)'],
    ['Potent Spellcasting', 'บวก WIS เข้าไปในดาเมจของ Cantrip สาย Cleric (Lv14 ร่ายแล้วให้ Temp HP เท่ากับ 2 เท่าของ WIS แก่ตัวเองหรือเพื่อน)']] },
  { cls: 'druid', at: 7, key: 'elementalFury', feat: 'Elemental Fury', opts: [
    ['Potent Spellcasting', 'บวก WIS เข้าไปในดาเมจของ Cantrip สาย Druid (Lv15 Cantrip ที่ระยะ 10 ฟุตขึ้นไป ไกลขึ้นอีก 300 ฟุต)'],
    ['Primal Strike', 'ตีโดนด้วยอาวุธหรือท่าของร่างสัตว์ 1 ครั้งต่อเทิร์น ได้ดาเมจ Cold / Fire / Lightning / Thunder เพิ่ม 1d8 (Lv15 เพิ่มเป็น 2d8)']] },
  { cls: 'ranger', at: 7, key: 'defTactics', feat: 'Defensive Tactics', srdSub: true, opts: [
    ['Escape the Horde', 'Opportunity Attack ที่ศัตรูตีเรามี Disadvantage'],
    ['Multiattack Defense', 'ครีเจอร์ที่ตีโดนเรา การโจมตีอื่นของมันใส่เราในเทิร์นนั้นมี Disadvantage']] },
];
export const expertiseCount = (id, L) => (EXPERTISE[id] || []).filter(([lv]) => L >= lv).reduce((t, [, n]) => t + n, 0);
export const metamagicCount = L => (L >= 17 ? 6 : L >= 10 ? 4 : L >= 2 ? 2 : 0);
/** Prepared spells ของ 1/3 caster (Eldritch Knight / Arcane Trickster แบบ 2024) ตามเลเวลคลาส */
const THIRD_PREP = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
export const mod = s => Math.floor((s - 10) / 2);
export const pbOf = l => 2 + Math.floor((l - 1) / 4);

/** ตัวเลือกพิเศษของ species */
export const SPECIES_OPT = {
  dragonborn: { key: 'ancestry', label: 'Draconic Ancestry', opts: [['Black', 'Acid'], ['Blue', 'Lightning'], ['Brass', 'Fire'], ['Bronze', 'Lightning'], ['Copper', 'Acid'], ['Gold', 'Fire'], ['Green', 'Poison'], ['Red', 'Fire'], ['Silver', 'Cold'], ['White', 'Cold']] },
  elf: { key: 'lineage', label: 'Elven Lineage', opts: [['Drow'], ['High Elf'], ['Wood Elf']], ability: true },
  gnome: { key: 'lineage', label: 'Gnomish Lineage', opts: [['Forest Gnome'], ['Rock Gnome']], ability: true },
  goliath: { key: 'ancestry', label: 'Giant Ancestry', opts: [["Cloud's Jaunt", 'Cloud Giant'], ["Fire's Burn", 'Fire Giant'], ["Frost's Chill", 'Frost Giant'], ["Hill's Tumble", 'Hill Giant'], ["Stone's Endurance", 'Stone Giant'], ["Storm's Thunder", 'Storm Giant']] },
  tiefling: { key: 'legacy', label: 'Fiendish Legacy', opts: [['Abyssal', 'Poison'], ['Chthonic', 'Necrotic'], ['Infernal', 'Fire']], ability: true },
};
// สเปลจาก species: [cantrip(s) lv1, lv3, lv5]
const SPECIES_SPELLS = {
  Drow: [['Dancing Lights'], 'Faerie Fire', 'Darkness'],
  'High Elf': [['Prestidigitation'], 'Detect Magic', 'Misty Step'],
  'Wood Elf': [['Druidcraft'], 'Longstrider', 'Pass without Trace'],
  'Forest Gnome': [['Minor Illusion'], null, null, 'Speak with Animals'],
  'Rock Gnome': [['Mending', 'Prestidigitation']],
  Abyssal: [['Poison Spray'], 'Ray of Sickness', 'Hold Person'],
  Chthonic: [['Chill Touch'], 'False Life', 'Ray of Enfeeblement'],
  Infernal: [['Fire Bolt'], 'Hellish Rebuke', 'Darkness'],
};
export const SIZE_CHOICE = ['human', 'tiefling'];

// ---------- ตัวช่วยตาราง ----------
export function col(cls, name, level) {
  const t = cls.table, i = t.head.indexOf(name);
  return i < 0 ? null : t.rows[level - 1][i];
}
const num = v => (v == null || v === '-' || v === '—' ? 0 : parseInt(v, 10) || 0);

export function parseMdTables(text) {
  const out = [];
  let label = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    const lm = l.match(/^\*\*(.+?)\*\*$/);
    if (lm) label = lm[1];
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim());
      const cells = rows.filter(r => !/^\|[\s:|\-—]+\|?$/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.replace(/\*/g, '').trim()));
      out.push({ label, head: cells[0], rows: cells.slice(1) });
    }
  }
  return out;
}

/** ซับคลาสที่ตัวละครเลือก (SRD หรือจาก Content Pack) */
export function subOf(c, id = c.classId) {
  const cls = D.cls[id];
  if (!cls) return null;
  const o = id === c.classId ? c : c.mc?.[id];
  const sid = o?.subclassId;
  if (!sid) return cls.subclass;
  const list = D.subs?.[cls.id] || [];
  const hit = list.find(s => s.id === sid || s.phb === sid);
  if (hit) return hit;
  if (D.openSub?.[sid]) return D.openSub[sid];
  // ไม่มีในเครื่อง (แพ็กถูกปิด/ลบ) → เก็บชื่อเดิมไว้เป็นซับคลาสว่าง (ถ้าชื่อตรงรายชื่อ PHB ก็ใช้อันนั้น)
  const base = String(sid).replace(/^phb:/, '').replace(/-[a-z0-9]{4}$/, '');
  const named = list.find(s => s.phb && (s.phb === 'phb:' + base || (o.subName && normName(s.name) === normName(o.subName))));
  if (named) return named;
  const nm = o.subName || base.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  return { ...stubSub(cls.id, nm, sid), lost: true };
}
/** ตั้งซับคลาส (null หรือ SRD = ซับคลาส SRD) — ซับคลาสที่อยู่ในรายชื่อ PHB เก็บเป็น phb:<slug> เพื่อให้ผูกกับแพ็กชื่อตรงกันเอง */
export function setSub(c, id, sb) {
  const o = id === c.classId ? c : mcOf(c, id);
  if (!sb || sb === D.cls[id]?.subclass) { o.subclassId = null; delete o.subName; return; }
  o.subclassId = sb.phb || sb.id;
  o.subName = sb.name;
}
/** เลือกซับคลาส SRD อยู่หรือเปล่า (ตัวเลือกพิเศษอย่าง Land / Hunter's Prey ใช้เฉพาะซับคลาส SRD) */
export const srdSub = (c, id = c.classId) => !!D.cls[id] && subOf(c, id) === D.cls[id].subclass;
/** ข้อมูลของคลาสที่ multiclass เข้าไป: {choices, skills, spells, subclassId} (คลาสหลักใช้ c.choices / c.spells / c.subclassId เหมือนเดิม) */
export function mcOf(c, id) {
  c.mc = c.mc || {};
  const o = c.mc[id] = c.mc[id] || {};
  o.choices = o.choices || {};
  o.skills = o.skills || [];
  o.spells = o.spells || { cantrips: [], prepared: [], book: [] };
  if (o.subclassId === undefined) o.subclassId = null;
  return o;
}
export const chOf = (c, id) => (id === c.classId ? (c.choices = c.choices || {}) : mcOf(c, id).choices);
export const spellsOf = (c, id) => (id === c.classId ? (c.spells = c.spells || { cantrips: [], prepared: [], book: [] }) : mcOf(c, id).spells);
/** proficiency ที่ได้ตอน multiclass เข้าคลาสนี้ (PHB 2024) */
export const MC_PROF = {
  barbarian: { armor: ['shield'], martial: true },
  bard: { armor: ['light'], skills: 1, anySkill: true, tools: 'เครื่องดนตรี 1 ชิ้น' },
  cleric: { armor: ['light', 'medium', 'shield'] },
  druid: { armor: ['light', 'shield'] },
  fighter: { armor: ['light', 'medium', 'shield'], martial: true },
  monk: {},
  paladin: { armor: ['light', 'medium', 'shield'], martial: true },
  ranger: { armor: ['light', 'medium', 'shield'], martial: true, skills: 1 },
  rogue: { armor: ['light'], skills: 1, tools: "Thieves' Tools" },
  sorcerer: {}, warlock: { armor: ['light'] }, wizard: {},
};
const HALF_CASTER = new Set(['paladin', 'ranger']);

// ---------- เลเวล (เก็บเป็นประวัติทีละเลเวล รองรับ Multiclass) ----------
/** c.levels[i] = {c: classId, hp?: ผลทอยเต๋า (ไม่มี = ค่าเฉลี่ย), feat?: featId ที่ได้ตอน ASI/Epic Boon, asi?: {ab: +n}} — index 0 = Lv1 = คลาสหลักเสมอ */
export function ensureLevels(c) {
  if (!Array.isArray(c.levels) || !c.levels.length) {
    const n = Math.min(MAX_LEVEL, Math.max(1, c.level || 1));
    c.levels = Array.from({ length: n }, (_, i) => (i && c.hpRolls?.[i + 1] ? { c: c.classId || null, hp: c.hpRolls[i + 1] } : { c: c.classId || null }));
    delete c.hpRolls;
  }
  // c.level เป็นตัวหลัก — ถ้าโค้ด/ไฟล์เก่าตั้งไว้ไม่ตรง ให้เติม/ตัดเลเวลท้ายให้ตรง
  const want = Math.max(1, Math.min(MAX_LEVEL, c.level | 0 || c.levels.length));
  while (c.levels.length < want) c.levels.push({ c: c.classId || null });
  c.levels.length = want;
  for (const e of c.levels) if (!e.c) e.c = c.classId || null;
  c.levels[0].c = c.classId || null;
  c.level = c.levels.length;
  return c.levels;
}
/** ตั้งเลเวลรวม (เพิ่มเลเวลใหม่เป็นคลาสหลัก / ตัดเลเวลท้ายทิ้ง) */
export function setLevel(c, n) {
  ensureLevels(c);
  n = Math.max(1, Math.min(MAX_LEVEL, n | 0));
  while (c.levels.length < n) c.levels.push({ c: c.classId || null });
  c.levels.length = n;
  c.level = n;
}
/** เปลี่ยนคลาสหลัก — เลเวลที่เป็นคลาสหลักเดิมย้ายไปเป็นคลาสใหม่ */
export function setPrimaryClass(c, id) {
  const old = c.classId;
  ensureLevels(c);
  for (const e of c.levels) if (!e.c || e.c === old) e.c = id;
  c.classId = id;
}
/** {classId: เลเวลของคลาสนั้น} เรียงตามลำดับที่เข้า */
export function classLevels(c) {
  const out = {};
  for (const e of ensureLevels(c)) if (e.c) out[e.c] = (out[e.c] || 0) + 1;
  return out;
}
export const classLine = c => Object.entries(classLevels(c)).map(([id, n]) => `${D.cls[id]?.name || id} ${n}`).join(' / ');
export const hitDieAvg = d => Math.floor(d / 2) + 1;
/** แต่ละเลเวลเป็นคลาสไหน เลเวลที่เท่าไหร่ของคลาส ได้ ASI / Epic Boon ไหม */
export function levelInfo(c) {
  const cnt = {};
  return ensureLevels(c).map((e, i) => {
    const cls = D.cls[e.c];
    const cl = cnt[e.c] = (cnt[e.c] || 0) + 1;
    const gains = cls ? String(col(cls, 'Class Features', cl) || '') : '';
    return { i, lv: i + 1, e, cls, cl, gains, asi: /Ability Score Improvement/.test(gains), boon: /Epic Boon/.test(gains) };
  });
}
const ABIL_BY_EN = Object.fromEntries(ABIL.map(a => [ABIL_EN[a].toLowerCase(), a]));
/** feat นี้เพิ่มค่าพลังยังไง: {total, per, abil[], cap} หรือ null */
export function featAsiRule(f) {
  if (!f) return null;
  if (f.id === 'ability-score-improvement') return { total: 2, per: 2, abil: ABIL, cap: 20 };
  const t = f.text || '';
  let mm = t.match(/Increase one ability score of your choice by 1, to a maximum of (\d+)/i);
  if (mm) return { total: 1, per: 1, abil: ABIL, cap: +mm[1] };
  mm = t.match(/Increase your ([A-Za-z ,]+?) score by 1, to a maximum of (\d+)/i);
  if (mm) {
    const abil = mm[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => ABIL_BY_EN[x.trim().toLowerCase()]).filter(Boolean);
    if (abil.length) return { total: 1, per: 1, abil, cap: +mm[2] };
  }
  return null;
}
const REPEATABLE = new Set(['ability-score-improvement', 'skilled', 'magic-initiate']);
export const featRepeatable = f => !!f && (!!f.repeatable || REPEATABLE.has(f.id) || /Repeatable\./.test(f.text || ''));
const hasFightingStyle = c => Object.entries(classLevels(c)).some(([id, n]) => FIGHTING_STYLE_AT[id] && n >= FIGHTING_STYLE_AT[id]);
function originFeatIds(c) {
  const bg = D.bg[c.bgId], so = c.speciesOpt || {};
  const out = [];
  if (bg) out.push(D.feat[featIdOf(bg.feat)]?.id);
  if (c.speciesId === 'human' && so.feat) out.push(so.feat);
  return out.filter(Boolean);
}
/** feat ที่เลือกได้ตอน ASI / Epic Boon ของเลเวล li */
export function featChoices(c, li) {
  const taken = new Set([...originFeatIds(c), c.choices?.fightingStyle, ...levelInfo(c).filter(o => o.i !== li.i && o.e.feat).map(o => o.e.feat)]);
  const key = f => (li.boon ? (f.category === 'Epic Boon' ? 0 : f.id === 'ability-score-improvement' ? 1 : 2) : (f.id === 'ability-score-improvement' ? 0 : 1));
  return D.feats.filter(f => {
    if (taken.has(f.id) && !featRepeatable(f)) return false;
    if (f.category === 'Epic Boon') return li.lv >= 19;
    if (f.category === 'Fighting Style') return hasFightingStyle(c);
    if (f.category === 'General') return li.lv >= 4;
    return true;
  }).sort((a, b) => key(a) - key(b));
}
/** ผ่านเงื่อนไข Multiclass (ค่าพลังหลัก 13+) ไหม */
export function meetsPrimary(cls, score) {
  const s = cls?.core?.['Primary Ability'] || '';
  const abil = s.split(/\s+(?:or|and)\s+/).map(x => ABIL_BY_EN[x.trim().toLowerCase()]).filter(Boolean);
  if (!abil.length) return true;
  return / or /.test(s) ? abil.some(a => (score[a] || 0) >= 13) : abil.every(a => (score[a] || 0) >= 13);
}
const EXTRA_ATK = { barbarian: [5], fighter: [5, 11, 20], monk: [5], paladin: [5], ranger: [5] };

/** สเปลที่ซับคลาสให้ "เตรียมไว้เสมอ" */
export function subclassSpells(cls, level, land, sub = cls.subclass) {
  if (level < 3) return [];
  if (sub.pack) return (sub.spells || []).filter(r => num(r.level) <= level).flatMap(r => String(r.list || '').split(',').map(x => x.trim()).filter(Boolean));
  const f = sub.features.find(x => /Spells$/.test(x.name));
  if (!f) return [];
  let tables = parseMdTables(f.text);
  if (cls.id === 'druid') tables = tables.filter(t => t.label.toLowerCase().startsWith((land || 'arid').toLowerCase()));
  const names = [];
  for (const r of tables[0]?.rows || []) if (num(r[0]) <= level) names.push(...r[1].split(',').map(s => s.trim()));
  return names;
}

export function casterInfo(cls, level) {
  if (!SPELL_AB[cls.id]) return null;
  const slots = {};
  let maxLevel = 0;
  if (cls.id === 'warlock') {
    const n = num(col(cls, 'Spell Slots', level)), lv = num(col(cls, 'Slot Level', level));
    if (n) { slots[lv] = n; maxLevel = lv; }
  } else {
    for (let s = 1; s <= 9; s++) {
      const n = num(col(cls, String(s), level));
      if (n) { slots[s] = n; maxLevel = s; }
    }
  }
  return {
    ability: SPELL_AB[cls.id],
    cantrips: num(col(cls, 'Cantrips', level)),
    prepared: num(col(cls, 'Prepared Spells', level)),
    slots, maxLevel, pact: cls.id === 'warlock',
  };
}

/** ข้อมูลการร่ายเวทของคลาส id ที่เลเวล n — รวมซับคลาสจาก Content Pack ที่ตั้งเป็น 1/3 caster */
export function casterOf(c, id, n) {
  const k = D.cls[id];
  if (!k) return null;
  const ci = casterInfo(k, n);
  if (ci) return ci;
  const sub = subOf(c, id);
  if (!sub?.pack || !sub.casting?.list || n < 3) return null;
  const slots = casterInfo(D.cls.wizard, Math.ceil(n / 3)).slots;
  return { ability: sub.casting.ab || 'int', cantrips: n >= 10 ? 3 : 2, prepared: THIRD_PREP[n - 1], slots, maxLevel: Math.max(...Object.keys(slots).map(Number)), pact: false, third: true, list: sub.casting.list };
}
export function classSpellList(classId, maxLevel, includeCantrips = true) {
  const ids = [].concat(classId);
  return D.spells.filter(s => (ids.includes('any') || s.classes.some(k => ids.includes(k))) && (s.level === 0 ? includeCantrips : s.level <= maxLevel));
}

// ---------- อุปกรณ์ ----------
export function equipOptions(text) {
  const out = {};
  const re = /\(([A-C])\)\s*([^;]+?)(?=;|$)/g;
  let m;
  while ((m = re.exec(text || ''))) out[m[1]] = m[2].replace(/^or\s+/i, '').trim();
  return out;
}

const singular = n => n.replace(/ies$/, 'y').replace(/(?<!s)s$/, '');
/** น้ำหนักต่อชิ้น (ปอนด์) — ใช้ค่าที่ผู้เล่นใส่เองก่อน ไม่งั้นหาจากตาราง SRD */
export function itemWeight(it) {
  if (it.weight != null && it.weight !== '') return +it.weight || 0;
  const W = D.weights || {}, n = (it.name || '').toLowerCase().replace(/\s*\(.*\)$/, '');
  return W[n] ?? W[singular(n)] ?? W[D.weapon[it.weapon]?.name.toLowerCase()] ?? W[D.armorById[it.armor]?.name.toLowerCase()] ?? 0;
}
/** น้ำหนักรวม (ของ + เหรียญ 50 เหรียญ = 1 ปอนด์) กับที่แบกได้ (STR × 15, ตัว Large ×2) */
export function carry(c, x) {
  const e = c.equipment || {};
  const coins = ['pp', 'gp', 'ep', 'sp', 'cp'].reduce((t, k) => t + (+e[k] || 0), 0);
  const total = (e.items || []).reduce((t, it) => t + itemWeight(it) * (it.qty || 1), 0) + coins / 50;
  return { total: Math.round(total * 10) / 10, max: x.score.str * 15 };
}
export function parseItems(text) {
  const items = [];
  let gp = 0;
  for (let part of (text || '').split(/,\s*(?:and\s+)?|\s+and\s+/)) {
    part = part.trim();
    if (!part) continue;
    const g = part.match(/^(\d+)\s*GP$/i);
    if (g) { gp += +g[1]; continue; }
    const q = part.match(/^(\d+)\s+(.+)$/);
    const qty = q ? +q[1] : 1;
    let name = q ? q[2] : part;
    const base = qty > 1 ? singular(name) : name;
    const w = D.weapons.find(x => x.name.toLowerCase() === base.toLowerCase());
    const a = D.armor.find(x => x.name.toLowerCase() === base.toLowerCase());
    items.push({ name: w?.name || a?.name || name, qty, weapon: w?.id, armor: a?.id });
  }
  return { items, gp };
}

// ---------- ความชำนาญอาวุธ/เกราะ ----------
function armorTraining(c) {
  const set = new Set();
  for (const id of Object.keys(classLevels(c))) {
    const k = D.cls[id];
    if (!k) continue;
    if (id === c.classId) {
      const t = (k.core['Armor Training'] || '').toLowerCase();
      ['light', 'medium', 'heavy'].forEach(a => t.includes(a) && set.add(a));
      if (t.includes('shield')) set.add('shield');
    } else (MC_PROF[id]?.armor || []).forEach(a => set.add(a));
    const ch = chOf(c, id);
    if (id === 'cleric' && ch.divineOrder === 'Protector') set.add('heavy');
    if (id === 'druid' && ch.primalOrder === 'Warden') set.add('medium');
  }
  return set;
}
const RULE_RANK = ['simple', 'light', 'finesse-light', 'all'];
function weaponRule(c) {
  let best = 'simple';
  for (const id of Object.keys(classLevels(c))) {
    const k = D.cls[id];
    if (!k) continue;
    const ch = chOf(c, id), t = k.core['Weapon Proficiencies'] || '';
    let r;
    if ((id === 'cleric' && ch.divineOrder === 'Protector') || (id === 'druid' && ch.primalOrder === 'Warden')) r = 'all';
    else if (id !== c.classId) r = MC_PROF[id]?.martial ? 'all' : 'simple';
    else r = /Simple and Martial/i.test(t) ? 'all' : /Finesse or Light/i.test(t) ? 'finesse-light' : /Light property/i.test(t) ? 'light' : 'simple';
    if (RULE_RANK.indexOf(r) > RULE_RANK.indexOf(best)) best = r;
  }
  return best;
}
export function weaponProficient(w, rule) {
  if (/^Simple/.test(w.group) || rule === 'all') return true;
  if (rule === 'light') return /\bLight\b/.test(w.properties);
  if (rule === 'finesse-light') return /\b(Light|Finesse)\b/.test(w.properties);
  return false;
}

// ---------- ทรัพยากร (ใช้ได้กี่ครั้ง) ----------
function resources(c, x) {
  const { TL, pb, m } = x;
  const R = [];
  let pre = '';
  const add = (id, name, max, reset, icon) => max > 0 && R.push({ id: pre + id, name, max, reset, icon });
  for (const [cid, L] of Object.entries(x.CLs)) {
  const cls = D.cls[cid];
  if (!cls) continue;
  pre = cid === c.classId ? '' : cid + '-';
  const t = n => num(col(cls, n, L));
  switch (cls.id) {
    case 'barbarian':
      add('rage', 'Rage', t('Rages'), 'short1', 'flame');
      if (L >= 15) add('persist', 'Persistent Rage (คืน Rage ตอนทอย Initiative)', 1, 'long', 'flame');
      break;
    case 'bard': add('bardic', 'Bardic Inspiration', Math.max(1, m.cha), L >= 5 ? 'short' : 'long', 'lyre'); break;
    case 'cleric':
      if (L >= 2) add('cd', 'Channel Divinity', t('Channel Divinity'), 'short1', 'holy-symbol');
      if (L >= 10) add('di', 'Divine Intervention', 1, 'long', 'holy-symbol');
      break;
    case 'druid': if (L >= 2) add('wild', 'Wild Shape', t('Wild Shape'), 'short1', 'oak-leaf'); break;
    case 'fighter':
      add('sw', 'Second Wind', t('Second Wind'), 'short1', 'hp');
      if (L >= 2) add('surge', 'Action Surge', L >= 17 ? 2 : 1, 'short', 'lightning-helix');
      if (L >= 9) add('indom', 'Indomitable', L >= 17 ? 3 : L >= 13 ? 2 : 1, 'long', 'hp');
      break;
    case 'monk':
      if (L >= 2) { add('focus', 'Focus Points', t('Focus Points'), 'short', 'fist'); add('meta', 'Uncanny Metabolism', 1, 'long', 'hp'); }
      break;
    case 'paladin':
      add('loh', 'Lay On Hands (HP)', 5 * L, 'long', 'hp');
      if (L >= 2) add('smite', "Paladin's Smite (ร่ายฟรี)", 1, 'long', 'flame');
      if (L >= 3) add('cd', 'Channel Divinity', t('Channel Divinity'), 'short1', 'holy-symbol');
      if (L >= 5) add('steed', 'Faithful Steed (ร่าย Find Steed ฟรี)', 1, 'long', 'spell');
      break;
    case 'ranger':
      add('fe', "Hunter's Mark (ร่ายฟรี)", t('Favored Enemy'), 'long', 'eye');
      if (L >= 10) add('tireless', 'Tireless (Temp HP)', Math.max(1, m.wis), 'long', 'hp');
      if (L >= 14) add('veil', "Nature's Veil", Math.max(1, m.wis), 'long', 'eye');
      break;
    case 'rogue': if (L >= 20) add('luck', 'Stroke of Luck', 1, 'short', 'd20'); break;
    case 'sorcerer':
      add('innate', 'Innate Sorcery', 2, 'long', 'magic-swirl');
      if (L >= 2) add('sp', 'Sorcery Points', t('Sorcery Points'), 'long', 'sorcerer');
      if (L >= 5) add('restore', 'Sorcerous Restoration', 1, 'long', 'sorcerer');
      break;
    case 'warlock':
      if (L >= 2) add('cunning', 'Magical Cunning', 1, 'long', 'warlock-eye');
      if (L >= 9) add('patron', 'Contact Patron', 1, 'long', 'warlock-eye');
      for (const [lv, sl] of [[11, 6], [13, 7], [15, 8], [17, 9]]) if (L >= lv) add('arc' + sl, `Mystic Arcanum (Lv ${sl})`, 1, 'long', 'spell');
      break;
    case 'wizard':
      add('arcrec', 'Arcane Recovery', 1, 'long', 'book');
      if (L >= 20) add('sig', 'Signature Spells', 2, 'short', 'book');
      break;
  }
  // ฟีเจอร์ซับคลาสจาก Content Pack ที่กำหนดจำนวนครั้งไว้
  const sub = subOf(c, cid);
  if (sub?.pack && L >= 3) for (const f of sub.features) if (f.level <= L && f.uses?.n) {
    const u = f.uses.n, n = u === 'pb' ? pb : m[u] != null ? Math.max(1, m[u]) : parseInt(u, 10) || 0;
    add('pk-' + f.id, f.name, n, f.uses.reset === 'short' ? 'short' : 'long', 'feat');
  }
  }
  pre = '';
  const sp = c.speciesId, so = c.speciesOpt || {};
  if (sp === 'dragonborn') add('breath', 'Breath Weapon', pb, 'long', 'dragonborn');
  if (sp === 'goliath' && so.ancestry) add('giant', so.ancestry, pb, 'long', 'goliath');
  if (sp === 'orc') { add('adrenaline', 'Adrenaline Rush', pb, 'short', 'orc'); add('relentless', 'Relentless Endurance', 1, 'long', 'hp'); }
  if (sp === 'dwarf') add('stone', 'Stonecunning', pb, 'long', 'dwarf');
  if (sp === 'gnome' && so.lineage === 'Forest Gnome') add('swa', 'Speak with Animals (ร่ายฟรี)', pb, 'long', 'gnome');
  if (SPECIES_SPELLS[so.lineage || so.legacy] && TL >= 3 && SPECIES_SPELLS[so.lineage || so.legacy][1])
    add('sp3', SPECIES_SPELLS[so.lineage || so.legacy][1] + ' (ร่ายฟรี)', 1, 'long', 'spell');
  if (SPECIES_SPELLS[so.lineage || so.legacy]?.[2] && TL >= 5)
    add('sp5', SPECIES_SPELLS[so.lineage || so.legacy][2] + ' (ร่ายฟรี)', 1, 'long', 'spell');
  if (x.originFeats.includes('magic-initiate')) add('mi', 'Magic Initiate (ร่ายฟรี)', 1, 'long', 'feat');
  if (x.originFeats.includes('boon-of-fate')) add('fate', 'Improve Fate (2d4 · ได้คืนตอนทอย Initiative ด้วย)', 1, 'short', 'd20');
  return R;
}

// ---------- คำนวณทั้งหมด ----------
export function compute(c) {
  const LI = levelInfo(c), CLs = classLevels(c);
  const cls = D.cls[c.classId], sp = D.sp[c.speciesId], bg = D.bg[c.bgId];
  const L = LI.length, CL = CLs[c.classId] || L, pb = pbOf(L), ch = c.choices || {}, so = c.speciesOpt || {};
  const warn = [];
  const sub = subOf(c), isSrdSub = srdSub(c);
  if (cls && sub?.lost) warn.push(`ซับคลาส ${sub.name} ไม่มีข้อมูลในเครื่องนี้ (แพ็กถูกปิดหรือลบ) — เก็บชื่อไว้ให้ เปิดแพ็กหรือนำเข้าใหม่แล้วข้อมูลจะกลับมาเอง`);

  // ค่าความสามารถ
  const score = {};
  for (const a of ABIL) score[a] = (c.abilities?.base?.[a] ?? 10) + (c.abilities?.bonus?.[a] || 0);
  // ASI / feat จากเลเวลอัป (เฉพาะเลเวลที่ได้ ASI หรือ Epic Boon จริง)
  const levelFeats = [];
  for (const li of LI) if ((li.asi || li.boon) && D.feat[li.e.feat]) {
    levelFeats.push(li.e.feat);
    const r = featAsiRule(D.feat[li.e.feat]);
    if (r) for (const [a, n] of Object.entries(li.e.asi || {})) if (r.abil.includes(a) && n > 0) score[a] = Math.max(score[a], Math.min(r.cap, score[a] + Math.min(n, r.per)));
  }
  if ((CLs.barbarian || 0) >= 20) for (const a of ['str', 'con']) score[a] = Math.max(score[a], Math.min(25, score[a] + 4));
  if ((CLs.monk || 0) >= 20) for (const a of ['dex', 'wis']) score[a] = Math.max(score[a], Math.min(25, score[a] + 4));
  const m = Object.fromEntries(ABIL.map(a => [a, mod(score[a])]));

  // Origin feats (จาก background + Human Versatile)
  const originFeats = originFeatIds(c);
  const featIds = [...originFeats];
  for (const [id, n] of Object.entries(CLs)) {
    const fs = FIGHTING_STYLE_AT[id] && n >= FIGHTING_STYLE_AT[id] && chOf(c, id).fightingStyle;
    if (fs && !['blessed-warrior', 'druidic-warrior'].includes(fs)) featIds.push(fs);
  }
  featIds.push(...levelFeats);

  // สกิล
  const prof = new Set([...(bg?.skills || []), ...(c.skills || [])]);
  if (so.skill) prof.add(so.skill);
  for (const k of ['skilled', 'skilled2']) (ch[k] || []).forEach(s => SKILL_AB[s] && prof.add(s));
  for (const li of LI) if ((li.asi || li.boon) && li.e.feat === 'skilled') (li.e.sub?.skills || []).forEach(s => SKILL_AB[s] && prof.add(s));
  const expList = [];
  for (const [id, n] of Object.entries(CLs)) {
    if (!D.cls[id]) continue;
    const k = chOf(c, id);
    if (id !== c.classId) (c.mc?.[id]?.skills || []).forEach(s => prof.add(s));
    if (id === 'barbarian' && n >= 3 && k.primalSkill) prof.add(k.primalSkill);
    if (id === 'bard' && n >= 3 && srdSub(c, id)) (k.loreSkills || []).forEach(s => prof.add(s));
    expList.push(...(k.expertise || []));
  }
  const exp = new Set(expList.filter(s => prof.has(s)));
  const thaum = !!CLs.cleric && chOf(c, 'cleric').divineOrder === 'Thaumaturge', magi = !!CLs.druid && chOf(c, 'druid').primalOrder === 'Magician';
  const skills = SKILLS.map(([name, ab]) => {
    const p = prof.has(name), e = exp.has(name), parts = [[ABIL_SHORT[ab], m[ab]]];
    if (e) parts.push(['Expertise (Prof×2)', pb * 2]); else if (p) parts.push(['Proficiency', pb]);
    else if ((CLs.bard || 0) >= 2) parts.push(['Jack of All Trades (½ Prof)', Math.floor(pb / 2)]);
    if ((thaum && ['Arcana', 'Religion'].includes(name)) || (magi && ['Arcana', 'Nature'].includes(name))) parts.push([thaum && name !== 'Nature' ? 'Thaumaturge' : 'Magician', Math.max(1, m.wis)]);
    return { name, ab, bonus: parts.reduce((t, q) => t + q[1], 0), prof: p, exp: e, parts };
  });

  const saveProf = new Set(cls?.saves || []);
  if ((CLs.monk || 0) >= 14) ABIL.forEach(a => saveProf.add(a)); // Disciplined Survivor
  if ((CLs.rogue || 0) >= 15) ['wis', 'cha'].forEach(a => saveProf.add(a)); // Slippery Mind
  const aura = (CLs.paladin || 0) >= 6 ? Math.max(1, m.cha) : 0; // Aura of Protection
  const saves = ABIL.map(a => {
    const parts = [[ABIL_SHORT[a], m[a]]];
    if (saveProf.has(a)) parts.push(['Proficiency', pb]);
    if (aura) parts.push(['Aura of Protection', aura]);
    return { ab: a, prof: saveProf.has(a), bonus: parts.reduce((t, q) => t + q[1], 0), parts };
  });

  // เกราะและ AC
  const training = cls ? armorTraining(c) : new Set();
  const items = c.equipment?.items || [];
  const worn = D.armorById[c.equipment?.armor] || null;
  const shield = !!c.equipment?.shield;
  let ac = 10 + m.dex, acNote = 'ไม่ใส่เกราะ (10 + DEX)';
  if (worn) {
    const base = parseInt(worn['armor class (ac)'], 10);
    const heavy = /Heavy/.test(worn.group), medium = /Medium/.test(worn.group);
    ac = base + (heavy ? 0 : medium ? Math.min(2, m.dex) : m.dex);
    acNote = worn.name;
    const kind = heavy ? 'heavy' : medium ? 'medium' : 'light';
    if (!training.has(kind)) warn.push(`ยังไม่มี Armor Training สำหรับ ${worn.name} — ทอยที่ใช้ STR/DEX จะเสียเปรียบและร่ายเวทไม่ได้`);
    const strReq = worn.strength?.match(/\d+/);
    if (strReq && score.str < +strReq[0]) warn.push(`${worn.name} ต้องการ STR ${strReq[0]} — ความเร็วลด 10 ฟุต`);
  } else {
    const alt = [];
    const ud = Object.keys(CLs).find(id => id === 'barbarian' || id === 'monk'); // ได้ Unarmored Defense แค่อันแรก
    if (ud === 'barbarian') alt.push([10 + m.dex + m.con, 'Unarmored Defense (10 + DEX + CON)']);
    if (ud === 'monk' && !shield) alt.push([10 + m.dex + m.wis, 'Unarmored Defense (10 + DEX + WIS)']);
    if ((CLs.sorcerer || 0) >= 3 && srdSub(c, 'sorcerer')) alt.push([10 + m.dex + m.cha, 'Draconic Resilience (10 + DEX + CHA)']);
    for (const [v, n] of alt) if (v > ac) { ac = v; acNote = n; }
  }
  if (shield) {
    ac += 2; acNote += ' + Shield';
    if (!training.has('shield')) warn.push('ยังไม่มี Shield training');
  }
  if (worn && featIds.includes('defense')) { ac += 1; acNote += ' + Defense'; }

  // HP
  let hpMax = 0;
  for (const li of LI) {
    const d = li.cls?.hitDie;
    if (d) hpMax += Math.max(1, (li.i === 0 ? d : li.e.hp || hitDieAvg(d)) + m.con);
  }
  if (cls) {
    if (c.speciesId === 'dwarf') hpMax += L;
    if ((CLs.sorcerer || 0) >= 3 && srdSub(c, 'sorcerer')) hpMax += CLs.sorcerer;
  }
  const hitDice = Object.entries(CLs).filter(([id]) => D.cls[id]).map(([id, n]) => ({ die: D.cls[id].hitDie, n }));

  // ความเร็ว
  let speed = sp?.speed || 30;
  if (so.lineage === 'Wood Elf') speed = 35;
  if ((CLs.monk || 0) >= 2 && !worn && !shield) speed += num(col(D.cls.monk, 'Unarmored Movement', CLs.monk));
  const heavy = /Heavy/.test(worn?.group || '');
  if ((CLs.barbarian || 0) >= 5 && !heavy) speed += 10; // Fast Movement
  if ((CLs.ranger || 0) >= 6 && !heavy) speed += 10; // Roving
  if (worn?.strength?.match(/\d+/) && score.str < +worn.strength.match(/\d+/)[0]) speed -= 10;

  const initParts = [['DEX', m.dex], ...(featIds.includes('alert') ? [['Alert', pb]] : [])];
  let init = initParts.reduce((t, q) => t + q[1], 0);
  let darkvision = { dragonborn: 60, dwarf: 120, elf: 60, gnome: 60, orc: 120, tiefling: 60 }[c.speciesId] || 0;
  if (so.lineage === 'Drow') darkvision = 120;

  // อาวุธ
  const rule = cls ? weaponRule(c) : 'simple';
  const masteries = new Set(Object.keys(CLs).filter(id => MASTERY_AT[id]).flatMap(id => chOf(c, id).mastery || []));
  const monkL = CLs.monk || 0, monk = D.cls.monk;
  const attacks = [];
  const seen = new Set();
  for (const it of items) {
    if (it.equipped === false) continue; // เก็บในกระเป๋า ไม่ได้ถือ
    const w = D.weapon[it.weapon];
    if (!w || seen.has(w.id)) continue;
    seen.add(w.id);
    const ranged = /Ranged/.test(w.group), finesse = /Finesse/.test(w.properties);
    let ab = ranged ? 'dex' : finesse ? (m.dex > m.str ? 'dex' : 'str') : 'str';
    if (monkL && !ranged && (/^Simple Melee/.test(w.group) || /\bLight\b/.test(w.properties)) && m.dex > m[ab]) ab = 'dex';
    const p = weaponProficient(w, rule);
    const hitParts = [[ABIL_SHORT[ab], m[ab]], ...(p ? [['Proficiency', pb]] : []), ...(ranged && featIds.includes('archery') ? [['Archery', 2]] : [])];
    const hit = hitParts.reduce((t, q) => t + q[1], 0);
    let dmg = w.damage.replace(/^(\S+)/, `$1${m[ab] ? (m[ab] > 0 ? '+' : '') + m[ab] : ''}`);
    if (monkL && ab === 'dex') {
      const ma = col(monk, 'Martial Arts', monkL);
      const [d] = w.damage.split(' ');
      if (parseInt(ma.slice(2)) > parseInt(d.split('d')[1])) dmg = w.damage.replace(d, ma + (m.dex ? (m.dex > 0 ? '+' : '') + m.dex : ''));
    }
    attacks.push({ id: w.id, name: w.name, hit, hitParts, dmg, ab, props: w.properties, mastery: masteries.has(w.id) ? w.mastery : null, prof: p, ranged });
  }
  const unarmedDie = monkL ? col(monk, 'Martial Arts', monkL) : null;
  let atkPer = 1;
  for (const [id, n] of Object.entries(CLs)) atkPer = Math.max(atkPer, 1 + (EXTRA_ATK[id] || []).filter(l => n >= l).length);
  const inv = CLs.warlock ? chOf(c, 'warlock').invocations || [] : [];
  if (inv.includes('devouring-blade') && CLs.warlock >= 12) atkPer = Math.max(atkPer, 3);
  else if (inv.includes('thirsting-blade') && CLs.warlock >= 5) atkPer = Math.max(atkPer, 2);
  const uAb = monkL && m.dex > m.str ? 'dex' : 'str';
  attacks.push({ id: 'unarmed', name: 'Unarmed Strike', ab: uAb, hit: m[uAb] + pb, hitParts: [[ABIL_SHORT[uAb], m[uAb]], ['Proficiency', pb]], dmg: unarmedDie ? `${unarmedDie}${m[uAb] >= 0 ? '+' : ''}${m[uAb]} Bludgeoning` : `${Math.max(0, 1 + m.str)} Bludgeoning`, props: '', prof: true });

  // เวท
  const casting = [];
  // สเปลสลอต: ร่ายเวทคลาสเดียว = ตารางของคลาสนั้น · หลายคลาส = ตาราง Multiclass Spellcaster (Paladin/Ranger ครึ่งปัดขึ้น) · Pact Magic แยก
  const CI = Object.fromEntries(Object.entries(CLs).map(([id, n]) => [id, casterOf(c, id, n)]));
  const slotCls = Object.entries(CLs).filter(([id]) => CI[id] && !CI[id].pact);
  let shared = {}, casterLv = 0;
  if (slotCls.length === 1) shared = CI[slotCls[0][0]].slots;
  else if (slotCls.length > 1) {
    casterLv = slotCls.reduce((t, [id, n]) => t + (CI[id].third ? Math.floor(n / 3) : HALF_CASTER.has(id) ? Math.ceil(n / 2) : n), 0);
    shared = casterInfo(D.cls.wizard, Math.min(20, casterLv)).slots;
  }
  let slotsGiven = false;
  for (const [id, n] of Object.entries(CLs)) {
    const k = D.cls[id], ci = CI[id];
    if (!ci) continue;
    const kc = chOf(c, id), sel = spellsOf(c, id), primary = id === c.classId, ab = ci.ability;
    const always = [];
    if (id === 'druid') always.push('Speak with Animals');
    if (id === 'ranger') always.push("Hunter's Mark");
    if (id === 'paladin' && n >= 2) always.push('Divine Smite');
    always.push(...subclassSpells(k, n, kc.land, subOf(c, id)));
    const extraCantrips = (id === 'cleric' && kc.divineOrder === 'Thaumaturge') || (id === 'druid' && kc.primalOrder === 'Magician') ? 1 : 0;
    let slots = {};
    if (ci.pact) slots = ci.slots;
    else if (!slotsGiven) { slots = shared; slotsGiven = true; }
    casting.push({
      key: primary ? 'class' : 'mc:' + id, cid: id, sel, source: (primary ? k.name : `${k.name} (Multiclass)`) + (ci.third ? ` · ${subOf(c, id).name}` : ''), ab, dc: 8 + pb + m[ab], atk: pb + m[ab],
      cantripMax: ci.cantrips + extraCantrips, preparedMax: ci.prepared, slots, pact: ci.pact, maxLevel: ci.maxLevel, casterLv: !ci.pact && casterLv && Object.keys(slots).length ? casterLv : 0,
      cantrips: sel.cantrips || [], prepared: sel.prepared || [], book: sel.book,
      bookMax: id === 'wizard' ? 6 + 2 * (n - 1) : null,
      always: always.map(nm => D.spellByName[nm.toLowerCase()]?.id).filter(Boolean),
      list: ci.list || (id === 'bard' && n >= 10 ? ['bard', 'cleric', 'druid', 'wizard'] : id), secrets: id === 'bard' && n >= 10,
    });
    if (ci.cantrips + extraCantrips < (sel.cantrips || []).length) warn.push(`เลือก cantrip ของ ${k.name} เกินจำนวน`);
  }
  if (inv.includes('pact-of-the-tome')) {
    const kc = chOf(c, 'warlock'), ab = 'cha';
    casting.push({ key: 'tome', chs: kc, source: 'Pact of the Tome (Book of Shadows)', ab, dc: 8 + pb + m[ab], atk: pb + m[ab], cantripMax: 3, preparedMax: 2, maxLevel: 1, cantrips: kc.tomeCantrips || [], prepared: kc.tomeRituals || [], always: [], list: 'any', slots: {} });
  }
  // Magic Initiate ที่ได้ตอน ASI/feat
  const miLv = LI.filter(li => (li.asi || li.boon) && li.e.feat === 'magic-initiate' && li.e.sub?.miList);
  for (const li of miLv) {
    const q = li.e.sub, ab = q.miAb || SPELL_AB[q.miList] || 'int';
    casting.push({ key: 'mi', chs: q, source: `Magic Initiate (${q.miList[0].toUpperCase() + q.miList.slice(1)}) · Lv ${li.lv}`, ab, dc: 8 + pb + m[ab], atk: pb + m[ab], cantripMax: 2, preparedMax: 1, maxLevel: 1, cantrips: q.miCantrips || [], prepared: q.miSpell ? [q.miSpell] : [], always: [], list: q.miList, slots: {} });
  }
  for (const id of ['paladin', 'ranger']) {
    if ((CLs[id] || 0) < 2) continue;
    const kc = chOf(c, id), want = id === 'paladin' ? 'blessed-warrior' : 'druidic-warrior';
    if (kc.fightingStyle !== want) continue;
    const ab = id === 'paladin' ? 'cha' : 'wis';
    casting.push({ key: 'fs', chs: kc, source: id === 'paladin' ? 'Blessed Warrior' : 'Druidic Warrior', ab, dc: 8 + pb + m[ab], atk: pb + m[ab], cantripMax: 2, preparedMax: 0, cantrips: kc.fsCantrips || [], prepared: [], always: [], list: id === 'paladin' ? 'cleric' : 'druid', slots: {} });
  }
  if (originFeats.includes('magic-initiate')) {
    const listId = (bg?.feat.match(/\((\w+)\)/)?.[1] || ch.miList || 'wizard').toLowerCase();
    const viaHuman = so.feat === 'magic-initiate' && !bg?.feat.startsWith('Magic Initiate');
    const list = viaHuman ? (ch.miList || 'wizard') : listId;
    const ab = ch.miAb || SPELL_AB[list] || 'int';
    casting.push({ key: 'mi', chs: ch, source: `Magic Initiate (${list[0].toUpperCase() + list.slice(1)})`, ab, dc: 8 + pb + m[ab], atk: pb + m[ab], cantripMax: 2, preparedMax: 1, maxLevel: 1, cantrips: ch.miCantrips || [], prepared: ch.miSpell ? [ch.miSpell] : [], always: [], list, slots: {} });
  }
  const sps = SPECIES_SPELLS[so.lineage || so.legacy];
  if (sps) {
    const ab = so.ability || 'int';
    const always = [];
    if (L >= 3 && sps[1]) always.push(sps[1]);
    if (L >= 5 && sps[2]) always.push(sps[2]);
    if (sps[3]) always.push(sps[3]);
    const cantrips = [...sps[0]];
    if (c.speciesId === 'tiefling') cantrips.push('Thaumaturgy');
    casting.push({ key: 'species', source: so.lineage || so.legacy, ab, dc: 8 + pb + m[ab], atk: pb + m[ab], fixed: true, cantripMax: 0, preparedMax: 0, cantrips: cantrips.map(n => D.spellByName[n.toLowerCase()]?.id).filter(Boolean), prepared: [], always: always.map(n => D.spellByName[n.toLowerCase()]?.id).filter(Boolean), slots: {} });
  } else if (c.speciesId === 'tiefling') {
    // ยังไม่เลือก legacy
  }

  // ฟีเจอร์
  const feats = [];
  if (cls) {
    for (const f of cls.features) if (f.level <= CL && !/Subclass$|^Ability Score Improvement$|^Epic Boon$/.test(f.name)) feats.push({ ...f, src: 'class' });
    if (CL >= 3) for (const f of sub.features) if (f.level <= CL) feats.push({ ...f, src: 'sub', picked: chOf(c, c.classId).packOpt?.[f.id] });
  }
  // ฟีเจอร์ของคลาสที่ multiclass เข้าไป (ซับคลาส/เวทของคลาสที่ 2 มาในเฟส 2L-2)
  const mcFeats = Object.entries(CLs).filter(([id]) => id !== c.classId && D.cls[id]).map(([id, n]) => ({
    cls: D.cls[id], n,
    feats: [...D.cls[id].features.filter(f => f.level <= n && !/Subclass$|^Ability Score Improvement$|^Epic Boon$/.test(f.name)).map(f => ({ ...f, src: 'class' })),
      ...(n >= 3 ? subOf(c, id).features.filter(f => f.level <= n).map(f => ({ ...f, src: 'sub', picked: chOf(c, id).packOpt?.[f.id] })) : [])],
    sub: subOf(c, id),
  }));

  const xx = { CLs, TL: L, pb, m, originFeats: featIds };
  const res = cls ? resources(c, xx) : [];
  for (const li of miLv) res.push({ id: 'mi' + li.i, name: `Magic Initiate Lv ${li.lv} (ร่ายฟรี)`, max: 1, reset: 'long', icon: 'feat' });

  // ---- เฟส 4D: ปรับค่าเอง (c.custom) + Exhaustion + Defenses / Speed / Senses ----
  const cu = c.custom || {}, exh = Math.min(6, Math.max(0, c.play?.exh || 0)), num0 = v => +v || 0;
  const bump = (o, key, label, n, pk = 'parts') => { if (!n) return; o[pk].push([label, n]); o[key] += n; };
  for (const s of skills) { bump(s, 'bonus', 'ปรับเอง', num0(cu.skills?.[s.name])); bump(s, 'bonus', `Exhaustion ${exh}`, -2 * exh); }
  for (const s of saves) { bump(s, 'bonus', 'ปรับเอง', num0(cu.saves?.[s.ab])); bump(s, 'bonus', `Exhaustion ${exh}`, -2 * exh); }
  for (const [lab, n] of [['ปรับเอง', num0(cu.init)], [`Exhaustion ${exh}`, -2 * exh]]) if (n) { initParts.push([lab, n]); init += n; }
  for (const a of attacks) {
    a.hitParts = a.hitParts || [];
    const ca = cu.attack?.[a.id] || {};
    bump(a, 'hit', 'ปรับเอง', num0(ca.hit), 'hitParts'); bump(a, 'hit', `Exhaustion ${exh}`, -2 * exh, 'hitParts');
    if (num0(ca.dmg)) a.dmg = a.dmg.replace(/^(\d+d\d+)?\s*([+-]\d+)?/, (all, dice, k) => { const t = (+k || 0) + num0(ca.dmg); return dice ? `${dice}${t ? (t > 0 ? '+' : '') + t : ''}` : String(Math.max(0, (+k || 0) + num0(ca.dmg))); });
  }
  for (const b of casting) { b.dc += num0(cu.spellDc); b.atk += num0(cu.spellAtk) - 2 * exh; }
  if (num0(cu.ac)) { ac += num0(cu.ac); acNote += ` ${num0(cu.ac) > 0 ? '+' : '−'} ${Math.abs(num0(cu.ac))} (ปรับเอง)`; }
  hpMax += num0(cu.hpMax);
  speed = Math.max(0, speed + num0(cu.speed) - 5 * exh);
  const perception = skills.find(s => s.name === 'Perception').bonus;
  darkvision = Math.max(darkvision, num0(cu.darkvision));
  const blindsight = num0(cu.blindsight);
  // ความเร็วแบบอื่น
  const speeds = { climb: num0(cu.climb), swim: num0(cu.swim), fly: num0(cu.fly) };
  if ((CLs.ranger || 0) >= 6 && !heavy) { speeds.climb = Math.max(speeds.climb, speed); speeds.swim = Math.max(speeds.swim, speed); }
  if ((CLs.rogue || 0) >= 3 && srdSub(c, 'rogue')) speeds.climb = Math.max(speeds.climb, speed);
  const speedNotes = [];
  if ((CLs.monk || 0) >= 9) speedNotes.push('Acrobatic Movement: เดินบนผนังแนวตั้งและบนผิวน้ำได้ระหว่างเคลื่อนที่ (ถ้าไม่ใส่เกราะ/โล่)');
  if (c.speciesId === 'dragonborn' && L >= 5) speedNotes.push('Draconic Flight: ใช้ Bonus Action กางปีกบินได้เท่า Speed นาน 10 นาที (1 ครั้ง/พักยาว)');
  // ดาเมจที่ทนได้ (res = Resistance, imm = Immunity, vul = Vulnerability)
  const defenses = [], condImm = [], saveNotes = [];
  const optType = (sid, key) => SPECIES_OPT[sid]?.opts.find(o => o[0] === so[key])?.[1];
  if (c.speciesId === 'dwarf') { defenses.push({ type: 'Poison', kind: 'res', src: 'Dwarven Resilience' }); saveNotes.push('Dwarven Resilience: Advantage เซฟกันหรือหลุดจาก Poisoned'); }
  if (c.speciesId === 'dragonborn' && optType('dragonborn', 'ancestry')) defenses.push({ type: optType('dragonborn', 'ancestry'), kind: 'res', src: 'Damage Resistance (Draconic Ancestry)' });
  if (c.speciesId === 'tiefling' && optType('tiefling', 'legacy')) defenses.push({ type: optType('tiefling', 'legacy'), kind: 'res', src: `Fiendish Legacy (${so.legacy})` });
  if (c.speciesId === 'elf') saveNotes.push('Fey Ancestry: Advantage เซฟกันหรือหลุดจาก Charmed');
  if (c.speciesId === 'gnome') saveNotes.push('Gnomish Cunning: Advantage เซฟ INT, WIS และ CHA');
  if (c.speciesId === 'halfling') saveNotes.push('Brave: Advantage เซฟกันหรือหลุดจาก Frightened');
  if (CLs.barbarian) {
    defenses.push(...['Bludgeoning', 'Piercing', 'Slashing'].map(t => ({ type: t, kind: 'res', src: 'Rage', when: 'ตอน Rage' })));
    saveNotes.push('Rage: ระหว่าง Rage ได้ Advantage ทอย STR Check และ STR Saving Throw');
    if (CLs.barbarian >= 2) saveNotes.push('Danger Sense: Advantage เซฟ DEX (ถ้าไม่ติด Incapacitated)');
  }
  if ((CLs.druid || 0) >= 10 && srdSub(c, 'druid')) {
    const t = { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' }[chOf(c, 'druid').land];
    if (t) defenses.push({ type: t, kind: 'res', src: "Nature's Ward" });
    condImm.push({ type: 'Poisoned', src: "Nature's Ward" });
  }
  if ((CLs.paladin || 0) >= 10) condImm.push({ type: 'Frightened', src: 'Aura of Courage' });
  for (const d of cu.defenses || []) if (d?.type) defenses.push({ type: d.type, kind: d.kind || 'res', src: 'เพิ่มเอง' });
  if (exh >= 6) warn.push('Exhaustion ระดับ 6 = ตัวละครตาย');

  // ภาษา
  const langs = new Set(['Common', ...(c.languages || []), ...String(cu.langs || '').split(',').map(z => z.trim()).filter(Boolean)]);
  if (CLs.druid) langs.add('Druidic');
  if (CLs.rogue) langs.add("Thieves' Cant");

  // เช็คตัวเลือกที่ยังขาด
  if (!cls) warn.push('ยังไม่ได้เลือกคลาส');
  if (!sp) warn.push('ยังไม่ได้เลือก Species');
  if (!bg) warn.push('ยังไม่ได้เลือก Background');

  const out = {
    cls, sub, sp, bg, L, CL, CLs, masteryIds: [...masteries], classLine: classLine(c), hitDice, atkPer, mcFeats, levelFeats, aura,
    pb, score, m, skills, saves, ac, acNote, hpMax, speed, init, initParts, perception, darkvision, truesight: featIds.includes('boon-of-truesight') ? 60 : 0,
    attacks, casting, feats, res, featIds, originFeats: originFeats.filter(Boolean), langs: [...langs],
    training: [...training], weaponRule: rule, warn,
    exh, defenses, condImm, saveNotes, speeds, speedNotes, blindsight, customProfs: String(cu.profs || '').trim(),
  };
  // ป้าย Advantage / Disadvantage บนสูตร (เฟส 4E) — อ่าน c.play ตอนเรียก จึงตรงกับสถานะล่าสุดเสมอ
  out.rf = (kind, ab, skill) => rollFlags(c.play, out, kind, ab, skill);
  out.picks = {};
  for (const q of SRD_PICKS) if ((CLs[q.cls] || 0) >= q.at && (!q.srdSub || srdSub(c, q.cls))) out.picks[q.key] = chOf(c, q.cls)[q.key] || null;
  if (c.play?.wild) applyWild(c, out);
  return out;
}

// ---------- Wild Shape (เฟส 5): ใช้ STR/DEX/CON, AC, Speed, การโจมตี, Senses ของร่างสัตว์ (กฎ 2024) ----------
const WORD_N = { one: 1, two: 2, three: 3, four: 4 };
/** อ่านท่าโจมตีจาก md ของสัตว์ SRD → [{name, hit, reach, dmg, extra}] + จำนวนโจมตีจาก Multiattack */
export function beastAttacks(a) {
  const t = String(a.md || '').replace(/(\w)- (\w)/g, '$1$2').replace(/\*\*\*\s*\*\*\*\s*\.\s*\*\*\*/g, '.***');
  const list = [];
  const re = /\*\*\*([^*]+?)\.?\*\*\*\s*\*(Melee|Ranged|Melee or Ranged) Attack Roll:\*\s*([+-]\d+)(?:\s*\([^)]*\))?,\s*([^.*]+?)\.\s*\*Hit:\*\s*(?:\d+\s*\(([^)]+)\)|(\d+))\s*(\w+) damage([^\n]*)/g;
  let m;
  while ((m = re.exec(t))) {
    const extra = m[8].replace(/^\s*plus\s*\d+\s*\(([^)]+)\)\s*(\w+) damage/, (z, d, k) => `+ ${d.replace(/\s/g, '')} ${k}`).replace(/^[.\s]+/, '');
    list.push({ name: m[1].trim(), kind: m[2], hit: +m[3], reach: m[4].trim(), dmg: `${(m[5] || m[6]).replace(/\s/g, '')} ${m[7]}`, extra: extra.trim() });
  }
  const ma = t.match(/\*\*\*Multiattack\.\*\*\*\s*([^\n]+)/)?.[1] || '';
  const per = (ma.match(/\b(one|two|three|four)\b/gi) || []).reduce((n, w) => n + (WORD_N[w.toLowerCase()] || 0), 0);
  return { list, per: per || 1, multi: ma };
}

function applyWild(c, x) {
  const w = (c.extras || []).find(z => z.id === c.play.wild), a = w && D.animal?.[w.animal];
  if (!a) return;
  const exh = c.play.exh || 0;
  x.wild = { name: w.name, animal: a.id, from: { ac: x.ac, speed: x.speed, str: x.score.str, dex: x.score.dex, con: x.score.con, atkPer: x.atkPer } };
  for (const ab of ['str', 'dex', 'con']) { x.score[ab] = a.abil[ab]; x.m[ab] = mod(a.abil[ab]); }
  const fix = (parts, ab) => parts.map(([l, n]) => (l === ABIL_SHORT[ab] && ['str', 'dex', 'con'].includes(ab) ? [l + ' (ร่าง)', x.m[ab]] : [l, n]));
  const listed = {};
  for (const [, k, v] of String(a.info || '').matchAll(/(\w+(?: of Hand)?) ([+-]\d+)/g)) listed[k] = +v;
  for (const s of x.skills) {
    s.parts = fix(s.parts, s.ab);
    s.bonus = s.parts.reduce((t, q) => t + q[1], 0);
    if (listed[s.name] != null && listed[s.name] - 2 * exh > s.bonus) { s.parts = [[`ค่าของ ${a.name}`, listed[s.name]], ...(exh ? [['Exhaustion', -2 * exh]] : [])]; s.bonus = listed[s.name] - 2 * exh; }
  }
  for (const s of x.saves) { s.parts = fix(s.parts, s.ab); s.bonus = s.parts.reduce((t, q) => t + q[1], 0); }
  x.initParts = fix(x.initParts, 'dex'); x.init = x.initParts.reduce((t, q) => t + q[1], 0);
  const P = x.skills.find(s => s.name === 'Perception'); if (P) x.perception = 10 + P.bonus;
  x.ac = a.ac; x.acNote = `AC ของร่าง ${a.name}`;
  const sp = String(a.speed || '');
  x.speed = Math.max(0, (parseInt(sp, 10) || 0) - 5 * exh);
  x.speeds = { climb: 0, swim: 0, fly: 0 };
  for (const [, k, n] of sp.matchAll(/(Climb|Swim|Fly) (\d+)/gi)) x.speeds[k.toLowerCase()] = +n;
  const dv = String(a.info || '').match(/Darkvision (\d+)/); if (dv) x.darkvision = Math.max(x.darkvision, +dv[1]);
  const bs = String(a.info || '').match(/Blindsight (\d+)/); if (bs) x.blindsight = Math.max(x.blindsight || 0, +bs[1]);
  const B = beastAttacks(a);
  x.attacks = B.list.map((q, i) => ({ id: `wild-${i}`, name: q.name, ab: q.kind === 'Ranged' ? 'dex' : 'str', hit: q.hit - 2 * exh,
    hitParts: [[`ค่าของ ${a.name}`, q.hit], ...(exh ? [['Exhaustion', -2 * exh]] : [])], dmg: q.dmg, props: [q.reach, q.extra].filter(Boolean).join(' · '), prof: true, wild: true }));
  x.atkPer = Math.max(B.per, x.atkPer);
  x.wild.multi = B.multi;
  x.noCast = true;
}


/** รายการตัวเลือกที่ผู้เล่นยังไม่ได้เลือก (ใช้ทั้งในวิซาร์ดและใบตัวละคร) */
export function missing(c) {
  const out = [];
  const cls = D.cls[c.classId];
  if (!cls) return ['เลือกคลาส'];
  if ((c.skills || []).length < cls.skillChoose) out.push(`เลือกสกิลของคลาส (${cls.skillChoose})`);
  for (const [id, L] of Object.entries(classLevels(c))) {
    const k = D.cls[id];
    if (!k) continue;
    const ch = chOf(c, id), primary = id === c.classId, tag = primary ? '' : ` — ${k.name}`, isSrdSub = srdSub(c, id);
    if (!primary && (MC_PROF[id]?.skills || 0) > (c.mc?.[id]?.skills || []).length) out.push(`เลือกสกิลจาก Multiclass${tag}`);
    if (FIGHTING_STYLE_AT[id] && L >= FIGHTING_STYLE_AT[id] && !ch.fightingStyle) out.push('เลือก Fighting Style' + tag);
    if (id === 'cleric' && !ch.divineOrder) out.push('เลือก Divine Order' + tag);
    if (id === 'druid' && !ch.primalOrder) out.push('เลือก Primal Order' + tag);
    if (MASTERY_AT[id] && (ch.mastery || []).length < num(col(k, id === 'barbarian' ? 'Mastery' : 'Weapon Mastery', L) || 2)) out.push('เลือก Weapon Mastery' + tag);
    if (id === 'barbarian' && L >= 3 && !ch.primalSkill) out.push('เลือกสกิลจาก Primal Knowledge' + tag);
    if (id === 'bard' && L >= 3 && isSrdSub && (ch.loreSkills || []).length < 3) out.push('เลือกสกิล 3 อย่าง (Bonus Proficiencies)' + tag);
    if (id === 'druid' && L >= 3 && isSrdSub && !ch.land) out.push('เลือกชนิดดินแดน (Circle of the Land)' + tag);
    if (id === 'ranger' && L >= 3 && isSrdSub && !ch.huntersPrey) out.push("เลือก Hunter's Prey" + tag);
    for (const q of SRD_PICKS) if (q.cls === id && L >= q.at && (!q.srdSub || isSrdSub) && !ch[q.key]) out.push(`เลือก ${q.feat}` + tag);
    if (id === 'sorcerer' && (ch.metamagic || []).length < metamagicCount(L)) out.push(`เลือก Metamagic ${metamagicCount(L)} อย่าง` + tag);
    if (id === 'warlock' && (ch.invocations || []).includes('pact-of-the-tome') && ((ch.tomeCantrips || []).length < 3 || (ch.tomeRituals || []).length < 2)) out.push('เลือกเวทใน Book of Shadows (Pact of the Tome)');
    if (id === 'warlock' && (ch.invocations || []).length < num(col(k, 'Eldritch Invocations', L))) out.push('เลือก Eldritch Invocations' + tag);
    if ((ch.expertise || []).length < expertiseCount(id, L)) out.push(`เลือก Expertise ${expertiseCount(id, L)} อย่าง` + tag);
    const sb = subOf(c, id);
    if (sb?.pack && L >= 3) for (const f of sb.features) if (f.level <= L && f.opts?.length && !f.opts.some(o => o.name === ch.packOpt?.[f.id])) out.push(`เลือก ${f.name} (Lv ${f.level})` + tag);
  }
  if (SPECIES_OPT[c.speciesId] && !c.speciesOpt?.[SPECIES_OPT[c.speciesId].key]) out.push(`เลือก ${SPECIES_OPT[c.speciesId].label}`);
  if (c.speciesId === 'human' && !c.speciesOpt?.feat) out.push('เลือก Origin Feat (Human Versatile)');
  if (c.speciesId === 'human' && !c.speciesOpt?.skill) out.push('เลือกสกิล (Human Skillful)');
  if (c.speciesId === 'elf' && !c.speciesOpt?.skill) out.push('เลือกสกิล (Keen Senses)');
  if (c.settings?.hp === 'roll') for (const li of levelInfo(c)) if (li.i > 0 && li.cls && !li.e.hp) out.push(`ใส่ผลทอย HP (Lv ${li.lv})`);
  for (const li of levelInfo(c)) if (li.asi || li.boon) {
    const f = D.feat[li.e.feat];
    if (!f) { out.push(`เลือก ${li.boon ? 'Epic Boon' : 'ASI'} หรือ Feat (Lv ${li.lv})`); continue; }
    const r = featAsiRule(f);
    if (r && Object.values(li.e.asi || {}).reduce((s, n) => s + n, 0) < r.total) out.push(`ใส่แต้มค่าพลังของ ${f.name} (Lv ${li.lv})`);
    if (f.id === 'skilled' && (li.e.sub?.skills || []).length < 3) out.push(`เลือกสกิล 3 อย่างของ Skilled (Lv ${li.lv})`);
    if (f.id === 'magic-initiate' && !li.e.sub?.miList) out.push(`เลือกรายการเวทของ Magic Initiate (Lv ${li.lv})`);
  }
  return out;
}

export function newCharacter() {
  return {
    v: 1, name: '', player: '', level: 1, levels: [{ c: null }], mc: {}, classId: null, speciesId: null, bgId: null,
    abilities: { method: 'standard', base: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, bonus: {}, assign: {} },
    skills: [], languages: [], choices: {}, speciesOpt: {},
    equipment: { classOpt: 'A', bgOpt: 'A', items: [], gp: 0, armor: null, shield: false },
    spells: { cantrips: [], prepared: [], book: [] },
    play: { hp: null, temp: 0, hdUsed: 0, slots: {}, res: {}, conditions: [], death: { s: 0, f: 0 }, inspiration: false },
    notes: '', details: {}, settings: { hp: 'avg' },
  };
}

/** สร้างรายการของจากตัวเลือก A/B ของคลาสและ background */
export function rebuildEquipment(c) {
  const cls = D.cls[c.classId], bg = D.bg[c.bgId];
  const items = [], e = c.equipment;
  let gp = 0;
  for (const [txt, opt] of [[cls?.core['Starting Equipment'], e.classOpt], [bg?.equipment, e.bgOpt]]) {
    const o = equipOptions(txt)[opt || 'A'];
    if (!o) continue;
    const r = parseItems(o);
    items.push(...r.items);
    gp += r.gp;
  }
  e.items = items;
  e.gp = gp;
  const armor = items.find(i => i.armor && i.armor !== 'shield');
  e.armor = armor?.armor || null;
  e.shield = items.some(i => i.armor === 'shield');
}
