// หน้า Content Pack: รายการแพ็ก → แก้แพ็ก → ฟอร์มเพิ่ม/แก้ Subclass / Background / Feat / Spell
import { D } from '../data.js';
import { h, iconSvg, toast, sheet, confirmSheet } from '../util.js';
import { md } from '../md.js';
import { ABIL, ABIL_SHORT, SKILLS } from '../rules.js';
import { SCHOOL_TH, TYPE_LABEL as ACT_LABEL } from './parts.js';
import * as P from '../packs.js';

const ACT = ['passive', 'action', 'bonus', 'reaction', 'magic'];
const FEAT_CAT = ['Origin', 'General', 'Fighting Style', 'Epic Boon'];
const FEAT_CAT_TH = { Origin: 'Origin (ได้ตอนสร้างตัว)', General: 'General (เลเวล 4+)', 'Fighting Style': 'Fighting Style', 'Epic Boon': 'Epic Boon (เลเวล 19+)' };
const USES = [['', 'ไม่นับจำนวนครั้ง'], ['pb', 'เท่า Proficiency Bonus'], ['1', '1 ครั้ง'], ['2', '2 ครั้ง'], ['3', '3 ครั้ง'], ['4', '4 ครั้ง'], ['5', '5 ครั้ง'],
  ...ABIL.map(a => [a, `เท่า mod ${ABIL_SHORT[a]} (ขั้นต่ำ 1)`])];
const clone = o => JSON.parse(JSON.stringify(o));

export function renderPacks(root, parts, nav) {
  const [pid, type, iid] = parts;
  if (!pid) return listView(root, nav);
  if (pid === 'fill') return fillSub(root, decodeURIComponent(type || ''), decodeURIComponent(iid || ''), nav);
  const p = P.getPack(pid);
  if (!p) { root.replaceChildren(h('section.hero', h('h1', 'ไม่พบแพ็กนี้ในเครื่อง'), h('a.btn', { href: '#/packs' }, 'กลับไปหน้าแพ็ก'))); return; }
  if (type && P.TYPES.includes(type)) return itemForm(root, p, type, iid, nav);
  packView(root, p, nav);
}

// ---------- สร้างซับคลาสจากชื่อ (ปุ่ม "สร้างในแพ็ก") ----------
let PREFILL = null;
function fillSub(root, classId, name, nav) {
  if (!D.cls[classId] || !name) return location.replace('#/packs');
  const all = P.listPacks();
  for (const p of all) {
    const s = (p.items?.subclasses || []).find(x => x.classId === classId && P.normName(x.name) === P.normName(name));
    if (s) {
      if (!p.enabled) toast(`แพ็ก "${p.name}" ปิดอยู่ — เปิดใช้แล้วตัวละครจะได้ข้อมูลนี้`);
      return location.replace(`#/packs/${p.id}/subclasses/${s.id}`);
    }
  }
  const go = (p, replace = true) => { PREFILL = { classId, name }; const to = `#/packs/${p.id}/subclasses/new`; replace ? location.replace(to) : nav(to); };
  const fresh = () => { const p = P.newPack('ซับคลาสเพิ่มเติม'); P.savePack(p); return p; };
  if (!all.length) return go(fresh());
  if (all.length === 1) return go(all[0]);
  root.replaceChildren(h('section.packs',
    h('h1', `เพิ่ม ${name} ลงแพ็กไหน?`),
    h('div.pack-list', all.map(p => h('button.btn', { onclick: () => go(p, false) }, (p.name || 'แพ็กไม่มีชื่อ') + (p.enabled ? '' : ' (ปิดอยู่)')))),
    h('button.btn.primary', { onclick: () => go(fresh(), false) }, '+ สร้างแพ็กใหม่')));
}

