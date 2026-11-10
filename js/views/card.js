// การ์ดสรุปตัวละครหน้าเดียว (เฟส 5) — #/card/<id> (ตัวละครในเครื่อง) · #/view/<code> (ลิงก์ที่เพื่อนส่งมา อ่านอย่างเดียว)
// แชร์ได้ 2 แบบ: ลิงก์ (ใช้รหัสเดียวกับลิงก์แชร์) และรูป PNG ที่วาดเองด้วย Canvas (ใช้ออฟไลน์ได้)
import { D, thFeature } from '../data.js';
import { h, toast, sign } from '../util.js';
import * as S from '../store.js';
import { ABIL, ABIL_SHORT, compute } from '../rules.js';
import { dmgRange } from './explain.js';

const SKIP = /^(spellcasting|pact-magic|ability-score-improvement|epic-boon|weapon-mastery|.*-subclass)$/;

/** ข้อมูลที่ใช้ทั้งหน้าเว็บและรูป */
export function cardData(c) {
  const x = compute(c);
  const feats = [];
  const addF = (cls, list) => { for (const f of list) if (!SKIP.test(f.id) && !feats.some(z => z.name === f.name)) feats.push({ name: f.name, s: f.pack ? f.th?.s : thFeature(cls.id, f.id, f.src === 'sub')?.s }); };
  if (x.cls) addF(x.cls, x.feats);
  for (const mc of x.mcFeats) addF(mc.cls, mc.feats);
  for (const id of new Set(x.featIds)) { const f = D.feat[id]; if (f && !feats.some(z => z.name === f.name)) feats.push({ name: f.name, s: D.th.feats?.[id]?.s }); }
  const spells = [...new Set(x.casting.flatMap(b => [...(b.cantrips || []), ...(b.always || []), ...(b.prepared || [])]))].map(id => D.spell[id]).filter(Boolean).sort((a, b) => a.level - b.level);
  return {
    x, name: c.name || 'Character ไร้ชื่อ',
    line: [x.sp?.name, x.classLine, x.CL >= 3 && x.sub ? x.sub.name : null].filter(Boolean).join(' · '),
    bg: x.bg?.name, level: c.level || 1, align: c.details?.alignment || '',
    stats: [['HP', String(x.hpMax)], ['AC', String(x.ac)], ['SPEED', `${x.speed} ft`], ['INIT', sign(x.init)], ['PROF', sign(x.pb)]],
    attacks: x.attacks.filter(a => a.id !== 'unarmed' || x.attacks.length === 1).slice(0, 5),
    feats, spells, story: String(c.details?.backstory || '').trim(), portrait: c.portrait || null,
  };
}

