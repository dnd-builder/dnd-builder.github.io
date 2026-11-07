// ชิ้นส่วน UI ที่ใช้ร่วมกัน: การ์ดฟีเจอร์, แถวสเปล, รายละเอียดสเปล, ตัวเลือก
import { D, thFeature, loadFull } from '../data.js';
import { h, icon, iconSvg, sheet, sign } from '../util.js';
import { md } from '../md.js';
import { fillHref, ddbHref, srcTag, openSpellFull } from '../packs.js';

export const TYPE_LABEL = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', passive: 'ติดตัว', magic: 'Magic Action' };
export const SCHOOL_TH = { Abjuration: 'ป้องกัน', Conjuration: 'เรียก/เสก', Divination: 'พยากรณ์', Enchantment: 'สะกดจิต', Evocation: 'พลังงาน', Illusion: 'ภาพลวง', Necromancy: 'ความตาย', Transmutation: 'แปรสภาพ' };
export const LEVEL_TH = l => (l === 0 ? 'Cantrip' : `Level ${l}`);

/** กล่อง "ต้นฉบับ (EN)" พับได้ */
export function original(text, label = 'ต้นฉบับ (EN) — SRD 5.2.1') {
  if (!text) return null;
  return h('details.orig', h('summary', label), h('div.md', { html: md(text) }));
}

/** กล่อง "แปลเต็ม (ไทย)" พับได้ — โหลดไฟล์กลุ่ม g ตอนเปิดครั้งแรก, id เป็น string หรือ path เช่น ['wizard','f','scholar'] */
export function fullTh(g, id) {
  if (!g || !id) return null;
  const body = h('div.md', h('p.muted.small', 'กำลังโหลด…'));
  let done = false;
  return h('details.full', {
    ontoggle: e => {
      if (done || !e.currentTarget.open) return;
      done = true;
      loadFull(g).then(d => {
        const v = [].concat(id).reduce((o, k) => o?.[k], d);
        body.innerHTML = typeof v === 'string' ? md(v) : '<p class="muted small">ยังไม่มีคำแปลเต็ม — ดูต้นฉบับด้านล่าง</p>';
      });
    },
  }, h('summary', 'แปลเต็ม (ไทย)'), body);
}

/** การ์ดฟีเจอร์ — th = {t, s, tip, full?}, full = [กลุ่ม, id] สำหรับคำแปลเต็ม, pack = ชื่อ Content Pack (ถ้ามาจากแพ็ก) */
export function featureCard({ name, level, text, th, tag, full, pack, open }) {
  const t = th?.t || 'passive';
  if (pack) return h('article.feat.from-pack.t-' + t,
    h('header',
      h('span.feat-ico', { html: iconSvg(t === 'magic' ? 'action' : t) }),
      h('div.feat-title', h('b', name), h('small', [level ? `Lv ${level}` : null, tag, TYPE_LABEL[t]].filter(Boolean).join(' · ')))),
    h('span.pack-badge', srcTag({ pack, open })),
    th?.s ? h('p.th', th.s) : null,
    th?.full ? h('div.md', { html: md(th.full) }) : null,
    !th?.s && !th?.full && !text ? h('p.th.muted', 'แพ็กนี้ยังไม่ได้ใส่คำอธิบาย') : null,
    th?.tip ? h('p.tip', '💡 ' + th.tip) : null,
    full && th?.s ? fullTh(...full) : null,
    th?.s || th?.full ? original(text, open ? `ต้นฉบับ (EN) — ${pack} (OGL)` : 'ข้อความ EN') : (text ? h('div.md', { html: md(text) }) : null));
  return h('article.feat.t-' + t,
    h('header',
      h('span.feat-ico', { html: iconSvg(t === 'magic' ? 'action' : t) }),
      h('div.feat-title', h('b', name), h('small', [level ? `Lv ${level}` : null, tag, TYPE_LABEL[t]].filter(Boolean).join(' · ')))),
    th?.s ? h('p.th', th.s) : h('p.th.muted', 'ยังไม่มีคำอธิบายภาษาไทย — ดูต้นฉบับด้านล่าง'),
    th?.tip ? h('p.tip', '💡 ' + th.tip) : null,
    full ? fullTh(...full) : null,
    original(text));
}

