// วิซาร์ดสร้าง/แก้ไขตัวละครทีละขั้น
import { D } from '../data.js';
import { h, iconSvg, sheet, toast, sign } from '../util.js';
import * as S from '../store.js';
import {
  ABIL, ABIL_EN, ABIL_SHORT, ABIL_TH, SKILLS, SKILL_AB, LANGS, STANDARD_ARRAY, POINT_COST, MAX_LEVEL,
  SPECIES_OPT, SIZE_CHOICE, FIGHTING_STYLE_AT, MASTERY_AT, EXPERTISE,
  SRD_PICKS, compute, missing, col, expertiseCount, metamagicCount, setLevel, setPrimaryClass, classLevels, levelInfo, chOf, mcOf, MC_PROF, equipOptions, rebuildEquipment, classSpellList, weaponProficient, mod, subOf, srdSub, setSub,
  bgOf,
} from '../rules.js';
import { featIdOf, listPacks, savePack, srcTag, openDocs, openOn, setOpen } from '../packs.js';
import { levelEditor, levelSummary } from './levelup.js';
import { openToggles } from './packs.js';
import { classFeatureCard, featureCard, choiceCard, chips, counter, spellRow, original, statBox, fullTh, stubSubBox, acc, detailGroups, LEVEL_TH } from './parts.js';

const STEPS = [
  { id: 'basic', en: 'START', label: 'เริ่ม / ตั้งค่า' },
  { id: 'class', en: 'CLASS', label: 'คลาส', n: 1 },
  { id: 'background', en: 'BACKGROUND', label: 'ภูมิหลัง', n: 2 },
  { id: 'species', en: 'SPECIES', label: 'เผ่าพันธุ์', n: 3 },
  { id: 'abilities', en: 'ABILITIES', label: 'ค่าพลัง', n: 4 },
  { id: 'levels', en: 'LEVELS', label: 'เลเวล' },
  { id: 'equipment', en: 'EQUIPMENT', label: 'ของติดตัว', n: 5 },
  { id: 'spells', en: 'SPELLS', label: 'เวทมนตร์' },
  { id: 'done', en: 'SUMMARY', label: 'สรุป' },
];
const SPECIES_MISS = /Human|Keen Senses|^เลือก (Draconic Ancestry|Elven Lineage|Fiendish Legacy|Giant Ancestry|Gnomish Lineage)/;

const thc = id => D.th.classes?.[id] || {};
const ths = id => D.th.species?.[id] || {};
const featTh = id => D.th.feats?.[id];
const packSub = (x, base) => (x?.pack ? [base, srcTag(x)].filter(Boolean).join(' · ') : base);