/** ข้อความสรุปตัวละครสำหรับแปะให้ AI DM / เพื่อนในแชต (โหมดออนไลน์) */
export function charText(c) {
  const d = cardData(c), x = d.x, P = c.play || {};
  const hp = P.hp ?? x.hpMax, L = [];
  L.push(`[ตัวละครผู้เล่น — D&D 2024] ${d.name}`);
  L.push(`${d.line} · เลเวล ${d.level}${d.bg ? ` · ภูมิหลัง ${d.bg}` : ''}${d.align ? ` · ${d.align}` : ''}`);
  L.push(`HP ${hp}/${x.hpMax}${P.temp ? ` (+${P.temp} Temp)` : ''} · AC ${x.ac} · Speed ${x.speed} ft · Initiative ${sign(x.init)} · Proficiency ${sign(x.pb)}`);
  L.push('ค่าพลัง: ' + ABIL.map(a => `${ABIL_SHORT[a]} ${x.score[a]} (${sign(x.m[a])})`).join(' · '));
  L.push('Saving Throws: ' + x.saves.map(v => `${ABIL_SHORT[v.ab]} ${sign(v.bonus)}${v.prof ? '*' : ''}`).join(' · ') + ' (* = ชำนาญ)');
  const sk = x.skills.filter(s => s.prof || s.exp);
  if (sk.length) L.push('Skills ที่ชำนาญ: ' + sk.map(s => `${s.name} ${sign(s.bonus)}${s.exp ? ' (Expertise)' : ''}`).join(', '));
  L.push(`Passive Perception ${10 + (x.skills.find(s => s.name === 'Perception')?.bonus || 0)}`);
  if (d.attacks.length) L.push('การโจมตี: ' + d.attacks.map(a => `${a.name} ${sign(a.hit)} to hit, ${a.dmg}`).join(' · ') + (x.atkPer > 1 ? ` · Extra Attack (ตี ${x.atkPer} ครั้งต่อ Attack action)` : ''));
  for (const b of x.casting) L.push(`เวท${b.source ? ` (${b.source})` : ''}: Spell save DC ${b.dc} · Spell attack ${sign(b.atk)}`);
  if (d.spells.length) {
    const by = {};
    for (const s of d.spells) (by[s.level] = by[s.level] || []).push(s.name);
    L.push('เวทที่ใช้ได้: ' + Object.keys(by).map(l => `${+l === 0 ? 'Cantrip' : `Level ${l}`}: ${by[l].join(', ')}`).join(' | '));
    const sl = x.casting.flatMap(b => Object.entries(b.slots || {}).map(([l, n]) => [(b.pact ? 'p' : '') + l, l, n, b.pact]));
    const seen = new Set(), uniq = sl.filter(([k]) => !seen.has(k) && seen.add(k));
    if (uniq.length) L.push('Spell slots (เหลือ/ทั้งหมด): ' + uniq.map(([k, l, n, pact]) => `${pact ? 'Pact ' : ''}Lv${l} ${n - (P.slots?.[k] || 0)}/${n}`).join(' · '));
  }
  const res = (x.res || []).filter(r => r.max);
  if (res.length) L.push('ทรัพยากร: ' + res.map(r => `${r.name} ${r.max - (P.res?.[r.id] || 0)}/${r.max}${r.reset === 'short' ? ' (พักสั้นคืน)' : r.reset === 'long' ? ' (พักยาวคืน)' : ''}`).join(' · '));
  if (d.feats.length) L.push('ฟีเจอร์: ' + d.feats.map(f => f.name).join(', '));
  const cond = [...(P.conditions || []), P.exh ? `Exhaustion ${P.exh}` : null].filter(Boolean);
  if (cond.length) L.push('สถานะที่ติดอยู่: ' + cond.join(', '));
  if (d.story) L.push(`ประวัติย่อ: ${d.story.slice(0, 400)}${d.story.length > 400 ? '…' : ''}`);
  L.push('(ผู้เล่นทอยเต๋าเองในเว็บ แล้วจะแปะผลทอยมาให้)');
  return L.join('\n');
}

export async function renderCard(root, mode, key, nav) {
  let c, shared = mode === 'view';
  try { c = shared ? await S.decodeChar(key) : S.get(key); } catch { c = null; }
  if (!c) { root.replaceChildren(h('section.hero', h('h1', 'เปิดการ์ดไม่ได้'), h('p', shared ? 'ลิงก์อาจไม่ครบ ลองคัดลอกลิงก์ใหม่ทั้งหมดอีกครั้ง' : 'ไม่พบตัวละครนี้ในเครื่อง'), h('a.btn', { href: '#/' }, 'กลับหน้าแรก'))); return; }
  if (c.theme) { document.documentElement.style.setProperty('--gold', c.theme); document.documentElement.style.setProperty('--gold2', `color-mix(in srgb, ${c.theme} 60%, white)`); }
  const d = cardData(c), x = d.x;
  const sec = (en, th, ...kids) => h('section.cd-sec', h('h3.sec2', h('span', en), h('small', th)), ...kids);
  root.replaceChildren(h('div.card-page',
    shared ? h('p.tip', '👀 การ์ดตัวละครที่เพื่อนส่งมา — ดูอย่างเดียว · อยากเก็บไว้ในเครื่องกด "นำเข้าตัวละครนี้" ด้านล่าง') : null,
    h('header.cd-head',
      d.portrait ? h('img.cd-pic', { src: d.portrait, alt: '' }) : null,
      h('div', h('h1', d.name), h('p', d.line), h('p.muted.small', [d.bg ? `ภูมิหลัง ${d.bg}` : null, `เลเวล ${d.level}`, d.align || null].filter(Boolean).join(' · ')))),
    h('div.cd-abil', ABIL.map(a => h('div', h('small', ABIL_SHORT[a]), h('b', sign(x.m[a])), h('span', String(x.score[a]))))),
    h('div.cd-stats', d.stats.map(([k, v]) => h('div', h('small', k), h('b', v)))),
    d.attacks.length ? sec('ATTACKS', 'การโจมตี', h('div.card.list', d.attacks.map(a => h('div.cd-row', h('b', a.name), h('span', sign(a.hit)), h('span', a.dmg, dmgRange(a.dmg) ? h('small.rng', ` (${dmgRange(a.dmg)})`) : null))))) : null,
    d.feats.length ? sec('FEATURES', 'ความสามารถเด่น', h('ul.cd-feats', d.feats.map(f => h('li', h('b', f.name), f.s ? h('small', ' — ' + f.s) : null)))) : null,
    d.spells.length ? sec('SPELLS', 'เวทที่เตรียมไว้', h('p.cd-spells', d.spells.map(s => `${s.name}${s.level ? ` (${s.level})` : ''}`).join(' · '))) : null,
    d.story ? sec('BACKSTORY', 'เรื่องราว', h('p.cd-story', d.story)) : null,
    h('div.cd-actions',
      h('button.btn.primary', { onclick: () => shareImage(d) }, '📷 แชร์เป็นรูป'),
      h('button.btn', { onclick: () => shareLink(c) }, '🔗 ส่งลิงก์การ์ด'),
      shared ? h('a.btn', { href: `#/import/${key}` }, '📥 นำเข้าตัวละครนี้') : h('a.btn.ghost', { href: `#/c/${c.id}` }, '← กลับใบตัวละคร'))));
}

