// ทอยเต๋าในเว็บ (โหมดออนไลน์) — ค่าเริ่มต้นปิด เล่นที่โต๊ะใช้เต๋าจริงเหมือนเดิม
// ผลทอยขึ้นเป็นแถบลอยด้านบน + ปุ่มคัดลอกไปแปะให้ AI DM / เพื่อนในแชต
import { h, toast, sheet } from './util.js';
import { flagSum } from './fx.js';

const ctx = { on: false, name: '', onAttack: null };
const hist = [];
let bar = null;

export const setDice = o => Object.assign(ctx, o);
export const diceOn = () => ctx.on;

/** สุ่ม 1..n แบบไม่เอียง */
export function die(n) {
  const lim = Math.floor(2 ** 32 / n) * n, a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= lim);
  return (a[0] % n) + 1;
}

const sg = n => (n < 0 ? '-' : '+') + Math.abs(n);

/** แยกสูตร "2d6+3 Slashing + 1d6 Fire" → [{s,n,d} | {s,k}] (ไม่อ่านในวงเล็บ) */
function parse(expr) {
  const s = String(expr || '').split('(')[0].replace(/−/g, '-');
  const out = [], re = /([+-])?\s*(\d+)d(\d+)|([+-])\s*(\d+)(?![\dd])/g;
  let m;
  while ((m = re.exec(s))) out.push(m[3] ? { s: m[1] === '-' ? -1 : 1, n: +m[2], d: +m[3] } : { s: m[4] === '-' ? -1 : 1, k: +m[5] });
  return out;
}
export const hasDice = expr => parse(expr).some(t => t.d);

/** ทอยตามสูตร (crit = ลูกเต๋าคูณสอง ตัวบวกไม่คูณ) → {total, text} */
function rollTerms(terms, crit) {
  let total = 0, text = '';
  for (const t of terms) {
    if (t.d) {
      const n = t.n * (crit ? 2 : 1), r = Array.from({ length: n }, () => die(t.d)), sum = r.reduce((a, b) => a + b, 0);
      total += t.s * sum; text += `${text ? (t.s < 0 ? ' - ' : ' + ') : t.s < 0 ? '-' : ''}${n}d${t.d}[${r.join(',')}]`;
    } else { total += t.s * t.k; text += ` ${t.s < 0 ? '-' : '+'} ${t.k}`; }
  }
  return { total, text: text.trim() };
}

/** ทอย d20 (Attack / Check / Save / Initiative) — force: 'adv' | 'dis' | 'normal' */
export function rollD20(label, bonus, flags = [], force = null, opt = {}) {
  let k = force || flagSum(flags);
  if (k === 'both' || k === 'fail') k = 'normal';
  const a = die(20), b = k === 'adv' || k === 'dis' ? die(20) : null;
  const nat = b == null ? a : k === 'adv' ? Math.max(a, b) : Math.min(a, b);
  let total = nat + bonus, text = b == null ? `d20[${a}]` : `2d20${k === 'adv' ? ' Advantage' : ' Disadvantage'}[${a},${b}]→${nat}`;
  if (bonus) text += ` ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`;
  for (const f of flags || []) if (f.t === 'plus' || f.t === 'minus') {
    const r = rollTerms(parse(f.add));
    total += (f.t === 'plus' ? 1 : -1) * r.total; text += ` ${f.t === 'plus' ? '+' : '-'} ${r.text} (${f.why})`;
  }
  return { label, total, text, nat, adv: k, ...opt };
}

/** ทอยดาเมจ / ฮีลตามสูตร */
export function rollExpr(label, expr, crit = false, opt = {}) {
  const r = rollTerms(parse(expr), crit);
  const type = String(expr).split('(')[0].replace(/[\d+\-−d\s]+/g, ' ').trim();
  return { label: label + (crit ? ' (Critical)' : ''), total: Math.max(0, r.total), text: r.text, type, crit, ...opt };
}

/** ข้อความสำหรับคัดลอก */
export const lineOf = r => `${r.who} – ${r.label}: ${r.text} = ${r.total}${r.type ? ' ' + r.type : ''}${r.nat === 20 ? ' (NAT 20!)' : r.nat === 1 ? ' (NAT 1)' : ''}${r.note ? ' → ' + r.note : ''}`;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว แปะในแชตได้เลย'); }
  catch { sheet('คัดลอกข้อความนี้', h('textarea.inp', { rows: 6, readonly: true, onfocus: e => e.target.select() }, text)); }
}