/** สวิตช์คอนเทนต์เสริมจากหนังสือ OGL (ใช้ทั้งหน้าแพ็กและขั้น START) */
export function openToggles(after) {
  const docs = P.openDocs(), all = P.openOn();
  return h('div.open-toggles',
    h('p.muted.small', 'ซับคลาสจากหนังสือ 5e ของสำนักพิมพ์อื่นที่เปิดให้ใช้ฟรีตามสัญญา OGL 1.0a (ไม่ใช่ของ D&D ทางการ) แปลงให้เข้ากับกฎ 2024 แล้ว — ก่อนใช้ควรถาม DM ก่อน · ขึ้นป้าย 📖'),
    h('label.row.check-row', h('input', { type: 'checkbox', checked: all, onchange: e => { P.setOpen(null, e.target.checked); after?.(); } }), h('b', ' ใช้คอนเทนต์เสริม')),
    all ? h('div.pack-toggles', docs.map(d => h('label.row.check-row', h('input', { type: 'checkbox', checked: P.openOn(d.id), onchange: e => { P.setOpen(d.id, e.target.checked); after?.(); } }),
      ` 📖 ${d.title} `, h('small.muted', `ซับคลาส ${d.n}`)))) : null,
    h('p.muted.small', 'ตัวละครที่เลือกของจากเล่มที่ปิดไว้แล้วยังใช้ได้เหมือนเดิม แค่จะไม่ขึ้นให้เลือกใหม่ · รายชื่อผู้แต่งดูได้ที่ ', h('a', { href: '#/credits' }, 'เครดิต')));
}
function openBlock(rerender) {
  if (!P.openDocs().length) return null;
  const wrap = h('details.block.open-block', h('summary', h('b', '📖 คอนเทนต์เสริม (OGL) '), P.openOn() ? `เปิดใช้ ${P.openDocs().filter(d => P.openOn(d.id)).length} เล่ม` : 'ปิดอยู่'));
  const body = h('div');
  const draw = () => body.replaceChildren(openToggles(() => { draw(); wrap.querySelector('summary').lastChild.textContent = P.openOn() ? `เปิดใช้ ${P.openDocs().filter(d => P.openOn(d.id)).length} เล่ม` : 'ปิดอยู่'; }));
  draw(); wrap.append(body);
  return wrap;
}

/** ซับคลาส PHB 2024 ที่ยังไม่มีข้อมูล */
function missingList() {
  const rows = D.classes.map(k => [k, P.missingSubs(k.id)]).filter(([, l]) => l.length);
  const total = D.classes.reduce((n, k) => n + (D.subList?.[k.id] || []).filter(x => P.normName(x) !== P.normName(k.subclass.name)).length, 0);
  const miss = rows.reduce((n, [, l]) => n + l.length, 0);
  if (!total) return null;
  return h('details.block.miss-subs',
    h('summary', h('b', 'ซับคลาส PHB 2024 '), miss ? `ยังต้องเติม ${miss} จาก ${total}` : `เติมครบ ${total} แล้ว 🎉`),
    h('p.muted.small', 'ซับคลาสพวกนี้ไม่อยู่ในข้อมูลฟรี (SRD) — กดชื่อเพื่อสร้างในแพ็ก แล้วกรอกข้อมูลจากหนังสือ · กด ↗ เพื่อเปิดอ่านที่ D&D Beyond'),
    rows.map(([k, l]) => h('div.miss-row', h('b', k.name), h('div.chips', l.map(s => h('span.chip-pair', h('a.chip', { href: P.fillHref(k.id, s.name) }, s.name),
      h('a.chip.ddb', { href: P.ddbHref(s.name), target: '_blank', rel: 'noopener', title: 'อ่านที่ D&D Beyond' }, '↗')))))));
}