async function shareLink(c) {
  const url = `${location.href.split('#')[0]}#/view/${await S.encodeChar(c)}`;
  if (navigator.share) { try { await navigator.share({ title: c.name || 'ตัวละคร', url }); return; } catch { /* ยกเลิก */ } }
  try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์การ์ดแล้ว ส่งเข้า LINE ได้เลย'); }
  catch { prompt('คัดลอกลิงก์นี้', url); }
}

// ---------- วาดรูป ----------
const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
/** ตัดคำภาษาไทย/อังกฤษให้พอดีความกว้าง */
function lines(ctx, text, maxW) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map(s => s.segment) : [...text];
  const out = [];
  let cur = '';
  for (const w of seg) {
    if (w === '\n') { out.push(cur); cur = ''; continue; }
    if (ctx.measureText(cur + w).width > maxW && cur) { out.push(cur.trimEnd()); cur = w.trimStart(); }
    else cur += w;
  }
  if (cur) out.push(cur);
  return out;
}
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export async function drawCard(d) {
  try { await document.fonts?.ready; } catch { /* ไม่เป็นไร */ }
  const W = 1080, PAD = 56, x = d.x;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = 4000;
  const g = cv.getContext('2d');
  const F = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (sz, wt = 400) => { g.font = `${wt} ${sz}px ${F}`; };
  const bg = css('--bg') || '#121214', card = css('--card') || '#1f1f23', line = css('--line') || '#38383f', text = css('--text') || '#ececef', muted = css('--muted') || '#a9a9b3';
  const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#e0464a';
  const rr = (X, Y, w, hh, r, fill, stroke) => { g.beginPath(); g.roundRect(X, Y, w, hh, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); } };
  g.fillStyle = bg; g.fillRect(0, 0, W, cv.height);
  g.fillStyle = gold; g.fillRect(0, 0, W, 12);
  let y = 60;
  // หัว
  let tx = PAD;
  if (d.portrait) {
    const im = await loadImg(d.portrait);
    if (im) { g.save(); g.beginPath(); g.arc(PAD + 90, y + 90, 90, 0, Math.PI * 2); g.clip(); g.drawImage(im, PAD, y, 180, 180); g.restore(); g.strokeStyle = gold; g.lineWidth = 6; g.beginPath(); g.arc(PAD + 90, y + 90, 90, 0, Math.PI * 2); g.stroke(); tx = PAD + 210; }
  }
  g.textBaseline = 'top';
  font(64, 700); g.fillStyle = text;
  const nameL = lines(g, d.name, W - tx - PAD);
  for (const l of nameL.slice(0, 2)) { g.fillText(l, tx, y); y += 78; }
  font(32, 500); g.fillStyle = gold;
  for (const l of lines(g, d.line, W - tx - PAD).slice(0, 2)) { g.fillText(l, tx, y); y += 44; }
  font(28); g.fillStyle = muted;
  g.fillText([d.bg ? `ภูมิหลัง ${d.bg}` : null, `เลเวล ${d.level}`, d.align || null].filter(Boolean).join(' · '), tx, y); y += 44;
  y = Math.max(y, d.portrait ? 270 : y) + 24;
  // ค่าพลัง 6
  const bw = (W - PAD * 2 - 5 * 16) / 6;
  ABIL.forEach((a, i) => {
    const X = PAD + i * (bw + 16);
    rr(X, y, bw, 170, 18, card, line);
    g.textAlign = 'center'; g.fillStyle = muted; font(26, 600); g.fillText(ABIL_SHORT[a], X + bw / 2, y + 16);
    g.fillStyle = text; font(56, 700); g.fillText(sign(x.m[a]), X + bw / 2, y + 52);
    g.fillStyle = muted; font(28); g.fillText(String(x.score[a]), X + bw / 2, y + 120);
  });
  y += 194;
  // ค่าหลัก 5
  const sw = (W - PAD * 2 - 4 * 16) / 5;
  d.stats.forEach(([k, v], i) => {
    const X = PAD + i * (sw + 16);
    rr(X, y, sw, 120, 18, card, i === 0 ? gold : line);
    g.textAlign = 'center'; g.fillStyle = muted; font(24, 600); g.fillText(k, X + sw / 2, y + 14);
    g.fillStyle = text; font(44, 700); g.fillText(v, X + sw / 2, y + 52);
  });
  g.textAlign = 'left';
  y += 150;
  const head = (en, th) => { font(34, 700); g.fillStyle = gold; g.fillText(en, PAD, y); const w = g.measureText(en).width; font(26); g.fillStyle = muted; g.fillText(th, PAD + w + 16, y + 6); y += 52; g.fillStyle = line; g.fillRect(PAD, y - 8, W - PAD * 2, 2); y += 12; };
  // การโจมตี
  if (d.attacks.length) {
    head('ATTACKS', 'การโจมตี');
    for (const a of d.attacks) {
      font(32, 600); g.fillStyle = text; g.fillText(a.name, PAD, y);
      font(32, 700); g.fillStyle = gold; g.fillText(sign(a.hit), PAD + 470, y);
      font(30); g.fillStyle = text; const r = dmgRange(a.dmg); g.fillText(a.dmg + (r ? `  (${r})` : ''), PAD + 580, y);
      y += 48;
    }
    y += 20;
  }
  const para = (txt, sz, color, max) => { font(sz); g.fillStyle = color; for (const l of lines(g, txt, W - PAD * 2).slice(0, max)) { g.fillText(l, PAD, y); y += sz * 1.5; } };
  if (d.feats.length) { head('FEATURES', 'ความสามารถเด่น'); para(d.feats.map(f => f.name).join('  ·  '), 30, text, 8); y += 20; }
  if (d.spells.length) { head('SPELLS', 'เวทที่เตรียมไว้'); para(d.spells.map(s => s.name).join('  ·  '), 28, text, 8); y += 20; }
  if (d.story) { head('BACKSTORY', 'เรื่องราว'); const st = d.story.length > 420 ? d.story.slice(0, 420) + '…' : d.story; para(st, 28, muted, 10); y += 20; }
  font(22); g.fillStyle = muted; g.fillText('Character Builder · D&D 2024 (SRD 5.2.1)', PAD, y + 10);
  y += 60;
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.ceil(y);
  out.getContext('2d').drawImage(cv, 0, 0);
  return out;
}

async function shareImage(d) {
  toast('กำลังวาดรูป…');
  const cv = await drawCard(d);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `${(d.name || 'character').replace(/[\\/:*?"<>|]/g, '')}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: d.name }); return; } catch { /* ยกเลิก → ดาวน์โหลดแทน */ } }
  const a = h('a', { href: URL.createObjectURL(blob), download: file.name });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดรูปแล้ว');
}
