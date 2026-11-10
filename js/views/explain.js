// การ์ดอธิบาย "ตัวเลขนี้มาจากไหน" — ใช้เต๋าจริง เว็บแค่บอกสูตร
import { D } from '../data.js';
import { h, sheet } from '../util.js';
import { ABIL_SHORT, col } from '../rules.js';
import { flagSum } from '../fx.js';
import { fullTh } from './parts.js';
import { rollRow, exprRow } from '../dice.js';

const pm = n => (n < 0 ? '− ' : '+ ') + Math.abs(n);

/** ช่วงดาเมจของสูตรเต๋า เช่น "1d8+3 Slashing" → "4–11" (ไม่ใช่สูตรเต๋า = '') */
export function dmgRange(s) {
  const m = String(s || '').replace(/−/g, '-').match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?/);
  if (!m) return '';
  const n = +m[1], d = +m[2], k = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  return `${Math.max(0, n + k)}–${n * d + k}`;
}

/** ดาเมจสูตร + ช่วงตัวเล็ก */
export const dmgText = s => [s, dmgRange(s) ? h('small.rng', ` (${dmgRange(s)})`) : null];

/** กล่องสูตร: label: d20 + 5 แล้วแตกรายการ STR +3 · Prof +2 · flags = ป้าย Advantage/Disadvantage จาก x.rf() */
export function formula(label, total, parts = [], flags = [], die = 'd20', opt = {}) {
  const extra = (flags || []).filter(f => f.t === 'plus' || f.t === 'minus').map(f => ` ${f.t === 'plus' ? '+' : '−'} ${f.add}`).join('');
  return h('div.formula',
    h('div.f-main', h('span', label), h('b', `${flagSum(flags) === 'fail' ? '—' : `${die} ${pm(total)}${extra}`}`)),
    parts.length ? h('div.f-parts', parts.map(([l, n]) => h('span', l, ' ', h('b', (n < 0 ? '−' : '+') + Math.abs(n))))) : null,
    fxNode(flags),
    die === 'd20' ? rollRow(opt.tag || label.replace(/^ทอย\s*/, ''), total, flags, opt) : null);
}

/** ป้ายบอกผล Condition/เอฟเฟกต์ใต้สูตร */
export function fxNode(flags) {
  if (!flags?.length) return null;
  const why = t => [...new Set(flags.filter(f => f.t === t).map(f => f.why))].join(', ');
  const k = flagSum(flags), rows = [];
  if (k === 'fail') rows.push(h('div.fx.fail', '⛔ ล้มเหลวอัตโนมัติ — ไม่ต้องทอยเลย', h('small', ` (${why('fail')})`)));
  else if (k === 'both') rows.push(h('div.fx', '⚖️ มีทั้ง Advantage และ Disadvantage → หักล้างกัน ทอย d20 ลูกเดียวตามปกติ', h('small', ` (▲ ${why('adv')} · ▼ ${why('dis')})`)));
  else if (k === 'adv') rows.push(h('div.fx.adv', '▲ Advantage — ทอย d20 สองลูก เอาลูกที่สูงกว่า', h('small', ` (${why('adv')})`)));
  else if (k === 'dis') rows.push(h('div.fx.dis', '▼ Disadvantage — ทอย d20 สองลูก เอาลูกที่ต่ำกว่า', h('small', ` (${why('dis')})`)));
  for (const f of flags) if (f.t === 'plus' || f.t === 'minus') rows.push(h('div.fx' + (f.t === 'plus' ? '.adv' : '.dis'), `${f.t === 'plus' ? '+' : '−'} ทอย ${f.add} ${f.t === 'plus' ? 'บวกเพิ่ม' : 'แล้วลบออก'}`, h('small', ` (${f.why})`)));
  return rows.length ? h('div.fx-box', rows) : null;
}
/** เครื่องหมายเล็ก ๆ ข้างตัวเลขบนใบ: ▲ / ▼ / ⛔ / ⚖ */
export function fxMark(flags) {
  const k = flagSum(flags);
  const plus = (flags || []).some(f => f.t === 'plus'), minus = (flags || []).some(f => f.t === 'minus');
  const sym = { adv: '▲', dis: '▼', fail: '⛔', both: '⚖' }[k] || (plus && !minus ? '+' : minus && !plus ? '−' : '');
  return sym ? h('i.fxm.' + (k || (plus ? 'adv' : 'dis')), { title: flags.map(f => f.why).join(', ') }, sym) : null;
}