// ---------- รายการแพ็ก ----------
function listView(root, nav) {
  const packs = P.listPacks();
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const p = await P.readPackFile(f);
      const done = asCopy => { const np = P.importPack(p, asCopy); toast(`นำเข้าแพ็ก "${np.name}" แล้ว (${P.countItems(np)} รายการ)`); listView(root, nav); };
      if (P.getPack(p.id)) sheet('มีแพ็กนี้อยู่แล้ว', h('p', `ในเครื่องมีแพ็ก "${P.getPack(p.id).name}" อยู่แล้ว จะทำยังไงดี?`), [
        { label: 'ยกเลิก' },
        { label: 'นำเข้าเป็นแพ็กใหม่', onClick: () => done(true) },
        { label: 'แทนที่ของเดิม', primary: true, onClick: () => done(false) },
      ]);
      else done(false);
    } catch (err) { toast(err.message || 'ไฟล์นี้อ่านไม่ได้'); }
  } });
  root.replaceChildren(h('section.packs',
    h('h1', 'Content Pack'),
    h('p', 'เพิ่ม Subclass, Background, Feat และ Spell ที่ไม่มีในข้อมูลฟรี (SRD) ได้เอง แล้วส่งไฟล์แพ็กให้เพื่อนในกลุ่มใช้ด้วยกัน'),
    h('p.muted.small', 'แพ็กเก็บไว้ในเครื่องนี้ ถ้าแชร์ตัวละครที่ใช้ของจากแพ็ก ลิงก์จะพาของชิ้นนั้นไปด้วยให้อัตโนมัติ'),
    h('div.row',
      h('button.btn.primary', { onclick: () => { const p = P.newPack(); P.savePack(p); nav(`#/packs/${p.id}`); } }, '+ สร้างแพ็กใหม่'),
      h('button.btn', { onclick: () => fileIn.click() }, 'นำเข้าไฟล์แพ็ก'), fileIn),
    packs.length ? h('div.pack-list', packs.map(p => h('div.pack-card' + (p.enabled ? '' : '.off'),
      h('a.pack-main', { href: `#/packs/${p.id}` },
        h('b', p.name || 'แพ็กไม่มีชื่อ'),
        h('small', [p.author ? `โดย ${p.author}` : null, P.TYPES.map(t => p.items?.[t]?.length ? `${P.TYPE_LABEL[t]} ${p.items[t].length}` : null).filter(Boolean).join(' · ') || 'ยังว่างอยู่'].filter(Boolean).join(' — '))),
      toggle(p.enabled, v => { p.enabled = v; P.savePack(p); listView(root, nav); }))))
      : h('div.empty', h('p', 'ยังไม่มีแพ็กในเครื่องนี้'), h('p.muted.small', 'กด "สร้างแพ็กใหม่" หรือขอไฟล์แพ็กจากเพื่อนมานำเข้า')),
    missingList(), openBlock()));
}

function toggle(on, onChange, label = 'เปิดใช้') {
  return h('label.switch', { title: label },
    h('input', { type: 'checkbox', checked: on, onchange: e => onChange(e.target.checked) }),
    h('span.sw'), h('small', on ? 'เปิด' : 'ปิด'));
}

// ---------- แก้แพ็ก ----------
function packView(root, p, nav) {
  const save = () => P.savePack(p);
  root.replaceChildren(h('section.packs',
    h('a.back', { href: '#/packs' }, '← แพ็กทั้งหมด'),
    h('h1', p.name || 'แพ็กไม่มีชื่อ'),
    h('div.form',
      field('ชื่อแพ็ก', h('input.inp', { value: p.name, maxlength: 60, oninput: e => { p.name = e.target.value; save(); root.querySelector('h1').textContent = p.name || 'แพ็กไม่มีชื่อ'; } })),
      field('คนทำ', h('input.inp', { value: p.author || '', maxlength: 40, placeholder: 'เช่น พี่จ๋า', oninput: e => { p.author = e.target.value; save(); } })),
      field('คำอธิบาย', h('textarea.inp', { rows: 2, placeholder: 'แพ็กนี้มีอะไรบ้าง ใช้กับแคมเปญไหน', oninput: e => { p.desc = e.target.value; save(); } }, p.desc || '')),
      h('div.fld', h('span.fld-l', 'ใช้แพ็กนี้ในเว็บ'), toggle(p.enabled, v => { p.enabled = v; save(); packView(root, p, nav); }))),
    P.TYPES.map(t => h('div.block.pack-sec',
      h('h3', h('span.sec-ico', { html: iconSvg(P.TYPE_ICON[t]) }), `${P.TYPE_LABEL[t]} (${p.items[t].length})`),
      p.items[t].length ? h('div.item-list', p.items[t].map(it => h('a.item-row', { href: `#/packs/${p.id}/${t}/${it.id}` },
        h('b', it.name), h('small', itemMeta(t, it)), h('span.go', '›')))) : null,
      h('a.btn.small', { href: `#/packs/${p.id}/${t}/new` }, `+ เพิ่ม ${P.TYPE_LABEL[t]}`))),
    h('div.row.pack-actions',
      h('button.btn', { onclick: () => { P.exportPack(p); toast('ดาวน์โหลดไฟล์แพ็กแล้ว ส่งให้เพื่อนได้เลย'); } }, '⬇ ส่งออกไฟล์แพ็ก'),
      h('button.btn.dmg', { onclick: async () => {
        if (await confirmSheet('ลบแพ็กนี้?', `"${p.name}" และของ ${P.countItems(p)} รายการในแพ็กจะหายจากเครื่องนี้ (ตัวละครที่ใช้ของในแพ็กจะกลับไปใช้ของ SRD) — ถ้ายังอยากเก็บไว้ ส่งออกไฟล์ก่อนนะ`, 'ลบแพ็ก')) {
          P.removePack(p.id); toast('ลบแพ็กแล้ว'); nav('#/packs');
        }
      } }, 'ลบแพ็ก'))));
}