export function renderWizard(root, c, stepId, nav) {
  let step = STEPS.findIndex(s => s.id === stepId);
  if (step < 0) step = 0;
  const openSet = new Set(); // แถบพับที่ผู้ใช้เปิดค้างไว้
  const ui = { spQ: '', spLv: 'all', spSel: false };
  c.settings = Object.assign({ hp: 'avg' }, c.settings);
  c.details = Object.assign({}, c.details);
  if (c.look) { if (!c.details.appearance) c.details.appearance = c.look; delete c.look; S.autosave(c); }

  const changed = (re = true) => {
    S.autosave(c);
    if (re) draw();
  };

  function visibleSteps() {
    const x = compute(c);
    const hasSpells = x.casting.some(b => !b.fixed && (b.cantripMax || b.preparedMax));
    return STEPS.filter(s => (s.id !== 'spells' || hasSpells) && (s.id !== 'levels' || c.level > 1));
  }

  function draw() {
    const steps = visibleSteps();
    if (!steps.some(s => s.id === STEPS[step].id)) step = STEPS.indexOf(steps[steps.length - 1]);
    const cur = STEPS[step];
    const pos = steps.indexOf(cur);
    const scrollY = window.scrollY;
    const body = ({ basic, class: klass, background, species, abilities, levels, equipment, spells, done })[cur.id]();
    root.replaceChildren(
      h('nav.stepper', { 'aria-label': 'ขั้นตอน' }, steps.map((s, i) => h('button.step' + (s === cur ? '.on' : '') + (i < pos ? '.past' : '') + (stepNeed(s.id) ? '.need' : ''), {
        type: 'button', onclick: () => go(STEPS.indexOf(s)),
      }, h('b', s.n ? `${s.n} ${s.en}` : s.en), h('small', s.label))),
      h('button.step.to-sheet', { type: 'button', onclick: () => { S.save(c); nav(`#/c/${c.id}`); } }, h('b', 'ดูใบตัวละคร'), h('small', 'CHARACTER SHEET'))),
      h('section.wz-body', body),
      h('footer.wz-foot',
        h('button.btn', { disabled: pos === 0, onclick: () => go(STEPS.indexOf(steps[pos - 1])) }, '← ย้อน'),
        h('span.wz-pos', `${pos + 1}/${steps.length}`),
        pos < steps.length - 1
          ? h('button.btn.primary', { onclick: () => go(STEPS.indexOf(steps[pos + 1])) }, 'ถัดไป →')
          : h('button.btn.primary', { onclick: () => { S.save(c); nav(`#/c/${c.id}`); } }, 'เปิดใบตัวละคร')));
    if (cur.id === stepId) window.scrollTo(0, scrollY);
    const on = root.querySelector('.stepper .step.on'), bar = root.querySelector('.stepper');
    document.documentElement.style.setProperty('--topbar-h', (document.querySelector('.topbar')?.offsetHeight || 53) + 'px');
    document.documentElement.style.setProperty('--stepper-h', bar.offsetHeight + 'px');
    if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
  }
  // ขั้นไหนยังเลือกไม่ครบ (ติดจุด ⚠ ที่แถบขั้น)
  function stepNeed(id) {
    const ms = missing(c);
    const lvMiss = m => / \(Lv \d+\)$/.test(m) && /ASI|Epic Boon|ใส่แต้ม|Skilled|Magic Initiate|ผลทอย HP/.test(m);
    if (id === 'class') return !c.classId || ms.some(m => !SPECIES_MISS.test(m) && !lvMiss(m) && !/Book of Shadows|ของ Background/.test(m));
    if (id === 'species') return !c.speciesId || ms.some(m => SPECIES_MISS.test(m)) || c.languages.length < 2 + ((classLevels(c).ranger || 0) >= 2 ? 2 : 0);
    if (id === 'background') return !c.bgId || !Object.values(c.abilities.bonus || {}).some(Boolean) || ms.some(m => /ของ Background/.test(m));
    if (id === 'abilities') return c.abilities.method !== 'pointbuy' && Object.keys(c.abilities.assign || {}).length < 6;
    if (id === 'levels') return ms.some(lvMiss);
    if (id === 'spells') {
      const x = compute(c);
      return ms.some(m => /Book of Shadows/.test(m)) || x.casting.some(b => !b.fixed && ((b.cantripMax && b.cantrips.length < b.cantripMax) || (b.preparedMax && b.prepared.length < b.preparedMax)));
    }
    return false;
  }
  function go(i) {
    step = i;
    stepId = STEPS[i].id;
    history.replaceState(null, '', `#/edit/${c.id}/${stepId}`);
    draw();
    window.scrollTo(0, 0);
  }

  const section = (title, ...kids) => h('div.block', h('h3', title), ...kids);
  const intro = (title, text) => h('div.wz-intro', h('h2', title), text ? h('p', text) : null);

  // ---------- เริ่ม / ตั้งค่า ----------
  function basic() {
    const ST = c.settings;
    const packs = listPacks();
    return [
      intro('มาสร้างตัวละครกัน', 'ตั้งชื่อ เลือกเลเวลเริ่มต้น แล้วกด "ถัดไป" ไปเลือกคลาสได้เลย ถ้าเพิ่งเล่นครั้งแรก DM ส่วนใหญ่จะให้เริ่มที่เลเวล 1'),
      section('ชื่อตัวละคร', h('input.inp', { value: c.name, placeholder: 'เช่น Jerk', maxlength: 40, oninput: e => { c.name = e.target.value; changed(false); } })),
      section('ชื่อผู้เล่น', h('input.inp', { value: c.player, placeholder: 'ไม่ใส่ก็ได้', maxlength: 40, oninput: e => { c.player = e.target.value; changed(false); } })),
      section('เลเวล',
        h('select.inp.lv-sel', { 'aria-label': 'เลเวล', onchange: async e => {
          const n = +e.target.value;
          if (n < c.level && levelInfo(c).slice(n).some(li => li.e.hp || li.e.feat || li.e.c !== c.classId) && !confirm(`ลดเป็นเลเวล ${n}? ตัวเลือกของเลเวล ${n + 1}–${c.level} (HP/ASI/feat/คลาส) จะหายไป`)) { e.target.value = c.level; return; }
          setLevel(c, n); changed();
        } }, Array.from({ length: MAX_LEVEL }, (_, i) => h('option', { value: i + 1, selected: c.level === i + 1 }, `เลเวล ${i + 1}`))),
        h('p.muted.small', 'ซับคลาสได้ที่เลเวล 3 · ถ้าเริ่มเลเวล 2 ขึ้นไป จะมีขั้น "LEVELS" ให้เลือก HP / ASI / feat / Multiclass ทีละเลเวล')),
      h('h2.sec', 'ตั้งค่าตัวละคร'),
      acc({ key: 'set-hp', title: 'HP ตอนเลเวลอัป', sub: ST.hp === 'roll' ? 'ทอยเต๋าเอง' : 'ใช้ค่าเฉลี่ย', openSet },
        h('div.seg', [['avg', 'ใช้ค่าเฉลี่ย'], ['roll', 'ทอยเต๋าเอง']].map(([k, l]) => h('button.seg-btn' + (ST.hp === k ? '.on' : ''), { type: 'button', onclick: () => { ST.hp = k; changed(); } }, l))),
        h('p.muted.small', ST.hp === 'roll'
          ? 'ทุกครั้งที่เลเวลอัปให้ทอย Hit Die ของคลาสจริง ๆ แล้วพิมพ์เลขที่ได้ลงไป (ลุ้นดีแต่อาจได้น้อย) — ถ้ายังไม่ได้ใส่ เว็บจะเตือนไว้'
          : 'ทุกเลเวลได้ HP เท่าค่าเฉลี่ยของ Hit Die (เช่น d10 ได้ 6) ไม่ต้องลุ้น — DM ส่วนใหญ่ใช้แบบนี้')),
      acc({ key: 'set-packs', title: 'ของจาก Content Pack', sub: packs.length ? `เปิดใช้ ${packs.filter(p => p.enabled).length} จาก ${packs.length} แพ็ก` : 'ยังไม่มีแพ็กในเครื่องนี้', openSet },
        packs.length ? h('div.pack-toggles', packs.map(p => h('label.row.check-row', h('input', { type: 'checkbox', checked: p.enabled, onchange: e => { p.enabled = e.target.checked; savePack(p); changed(); } }), ` ${p.name}`)))
          : h('p.muted.small', 'Content Pack คือซับคลาส / Background / Feat / สเปลที่เพิ่มเองหรือได้จากเพื่อน'),
        h('p.muted.small', 'เปิด/ปิดตรงนี้มีผลกับทุกตัวละครในเครื่องนี้ · จัดการแพ็กได้ที่ ', h('a', { href: '#/packs' }, 'หน้าแพ็ก'))),
      openDocs().length ? acc({ key: 'set-open', title: 'คอนเทนต์เสริมจากหนังสือ (OGL)', sub: openOn() ? `เปิดใช้ ${openDocs().filter(d => openOn(d.id)).length} จาก ${openDocs().length} เล่ม` : 'ปิดอยู่', openSet },
        openToggles(changed)) : null,
      h('p.muted.small', '💡 ของเริ่มต้นจะเลือกได้ที่ขั้น EQUIPMENT ว่าจะรับเป็นชุดอุปกรณ์หรือรับเป็นเงินแล้วไปซื้อเอง · รูปลักษณ์และนิสัยกรอกได้ที่ขั้น BACKGROUND'),
    ];
  }

  // ---------- 1. Class ----------
  function classSheet(cls) {
    const t = thc(cls.id);
    const L = Math.max(classLevels(c)[cls.id] || c.level, 3);
    sheet(cls.name, h('div',
      h('div.hero-row', h('span.hero-ico', { html: iconSvg(cls.id) }), h('div', h('b', t.tag || ''), h('p', t.desc || ''))),
      t.tips?.length ? h('div.tips', h('b', '💡 ทิปสำหรับมือใหม่'), h('ul', t.tips.map(x => h('li', x)))) : null,
      h('dl.kv',
        h('dt', 'Primary Ability'), h('dd', cls.core['Primary Ability']),
        h('dt', 'Hit Point Die'), h('dd', `d${cls.hitDie}`),
        h('dt', 'Saving Throws'), h('dd', cls.saves.map(a => ABIL_SHORT[a]).join(', ')),
        h('dt', 'Armor'), h('dd', cls.core['Armor Training']),
        h('dt', 'Weapons'), h('dd', cls.core['Weapon Proficiencies'])),
      h('h4', `ความสามารถถึงเลเวล ${L}`),
      cls.features.filter(f => f.level <= L && !/Subclass$/.test(f.name)).map(f => classFeatureCard(cls, f, false)),
      h('h4', `ซับคลาส: ${cls.subclass.name}`),
      thc(cls.id).sub?.desc ? h('p', thc(cls.id).sub.desc) : null,
      cls.subclass.features.filter(f => f.level <= L).map(f => classFeatureCard(cls, f, true)),
      (D.subs?.[cls.id] || []).length > 1 ? h('p.muted.small', 'ซับคลาสอื่น: ' + D.subs[cls.id].slice(1).map(x => x.name + (x.stub ? ' (ต้องเติมข้อมูล)' : x.open ? ' 📖' : ' 📦')).join(', ')) : null),
      [{ label: c.classId === cls.id ? 'เลือกอยู่แล้ว' : 'เลือกคลาสนี้', primary: true, onClick: () => pickClass(cls.id) }]);
  }
  function pickClass(id) {
    if (c.classId !== id) {
      setPrimaryClass(c, id);
      c.skills = [];
      c.choices = {};
      c.spells = { cantrips: [], prepared: [], book: [] };
      c.equipment.classOpt = 'A';
      rebuildEquipment(c);
    }
    changed();
  }

  /** การ์ดตัวเลือกหลักที่เลือกไว้ + แถบพับ "เปลี่ยน…" ที่มีตัวเลือกทั้งหมด */
  function pickHead(key, cur, label, grid) {
    if (!cur) return grid;
    return [h('div.picked', h('span.picked-ico', { html: iconSvg(cur.icon) }), h('div', h('small', label), h('b', cur.title), cur.sub ? h('p.muted.small', cur.sub) : null)),
      acc({ key, title: `เปลี่ยน${/^[A-Za-z]/.test(label) ? " " : ""}${label}`, sub: 'แตะการ์ดเพื่ออ่านรายละเอียดก่อนเลือก', openSet }, grid)];
  }

  function klass() {
    const out = [intro('CLASS · เลือกคลาส', 'คลาสคือ "อาชีพ" ของตัวละคร เป็นตัวกำหนดว่าสู้แบบไหน ใช้เวทได้ไหม และเก่งเรื่องอะไร แตะการ์ดเพื่ออ่านรายละเอียดก่อนตัดสินใจ')];
    const cls = D.cls[c.classId];
    const grid = h('div.grid', D.classes.map(k => choiceCard({
      id: k.id, iconName: k.id, title: k.name, sub: `d${k.hitDie} · ${k.core['Primary Ability']}`,
      desc: thc(k.id).tag, selected: c.classId === k.id, onClick: () => classSheet(k),
    })));
    out.push(...[].concat(pickHead('pick-class', cls && { icon: cls.id, title: `${cls.name} ${compute(c).CL}`, sub: thc(cls.id).tag }, 'คลาส', grid)));
    if (!cls) return out;
    const x = compute(c);
    out.push(...classChoices(cls, x.CL, c.choices, x, true));
    for (const [id, n] of Object.entries(x.CLs)) if (id !== cls.id && D.cls[id]) out.push(...classChoices(D.cls[id], n, chOf(c, id), x, false));
    return out;
  }

  /** ตัวเลือกของคลาสหนึ่ง — ฟีเจอร์คลาสเป็นแถบพับเรียงตามเลเวล และตัวเลือกของฟีเจอร์ไหนก็อยู่ในแถบของฟีเจอร์นั้น */
  function classChoices(cls, L, ch, x, primary) {
    const sub = subOf(c, cls.id);
    const feats = [
      ...cls.features.filter(f => f.level <= L && !/^Ability Score Improvement$|^Epic Boon$/.test(f.name)).map(f => ({ f, sub: false })),
      ...(L >= 3 ? sub.features.filter(f => f.level <= L).map(f => ({ f: { ...f, picked: ch.packOpt?.[f.id] }, sub: true })) : []),
    ].sort((a, b) => a.f.level - b.f.level);
    const slot = {}, loose = [];
    // ใส่ตัวเลือกในแถบของฟีเจอร์ชื่อนั้น (ถ้าไม่มีฟีเจอร์ชื่อนี้ = แถบแยก)
    const put = (names, title, desc, need, ...kids) => {
      const k = [].concat(names).find(n => feats.some(z => z.f.name === n || z.f.id === n));
      const body = [desc ? h('p.muted', desc) : null, ...kids];
      if (k && !slot[k]) slot[k] = { need, body };
      else loose.push(acc({ key: `${cls.id}:${title}`, title, sub: null, need, done: !need, openSet }, ...body));
    };

    if (primary) {
      const list = cls.skillList === 'any' ? SKILLS.map(s => s[0]) : cls.skillList;
      const bgSkills = bgOf(c)?.skills || [];
      put([], `สกิลจากคลาส (${c.skills.length}/${cls.skillChoose})`, `เลือก ${cls.skillChoose} อย่าง — สกิลที่ได้จาก Background แล้วจะขีดฆ่าไว้ เลือกซ้ำไม่ได้`, c.skills.length < cls.skillChoose,
        chips(list, c.skills, cls.skillChoose, v => { c.skills = v; changed(); }, { locked: bgSkills.filter(s => !c.skills.includes(s)) }));
    } else {
      const mp = MC_PROF[cls.id] || {}, mo = mcOf(c, cls.id);
      const got = [...(mp.armor || []).map(a => ({ light: 'Light armor', medium: 'Medium armor', shield: 'Shields' })[a]), mp.martial ? 'Martial weapons' : null, mp.tools].filter(Boolean);
      put([], 'Proficiency จาก Multiclass', `ได้: ${got.join(', ') || 'ไม่มี proficiency เพิ่ม'}${mp.skills ? ` + สกิล ${mp.skills} อย่าง` : ''} · ไม่ได้ Saving Throw และของเริ่มต้นของคลาสนี้`, (mp.skills || 0) > mo.skills.length,
        mp.skills ? chips(mp.anySkill ? SKILLS.map(k => k[0]) : cls.skillList, mo.skills, mp.skills, v => { mo.skills = v; changed(); },
          { locked: x.skills.filter(k => k.prof && !mo.skills.includes(k.name)).map(k => k.name) }) : null);
    }

    if (cls.id === 'cleric') put('Divine Order', 'Divine Order', 'เลือกบทบาท 1 แบบ', !ch.divineOrder, orderGrid(cls, ch, 'divineOrder', ['Protector', 'Thaumaturge']));
    if (cls.id === 'druid') put('Primal Order', 'Primal Order', 'เลือกบทบาท 1 แบบ', !ch.primalOrder, orderGrid(cls, ch, 'primalOrder', ['Magician', 'Warden']));

    if (FIGHTING_STYLE_AT[cls.id] && L >= FIGHTING_STYLE_AT[cls.id]) {
      const opts = D.feats.filter(f => f.category === 'Fighting Style').map(f => ({ id: f.id, name: f.name, text: f.text }));
      if (cls.id === 'paladin') opts.push({ id: 'blessed-warrior', name: 'Blessed Warrior', text: cls.features.find(f => f.name === 'Fighting Style').text });
      if (cls.id === 'ranger') opts.push({ id: 'druidic-warrior', name: 'Druidic Warrior', text: cls.features.find(f => f.name === 'Fighting Style').text });
      put('Fighting Style', 'Fighting Style', 'เลือกสไตล์การต่อสู้ที่ถนัด 1 แบบ (เปลี่ยนได้ตอนเลเวลอัป)', !ch.fightingStyle,
        h('div.grid.grid-2', opts.map(o => choiceCard({
          id: o.id, iconName: 'weapon', title: o.name, sub: packSub(D.feat[o.id]), desc: featTh(o.id)?.s, selected: ch.fightingStyle === o.id,
          onClick: () => { ch.fightingStyle = o.id; changed(); },
        }))));
    }

    if (MASTERY_AT[cls.id]) {
      const n = parseInt(col(cls, cls.id === 'barbarian' ? 'Mastery' : 'Weapon Mastery', L), 10) || 2;
      const other = new Set(Object.keys(classLevels(c)).filter(id => id !== cls.id && MASTERY_AT[id]).flatMap(id => chOf(c, id).mastery || []));
      const ws = D.weapons.filter(w => (cls.id === 'barbarian' ? /Melee/.test(w.group) : true) && weaponProficient(w, x.weaponRule) && (!other.has(w.id) || (ch.mastery || []).includes(w.id)));
      put('Weapon Mastery', 'Weapon Mastery', `เลือกอาวุธ ${n} ชนิดที่จะใช้ "ท่าพิเศษ" ได้ (เปลี่ยนได้หลังพักยาว) — แนะนำให้เลือกอาวุธที่ถืออยู่${other.size ? ' · อาวุธที่เลือกในคลาสอื่นไปแล้วจะไม่ขึ้นซ้ำ' : ''}`, (ch.mastery || []).length < n,
        counter((ch.mastery || []).length, n),
        chips(ws.map(w => w.id), ch.mastery || [], n, v => { ch.mastery = v; changed(); },
          { labels: Object.fromEntries(ws.map(w => [w.id, `${w.name} · ${w.mastery}`])) }),
        h('details.orig', h('summary', 'ท่าพิเศษ (Mastery) แต่ละแบบทำอะไร'),
          h('ul.mastery-list', D.mastery.map(mm => h('li', h('b', mm.name + ': '), D.th.mastery?.[mm.id] || mm.text, fullTh('mastery', mm.id))))));
    }

    if (expertiseCount(cls.id, L)) {
      const n = expertiseCount(cls.id, L), only = EXPERTISE[cls.id][0][2];
      const profSkills = x.skills.filter(s => s.prof && (!only || only.includes(s.name))).map(s => s.name);
      put(['Expertise', 'Scholar'], 'Expertise', `เลือก ${n} สกิลที่ชำนาญอยู่แล้ว ให้ได้โบนัส Proficiency สองเท่า${only ? ' (ต้องเป็นสกิลในรายการของ Scholar)' : ''}`, (ch.expertise || []).length < n,
        counter((ch.expertise || []).length, n),
        profSkills.length ? chips(profSkills, (ch.expertise || []).filter(s => profSkills.includes(s)), n, v => { ch.expertise = v; changed(); })
          : h('p.warn', 'ต้องเลือกสกิลของคลาสก่อน แล้วค่อยมาเลือก Expertise'));
    }

    if (cls.id === 'barbarian' && L >= 3) {
      const opts = cls.skillList.filter(s => !x.skills.find(k => k.name === s && k.prof) || ch.primalSkill === s);
      put('Primal Knowledge', 'Primal Knowledge', 'เลือกสกิลเพิ่มอีก 1 อย่างจากรายการสกิลของ Barbarian', !ch.primalSkill,
        chips(opts, ch.primalSkill ? [ch.primalSkill] : [], 1, v => { ch.primalSkill = v[0]; changed(); }));
    }
    const isSrdSub = srdSub(c, cls.id);
    if (cls.id === 'bard' && L >= 3 && isSrdSub) {
      const opts = SKILLS.map(k => k[0]).filter(k => !x.skills.find(z => z.name === k && z.prof) || (ch.loreSkills || []).includes(k));
      put('Bonus Proficiencies', 'Bonus Proficiencies', 'เลือกสกิลที่ยังไม่ชำนาญ 3 อย่าง', (ch.loreSkills || []).length < 3, counter((ch.loreSkills || []).length, 3),
        chips(opts, ch.loreSkills || [], 3, v => { ch.loreSkills = v; changed(); }));
    }
    if (cls.id === 'druid' && L >= 3 && isSrdSub) put('Circle of the Land Spells', 'ดินแดนของ Circle of the Land', 'เลือกชนิดดินแดน (เปลี่ยนได้ทุกครั้งที่พักยาว) — แต่ละแบบได้สเปลติดตัวไม่เหมือนกัน', !ch.land,
      chips(['Arid', 'Polar', 'Temperate', 'Tropical'], ch.land ? [ch.land[0].toUpperCase() + ch.land.slice(1)] : [], 1, v => { ch.land = v[0]?.toLowerCase(); changed(); },
        { labels: { Arid: 'Arid (ทะเลทราย)', Polar: 'Polar (ขั้วโลก)', Temperate: 'Temperate (เขตอบอุ่น)', Tropical: 'Tropical (เขตร้อน)' } }));
    for (const q of SRD_PICKS) if (q.cls === cls.id && L >= q.at && (!q.srdSub || isSrdSub)) put(q.feat, q.feat, 'เลือก 1 แบบ', !ch[q.key],
      h('div.grid.grid-2', q.opts.map(([n, d]) => choiceCard({ id: n, iconName: 'eye', title: n, desc: d, selected: ch[q.key] === n, onClick: () => { ch[q.key] = n; changed(); } }))));
    if (cls.id === 'ranger' && L >= 3 && isSrdSub) put("Hunter's Prey", "Hunter's Prey", 'เลือกสไตล์การล่า (สลับได้ทุกครั้งที่พักสั้นหรือพักยาว)', !ch.huntersPrey,
      h('div.grid.grid-2', [['Colossus Slayer', 'ตีศัตรูที่เลือดไม่เต็ม ได้ดาเมจเพิ่ม 1d8 (ครั้งเดียวต่อเทิร์น) — เหมาะกับการล่าตัวใหญ่'], ['Horde Breaker', 'ตีแล้วได้ตีเพิ่มอีกทีใส่ศัตรูอีกตัวที่ยืนใกล้กัน — เหมาะกับการเจอศัตรูเป็นฝูง']].map(([n, d]) =>
        choiceCard({ id: n, iconName: 'eye', title: n, desc: d, selected: ch.huntersPrey === n, onClick: () => { ch.huntersPrey = n; changed(); } }))));

    if (cls.id === 'sorcerer' && L >= 2) {
      const n = metamagicCount(L);
      put('Metamagic', 'Metamagic', `เลือก ${n} วิธีบิดเวท (ใช้ Sorcery Points) — ได้เลือกเพิ่มตอนเลเวล 10 และ 17`, (ch.metamagic || []).length < n, counter((ch.metamagic || []).length, n),
        optionList(cls.options['metamagic-options'].items, ch.metamagic || [], n, v => { ch.metamagic = v; changed(); }));
    }
    if (cls.id === 'warlock') {
      const n = parseInt(col(cls, 'Eldritch Invocations', L), 10);
      put('Eldritch Invocations', 'Eldritch Invocations', `เลือก ${n} อย่าง (บางอย่างต้องมี cantrip ที่ทำดาเมจ เช่น Eldritch Blast)`, (ch.invocations || []).length < n, counter((ch.invocations || []).length, n),
        optionList(cls.options['eldritch-invocation-options'].items.filter(i => i.minLevel <= L), ch.invocations || [], n, v => { ch.invocations = v; changed(); }));
    }

    // ซับคลาส
    const subs = D.subs?.[cls.id] || [cls.subclass];
    const isCur = sb => sub === sb || (!!sub.phb && sub.phb === sb.phb);
    put(`${cls.name} Subclass`, `ซับคลาส: ${sub.name}`, L >= 3 ? 'ได้ตอนเลเวล 3 · แตะการ์ดเพื่อเปลี่ยน' : 'จะได้ตอนเลเวล 3 — เลือกไว้ก่อนได้เลย', false,
      h('div.grid.grid-2', [...subs, ...(subs.some(isCur) ? [] : [sub])].map(sb => choiceCard({
        id: sb.id, iconName: cls.id, title: sb.name, sub: sb.stub ? '🟡 ต้องเติมข้อมูล' : sb.pack ? srcTag(sb) : 'SRD',
        desc: sb.stub ? null : sb.pack ? sb.th?.s : thc(cls.id).sub?.desc, selected: isCur(sb),
        onClick: () => { setSub(c, cls.id, sb); changed(); },
      }))),
      sub.stub ? stubSubBox(sub, cls.id) : null,
      h('p.muted.small', 'ข้อมูลฟรี (SRD) มีซับคลาสละ 1 แบบ — อันที่ขึ้น 🟡 เลือกไว้ได้ แล้วไปเติมข้อมูลเองที่ ', h('a', { href: '#/packs' }, 'Content Pack')));
    // ฟีเจอร์ซับคลาสจากแพ็กที่ให้เลือก A/B
    if (sub.pack && L >= 3) for (const f of sub.features) if (f.level <= L && f.opts?.length)
      put(f.id, `เลือก ${f.name}`, 'ฟีเจอร์นี้ให้เลือก 1 แบบ', !f.opts.some(o => o.name === ch.packOpt?.[f.id]),
        h('div.grid', f.opts.map(o => choiceCard({ id: o.name, iconName: 'feat', title: o.name, desc: o.s, selected: ch.packOpt?.[f.id] === o.name,
          onClick: () => { ch.packOpt = { ...ch.packOpt, [f.id]: o.name }; changed(); } }))));

    const out = [h('h2.sec', primary ? `${cls.name} ${L}` : `Multiclass: ${cls.name} ${L}`), ...loose];
    out.push(h('h3.sec2', h('span', 'CLASS FEATURES'), h('small', 'ความสามารถของคลาส · แตะเพื่ออ่าน')));
    const used = new Set();
    for (const { f, sub: isSub } of feats) {
      const k = [f.name, f.id].find(n => slot[n] && !used.has(n));
      if (k) used.add(k);
      const sl = k ? slot[k] : null;
      out.push(acc({ key: `${cls.id}:f:${isSub ? 's' : ''}${f.id}:${f.level}`, title: f.name, sub: `Lv ${f.level}${isSub ? ` · ${sub.name}` : ''}${sl ? ' · มีตัวเลือก' : ''}`, need: sl?.need, done: sl && !sl.need, openSet },
        ...(sl ? sl.body : []), /Subclass$/.test(f.name) ? null : classFeatureCard(cls, f, isSub)));
    }
    return out;
  }

  function orderGrid(cls, ch, key, opts) {
    return h('div.grid.grid-2', opts.map(o => choiceCard({
      id: o, iconName: o === 'Protector' || o === 'Warden' ? 'shield' : 'spell', title: o,
      desc: thc(cls.id).orders?.[o], selected: ch[key] === o,
      onClick: () => { ch[key] = o; changed(); },
    })));
  }

  function optionList(items, value, max, onChange) {
    const set = new Set(value);
    return h('div.opt-list', items.map(it => {
      const on = set.has(it.id);
      return h('div.opt' + (on ? '.on' : ''),
        h('div.opt-main',
          h('b', it.name), it.prereq ? h('small.muted', ' · ' + it.prereq) : null,
          h('p', D.th.options?.[it.id] || ''), fullTh('options', it.id), original(it.text)),
        h('button.check', {
          'aria-pressed': on ? 'true' : 'false', disabled: !on && set.size >= max,
          onclick: () => { on ? set.delete(it.id) : set.add(it.id); onChange([...set]); },
        }, on ? '✓' : '+'));
    }));
  }

  // ---------- 2. Background ----------
  /** Background จากหนังสือ OGL (กฎ 2014) → เลือกค่าพลัง 3 ตัว + Origin Feat + สกิลที่ให้เลือก ตามกฎ 2024 "สร้าง Background เอง" */
  function customBg(bg) {
    const ch = c.choices, abil = ch.bgAbil || [], pick = bg.skillPick;
    const origin = D.feats.filter(f => f.category === 'Origin');
    const out = [h('div.tip-box', h('p.small', `📖 ${bg.name} มาจาก ${bg.pack} (กฎ 2014) ซึ่งไม่ได้กำหนดโบนัสค่าพลังและ Origin Feat ไว้ — ตามกฎ 2024 ให้เลือกค่าพลัง 3 ตัว กับ Origin Feat 1 อย่างเอง`))];
    out.push(acc({ key: 'bg-abil', title: 'ค่าพลังที่ได้โบนัส (เลือก 3)', sub: abil.length ? abil.map(a => ABIL_SHORT[a]).join(' · ') : 'ยังไม่ได้เลือก', need: abil.length !== 3, done: abil.length === 3, openSet },
      chips(ABIL, abil, 3, v => { ch.bgAbil = v; c.abilities.bonus = {}; c.abilities.plus2 = null; c.abilities.plus1 = null; changed(); }, { labels: Object.fromEntries(ABIL.map(a => [a, ABIL_EN[a]])) })));
    if (pick) {
      const from = (pick.from.length ? pick.from : SKILLS.map(s => s[0])).filter(s => !bg.skills.includes(s)), cur = ch.bgSkills || [];
      out.push(acc({ key: 'bg-skill', title: `สกิลของ Background (เลือก ${pick.n})`, sub: [...bg.skills, ...cur].join(' · ') || 'ยังไม่ได้เลือก', need: cur.length < pick.n, done: cur.length >= pick.n, openSet },
        bg.skills.length ? h('p.muted.small', 'ได้แน่ ๆ: ' + bg.skills.join(', ')) : null,
        chips(from, cur, pick.n, v => { ch.bgSkills = v; changed(); })));
    }
    const f = D.feat[ch.bgFeat];
    out.push(acc({ key: 'bg-ofeat', title: 'Origin Feat (เลือก 1)', sub: f ? f.name + (featTh(f.id)?.s ? ' — ' + featTh(f.id).s : '') : 'ยังไม่ได้เลือก', need: !f, done: !!f, openSet },
      h('div.grid', origin.map(o => choiceCard({ id: o.id, iconName: 'feat', title: o.name, desc: featTh(o.id)?.s, selected: ch.bgFeat === o.id, onClick: () => { ch.bgFeat = o.id; changed(); } })))));
    if (bg.feature || bg.lang || bg.text) out.push(acc({ key: 'bg-orig', title: 'ข้อมูลต้นฉบับ (2014)', sub: bg.feature ? `ฟีเจอร์: ${bg.feature.name}` : null, openSet },
      D.th.backgrounds?.[bg.id]?.desc ? h('p', D.th.backgrounds[bg.id].desc) : null,
      bg.feature ? featureCard({ name: bg.feature.name, text: bg.feature.text, th: D.open.th.backgrounds?.[bg.id]?.f ? { s: D.open.th.backgrounds[bg.id].f } : null, tag: 'ฟีเจอร์ Background (2014) — ใช้ได้ถ้า DM อนุญาต', pack: bg.pack, open: bg.open }) : null,
      bg.lang ? h('p.small', h('b', 'ภาษา (2014): '), bg.lang, h('span.muted', ' — กฎ 2024 ไม่ให้ภาษาจาก Background ถาม DM ก่อน')) : null,
      original(bg.text, `ต้นฉบับ (EN) — ${bg.pack} (OGL)`)));
    return out;
  }

  function background() {
    const out = [intro('BACKGROUND · ภูมิหลัง', 'ตัวละครเคยทำอะไรมาก่อนออกผจญภัย Background ให้โบนัสค่าพลัง สกิล 2 อย่าง เครื่องมือ 1 อย่าง และ Origin Feat 1 อย่าง')];
    const grid = [h('div.grid', D.backgrounds.map(bg => choiceCard({
      id: bg.id, iconName: 'background', title: bg.name, sub: packSub(bg, bg.custom ? 'เลือกค่าพลัง + Feat เอง' : bg.abilities.map(a => ABIL_SHORT[a]).join(' · ')),
      desc: D.th.backgrounds?.[bg.id]?.desc, selected: c.bgId === bg.id,
      onClick: () => { if (c.bgId !== bg.id) { c.bgId = bg.id; c.abilities.bonus = {}; delete c.choices.bgAbil; delete c.choices.bgFeat; delete c.choices.bgSkills; c.abilities.plus2 = null; c.abilities.plus1 = null; c.equipment.bgOpt = 'A'; rebuildEquipment(c); } changed(); },
    }))), h('p.muted.small', 'ข้อมูลฟรี (SRD) มี Background 4 แบบ — Background อื่นจากหนังสือ (เช่น Guard) เพิ่มเองได้ที่ ', h('a', { href: '#/packs' }, 'Content Pack'))];
    const bg = bgOf(c);
    out.push(...[].concat(pickHead('pick-bg', bg && { icon: 'background', title: bg.name, sub: D.th.backgrounds?.[bg.id]?.desc }, 'Background', grid)));
    if (bg?.custom) out.push(...customBg(D.bg[c.bgId]));
    if (bg) {
      const A = c.abilities;
      const mode = A.bonusMode || '21';
      const setBonus = () => {
        A.bonus = {};
        if (mode === '111') bg.abilities.forEach(a => (A.bonus[a] = 1));
        else { if (A.plus2) A.bonus[A.plus2] = 2; if (A.plus1 && A.plus1 !== A.plus2) A.bonus[A.plus1] = 1; }
        changed();
      };
      const haveBonus = Object.values(A.bonus || {}).some(Boolean);
      if (bg.abilities.length === 3) out.push(acc({ key: 'bg-bonus', title: 'Ability Score Increases', sub: haveBonus ? Object.entries(A.bonus).filter(([, n]) => n).map(([a, n]) => `${ABIL_SHORT[a]} +${n}`).join(' · ') : 'โบนัสค่าพลัง', need: !haveBonus, done: haveBonus, openSet },
        h('p.muted', `เพิ่มค่าพลังจาก ${bg.abilities.map(a => ABIL_EN[a]).join(', ')} — จะเลือก +2 ให้ตัวหนึ่งกับ +1 ให้อีกตัว หรือ +1 ทั้งสามตัวก็ได้`),
        h('div.seg', [['21', '+2 / +1'], ['111', '+1 / +1 / +1']].map(([k, l]) => h('button.seg-btn' + (mode === k ? '.on' : ''), { type: 'button', onclick: () => { A.bonusMode = k; setBonus(); } }, l))),
        mode === '21' ? h('div.bonus-pick',
          h('label', '+2 ให้ ', h('select.inp', { onchange: e => { A.plus2 = e.target.value; setBonus(); } }, h('option', { value: '' }, '—'), bg.abilities.map(a => h('option', { value: a, selected: A.plus2 === a }, ABIL_EN[a])))),
          h('label', '+1 ให้ ', h('select.inp', { onchange: e => { A.plus1 = e.target.value; setBonus(); } }, h('option', { value: '' }, '—'), bg.abilities.filter(a => a !== A.plus2).map(a => h('option', { value: a, selected: A.plus1 === a }, ABIL_EN[a]))))) : null));
      out.push(acc({ key: 'bg-prof', title: 'Skill & Tool Proficiencies', sub: [...bg.skills, bg.tool.replace(/\s*\(see.*\)/, '')].join(' · '), openSet },
        h('dl.kv', h('dt', 'Skills'), h('dd', bg.skills.join(', ')), h('dt', 'Tool'), h('dd', bg.tool.replace(/\s*\(see.*\)/, ''))),
        bg.id === 'soldier' ? [h('p.muted', 'Gaming Set ที่เล่นเป็น:'), chips(['Dice Set', 'Dragonchess Set', 'Playing Card Set', 'Three-Dragon Ante Set'], c.choices.gamingSet ? [c.choices.gamingSet] : [], 1, v => { c.choices.gamingSet = v[0]; changed(); })] : null));
      const fid = featIdOf(bg.feat);
      const feat = D.feat[fid];
      if (bg.feat && (!bg.custom || fid === 'magic-initiate')) out.push(acc({ key: 'bg-feat', title: `Origin Feat: ${bg.feat}`, sub: featTh(fid)?.s, need: fid === 'magic-initiate' && !c.choices.miAb, openSet },
        fid === 'magic-initiate' ? miAbility() : null,
        feat ? featureCard({ name: bg.feat, text: feat.text, th: featTh(fid), tag: 'Origin Feat', full: ['feats', fid], pack: feat.pack }) : null));
    }
    out.push(h('h2.sec', 'รายละเอียดตัวละคร'), h('p.muted.small', 'ไม่บังคับ กรอกตอนไหนก็ได้ — แก้ทีหลังได้ที่แท็บ BACKGROUND และ NOTES ในใบตัวละคร'));
    for (const [k, en, th, el] of detailGroups(c.details, () => changed(false))) out.push(acc({ key: 'd-' + k, title: en, sub: th, openSet }, el));
    return out;
  }
  function miAbility() {
    return h('div', h('p.muted', 'Magic Initiate: เลือกค่าพลังที่ใช้ร่ายเวท — INT, WIS หรือ CHA (ส่วนใหญ่เลือกตัวที่สูงที่สุดในสามตัวนี้) แล้วไปเลือกเวทได้ที่ขั้น SPELLS'),
      chips(['int', 'wis', 'cha'], c.choices.miAb ? [c.choices.miAb] : [], 1, v => { c.choices.miAb = v[0]; changed(); }, { labels: { int: 'INT', wis: 'WIS', cha: 'CHA' } }));
  }

  // ---------- 3. Species ----------
  function species() {
    const out = [intro('SPECIES · เผ่าพันธุ์', 'เผ่าพันธุ์ของตัวละคร ให้ความสามารถพิเศษติดตัว เช่น มองในที่มืดได้ หรือพ่นไฟได้')];
    const grid = h('div.grid', D.species.map(s => choiceCard({
      id: s.id, iconName: s.id, title: s.name, sub: `${s.size.split(' ')[0]} · Speed ${s.speed}`,
      desc: ths(s.id).tag, selected: c.speciesId === s.id,
      onClick: () => { if (c.speciesId !== s.id) { c.speciesId = s.id; c.speciesOpt = {}; } changed(); },
    })));
    const sp = D.sp[c.speciesId];
    out.push(...[].concat(pickHead('pick-sp', sp && { icon: sp.id, title: sp.name, sub: ths(sp.id).desc }, 'Species', grid)));
    const nLang = 2 + ((classLevels(c).ranger || 0) >= 2 ? 2 : 0);
    const langAcc = () => acc({ key: 'sp-lang', title: `ภาษา (${c.languages.length}/${nLang})`, sub: ['Common', ...c.languages].join(', '), need: c.languages.length < nLang, done: c.languages.length >= nLang, openSet },
      h('p.muted', `รู้ภาษา Common อยู่แล้ว เลือกเพิ่มอีก ${nLang} ภาษา${nLang > 2 ? ' (รวม 2 ภาษาจาก Deft Explorer ของ Ranger)' : ''}`),
      chips(LANGS, c.languages, nLang, v => { c.languages = v; changed(); }));
    if (!sp) { out.push(langAcc()); return out; }
    const so = c.speciesOpt;
    const opt = SPECIES_OPT[sp.id];
    if (opt) {
      out.push(acc({ key: 'sp-opt', title: opt.label, sub: so[opt.key] || null, need: !so[opt.key], done: !!so[opt.key], openSet },
        chips(opt.opts.map(o => o[0]), so[opt.key] ? [so[opt.key]] : [], 1, v => { so[opt.key] = v[0]; changed(); },
          { labels: Object.fromEntries(opt.opts.map(o => [o[0], o[1] ? `${o[0]} (${o[1]})` : o[0]])) }),
        opt.ability ? [h('p.muted', 'ค่าพลังที่ใช้ร่ายเวทของเผ่า'), chips(['int', 'wis', 'cha'], so.ability ? [so.ability] : [], 1, v => { so.ability = v[0]; changed(); }, { labels: { int: 'INT', wis: 'WIS', cha: 'CHA' } })] : null));
    }
    if (SIZE_CHOICE.includes(sp.id)) out.push(acc({ key: 'sp-size', title: 'ขนาดตัว', sub: so.size || 'Medium', openSet }, chips(['Medium', 'Small'], [so.size || 'Medium'], 1, v => { so.size = v[0]; changed(); })));
    if (sp.id === 'elf') out.push(acc({ key: 'sp-keen', title: 'Keen Senses', sub: so.skill || 'เลือกสกิล 1 อย่าง', need: !so.skill, done: !!so.skill, openSet }, chips(['Insight', 'Perception', 'Survival'], so.skill ? [so.skill] : [], 1, v => { so.skill = v[0]; changed(); })));
    if (sp.id === 'human') {
      out.push(acc({ key: 'sp-skillful', title: 'Skillful', sub: so.skill || 'เลือกสกิลอะไรก็ได้ 1 อย่าง', need: !so.skill, done: !!so.skill, openSet }, chips(SKILLS.map(s => s[0]), so.skill ? [so.skill] : [], 1, v => { so.skill = v[0]; changed(); })));
      const origin = D.feats.filter(f => f.category === 'Origin');
      out.push(acc({ key: 'sp-versatile', title: 'Versatile: Origin Feat', sub: D.feat[so.feat]?.name || 'เลือก Origin Feat 1 อย่าง', need: !so.feat, done: !!so.feat, openSet },
        h('div.grid.grid-2', origin.map(f => choiceCard({
          id: f.id, iconName: 'feat', title: f.name, sub: packSub(f), desc: featTh(f.id)?.s, selected: so.feat === f.id,
          onClick: () => { so.feat = f.id; changed(); },
        }))),
        so.feat === 'magic-initiate' && !(bgOf(c)?.feat || '').startsWith('Magic Initiate') ? [h('p.muted', 'Magic Initiate: เลือกรายการเวท'),
          chips(['cleric', 'druid', 'wizard'], c.choices.miList ? [c.choices.miList] : [], 1, v => { c.choices.miList = v[0]; c.choices.miCantrips = []; c.choices.miSpell = null; changed(); }, { labels: { cleric: 'Cleric', druid: 'Druid', wizard: 'Wizard' } }), miAbility()] : null,
        so.feat === 'skilled' ? [h('p.muted', 'Skilled: เลือกสกิล 3 อย่าง (กฎจริงเลือกเครื่องมือแทนได้ — ถ้าเลือกเครื่องมือ จดไว้ในโน้ตได้เลย)'),
          counter((c.choices.skilled || []).length, 3), chips(SKILLS.map(s => s[0]), c.choices.skilled || [], 3, v => { c.choices.skilled = v; changed(); })] : null));
    }
    out.push(langAcc());
    out.push(h('h3.sec2', h('span', 'SPECIES TRAITS'), h('small', 'ความสามารถของเผ่า · แตะเพื่ออ่าน')));
    out.push(sp.traits.map(t => { const th = ths(sp.id).f?.[t.id]; return acc({ key: 'sp-t-' + t.id, title: t.name, sub: th?.s, openSet }, featureCard({ name: t.name, text: t.text, th, full: ['species', [sp.id, t.id]] })); }));
    return out;
  }

  // ---------- 4. ค่าพลัง ----------
  function abilities() {
    const A = c.abilities;
    const method = A.method || 'standard';
    const cls = D.cls[c.classId];
    const out = [intro('ABILITIES · ค่าพลัง', 'ตัวเลข 6 ตัวที่บอกว่าตัวละครเก่งด้านไหน ค่ายิ่งสูงตัวบวกยิ่งเยอะ (10 = +0, 12 = +1, 14 = +2, 16 = +3)')];
    if (cls) out.push(h('p.hint', `💡 ${cls.name} ใช้ ${cls.core['Primary Ability']} เป็นหลัก — ใส่ค่าที่สูงที่สุดไว้ตรงนั้น` + (thc(cls.id).abilityTip ? ` · ${thc(cls.id).abilityTip}` : '')));
    out.push(h('div.seg', [['standard', 'ชุดมาตรฐาน'], ['pointbuy', 'ซื้อแต้ม'], ['roll', 'ทอยเต๋าเอง']].map(([k, l]) => h('button.seg-btn' + (method === k ? '.on' : ''), {
      type: 'button', onclick: () => { A.method = k; A.assign = {}; ABIL.forEach(a => (A.base[a] = 8)); changed(); },
    }, l))));
    if (method === 'roll') {
      A.rolls = A.rolls || [];
      out.push(h('div.block',
        h('p', 'ทอย 4d6 แล้วตัดลูกที่ได้น้อยที่สุดทิ้ง เอาสามลูกที่เหลือมารวมกัน — ทำแบบนี้ 6 ครั้ง แล้วพิมพ์ผลรวมแต่ละครั้งลงช่องด้านล่าง (ค่าอยู่ระหว่าง 3–18)'),
        h('div.roll-inputs', Array.from({ length: 6 }, (_, i) => h('input.inp.num', { type: 'number', inputmode: 'numeric', min: 3, max: 18, value: A.rolls[i] ?? '', placeholder: `ครั้งที่ ${i + 1}`, 'aria-label': `ผลทอยครั้งที่ ${i + 1}`,
          onchange: e => {
            const v = parseInt(e.target.value, 10);
            A.rolls[i] = v >= 3 && v <= 18 ? v : null;
            if (A.rolls[i] == null && e.target.value) toast('ผลทอย 4d6 ตัดลูกต่ำสุด ต้องอยู่ระหว่าง 3 ถึง 18');
            for (const [a, idx] of Object.entries(A.assign || {})) if (idx === i) { if (A.rolls[i] == null) delete A.assign[a]; A.base[a] = A.rolls[i] ?? 8; }
            changed();
          } }))),
        h('p.muted.small', 'ทอยต่อหน้า DM หรือเพื่อน ๆ นะ 😉 จากนั้นเลือกว่าจะเอาเลขไหนไปใส่ค่าพลังตัวไหนในตารางด้านล่าง')));
    }
    const pool = method === 'roll' ? (A.rolls || []) : STANDARD_ARRAY;
    if (method === 'pointbuy') {
      const spent = ABIL.reduce((s, a) => s + (POINT_COST[A.base[a]] ?? 0), 0);
      out.push(h('p', 'แต้มที่เหลือ ', h('b.big', String(27 - spent)), ' / 27 (ค่าเริ่มต้นคือ 8 ซื้อได้สูงสุด 15)'));
    }
    const used = Object.values(A.assign || {});
    const rows = ABIL.map(a => {
      const bonus = A.bonus?.[a] || 0;
      const total = (A.base[a] || 8) + bonus;
      let input;
      if (method === 'pointbuy') {
        const spent = ABIL.reduce((s, k) => s + (POINT_COST[A.base[k]] ?? 0), 0);
        const v = A.base[a];
        input = h('div.stepper-inp',
          h('button.icon-btn', { disabled: v <= 8, onclick: () => { A.base[a] = v - 1; changed(); }, 'aria-label': 'ลด' }, '−'),
          h('b', String(v)),
          h('button.icon-btn', { disabled: v >= 15 || spent - POINT_COST[v] + POINT_COST[v + 1] > 27, onclick: () => { A.base[a] = v + 1; changed(); }, 'aria-label': 'เพิ่ม' }, '+'));
      } else {
        input = h('select.inp', { 'aria-label': ABIL_EN[a], onchange: e => {
          const i = e.target.value;
          A.assign = A.assign || {};
          if (i === '') delete A.assign[a]; else A.assign[a] = +i;
          A.base[a] = i === '' ? 8 : pool[+i];
          changed();
        } }, h('option', { value: '' }, '—'), pool.map((v, i) => (v == null ? null : h('option', { value: i, selected: A.assign?.[a] === i, disabled: used.includes(i) && A.assign?.[a] !== i }, String(v)))));
      }
      return h('div.ab-row',
        h('span.ab-ico', { html: iconSvg(a) }),
        h('div.ab-name', h('b', ABIL_EN[a]), h('small', ABIL_TH[a])),
        input,
        h('span.ab-bonus', bonus ? `+${bonus}` : ''),
        h('div.ab-total', h('b', String(total)), h('small', sign(mod(total)))));
    });
    out.push(h('div.ab-table', rows));
    if (!c.bgId) out.push(h('p.warn', 'ยังไม่ได้เลือก Background — โบนัส +2/+1 จะมาจาก Background'));
    return out;
  }

  // ---------- เลเวล 2+ ----------
  const openLv = new Set();
  function levels() {
    const x = compute(c);
    const out = [intro('LEVELS · เลเวลอัป', `ตั้งค่าทีละเลเวล (2–${c.level}): HP แบบค่าเฉลี่ยหรือทอยเอง, ASI / feat ที่เลเวล 4, 8, 12, 16 (บางคลาสได้เพิ่ม) และ Epic Boon ที่เลเวล 19 · อยากลองคลาสอื่นก็เปลี่ยนคลาสของเลเวลนั้นได้ (Multiclass)`)];
    out.push(h('div.ab-mini', ABIL.map(a => h('div', h('small', ABIL_SHORT[a]), h('b', sign(x.m[a])), h('span', String(x.score[a]))))),
      h('p.muted.small', `HP สูงสุด ${x.hpMax} · ${x.classLine}`));
    const miss = missing(c);
    for (const li of levelInfo(c).slice(1)) {
      const need = (li.asi || li.boon) && miss.some(t => t.endsWith(`(Lv ${li.lv})`));
      const open = openLv.has(li.i) || need;
      out.push(h('details.block.lv-card' + (need ? '.need' : ''), {
        open, ontoggle: e => { if (e.currentTarget.open) openLv.add(li.i); else openLv.delete(li.i); },
      }, h('summary', h('b', `Lv ${li.lv}`), ' ', h('span', levelSummary(c, li, x))),
        h('div.lv-body', levelEditor(c, li.i, () => { openLv.add(li.i); changed(); }))));
    }
    return out;
  }

  // ---------- 5. ของติดตัว ----------
  function equipment() {
    const cls = D.cls[c.classId], bg = bgOf(c);
    const e = c.equipment;
    const out = [intro('EQUIPMENT · ของติดตัว', 'เลือกชุดอุปกรณ์เริ่มต้นจากคลาสและ Background — ส่วนใหญ่ชุดสุดท้ายคือ "รับเป็นเงิน" แล้วไปซื้อของเองทีหลัง')];
    const optBlock = (title, text, key) => {
      const o = equipOptions(text);
      return section(title, h('div.grid.grid-1', Object.entries(o).map(([k, v]) => choiceCard({
        id: k, title: `ชุด ${k}`, desc: v, selected: (e[key] || 'A') === k,
        onClick: () => { e[key] = k; rebuildEquipment(c); changed(); },
      }))));
    };
    if (cls) out.push(optBlock(`จากคลาส ${cls.name}`, cls.core['Starting Equipment'], 'classOpt'));
    if (bg) out.push(optBlock(`จาก Background ${bg.name}`, bg.equipment, 'bgOpt'));
    if (!e.items.length && (cls || bg)) rebuildEquipment(c);
    const armors = e.items.filter(i => i.armor && i.armor !== 'shield');
    out.push(section('สวมใส่',
      h('label.row', 'เกราะ ', h('select.inp', { onchange: ev => { e.armor = ev.target.value || null; changed(); } },
        h('option', { value: '' }, 'ไม่ใส่เกราะ'),
        D.armor.filter(a => a.id !== 'shield').map(a => h('option', { value: a.id, selected: e.armor === a.id }, `${a.name} (AC ${a['armor class (ac)']})${armors.some(x => x.armor === a.id) ? ' ✓มีอยู่' : ''}`)))),
      h('label.row.check-row', h('input', { type: 'checkbox', checked: e.shield, onchange: ev => { e.shield = ev.target.checked; changed(); } }), ' ถือโล่ (Shield +2 AC)')));
    const x = compute(c);
    out.push(h('div.stats-row', statBox('AC', x.ac, x.acNote, 'ac'), statBox('เงิน', `${e.gp} GP`, null, 'coin')));
    x.warn.filter(w => /Armor|STR|Shield/.test(w)).forEach(w => out.push(h('p.warn', w)));
    out.push(section('รายการของ', h('ul.items', e.items.map(i => h('li', i.qty > 1 ? `${i.qty} × ${i.name}` : i.name, i.weapon ? h('i.tag', 'อาวุธ') : null, i.armor ? h('i.tag', 'เกราะ') : null)))));
    return out;
  }

  // ---------- เวท ----------
  const tag = (row, s) => { Object.assign(row.dataset, { lv: s.level, q: `${s.name} ${D.th.spells?.[s.id] || ''}`.toLowerCase() }); return row; };
  function spells() {
    const x = compute(c);
    const out = [intro('SPELLS · เวทมนตร์', 'Cantrip ร่ายได้ไม่จำกัดครั้ง ส่วนเวทเลเวล 1 ขึ้นไปต้องใช้ Spell Slot — แตะชื่อเวทเพื่ออ่านรายละเอียด แล้วกด + เพื่อเลือก')];
    const lvs = [...new Set(x.casting.filter(b => !b.fixed).flatMap(b => [0, ...Array.from({ length: b.maxLevel || 0 }, (_, i) => i + 1)]))].sort((a, b) => a - b);
    const chipBar = (opts, get, set) => h('div.chips.filter', opts.map(([id, l]) => h('button.chip' + (get() === id ? '.on' : ''), { 'data-v': id, onclick: e => {
      set(id); e.currentTarget.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', get() === b.dataset.v)); apply();
    } }, l)));
    out.push(h('div.sp-filter',
      h('input.inp.sp-q', { type: 'search', placeholder: 'ค้นหาเวท (ชื่ออังกฤษหรือคำไทย เช่น ไฟ รักษา)', value: ui.spQ, oninput: e => { ui.spQ = e.target.value; apply(); } }),
      chipBar([['all', 'ทุกเลเวล'], ...lvs.map(l => [String(l), l ? `Lv ${l}` : 'Cantrip'])], () => ui.spLv, v => { ui.spLv = v; }),
      chipBar([['sel', '✓ เฉพาะที่เลือกแล้ว']], () => (ui.spSel ? 'sel' : ''), () => { ui.spSel = !ui.spSel; })));
    const empty = h('p.muted.small.sp-empty', { hidden: true }, 'ไม่เจอเวทที่ตรงกับที่ค้นหา ลองพิมพ์คำอื่นหรือกด "ทุกเลเวล"');
    function apply() {
      const body = root.querySelector('.wz-body'), qq = ui.spQ.trim().toLowerCase();
      if (!body) return;
      let any = 0;
      body.querySelectorAll('.spell-row').forEach(r => {
        const d = r.dataset;
        const ok = (!qq || (d.q || '').includes(qq)) && (ui.spLv === 'all' || d.lv === ui.spLv) && (!ui.spSel || r.classList.contains('on'));
        r.hidden = !ok; any += ok;
      });
      body.querySelectorAll('.sp-group').forEach(g => { g.hidden = !g.querySelector('.spell-row:not([hidden])'); });
      body.querySelector('.sp-empty').hidden = !!any;
    }
    requestAnimationFrame(apply);
    for (const b of x.casting) {
      if (b.fixed || (!b.cantripMax && !b.preparedMax)) continue;
      out.push(h('h2.sec', b.source), h('p.muted', `ค่าพลังร่าย ${ABIL_SHORT[b.ab]} · Save DC ${b.dc} · Spell Attack ${sign(b.atk)}${b.cid && b.maxLevel ? ` · เตรียมได้ถึงเวทเลเวล ${b.maxLevel}` : ''}`));
      const always = new Set(b.always);
      if (b.always.length) out.push(section('เตรียมไว้เสมอ (ไม่นับโควตา)', h('div.sp-group', h('div.spell-list', b.always.map(id => tag(spellRow(D.spell[id], { badge: 'ติดตัว' }), D.spell[id]))))));
      const pick = (title, pool, value, max, onChange) => {
        const set = new Set(value);
        const levels = [...new Set(pool.map(s => s.level))].sort((a, b) => a - b);
        return h('div.block', h('h3', title, ' ', counter(set.size, max)),
          levels.map(lv => h('div.sp-group', levels.length > 1 ? h('h4.lv', lv === 0 ? 'Cantrips' : `Level ${lv}`) : null,
            h('div.spell-list', pool.filter(s => s.level === lv).map(s => tag(spellRow(s, {
              selected: set.has(s.id), disabled: set.size >= max,
              onToggle: () => { set.has(s.id) ? set.delete(s.id) : set.size < max && set.add(s.id); onChange([...set]); },
            }), s))))));
      };
      if (b.cid) {
        const sp = b.sel;
        const all = classSpellList(b.list, b.maxLevel);
        if (b.cantripMax) out.push(pick('Cantrips', all.filter(s => s.level === 0), sp.cantrips, b.cantripMax, v => { sp.cantrips = v; changed(); }));
        if (b.bookMax) {
          out.push(pick('Spellbook (สมุดเวท)', all.filter(s => s.level > 0), sp.book || [], b.bookMax, v => { sp.book = v; sp.prepared = sp.prepared.filter(id => v.includes(id)); changed(); }));
          out.push(pick('เตรียมวันนี้ (เลือกจากสมุดเวท)', (sp.book || []).map(id => D.spell[id]).filter(Boolean), sp.prepared, b.preparedMax, v => { sp.prepared = v; changed(); }));
        } else if (b.preparedMax) {
          out.push(pick('เวทที่เตรียมไว้', all.filter(s => s.level > 0 && !always.has(s.id)), sp.prepared, b.preparedMax, v => { sp.prepared = v; changed(); }));
        }
        if (b.secrets) out.push(h('p.muted.small', '✨ Magical Secrets: เลือกเวทจากรายการ Bard, Cleric, Druid และ Wizard ได้'));
        if (['cleric', 'druid', 'paladin', 'ranger', 'wizard'].includes(b.cid)) out.push(h('p.muted.small', '💡 คลาสนี้เปลี่ยนเวทที่เตรียมได้ทุกครั้งที่พักยาว'));
      } else if (b.key === 'fs') {
        out.push(pick('Cantrips', classSpellList(b.list, 0).filter(s => s.level === 0), b.chs.fsCantrips || [], 2, v => { b.chs.fsCantrips = v; changed(); }));
      } else if (b.key === 'mi') {
        const all = classSpellList(b.list, 1);
        out.push(pick('Cantrips', all.filter(s => s.level === 0), b.chs.miCantrips || [], 2, v => { b.chs.miCantrips = v; changed(); }));
        out.push(pick('เวทเลเวล 1 (ร่ายฟรีได้ 1 ครั้ง/พักยาว)', all.filter(s => s.level === 1), b.chs.miSpell ? [b.chs.miSpell] : [], 1, v => { b.chs.miSpell = v[0] || null; changed(); }));
      } else if (b.key === 'tome') {
        const all = classSpellList('any', 1);
        out.push(h('p.muted.small', 'Book of Shadows: cantrip 3 อย่าง + เวทเลเวล 1 ที่เป็น Ritual 2 อย่าง จากคลาสไหนก็ได้ (นับเป็นเวทของ Warlock)'));
        out.push(pick('Cantrips', all.filter(s => s.level === 0), b.chs.tomeCantrips || [], 3, v => { b.chs.tomeCantrips = v; changed(); }));
        out.push(pick('Ritual เลเวล 1', all.filter(s => s.level === 1 && s.ritual), b.chs.tomeRituals || [], 2, v => { b.chs.tomeRituals = v; changed(); }));
      }
    }
    out.push(empty);
    return out;
  }

  // ---------- สรุป ----------
  function done() {
    const x = compute(c);
    const miss = missing(c);
    return [
      intro(c.name || 'Character ไร้ชื่อ', [x.sp?.name, x.classLine, x.bg?.name].filter(Boolean).join(' · ')),
      h('div.stats-row', statBox('AC', x.ac, null, 'ac'), statBox('HP', x.hpMax, null, 'hp'), statBox('Speed', `${x.speed} ft`, null, 'speed'), statBox('Initiative', sign(x.init), null, 'init')),
      h('div.ab-mini', ABIL.map(a => h('div', h('small', ABIL_SHORT[a]), h('b', sign(x.m[a])), h('span', String(x.score[a]))))),
      miss.length ? h('div.block.warn-box', h('h3', 'ยังเลือกไม่ครบ'), h('ul', miss.map(m => h('li', m))), h('p.muted.small', 'เปิดใบตัวละครได้เลย แล้วค่อยกลับมาแก้ทีหลังก็ได้')) : h('p.ok', '✓ เลือกครบแล้ว พร้อมลุย!'),
      x.warn.length ? h('div.block', x.warn.map(w => h('p.warn', w))) : null,
    ];
  }

  draw();
}