/** โชว์ผลบนแถบลอย + เก็บประวัติ */
export function show(r) {
  r.who = r.who || ctx.name || 'Character';
  hist.unshift(r); hist.length = Math.min(hist.length, 10);
  bar?.remove();
  const atkBtns = r.dmg && hasDice(r.dmg) ? [
    h('button.btn.sm' + (r.nat === 20 ? '' : '.primary'), { onclick: () => show(rollExpr(`${r.name} Damage`, r.dmg, false)) }, '🎲 ทอยดาเมจ'),
    h('button.btn.sm' + (r.nat === 20 ? '.primary' : ''), { onclick: () => show(rollExpr(`${r.name} Damage`, r.dmg, true)) }, '💥 Critical'),
  ] : [];
  bar = h('div.roll-bar' + (r.nat === 20 ? '.n20' : r.nat === 1 ? '.n1' : ''), { role: 'status' },
    h('div.rb-top', h('span.rb-label', r.label), h('button.icon-btn', { 'aria-label': 'ปิด', onclick: () => { bar?.remove(); bar = null; } }, '✕')),
    h('div.rb-main', h('b.rb-total', String(r.total)), h('span.rb-text', r.text, r.type ? ` ${r.type}` : '')),
    r.nat === 20 ? h('p.rb-note', r.dmg ? '🎉 NAT 20 — Critical Hit! ทอยดาเมจแบบ Critical ได้เลย' : '🎉 NAT 20!') : r.nat === 1 ? h('p.rb-note', r.dmg ? '💀 NAT 1 — พลาดแน่นอน' : '💀 NAT 1') : null,
    r.note ? h('p.rb-note', r.note) : null,
    h('div.rb-btns', ...atkBtns,
      h('button.btn.sm', { onclick: () => copy(lineOf(r)) }, '📋 คัดลอก'),
      h('button.btn.sm.ghost', { onclick: openHistory }, `🕘 ประวัติ (${hist.length})`)));
  document.body.append(bar);
  return r;
}

function openHistory() {
  const all = hist.map(lineOf).join('\n');
  sheet('ประวัติการทอย (10 ครั้งล่าสุด)', h('div.card.list', hist.map(r => h('div.rb-hist',
    h('div', h('b', r.label), h('small', r.text)), h('b.rb-hn', String(r.total)),
    h('button.icon-btn', { 'aria-label': 'คัดลอก', onclick: () => copy(lineOf(r)) }, '📋')))),
  [{ label: '📋 คัดลอกทั้งหมด', primary: true, onClick: () => { copy(all); return false; } }]);
}

/** ปุ่มทอยใต้สูตร d20 — opt.atk = นับเป็นการโจมตี (ติ๊ก Action ในตัวติดตามเทิร์น), opt.dmg = สูตรดาเมจ */
export function rollRow(label, bonus, flags, opt = {}) {
  if (!ctx.on || flagSum(flags) === 'fail') return null;
  const go = force => {
    const r = rollD20(label, bonus, flags, force, opt);
    if (opt.atk && ctx.onAttack) { const m = ctx.onAttack(); if (m) r.note = m; }
    show(r);
  };
  const k = flagSum(flags);
  return h('div.roll-row',
    h('button.btn.sm.primary', { onclick: () => go(null) }, k === 'adv' ? '🎲 ทอย (Advantage)' : k === 'dis' ? '🎲 ทอย (Disadvantage)' : '🎲 ทอย'),
    k !== 'adv' ? h('button.btn.sm', { onclick: () => go('adv') }, '▲ Adv') : null,
    k !== 'dis' ? h('button.btn.sm', { onclick: () => go('dis') }, '▼ Dis') : null);
}

/** ปุ่มทอยใต้สูตรดาเมจ/ฮีล */
export function exprRow(label, expr, crit = true) {
  if (!ctx.on || !hasDice(expr)) return null;
  return h('div.roll-row',
    h('button.btn.sm.primary', { onclick: () => show(rollExpr(label, expr, false)) }, '🎲 ทอย'),
    crit ? h('button.btn.sm', { onclick: () => show(rollExpr(label, expr, true)) }, '💥 Critical') : null);
}

window.addEventListener('hashchange', () => { bar?.remove(); bar = null; });