function itemMeta(t, it) {
  if (t === 'subclasses') return `${D.cls[it.classId]?.name || '?'} · ฟีเจอร์ ${it.features?.length || 0}`;
  if (t === 'backgrounds') return (it.abilities || []).map(a => ABIL_SHORT[a]).join(' · ') + (it.feat ? ` · ${it.feat}` : '');
  if (t === 'feats') return it.category;
  if (t === 'spells') return `${it.level ? 'Level ' + it.level : 'Cantrip'} · ${it.school}`;
  return '';
}

// ---------- ชิ้นส่วนฟอร์ม ----------
const getp = (o, k) => k.split('.').reduce((x, y) => x?.[y], o);
function setp(o, k, v) {
  const ks = k.split('.'), last = ks.pop();
  const t = ks.reduce((x, y) => (x[y] ||= {}), o);
  if (v === '' || v == null) delete t[last]; else t[last] = v;
}
function field(label, input, hint) {
  return h('label.fld', h('span.fld-l', label), input, hint ? h('small.muted.fld-h', hint) : null);
}
const inp = (o, k, attrs = {}) => h('input.inp', { value: getp(o, k) ?? '', oninput: e => setp(o, k, attrs.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value), ...attrs });
function select(o, k, opts, onChange) {
  return h('select.inp', { onchange: e => { setp(o, k, e.target.value); onChange?.(e.target.value); } },
    opts.map(([v, l]) => h('option', { value: v, selected: String(getp(o, k) ?? '') === String(v) }, l)));
}
function check(o, k, label) {
  return h('label.chk', h('input', { type: 'checkbox', checked: !!getp(o, k), onchange: e => setp(o, k, e.target.checked || '') }), h('span', label));
}
/** ช่องข้อความยาว (markdown) + ปุ่มดูตัวอย่าง */
function mdArea(o, k, placeholder, rows = 5) {
  const prev = h('div.md.md-prev', { hidden: true });
  const ta = h('textarea.inp', { rows, placeholder, oninput: e => { setp(o, k, e.target.value); if (!prev.hidden) prev.innerHTML = md(e.target.value); } }, getp(o, k) || '');
  return h('div.mdbox', ta,
    h('div.md-tools',
      h('small.muted', '**ตัวหนา** · *เอียง* · - รายการ · | ตาราง |'),
      h('button.btn.small.ghost', { type: 'button', onclick: e => { prev.hidden = !prev.hidden; prev.innerHTML = md(ta.value); e.target.textContent = prev.hidden ? 'ดูตัวอย่าง' : 'ซ่อนตัวอย่าง'; } }, 'ดูตัวอย่าง')),
    prev);
}
function multiChips(opts, value, max, onChange) {
  const set = new Set(value || []);
  const wrap = h('div.chips');
  const draw = () => wrap.replaceChildren(...opts.map(([v, l]) => h('button.chip' + (set.has(v) ? '.on' : ''), {
    type: 'button', onclick: () => {
      if (set.has(v)) set.delete(v); else if (max === 1) { set.clear(); set.add(v); } else if (set.size < max) set.add(v); else return toast(`เลือกได้ ${max} อย่าง`);
      onChange([...set]); draw();
    },
  }, l)));
  draw();
  return wrap;
}
const thBlock = (it, { type = true, tip = true } = {}) => [
  type ? field('ใช้แบบไหน', select(it, 'th.t', ACT.map(a => [a, ACT_LABEL[a]]))) : null,
  field('สรุปภาษาไทย (สั้น ๆ)', inp(it, 'th.s', { placeholder: 'อ่านบรรทัดเดียวรู้เรื่องว่าทำอะไรได้' })),
  field('คำอธิบายไทยแบบเต็ม', mdArea(it, 'th.full', 'อธิบายละเอียด ตัวเลขให้ตรงหนังสือ คำเฉพาะคงเป็นอังกฤษได้ (Action, Saving Throw …)')),
  tip ? field('ทิป (ไม่บังคับ)', inp(it, 'th.tip', { placeholder: 'ใช้ตอนไหนดี ควรคู่กับอะไร' })) : null,
];
const enBlock = (it, k = 'text') => h('details.en-box', getp(it, k) ? { open: true } : {},
  h('summary', 'ข้อความ EN จากหนังสือ (ไม่บังคับ)'), mdArea(it, k, 'วางข้อความภาษาอังกฤษได้ จะพับไว้ใต้คำแปล', 4));