export function classFeatureCard(cls, f, sub) {
  if (f.pack) {
    const card = featureCard({ name: f.name, level: f.level, text: f.text, th: f.th, tag: f.subName, pack: f.pack, open: f.open, full: f.full });
    if (f.note) card.append(h('p.tip', '⚖️ ' + f.note));
    if (f.orig && f.orig !== f.level) card.append(h('p.muted.small', `ต้นฉบับ (กฎ 2014) ได้ที่เลเวล ${f.orig} — ย้ายมาช่องซับคลาสของกฎ 2024 ที่เลเวล ${f.level}`));
    if (f.opts?.length) card.append(h('ul.pack-opts', f.opts.map(o => h('li' + (o.name === f.picked ? '.on' : ''), h('b', (o.name === f.picked ? '✅ ' : '') + o.name), o.s ? ' — ' + o.s : ''))),
      f.picked ? null : h('p.tip', '🟡 ยังไม่ได้เลือก — ไปเลือกที่ขั้น Class ในหน้าแก้ไข'));
    return card;
  }
  return featureCard({ name: f.name, level: f.level, text: f.text, th: thFeature(cls.id, f.id, sub), tag: sub ? cls.subclass.name : null, full: ['classes', [cls.id, sub ? 'sub' : 'f', f.id]] });
}

export function spellMeta(s) {
  return [LEVEL_TH(s.level), s.school, s.time, s.range, s.concentration ? 'สมาธิ (C)' : null, s.ritual ? 'Ritual' : null].filter(Boolean).join(' · ');
}

export function spellDetail(s, actions = [], extra = null) {
  sheet(s.name, h('div.spell-detail',
    h('div.spell-head', h('span.school', { html: iconSvg(s.school) }), h('div', h('b', `${LEVEL_TH(s.level)} · ${s.school}`), h('small', `สำนัก${SCHOOL_TH[s.school] || ''}`))),
    s.pack ? h('span.pack-badge', srcTag(s)) : null,
    D.th.spells?.[s.id] ? h('p.th', D.th.spells[s.id]) : null,
    extra ? h('div.spell-math', extra) : null,
    s.open ? fullTh(openSpellFull(s.open), s.id) : s.pack ? (D.thFull?.spells?.[s.id] ? h('div.md', { html: md(D.thFull.spells[s.id]) }) : null) : fullTh('spells', s.id),
    h('dl.kv',
      h('dt', 'Casting Time'), h('dd', s.time),
      h('dt', 'Range'), h('dd', s.range),
      h('dt', 'Components'), h('dd', s.components),
      h('dt', 'Duration'), h('dd', s.duration)),
    h('p.muted.small', 'คลาสที่ใช้ได้: ' + s.classes.map(c => D.cls[c]?.name || c).join(', ')),
    s.pack ? (s.text ? original(s.text, 'ข้อความ EN') : null) : h('div.md', { html: md(s.text) })), actions);
}

export function spellRow(s, { selected, disabled, onToggle, badge, actions, extra } = {}) {
  const row = h('div.spell-row' + (selected ? '.on' : '') + (disabled ? '.off' : ''),
    h('span.school', { html: iconSvg(s.school) }),
    h('div.spell-main', { onclick: () => spellDetail(s, typeof actions === 'function' ? actions() : actions, typeof extra === 'function' ? extra() : extra) },
      h('b', s.name, s.concentration ? h('i.tag', 'C') : null, s.ritual ? h('i.tag', 'R') : null),
      h('small', D.th.spells?.[s.id] || spellMeta(s))),
    badge ? h('span.badge', badge) : null,
    onToggle ? h('button.check', { 'aria-pressed': selected ? 'true' : 'false', 'aria-label': (selected ? 'เอาออก ' : 'เลือก ') + s.name, disabled: disabled && !selected, onclick: onToggle }, selected ? '✓' : '+') : null);
  return row;
}

/** การ์ดตัวเลือกแบบกริด */
export function choiceCard({ id, iconName, title, sub, desc, selected, onClick }) {
  return h('button.choice' + (selected ? '.on' : ''), { type: 'button', 'aria-pressed': selected ? 'true' : 'false', 'data-id': id, onclick: onClick },
    iconName ? h('span.choice-ico', { html: iconSvg(iconName) }) : null,
    h('span.choice-txt', h('b', title), sub ? h('small', sub) : null, desc ? h('span.choice-desc', desc) : null));
}