/** เปิด bottom sheet อธิบาย */
export function explain(title, body, actions = []) {
  return sheet(title, h('div.explain', body), actions);
}

/** เนื้อหาการ์ดอาวุธ: สูตรโจมตี + ดาเมจ + ความหมาย Mastery / คุณสมบัติ */
export function attackBody(a, x) {
  const terms = [
    ...(a.mastery ? [a.mastery.toLowerCase()] : []),
    ...D.weaponProps.filter(p => new RegExp(`\\b${p.name}\\b`, 'i').test(a.props || '')).map(p => p.id)];
  const mod = x.m[a.ab] || 0;
  return [
    formula('ทอยโจมตี', a.hit, a.hitParts || [], x.rf?.('atk', a.ab), 'd20', { tag: `${a.name} Attack`, atk: true, dmg: a.dmg, name: a.name }),
    h('div.formula',
      h('div.f-main', h('span', 'ดาเมจ'), h('b', ...dmgText(a.dmg))),
      h('div.f-parts', a.wild ? h('span', 'ตามค่าสถานะของร่างสัตว์ (รวมค่าพลังแล้ว)') : /\d+d\d+/.test(a.dmg) ? [h('span', 'ลูกเต๋าอาวุธ'), h('span', `${ABIL_SHORT[a.ab]} `, h('b', (mod < 0 ? '−' : '+') + Math.abs(mod)))] : h('span', `1 + ${ABIL_SHORT[a.ab]} (ไม่มีลูกเต๋า)`)),
      exprRow(`${a.name} Damage`, a.dmg)),
    h('p.muted.small', 'ทอยได้ 20 = Critical Hit: ทอยลูกเต๋าดาเมจ 2 เท่า (ตัวบวกไม่คูณ) · DM บอกเองว่าโดนหรือไม่'),
    a.prof === false ? h('p.tip', '⚠ ยังไม่ชำนาญอาวุธนี้ — ไม่ได้บวก Proficiency') : null,
    x.atkPer > 1 ? h('p.small', `⚔️ Extra Attack: ใช้ Attack action แล้วตีได้ ${x.atkPer} ครั้ง`) : null,
    a.props ? h('p.small', h('b', 'คุณสมบัติ: '), a.props) : a.id === 'unarmed' ? h('p.small', 'ต่อย เตะ โขก — ใช้แทนการ Grapple / Shove ได้') : null,
    terms.map(id => {
      const it = D.masteryById[id] || D.weaponProps.find(p => p.id === id);
      return it ? h('div.wterm', h('b', it.name, id === a.mastery?.toLowerCase() ? h('i.tag.mastery', 'Mastery') : null), D.th.mastery?.[id] ? h('p.th', D.th.mastery[id]) : null, fullTh('mastery', id)) : null;
    }),
  ];
}

/** คำอธิบายค่าบนใบจาก data/th/help.json → [ความหมาย, ใช้ตอนไหน] */
export function helpBody(key) {
  const t = D.th.help?.terms?.[key];
  if (!t) return [];
  return [h('p.th', t.what), t.use ? h('p.help-use', h('b', 'ใช้ยังไง: '), t.use) : null];
}
/** ปุ่ม ⓘ เล็ก ๆ ข้างหัวข้อ เปิดคำอธิบายค่านั้น */
export function infoBtn(key, extra = []) {
  return h('button.info-btn', { 'aria-label': 'ความหมาย', onclick: e => { e.stopPropagation(); explain(D.th.help?.terms?.[key]?.t || key, [...helpBody(key), ...extra]); } }, 'ⓘ');
}