// ---------- ฟอร์มไอเทม ----------
const DEFAULTS = {
  subclasses: () => ({ classId: '', name: '', th: {}, features: [{ level: 3, name: '', th: { t: 'passive' } }], spells: [] }),
  backgrounds: () => ({ name: '', abilities: [], feat: '', skills: [], tool: '', equipA: '', gpB: 50, th: {} }),
  feats: () => ({ name: '', category: 'Origin', prereq: '', th: { t: 'passive' } }),
  spells: () => ({ name: '', level: 1, school: 'Evocation', classes: [], time: 'Action', range: '', components: 'V, S', duration: 'Instantaneous', th: {} }),
};

function itemForm(root, p, type, iid, nav) {
  const orig = iid !== 'new' ? p.items[type].find(x => x.id === iid) : null;
  if (iid !== 'new' && !orig) { nav(`#/packs/${p.id}`); return; }
  const it = orig ? clone(orig) : DEFAULTS[type]();
  if (!orig && type === 'subclasses' && PREFILL) { Object.assign(it, PREFILL); PREFILL = null; }
  const back = `#/packs/${p.id}`;
  const body = h('div.form', ({ subclasses: subForm, backgrounds: bgForm, feats: featForm, spells: spellForm })[type](it));

  function save() {
    const err = validate(type, it);
    if (err.length) { sheet('ยังกรอกไม่ครบ', h('ul', err.map(e => h('li', e)))); return; }
    it.name = it.name.trim();
    if (!it.id) it.id = P.itemId(it.name);
    if (type === 'subclasses') {
      it.features = it.features.filter(f => f.name?.trim()).map(f => {
        const opts = (f.opts || []).filter(o => o.name?.trim()).map(o => ({ name: o.name.trim(), s: (o.s || '').trim() }));
        const g = { ...f, name: f.name.trim(), id: f.id || P.itemId(f.name) };
        if (opts.length >= 2) g.opts = opts; else delete g.opts;
        return g;
      });
      it.spells = (it.spells || []).filter(r => r.list?.trim());
    }
    const i = p.items[type].findIndex(x => x.id === it.id);
    if (i >= 0) p.items[type][i] = it; else p.items[type].push(it);
    if (!P.savePack(p)) { toast('บันทึกไม่ได้ — พื้นที่ในเครื่องอาจเต็ม'); return; }
    toast(`บันทึก ${it.name} แล้ว`);
    nav(back);
  }

  root.replaceChildren(h('section.packs.item-form',
    h('a.back', { href: back }, `← ${p.name}`),
    h('h1', `${orig ? 'แก้' : 'เพิ่ม'} ${P.TYPE_LABEL[type]}`),
    body,
    h('div.form-foot',
      orig ? h('button.btn.dmg', { onclick: async () => {
        if (!(await confirmSheet(`ลบ ${orig.name}?`, 'ลบออกจากแพ็กนี้ (ย้อนกลับไม่ได้)', 'ลบ'))) return;
        p.items[type] = p.items[type].filter(x => x.id !== orig.id);
        P.savePack(p); toast('ลบแล้ว'); nav(back);
      } }, 'ลบ') : h('a.btn.ghost', { href: back }, 'ยกเลิก'),
      h('button.btn.primary', { onclick: save }, 'บันทึก'))));
}

