// หน้า "เล่นยังไง" — ถาม-ตอบตอนเล่น + ความหมายค่าพลัง สกิล และค่าบนใบตัวละคร (ข้อมูล data/th/help.json)
import { D } from '../data.js';
import { h } from '../util.js';
import { md } from '../md.js';
import * as S from '../store.js';
import { ABIL, ABIL_EN, ABIL_SHORT, SKILLS } from '../rules.js';
import { acc } from './parts.js';

const GO = { actions: 'actions', spells: 'spells', top: 'main', hp: '', rest: '' };

export function renderHelp(root, cid, anchor) {
  const H = D.th.help || {};
  const c = cid && cid !== '-' ? S.get(cid) : null;
  const openSet = new Set(anchor ? [anchor] : []);
  const out = [
    h('div.wz-intro', h('h2', 'เล่นยังไง'), h('p', 'รวมคำถามที่เจอบ่อยตอนเล่นจริง กับความหมายของตัวเลขทุกช่องในใบตัวละคร แตะหัวข้อเพื่ออ่าน — คำที่มีเส้นประใต้แตะดูความหมายต่อได้')),
    c ? h('a.btn.ghost.small', { href: `#/c/${c.id}` }, `← กลับไปที่ใบของ ${c.name || 'ตัวละคร'}`) : null,
  ];
  // ทิปของคลาสที่ตัวละครนี้มี
  if (c?.classId) {
    const ids = [...new Set((c.levels || []).map(l => l.c).filter(Boolean))];
    out.push(h('h2.sec', `ทิปสำหรับ ${c.name || 'ตัวละครนี้'}`));
    for (const id of ids) {
      const t = D.th.classes?.[id];
      if (!t) continue;
      out.push(acc({ key: 'cls-' + id, title: `${D.cls[id]?.name} — ${t.tag || ''}`, sub: 'ทิปสำหรับมือใหม่', openSet },
        t.desc ? h('p', t.desc) : null, t.abilityTip ? h('p.tip', '📊 ' + t.abilityTip) : null, t.tips?.length ? h('ul.help-tips', t.tips.map(z => h('li', z))) : null));
    }
  }
  out.push(h('h2.sec', 'ถาม-ตอบตอนเล่น'));
  for (const f of H.faq || []) {
    const go = c && f.go != null ? `#/c/${c.id}${GO[f.go] ? '/' + GO[f.go] : ''}` : null;
    out.push(acc({ key: f.id, title: f.q, openSet }, h('div.md.help-a', { html: md(f.a) }), go ? h('a.btn.small', { href: go }, 'ดูในใบตัวละคร →') : null));
  }
  out.push(h('h2.sec', 'ค่าพลัง 6 ตัว'));
  for (const a of ABIL) {
    const t = H.abilities?.[a];
    if (!t) continue;
    out.push(acc({ key: 'ab-' + a, title: `${ABIL_EN[a]} (${ABIL_SHORT[a]})`, sub: t.what, openSet },
      h('p', h('b', 'Check ใช้ตอน: '), t.check), h('p', h('b', 'เซฟใช้ตอน: '), t.save),
      h('p', h('b', 'สกิลที่ใช้ค่านี้: '), SKILLS.filter(s => s[1] === a).map(s => s[0]).join(', ') || 'ไม่มี'),
      t.extra ? h('p.tip', '💡 ' + t.extra) : null, t.classes ? h('p.muted.small', '🎭 ' + t.classes) : null));
  }
  out.push(h('h2.sec', 'สกิล 18 อย่าง'));
  for (const [name, ab] of SKILLS) {
    const t = H.skills?.[name];
    if (!t) continue;
    out.push(acc({ key: 'sk-' + name, title: `${name} (${ABIL_SHORT[ab]})`, sub: t.what, openSet },
      h('p', h('b', 'ใช้ตอน: '), t.when), h('p', h('b', 'ตัวอย่าง: '), t.ex)));
  }
  out.push(h('h2.sec', 'ตัวเลขบนใบตัวละคร'));
  for (const [k, t] of Object.entries(H.terms || {})) out.push(acc({ key: 't-' + k, title: t.t, sub: t.what, openSet }, h('p.th', t.what), h('p', t.use)));
  out.push(h('p.muted.small', 'อยากรู้ความหมายคำศัพท์กฎเพิ่ม ดูได้ที่หน้า ', h('a', { href: '#/glossary' }, 'ศัพท์')));
  root.replaceChildren(h('section.prose.help', out));
  if (anchor) requestAnimationFrame(() => root.querySelector('.acc[open]:not([data-cls])')?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
}