/** เลือกหลายอย่างแบบชิป */
export function chips(options, value, max, onChange, { labels = {}, locked = [] } = {}) {
  const set = new Set(value);
  return h('div.chips', options.map(o => {
    const on = set.has(o) || locked.includes(o);
    return h('button.chip' + (on ? '.on' : '') + (locked.includes(o) ? '.locked' : ''), {
      type: 'button', 'aria-pressed': on ? 'true' : 'false', disabled: locked.includes(o),
      onclick: () => {
        if (set.has(o)) set.delete(o);
        else if (max === 1) { set.clear(); set.add(o); }
        else if (set.size < max) set.add(o);
        else return;
        onChange([...set]);
      },
    }, labels[o] || (D.th.misc?.skills?.[o] ? [h('span', o), h('small.chip-th', D.th.misc.skills[o])] : o));
  }));
}

export function counter(n, max, label) {
  return h('span.counter' + (n === max ? '.done' : n > max ? '.over' : ''), `${label ? label + ' ' : ''}${n}/${max}`);
}

export function statBox(label, value, sub, ico) {
  return h('div.stat', ico ? h('span.stat-ico', { html: iconSvg(ico) }) : null, h('small', label), h('b', value), sub ? h('span', sub) : null);
}

export { sign, icon };

/** กล่องบอกว่าซับคลาสนี้ยังไม่มีข้อมูล + ปุ่มไปเติมในแพ็ก */
export function stubSubBox(sub, classId) {
  return h('div.warn-box.stub-sub',
    h('p', h('b', `🟡 ${sub.name} ยังไม่มีข้อมูลฟีเจอร์`)),
    h('p.small', 'เติมเองใน Content Pack หรือขอไฟล์แพ็กจากเพื่อนมานำเข้า — พอมีข้อมูลชื่อตรงกันแล้ว ตัวละครจะได้ฟีเจอร์เองโดยไม่ต้องเลือกใหม่'
      + (/^(fighter|rogue)$/.test(classId) ? ' (ถ้าเป็นสายร่ายเวท อย่าลืมกรอกช่อง "การร่ายเวท" ในฟอร์ม)' : '')),
    h('div.row-btns', h('a.btn.small', { href: fillHref(classId, sub.name) }, '+ สร้างในแพ็ก'),
      h('a.btn.small.ghost', { href: ddbHref(sub.name), target: '_blank', rel: 'noopener' }, 'อ่านที่ D&D Beyond ↗')));
}

/** แถบพับ (accordion) — need = ยังเลือกไม่ครบ (ติด ⚠ + เปิดค้าง), openSet = Set จำว่าแถบไหนเปิดอยู่ */
export function acc({ key, title, sub, need, done, openSet }, ...kids) {
  const open = need || openSet?.has(key);
  return h('details.acc' + (need ? '.need' : ''), {
    open, ontoggle: e => { if (!openSet) return; if (e.currentTarget.open) openSet.add(key); else openSet.delete(key); },
  }, h('summary', h('div.acc-t', h('b', title), sub ? h('small', sub) : null), need ? h('span.acc-badge.warn-b', '⚠ ต้องเลือก') : done ? h('span.acc-badge', '✓') : null),
  h('div.acc-body', ...kids));
}

// ---------- Character Details (ใช้ทั้งวิซาร์ดและใบตัวละคร) ----------
export const ALIGN = [
  ['Lawful Good', 'ดีและมีระเบียบ — ทำสิ่งที่ถูกต้อง รักษาคำพูด และเคารพกฎที่ยุติธรรม'],
  ['Neutral Good', 'ดีแบบยืดหยุ่น — ช่วยคนเท่าที่ช่วยได้ จะทำตามกฎหรือไม่ก็ดูว่าแบบไหนช่วยคนได้มากกว่า'],
  ['Chaotic Good', 'ดีแบบรักอิสระ — ทำความดีตามหัวใจตัวเอง ถ้ากฎขวางการทำสิ่งที่ถูกก็พร้อมแหกกฎ'],
  ['Lawful Neutral', 'ยึดกฎและระเบียบเป็นหลัก — สนใจว่าทำตามหน้าที่ ประเพณี หรือคำสั่งไหม มากกว่าเรื่องดีหรือชั่ว'],
  ['Neutral', 'เป็นกลาง — ไม่เอียงไปทางไหนชัด ๆ ตัดสินใจตามสถานการณ์ตรงหน้า'],
  ['Chaotic Neutral', 'รักอิสระเหนือสิ่งอื่น — ทำตามใจตัวเอง ไม่ชอบให้ใครมาสั่ง แต่ก็ไม่ได้ตั้งใจทำร้ายใคร'],
  ['Lawful Evil', 'ชั่วแบบมีระบบ — ใช้กฎ อำนาจ และลำดับชั้นหาประโยชน์ให้ตัวเอง และรักษาคำพูดถ้ามันได้ประโยชน์'],
  ['Neutral Evil', 'เห็นแก่ตัวสุด ๆ — ทำทุกอย่างเพื่อตัวเอง ไม่สนว่าใครจะเดือดร้อน'],
  ['Chaotic Evil', 'ชั่วและบ้าระห่ำ — ใช้ความรุนแรงตามอารมณ์ ไม่สนกฎและไม่สนใคร'],
];
const LIFESTYLE = ['Wretched', 'Squalid', 'Poor', 'Modest', 'Comfortable', 'Wealthy', 'Aristocratic'];