function validate(type, it) {
  const e = [];
  if (!it.name?.trim()) e.push('ใส่ชื่อ');
  if (type === 'subclasses') {
    if (!it.classId) e.push('เลือกคลาส');
    if (!it.features.some(f => f.name?.trim())) e.push('ใส่ฟีเจอร์อย่างน้อย 1 อย่าง (ต้องมีชื่อ)');
  }
  if (type === 'backgrounds') {
    if ((it.abilities || []).length !== 3) e.push('เลือกค่าพลัง 3 ตัว');
    if (!it.feat) e.push('เลือก Origin Feat');
    if ((it.skills || []).length !== 2) e.push('เลือกสกิล 2 อย่าง');
  }
  if (type === 'spells' && !(it.classes || []).length) e.push('เลือกคลาสที่ใช้สเปลนี้ได้อย่างน้อย 1 คลาส');
  return e;
}

// Subclass
/** ฟีเจอร์ที่ให้ผู้เล่นเลือก 1 แบบ (เช่น A หรือ B) — f.opts = [{name, s}] */
function optsBlock(f) {
  const box = h('div.opts-edit');
  const draw = () => box.replaceChildren(
    h('p.muted.small', 'ตัวเลือก (ถ้าฟีเจอร์นี้ให้เลือก 1 แบบ เช่น A หรือ B) — ผู้เล่นจะเลือกตอนสร้างตัวละคร'),
    ...(f.opts || []).map((o, i) => h('div.row.opt-edit',
      h('input.inp', { value: o.name || '', placeholder: `ชื่อตัวเลือก ${i + 1}`, oninput: e => { o.name = e.target.value; } }),
      h('input.inp', { value: o.s || '', placeholder: 'สรุปไทยสั้น ๆ', oninput: e => { o.s = e.target.value; } }),
      h('button.btn.small.ghost', { type: 'button', onclick: () => { f.opts.splice(i, 1); draw(); } }, 'ลบ'))),
    h('button.btn.small.ghost', { type: 'button', onclick: () => { (f.opts ||= []).push({ name: '', s: '' }); draw(); } }, '+ เพิ่มตัวเลือก'));
  draw();
  return box;
}