const DMG_T = 'Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder';
const AB_FULL = { Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
/** สูตรของสเปลด้วยตัวเลขของเรา: ทอยโจมตี / DC เซฟ / ดาเมจหรือฮีล (+ช่วง) / Cantrip ตามเลเวล / อัปสลอต */
export function spellMath(s, b, x) {
  if (!s || !b) return null;
  const t = (s.text || '').replace(/(\w)- (\w)/g, '$1$2').replace(/\s+/g, ' ');
  const out = [], mod = x.m[b.ab] || 0, ab = ABIL_SHORT[b.ab];
  if (/spell attack/i.test(t)) {
    const parts = [['Proficiency', x.pb], [ab, mod]], rest = b.atk - x.pb - mod;
    if (rest) parts.push(['อื่น ๆ', rest]);
    out.push(formula('ทอยโจมตีด้วยเวท', b.atk, parts, x.rf?.('atk', b.ab), 'd20', { tag: `${s.name} Spell Attack` }));
  }
  const sv = t.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/);
  if (sv) out.push(h('div.formula', h('div.f-main', h('span', `เป้าหมายทอยเซฟ ${AB_FULL[sv[1]]}`), h('b', `DC ${b.dc}`)), h('div.f-parts', h('span', 'บอก DM ว่า DC เท่านี้ — DM เป็นคนทอยให้เป้าหมาย'))));
  // ดาเมจ / ฮีล
  let eff = null, m;
  if ((m = t.match(new RegExp(`(\\d+)d(\\d+)(?:\\s*\\+\\s*(\\d+))?\\s+(${DMG_T}) damage`)))) eff = { n: +m[1], d: +m[2], k: +(m[3] || 0), label: `ดาเมจ ${m[4]}` };
  else if ((m = t.match(new RegExp(`(\\d+)d(\\d+) plus your spellcasting ability modifier (${DMG_T}) damage`)))) eff = { n: +m[1], d: +m[2], k: mod, label: `ดาเมจ ${m[3]}` };
  else if ((m = t.match(/Hit Points equal to (\d+)d(\d+)( plus your spellcasting ability modifier)?/))) eff = { n: +m[1], d: +m[2], k: m[3] ? mod : 0, label: 'ฟื้น HP' };
  const dice = (n, d, k) => `${n}d${d}${k ? (k > 0 ? '+' : '') + k : ''}`;
  if (eff) {
    let n = eff.n, note = null;
    const up = t.match(/Cantrip Upgrade\.?\**\s*([^*]*?)(?=\s*\*\*\*|$)/)?.[1] || '';
    if (s.level === 0 && up) {
      const tier = x.L >= 17 ? 3 : x.L >= 11 ? 2 : x.L >= 5 ? 1 : 0;
      const lv = up.match(/levels 5 \((\d+)d\d+\), 11 \((\d+)d\d+\), and 17 \((\d+)d\d+\)/);
      const beams = up.match(/(\w+) beams at level 5, (\w+) beams at level 11, and (\w+) beams at level 17/);
      if (lv && tier) { n = +lv[tier]; note = `เลเวลตัวละคร ${x.L} → ลูกเต๋าเพิ่มเป็น ${n}d${eff.d}`; }
      else if (beams) note = `เลเวลตัวละคร ${x.L} → ยิงได้ ${tier + 1} ลำ (ทอยโจมตีแยกทีละลำ ลำละ ${dice(eff.n, eff.d, eff.k)})`;
    }
    const potent = s.level === 0 && /^ดาเมจ/.test(eff.label) && ((b.cid === 'cleric' && x.picks?.blessedStrikes === 'Potent Spellcasting') || (b.cid === 'druid' && x.picks?.elementalFury === 'Potent Spellcasting'));
    if (potent) { eff.k += x.m.wis || 0; note = [note, `Potent Spellcasting: บวก WIS ${x.m.wis >= 0 ? '+' : ''}${x.m.wis}`].filter(Boolean).join(' · '); }
    const str = dice(n, eff.d, eff.k);
    out.push(h('div.formula', h('div.f-main', h('span', eff.label), h('b', ...dmgText(str))), note ? h('div.f-parts', h('span', note)) : null,
      exprRow(`${s.name} ${/^ฟื้น/.test(eff.label) ? 'Healing' : 'Damage'}`, str, /spell attack/i.test(t))));
    // อัปสลอต
    const u = t.match(/(?:damage|healing) increases by (\d+)d(\d+) for each spell slot level above (\d+)/);
    if (u && s.level > 0) {
      const lvs = [...new Set(x.casting.flatMap(z => Object.keys(z.slots || {}).map(Number)))].filter(l => l > s.level).sort((a, c) => a - c);
      if (lvs.length) out.push(h('div.formula', h('div.f-main', h('span', 'ใช้สลอตเลเวลสูงขึ้น')),
        h('div.f-parts', lvs.map(l => { const z = dice(eff.n + (l - +u[3]) * +u[1], eff.d, eff.k); return h('span', `Lv ${l}: `, h('b', z), h('small.rng', ` (${dmgRange(z)})`)); }))));
    }
  }
  if (!out.some(n => n.classList?.contains('up-note')) && !/(?:damage|healing) increases by \d+d\d+ for each/.test(t)) {
    const up = t.match(/Using a Higher-Level Spell Slot\.?\**\s*([^*]*)/)?.[1];
    if (up && s.level > 0) out.push(h('p.small.up-note', '⬆️ ใช้สลอตเลเวลสูงขึ้นแล้วเวทนี้แรงขึ้นได้ — อ่านหัวข้อ "Using a Higher-Level Spell Slot" ในแปลเต็มด้านล่าง'));
  }
  return out.length ? out : null;
}