/** ช่องกรอกหนึ่งช่องที่ผูกกับ c.details[k] */
export function detailField(Dt, save, k, label, opt = {}) {
  return h('label.fld', h('small', label), opt.rows
    ? h('textarea.inp', { rows: opt.rows, placeholder: opt.ph || '', oninput: e => { Dt[k] = e.target.value; save(); } }, Dt[k] || '')
    : h('input.inp', { value: Dt[k] || '', placeholder: opt.ph || '', list: opt.list, oninput: e => { Dt[k] = e.target.value; save(); } }));
}

/** กลุ่มช่องรายละเอียดตัวละคร → [[key, EN, ไทย, element], …] */
export function detailGroups(Dt, save) {
  const f = (k, label, opt) => detailField(Dt, save, k, label, opt);
  const al = h('p.muted.small', ALIGN.find(a => a[0] === Dt.alignment)?.[1] || '');
  return [
    ['details', 'CHARACTER DETAILS', 'รายละเอียดตัวละคร', h('div.card.details',
      h('label.fld', h('small', 'Alignment (แนวทางนิสัย)'), h('select.inp', { onchange: e => { Dt.alignment = e.target.value; al.textContent = ALIGN.find(a => a[0] === Dt.alignment)?.[1] || ''; save(); } },
        h('option', { value: '' }, '— ยังไม่เลือก —'), ALIGN.map(([n]) => h('option', { value: n, selected: Dt.alignment === n }, n)))),
      al,
      f('faith', 'ความเชื่อ / เทพที่นับถือ'),
      f('lifestyle', 'ไลฟ์สไตล์ (ใช้ชีวิตหรูแค่ไหน)', { list: 'dl-life' }),
      h('datalist#dl-life', LIFESTYLE.map(v => h('option', { value: v }))))],
    ['appearance', 'APPEARANCE', 'รูปลักษณ์', h('div.card.details.grid2',
      f('gender', 'เพศ / สรรพนาม'), f('age', 'อายุ'), f('height', 'ส่วนสูง'), f('weight', 'น้ำหนัก'),
      f('eyes', 'สีตา'), f('hair', 'ผม'), f('skin', 'ผิว'),
      h('div.span2', f('appearance', 'รูปร่างหน้าตาโดยรวม', { rows: 3, ph: 'เช่น ตัวสูงใหญ่ มีแผลเป็นที่แก้มซ้าย ชอบใส่ผ้าคลุมสีแดง' })))],
    ['personality', 'PERSONALITY', 'นิสัยใจคอ', h('div.card.details',
      f('traits', 'Personality Traits — นิสัยที่คนอื่นเห็นชัด ๆ', { rows: 2 }),
      f('ideals', 'Ideals — สิ่งที่เชื่อและยึดถือ', { rows: 2 }),
      f('bonds', 'Bonds — คน สถานที่ หรือสิ่งที่ผูกพัน', { rows: 2 }),
      f('flaws', 'Flaws — จุดอ่อนหรือนิสัยเสีย', { rows: 2 }))],
    ['backstory', 'BACKSTORY', 'ประวัติความเป็นมา', h('div.card.details', f('backstory', '', { rows: 6, ph: 'เกิดที่ไหน ทำไมถึงออกผจญภัย…' }))],
    ['people', 'ORGANIZATIONS & ALLIES', 'องค์กร พันธมิตร ศัตรู', h('div.card.details',
      f('orgs', 'องค์กร / กลุ่มที่สังกัด', { rows: 2 }), f('allies', 'พันธมิตร', { rows: 2 }), f('enemies', 'ศัตรู', { rows: 2 }), f('other', 'อื่น ๆ', { rows: 2 }))],
  ];
}