function subForm(it) {
  const feats = h('div.feat-edit-list');
  const spells = h('div.sub-spells');
  const drawFeats = () => feats.replaceChildren(...it.features.map((f, i) => h('div.feat-edit',
    h('div.row.fe-head',
      h('b', `ฟีเจอร์ ${i + 1}`),
      h('button.btn.small.ghost', { type: 'button', onclick: () => { it.features.splice(i, 1); drawFeats(); } }, 'ลบ')),
    h('div.row2',
      field('เลเวล', select(f, 'level', Array.from({ length: 18 }, (_, k) => [k + 3, `Lv ${k + 3}`]), v => { f.level = +v; })),
      field('ชื่อฟีเจอร์', inp(f, 'name', { placeholder: 'เช่น Improved Critical' }))),
    thBlock(f),
    h('div.row2',
      field('ใช้ได้กี่ครั้ง', select(f, 'uses.n', USES)),
      field('ได้คืนเมื่อ', select(f, 'uses.reset', [['long', 'Long Rest'], ['short', 'Short Rest']]))),
    optsBlock(f),
    enBlock(f))));
  const drawSpells = () => spells.replaceChildren(
    ...(it.spells || []).map((r, i) => h('div.row.spell-rowedit',
      select(r, 'level', [3, 5, 7, 9, 11, 13, 15, 17].map(l => [l, `Lv ${l}`])),
      h('input.inp', { value: r.list || '', placeholder: 'ชื่อสเปล EN คั่นด้วย , เช่น Shield, Misty Step', oninput: e => { r.list = e.target.value; warn(e.target, r.list); } }),
      h('button.btn.small.ghost', { type: 'button', onclick: () => { it.spells.splice(i, 1); drawSpells(); } }, '✕'))),
    h('button.btn.small', { type: 'button', onclick: () => { (it.spells ||= []).push({ level: [3, 5, 7, 9][Math.min(it.spells.length, 3)], list: '' }); drawSpells(); } }, '+ เพิ่มแถวสเปล'));
  const warn = (el, list) => {
    const bad = String(list).split(',').map(s => s.trim()).filter(s => s && !D.spellByName[s.toLowerCase()]);
    el.classList.toggle('bad', bad.length > 0);
    el.title = bad.length ? 'ไม่พบสเปล: ' + bad.join(', ') : '';
  };
  drawFeats(); drawSpells();
  const names = h('datalist#sub-names');
  function fillNames() { names.replaceChildren(...P.missingSubs(it.classId).map(x => h('option', { value: x.name }))); }
  fillNames();
  return [
    field('คลาส', select(it, 'classId', [['', '— เลือกคลาส —'], ...D.classes.map(c => [c.id, c.name])], fillNames)),
    field('ชื่อซับคลาส', [inp(it, 'name', { placeholder: 'เช่น Path of the Wild Heart', list: 'sub-names', autocomplete: 'off' }), names],
      'พิมพ์ให้ตรงชื่อในหนังสือ ตัวละครที่เลือกชื่อนี้ไว้จะได้ข้อมูลเอง'),
    field('คำโปรยภาษาไทย', inp(it, 'th.s', { placeholder: 'สายนี้เด่นเรื่องอะไร เล่นแบบไหน' })),
    h('h3', 'การร่ายเวท (ไม่บังคับ)'),
    h('p.muted.small', 'สำหรับซับคลาสแบบ Eldritch Knight / Arcane Trickster ที่ทำให้คลาสที่ร่ายเวทไม่ได้ ร่ายเวทได้แบบ 1/3 caster ตั้งแต่ Lv3 (สลอต cantrip และเวทที่เตรียมได้คิดตามตาราง 2024 ให้อัตโนมัติ)'),
    h('div.row2',
      field('รายการเวท', select(it, 'casting.list', [['', 'ไม่ร่ายเวท'], ['wizard', 'Wizard'], ['cleric', 'Cleric'], ['druid', 'Druid'], ['bard', 'Bard'], ['sorcerer', 'Sorcerer'], ['warlock', 'Warlock']])),
      field('ค่าพลังที่ใช้ร่าย', select(it, 'casting.ab', [['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA']]))),
    h('h3', 'ฟีเจอร์'),
    h('p.muted.small', 'ใส่ได้ทุกเลเวล 3–20 — จะแสดงในใบตัวละครเมื่อถึงเลเวลนั้น'),
    feats,
    h('button.btn.small', { type: 'button', onclick: () => { it.features.push({ level: it.features.at(-1)?.level || 3, name: '', th: { t: 'passive' } }); drawFeats(); } }, '+ เพิ่มฟีเจอร์'),
    h('h3', 'สเปลประจำซับคลาส (ไม่บังคับ)'),
    h('p.muted.small', 'สเปลที่ "เตรียมไว้เสมอ" เมื่อถึงเลเวลนั้น ไม่นับโควตา — ใช้ได้เฉพาะสเปลที่มีในเว็บ (SRD หรือแพ็ก) ช่องสีแดง = หาชื่อไม่เจอ'),
    spells,
  ];
}