// ---------- ลูกเต๋าของฟีเจอร์ (เฟส 4E) ----------
const dieBlock = (label, str, notes) => h('div.formula', h('div.f-main', h('span', label), h('b', ...dmgText(str))),
  notes ? h('div.f-parts', [].concat(notes).filter(Boolean).map(n => h('span', n))) : null);
const valBlock = (label, val, notes) => h('div.formula', h('div.f-main', h('span', label), h('b', String(val))),
  notes ? h('div.f-parts', [].concat(notes).filter(Boolean).map(n => h('span', n))) : null);
const plus = n => (n < 0 ? String(n) : '+' + n);

/** สูตรลูกเต๋า/ตัวเลขของฟีเจอร์ด้วยค่าของเรา — name = ชื่อฟีเจอร์ EN, clsId = คลาสเจ้าของ (species ไม่ต้องใส่) */
export function featureMath(name, x, clsId) {
  const n = clsId ? x.CLs?.[clsId] || 0 : 0, cls = clsId && D.cls[clsId];
  const lv = k => (cls && n ? col(cls, k, n) : null);
  const M = ab => x.m[ab] || 0, out = [];
  const dc = ab => 8 + M(ab) + x.pb;
  switch (name) {
    case 'Sneak Attack': { const d = lv('Sneak Attack'); if (d) out.push(dieBlock('ดาเมจเพิ่ม (Sneak Attack)', d, ['1 ครั้งต่อเทิร์น บวกเข้ากับดาเมจอาวุธ', 'ใช้อาวุธ Finesse หรืออาวุธยิงไกล', 'ต้องมี Advantage หรือมีเพื่อนยืนติดเป้า (และเราต้องไม่มี Disadvantage)'])); break; }
    case 'Rage': { const d = lv('Damage'); if (d) out.push(valBlock('ดาเมจเพิ่มตอน Rage', d, 'บวกทุกครั้งที่ตีโดนด้วยการโจมตีที่ใช้ STR')); break; }
    case 'Brutal Strike': case 'Improved Brutal Strike': out.push(dieBlock('ดาเมจเพิ่ม (Brutal Strike)', n >= 17 ? '2d10' : '1d10', 'ยอมสละ Advantage จาก Reckless Attack 1 ครั้ง → ตีโดนแล้วบวกดาเมจนี้ + ผลพิเศษ')); break;
    case 'Bardic Inspiration': { const d = lv('Bardic Die'); if (d) out.push(dieBlock('เพื่อนทอยเพิ่ม', '1' + d.toLowerCase(), ['เพื่อนเก็บไว้ได้ 1 ชั่วโมง', 'ใช้บวกตอนทอย D20 Test ไม่ผ่าน (ทอยแล้วค่อยตัดสินใจได้)'])); break; }
    case 'Martial Arts': { const d = lv('Martial Arts'), k = Math.max(M('str'), M('dex')); if (d) out.push(dieBlock('ดาเมจมือเปล่า / อาวุธ Monk', d + plus(k), [`ลูกเต๋า Martial Arts ${d}`, `ใช้ STR หรือ DEX ที่สูงกว่า ${plus(k)}`])); break; }
    case 'Uncanny Metabolism': { const d = lv('Martial Arts'); if (d) out.push(dieBlock('ฟื้น HP', d + plus(n), 'ตอนทอย Initiative ได้ Focus Point คืนหมด + ฟื้น HP เท่านี้')); break; }
    case 'Deflect Attacks': out.push(dieBlock('ลดดาเมจที่โดน', `1d10${plus(M('dex') + n)}`, ['1d10 + DEX + เลเวล Monk', `ลดจนเหลือ 0 → ใช้ Focus Point 1 แต้มสะท้อนกลับได้ (ดาเมจ 2 ลูกเต๋า Martial Arts + DEX, เป้าเซฟ DEX DC ${dc('wis')})`])); break;
    case "Monk's Focus": out.push(valBlock('DC เซฟของท่า Focus', `DC ${dc('wis')}`, '8 + WIS + Proficiency')); break;
    case 'Stunning Strike': out.push(valBlock('เป้าทอยเซฟ CON', `DC ${dc('wis')}`, ['8 + WIS + Proficiency', 'ไม่ผ่าน = Stunned ถึงต้นเทิร์นหน้าของเรา · ผ่าน = Speed ครึ่ง + โดนตีมี Advantage'])); break;
    case 'Second Wind': out.push(dieBlock('ฟื้น HP', `1d10${plus(n)}`, '1d10 + เลเวล Fighter')); break;
    case 'Tactical Mind': out.push(dieBlock('บวกเพิ่มตอน Check ไม่ผ่าน', '1d10', 'ใช้ Second Wind 1 ครั้ง · ถ้าบวกแล้วยังไม่ผ่าน จะไม่เสียครั้งนั้น')); break;
    case 'Indomitable': out.push(valBlock('ทอยเซฟใหม่ได้ + โบนัส', plus(n), 'บวกเลเวล Fighter เข้าไปตอนทอยใหม่ (ต้องใช้ผลใหม่)')); break;
    case 'Lay On Hands': out.push(valBlock('แต้มรักษาทั้งหมด', `${5 * n} HP`, ['5 × เลเวล Paladin · คืนเต็มตอนพักยาว', 'ใช้ 5 แต้ม = รักษา Poisoned ได้'])); break;
    case 'Channel Divinity':
      if (clsId === 'cleric') { const k = n >= 18 ? 4 : n >= 13 ? 3 : n >= 7 ? 2 : 1, b = x.casting?.find(z => z.cid === 'cleric');
        out.push(dieBlock('Divine Spark: ฟื้น HP หรือดาเมจ', `${k}d8${plus(M('wis'))}`, [`${k}d8 + WIS`, `ดาเมจ: เป้าเซฟ CON DC ${b?.dc ?? dc('wis')} (ผ่านครึ่ง) · Necrotic หรือ Radiant`])); }
      break;
    case 'Breath Weapon': { const k = x.L >= 17 ? 4 : x.L >= 11 ? 3 : x.L >= 5 ? 2 : 1; out.push(dieBlock('ดาเมจลมหายใจ', `${k}d10`, [`เป้าทอยเซฟ DEX DC ${dc('con')} (8 + CON + Proficiency)`, 'ไม่ผ่านโดนเต็ม · ผ่านโดนครึ่ง', 'ใช้แทนการโจมตี 1 ครั้งใน Attack action'])); break; }
    case 'Giant Ancestry': out.push(h('div.formula', h('div.f-main', h('span', 'ลูกเต๋าของแต่ละสายเลือด')), h('div.f-parts',
      h('span', 'Fire\'s Burn ', h('b', '1d10'), h('small.rng', ' (1–10) Fire')), h('span', 'Frost\'s Chill ', h('b', '1d6'), h('small.rng', ' (1–6) Cold')),
      h('span', 'Storm\'s Thunder ', h('b', '1d8'), h('small.rng', ' (1–8) Thunder')), h('span', 'Stone\'s Endurance ลดดาเมจ ', h('b', `1d12${plus(M('con'))}`), h('small.rng', ` (${dmgRange(`1d12${plus(M('con'))}`)})`)),
      h('span', `Hill's Tumble: ตีโดนแล้วทำเป้าขนาด Large ลงไปล้ม (Prone)`)))); break;
    case 'Blessed Strikes': case 'Improved Blessed Strikes': case 'Elemental Fury': case 'Improved Elemental Fury': case 'Defensive Tactics': {
      const key = { 'Blessed Strikes': 'blessedStrikes', 'Improved Blessed Strikes': 'blessedStrikes', 'Elemental Fury': 'elementalFury', 'Improved Elemental Fury': 'elementalFury', 'Defensive Tactics': 'defTactics' }[name];
      const v = x.picks?.[key];
      if (!v) { out.push(h('p.tip', `⚠ ยังไม่ได้เลือกแบบของ ${name.replace('Improved ', '')} — ไปเลือกที่หน้าแก้ไข ขั้น CLASS`)); break; }
      const two = n >= (clsId === 'cleric' ? 14 : 15);
      if (v === 'Divine Strike') out.push(dieBlock('Divine Strike: ดาเมจเพิ่ม', two ? '2d8' : '1d8', ['1 ครั้งต่อเทิร์น ตอนตีโดนด้วยอาวุธ', 'เลือก Necrotic หรือ Radiant']));
      else if (v === 'Primal Strike') out.push(dieBlock('Primal Strike: ดาเมจเพิ่ม', two ? '2d8' : '1d8', ['1 ครั้งต่อเทิร์น ตอนตีโดนด้วยอาวุธหรือท่าของร่างสัตว์', 'เลือก Cold / Fire / Lightning / Thunder']));
      else if (v === 'Potent Spellcasting') out.push(valBlock('Potent Spellcasting', `+${x.m.wis || 0} ดาเมจ Cantrip`, ['บวก WIS เข้าไปในดาเมจ Cantrip ของคลาสนี้ (สูตรในแท็บ SPELLS รวมให้แล้ว)',
        two && clsId === 'cleric' ? `Lv14: ร่ายโดนแล้วให้ Temp HP ${2 * (x.m.wis || 0)} แก่ตัวเองหรือเพื่อนในระยะ 60 ฟุต` : null, two && clsId === 'druid' ? 'Lv15: Cantrip ที่ระยะ 10 ฟุตขึ้นไป ไกลขึ้นอีก 300 ฟุต' : null]));
      else out.push(valBlock('ที่เลือกไว้', v, 'เปลี่ยนได้ทุกครั้งที่พักสั้นหรือพักยาว (แก้ที่หน้าแก้ไข ขั้น CLASS)'));
      break;
    }
    case 'Adrenaline Rush': out.push(valBlock('Temp HP ที่ได้', x.pb, 'เท่ากับ Proficiency Bonus')); break;
    case 'Arcane Recovery': out.push(valBlock('คืนสลอตรวมได้ไม่เกิน', `${Math.ceil(n / 2)} เลเวล`, 'ครึ่งหนึ่งของเลเวล Wizard (ปัดขึ้น) · สลอตแต่ละอันต้องไม่เกิน Lv 5')); break;
  }
  return out;
}