// Background
function bgForm(it) {
  const origin = D.feats.filter(f => f.category === 'Origin' && f.id !== 'magic-initiate').map(f => [f.name, f.name]);
  const featOpts = [['', '— เลือก Origin Feat —'], ...['Cleric', 'Druid', 'Wizard'].map(x => [`Magic Initiate (${x})`, `Magic Initiate (${x})`]), ...origin];
  return [
    field('ชื่อ Background', inp(it, 'name', { placeholder: 'เช่น Guard' })),
    field('คำอธิบายไทยสั้น ๆ', inp(it, 'th.s', { placeholder: 'อดีตเป็นยาม เฝ้าประตูเมือง ตาไว' })),
    field('ค่าพลังที่เพิ่มได้ (เลือก 3)', multiChips(ABIL.map(a => [a, ABIL_SHORT[a]]), it.abilities, 3, v => { it.abilities = v; })),
    field('Origin Feat', select(it, 'feat', featOpts)),
    field('สกิล (เลือก 2)', multiChips(SKILLS.map(s => [s[0], D.th.misc?.skills?.[s[0]] ? `${s[0]} · ${D.th.misc.skills[s[0]]}` : s[0]]), it.skills, 2, v => { it.skills = v; })),
    field('เครื่องมือ (Tool Proficiency)', inp(it, 'tool', { placeholder: "เช่น Gaming Set (one of your choice)" })),
    field('ของติดตัวแบบ A', h('textarea.inp', { rows: 2, placeholder: 'Spear, Light Crossbow, 20 Bolts, Gaming Set, Hooded Lantern, Manacles, Quiver, Traveler\'s Clothes, 12 GP', oninput: e => { it.equipA = e.target.value; } }, it.equipA || ''), 'คั่นด้วย , ใส่ชื่ออังกฤษตามหนังสือ ของที่เว็บรู้จักจะคำนวณ AC/การโจมตีให้'),
    field('แบบ B: เงิน (GP)', inp(it, 'gpB', { type: 'number', min: 0, max: 999, inputmode: 'numeric' })),
    enBlock(it),
  ];
}

// Feat
function featForm(it) {
  return [
    field('ชื่อ Feat', inp(it, 'name', { placeholder: 'เช่น Lucky' })),
    field('หมวด', select(it, 'category', FEAT_CAT.map(c => [c, FEAT_CAT_TH[c]]))),
    field('เงื่อนไข (ถ้ามี)', inp(it, 'prereq', { placeholder: 'เช่น Level 4+, Dexterity 13+' })),
    check(it, 'repeatable', 'เลือกซ้ำได้ (Repeatable)'),
    thBlock(it),
    enBlock(it),
  ];
}

// Spell
function spellForm(it) {
  const casters = D.classes.filter(c => D.spells.some(s => s.classes.includes(c.id)));
  return [
    field('ชื่อสเปล (EN)', inp(it, 'name', { placeholder: 'เช่น Ice Knife' })),
    h('div.row2',
      field('เลเวล', select(it, 'level', Array.from({ length: 10 }, (_, l) => [l, l ? `Level ${l}` : 'Cantrip']), v => { it.level = +v; })),
      field('สำนัก', select(it, 'school', Object.keys(SCHOOL_TH).map(s => [s, `${s} (${SCHOOL_TH[s]})`])))),
    field('คลาสที่ใช้ได้', multiChips(casters.map(c => [c.id, c.name]), it.classes, 12, v => { it.classes = v; })),
    h('div.row2',
      field('Casting Time', inp(it, 'time', { placeholder: 'Action' })),
      field('Range', inp(it, 'range', { placeholder: '60 feet' }))),
    h('div.row2',
      field('Components', inp(it, 'components', { placeholder: 'V, S, M (a drop of water)' })),
      field('Duration', inp(it, 'duration', { placeholder: 'Instantaneous' }))),
    h('div.row', check(it, 'concentration', 'Concentration'), check(it, 'ritual', 'Ritual')),
    thBlock(it, { type: false, tip: false }),
    enBlock(it),
  ];
}
