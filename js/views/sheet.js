// ใบตัวละครสำหรับใช้ตอนเล่น — โครงแบบ D&D Beyond: สแตททั้งหมดอยู่ส่วนบน + แท็บด้านล่าง
// ใช้เต๋าจริง: แตะอะไรก็ได้ = เปิดการ์ดบอกสูตร (เว็บไม่ทอยให้)
import { srcTag, featFull, traitFull } from '../packs.js';
import { D, loadAnimals, loadItems } from '../data.js';
import { h, iconSvg, sheet, toast, sign, confirmSheet, uid } from '../util.js';
import { md } from '../md.js';
import * as S from '../store.js';
import { ABIL, ABIL_EN, ABIL_SHORT, ABIL_TH, compute, missing, rebuildEquipment, levelInfo, chOf, hitDieAvg, itemWeight, carry } from '../rules.js';
import { openLevelUp, levelSummary, previewNext } from './levelup.js';
import { classFeatureCard, featureCard, spellRow, LEVEL_TH, stubSubBox, TYPE_LABEL, detailGroups, detailField } from './parts.js';
import { formula, explain, attackBody, dmgText, helpBody, infoBtn, spellMath, fxMark, fxNode, featureMath } from './explain.js';
import { COND_FX, flagSum } from '../fx.js';
import { showTerm } from './glossary.js';
import * as T from './turn.js';
import { setDice, diceOn, die as rollDie, rollD20, show } from '../dice.js';
import { charText } from './card.js';

const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
const TABS = [['main', 'MAIN', 'ข้อมูลหลัก'], ['actions', 'ACTIONS', 'การกระทำ'], ['spells', 'SPELLS', 'เวท'], ['inventory', 'INVENTORY', 'ของในกระเป๋า'], ['features', 'FEATURES & TRAITS', 'ความสามารถ'], ['background', 'BACKGROUND', 'ภูมิหลัง'], ['notes', 'NOTES', 'โน้ต'], ['extras', 'EXTRAS', 'สัตว์คู่ใจ']];
const OLD_TAB = { skills: 'main', gear: 'inventory' };
const head = (en, th, ...rest) => h('h3.sec2', h('span', en), h('small', th), ...rest);
// เฟส 10: ไอคอนโล่ของเซฟ · ชื่อไทยสั้นของค่าพลัง · ค่ารองแนะนำต่อคลาส (☆)
const infoBtnFn = fn => h('button.info-btn', { 'aria-label': 'ความหมาย', onclick: e => { e.stopPropagation(); fn(); } }, 'ⓘ');
const headK = (k, en, th, ...rest) => h('h3.sec2.k-' + k, h('span', en), h('small', th), ...rest);
const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>';
const SHIELD_OK = SHIELD.replace('</svg>', '<path d="M8.5 12l2.5 2.5 4.5-4.5"/></svg>');
const SAVE_TH = { str: 'พละกำลัง', dex: 'ว่องไว', con: 'อึด', int: 'ฉลาด', wis: 'ปัญญา', cha: 'เสน่ห์' };
const SUB_AB = { barbarian: 'con', bard: 'dex', cleric: 'con', druid: 'con', fighter: 'con', monk: 'wis', paladin: 'cha', ranger: 'wis', rogue: 'con', sorcerer: 'con', warlock: 'con', wizard: 'con' };
let obs; // IntersectionObserver ของกล่อง HP (โชว์แถบย่อตอนเลื่อนพ้น)

export function renderSheet(root, c, tab, nav) {
  tab = OLD_TAB[tab] || tab;
  let cur = TABS.some(t => t[0] === tab) ? tab : 'main';
  const P = c.play = Object.assign({ hp: null, temp: 0, hdUsed: 0, slots: {}, res: {}, conditions: [], death: { s: 0, f: 0 }, inspiration: false }, c.play);
  if (!P.hdu) { P.hdu = {}; const d0 = D.cls[c.classId]?.hitDie; if (P.hdUsed && d0) P.hdu[d0] = P.hdUsed; }
  const Dt = c.details = Object.assign({}, c.details);
  if (c.look) { if (!Dt.appearance) Dt.appearance = c.look; delete c.look; S.autosave(c); }
  if (P.conditions.includes('Exhaustion')) { P.exh = Math.max(1, P.exh || 0); P.conditions = P.conditions.filter(k => k !== 'Exhaustion'); }
  const INCAP = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];
  const dropConc = why => { if (!P.conc) return; const n = D.spell[P.conc]?.name || P.conc; T.dropFx(P, e => e.conc === P.conc); P.conc = null; toast(`🧠 สมาธิ ${n} หลุดแล้ว${why ? ' — ' + why : ''}`); };
  const hdUsedAll = () => Object.values(P.hdu).reduce((s, n) => s + n, 0);
  const save = () => S.autosave(c);
  const redraw = () => draw();
  const done = () => { save(); redraw(); };
  setDice({ on: !!c.settings?.online, name: c.name || 'Character', onAttack: () => { if (!P.turn) return ''; const m = T.attack(P, curX); done(); return m; } });
  let curX = null;
  const ui = { act: 'all', feat: 'all', spQ: '', spLv: 'all', spF: '' };

  function draw() {
    if (c.theme) { document.documentElement.style.setProperty('--gold', c.theme); document.documentElement.style.setProperty('--gold2', `color-mix(in srgb, ${c.theme} 60%, var(--mixbase))`); }
    else for (const k of ['--gold', '--gold2']) document.documentElement.style.removeProperty(k);
    const e = c.equipment;
    if (!e.items.length && !e.gp && (c.classId || c.bgId) && !e.touched) { rebuildEquipment(c); save(); }
    const x = curX = compute(c);
    if (P.hp == null || P.hp > x.hpMax) P.hp = x.hpMax;
    const y = window.scrollY;
    const miss = missing(c);
    if (!tabsNow().some(t => t[0] === cur)) cur = 'main';
    const tabsEl = h('nav.tabs', { role: 'tablist' }, tabsNow().map(([id, en, th]) => h('button.tab' + (cur === id ? '.on' : ''), {
      role: 'tab', 'aria-selected': cur === id ? 'true' : 'false', onclick: () => go(id),
    }, h('b', en), h('small', th))));
    const body = h('section.sh-body', ({ main, actions, spells, inventory, features, background, notes, extras })[cur](x));
    swipe(body);
    root.replaceChildren(...[
      header(x),
      miss.length && !combat() ? h('button.miss-bar', { onclick: () => nav(`#/edit/${c.id}/class`) }, `⚠ ยังเลือกไม่ครบ ${miss.length} อย่าง — แตะเพื่อไปเลือกให้ครบ`) : null,
      top(x), h('div.stk-anchor'),
      h('div.sticky-stats', mini(x), T.turnBar(c, x, P, save, redraw), T.hotbar(c, x, P, save, redraw), tabsEl), body].filter(Boolean));
    window.scrollTo(0, y);
    const on = tabsEl.querySelector('.on');
    if (on) tabsEl.scrollLeft = on.offsetLeft - (tabsEl.clientWidth - on.offsetWidth) / 2;
    // แถบย่อ HP/AC/Init/Speed โชว์เมื่อแถบเทิร์น+แท็บติดขอบบนแล้ว (การ์ด HP เลื่อนพ้นจอ)
    obs?.disconnect();
    const anc = root.querySelector('.stk-anchor'), m = root.querySelector('.mini'), stkTop = stickyTop();
    if (anc && m && 'IntersectionObserver' in window) {
      obs = new IntersectionObserver(([en]) => m.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top <= stkTop + 1), { rootMargin: `-${stkTop + 1}px 0px 0px 0px` });
      obs.observe(anc);
    }
  }

  function go(id) {
    if (id === cur) return;
    cur = id; history.replaceState(null, '', `#/c/${c.id}/${id}`); draw();
    const anc = root.querySelector('.stk-anchor');
    const top0 = anc ? anc.getBoundingClientRect().top + window.scrollY - stickyTop() : 0;
    if (window.scrollY > top0) window.scrollTo(0, top0);
  }
  const stickyTop = () => parseFloat(getComputedStyle(root.querySelector('.sticky-stats') || document.body).top) || 0;
  // ปัดซ้าย/ขวาเปลี่ยนแท็บ
  function swipe(el) {
    let sx = 0, sy = 0, ok = false;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; ok = !e.target.closest('input, textarea, select, .chips, .no-swipe'); }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!ok) return;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const T2 = tabsNow(), i = T2.findIndex(z => z[0] === cur) + (dx < 0 ? 1 : -1);
      if (T2[i]) go(T2[i][0]);
    }, { passive: true });
  }

  // ---------- หัว ----------
  // โหมดสู้ (เฟส 5): เหลือแต่ของที่ใช้ตอนต่อสู้ — จำแยกตามตัวละครใน c.settings.view
  const combat = () => c.settings?.view === 'combat';
  const tabsNow = () => (combat() ? TABS.filter(([id]) => id === 'main' || id === 'actions' || (id === 'spells' && curX?.casting.length) || (id === 'extras' && (c.extras?.length || curX?.CLs.druid >= 2))) : TABS);
  function toggleView() {
    c.settings = { ...(c.settings || {}), view: combat() ? null : 'combat' };
    save(); redraw(); window.scrollTo(0, 0);
    toast(combat() ? '⚔️ โหมดสู้: เหลือแต่ของที่ใช้ตอนต่อสู้ · กด 📄 เพื่อกลับใบเต็ม' : '📄 กลับมาใบตัวละครเต็มแล้ว');
  }
  function header(x) {
    const subtitle = [x.sp ? x.sp.name + (c.speciesOpt?.lineage ? ` (${c.speciesOpt.lineage})` : '') : null, x.classLine || '?', x.CL >= 3 && x.sub ? x.sub.name : null, x.bg?.name].filter(Boolean).join(' · ');
    return h('header.sh-head',
      h('a.icon-btn.back-btn', { href: '#/', 'aria-label': 'กลับหน้ารายชื่อตัวละคร' }, '‹'),
      h('button.sh-ico' + (c.portrait ? '.has-pic' : ''), { onclick: lookSheet, 'aria-label': 'รูปและสีประจำตัว' }, c.portrait ? h('img', { src: c.portrait, alt: '' }) : h('span', { html: iconSvg(c.classId || 'd20') })),
      h('div.sh-title', h('h1', c.name || 'Character ไร้ชื่อ'), h('p', subtitle)),
      h('button.icon-btn.rest-one', { onclick: () => restSheet(x), 'aria-label': 'พักผ่อน', title: 'พักสั้น / พักยาว' }, h('span', { html: iconSvg('long') })),
      h('button.icon-btn.view-btn' + (combat() ? '.on' : ''), { onclick: toggleView, 'aria-label': combat() ? 'กลับใบเต็ม' : 'โหมดสู้', title: combat() ? 'กลับใบเต็ม' : 'โหมดสู้' }, combat() ? '📄' : '⚔️'),
      h('a.icon-btn.help-btn', { href: `#/help/${c.id}`, 'aria-label': 'เล่นยังไง' }, '❓'),
      h('button.icon-btn', { 'aria-label': 'เมนู', onclick: menu }, '⋯'));
  }
  function restSheet(x) {
    const close = sheet('พักผ่อน', h('div.menu-list',
      h('button.menu-item', { onclick: () => { close(); shortRest(x); } }, h('span', { html: iconSvg('short') }), h('span', h('b', 'พักสั้น (Short Rest)'), h('small', ' — ราว 1 ชั่วโมง ใช้ Hit Dice ฟื้น HP และฟื้นบางความสามารถ'))),
      h('button.menu-item', { onclick: () => { close(); longRest(x); } }, h('span', { html: iconSvg('long') }), h('span', h('b', 'พักยาว (Long Rest)'), h('small', ' — นอน 8 ชั่วโมง ฟื้น HP เต็ม สลอตเวท และเกือบทุกอย่าง')))));
  }
  // รูปตัวละคร (ย่อเหลือ 256px เก็บในเครื่อง) + สีประจำตัว
  const THEMES = [['', 'แดง (ค่าเริ่มต้น)'], ['#e8833a', 'ส้ม'], ['#d4a73a', 'ทอง'], ['#4caf6e', 'เขียว'], ['#3f8fd8', 'ฟ้า'], ['#9b6be0', 'ม่วง'], ['#e05c9a', 'ชมพู'], ['#9aa0a6', 'เทา']];
  function lookSheet() {
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const img = await createImageBitmap(f), k = Math.min(1, 256 / Math.max(img.width, img.height));
        const cv = h('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        c.portrait = cv.toDataURL('image/jpeg', 0.85); S.save(c); redraw(); close(); toast('ใส่รูปแล้ว');
      } catch { toast('เปิดรูปนี้ไม่ได้ ลองรูปอื่นดูนะ'); }
    } });
    const close = sheet('รูปและสีประจำตัว', h('div.look',
      h('div.look-pic', c.portrait ? h('img', { src: c.portrait, alt: 'รูปตัวละคร' }) : h('span', { html: iconSvg(c.classId || 'd20') })),
      h('div.row.wrap', h('button.btn.primary', { onclick: () => file.click() }, c.portrait ? 'เปลี่ยนรูป' : 'เลือกรูปจากเครื่อง'),
        c.portrait ? h('button.btn', { onclick: () => { delete c.portrait; S.save(c); redraw(); close(); } }, 'เอารูปออก') : null, file),
      h('p.muted.small', 'รูปจะถูกย่อให้เล็กแล้วเก็บไว้ในเครื่องนี้ · ลิงก์แชร์จะไม่มีรูปติดไป (ลิงก์จะยาวเกิน) แต่ไฟล์สำรองมีรูปไปด้วย'),
      h('h4', 'สีประจำตัวละคร'),
      h('div.swatches', THEMES.map(([v, l]) => h('button.swatch' + ((c.theme || '') === v ? '.on' : ''), { 'aria-label': l, title: l, style: { background: v || '#e0464a' },
        onclick: () => { if (v) c.theme = v; else delete c.theme; S.save(c); redraw(); close(); lookSheet(); } }))),
      h('p.muted.small', 'สีนี้ใช้เฉพาะตอนเปิดใบของตัวละครนี้ ช่วยให้แยกตัวละครออกง่ายเวลามีหลายตัว')));
  }
  function mini(x) {
    return h('button.mini', { onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), 'aria-label': 'เลื่อนขึ้นไปดู HP' },
      h('span.mi.mi-hp', h('i', 'HP '), h('b', String(P.hp)), `/${x.hpMax}`, P.temp ? h('em', ` +${P.temp}`) : null),
      h('span.mi.mi-ac', h('i', 'AC '), h('b', String(x.ac))),
      h('span.mi.mi-init', h('i', 'Init '), h('b', sign(x.init))),
      h('span.mi.mi-spd', h('b', String(x.speed)), ' ft'),
      P.wild && wildOf() ? h('span', '🐾 ', h('b', wildOf().name)) : null,
      P.conc ? h('span', '🧠 ', h('b', D.spell[P.conc]?.name || '')) : null,
      P.conditions.length || P.exh ? h('span.bad', '⚠ ' + [...P.conditions, P.exh ? `Exhaustion ${P.exh}` : null].filter(Boolean).join(', ')) : null);
  }

  function menu() {
    const close = sheet('เมนู', h('div.menu-list',
      h('button.menu-item', { onclick: () => { close(); openLevelUp(c, () => { S.save(c); redraw(); }); } }, `⬆️ เลเวลอัป (→ Lv ${c.level + 1})`),
      c.level > 1 ? h('button.menu-item', { onclick: async () => { close(); await levelDown(); } }, `↩️ ย้อนเลเวล (กลับเป็น Lv ${c.level - 1})`) : null,
      h('button.menu-item', { onclick: () => { close(); nav(`#/edit/${c.id}/basic`); } }, '✏️ แก้ไขตัวละคร'),
      h('button.menu-item', { onclick: () => { close(); nav(`#/card/${c.id}`); } }, '🪪 การ์ดสรุปตัวละคร (แชร์เป็นรูป / ลิงก์)'),
      h('button.menu-item', { onclick: async () => { close(); await share(); } }, '🔗 แชร์ลิงก์ตัวละคร'),
      h('button.menu-item', { onclick: () => { close(); S.exportFile([c]); toast('ดาวน์โหลดไฟล์สำรองแล้ว'); } }, '💾 ดาวน์โหลดไฟล์สำรอง'),
      h('button.menu-item', { onclick: () => { close(); window.print(); } }, '🖨️ ปริ้น / เซฟเป็น PDF'),
      h('button.menu-item', { onclick: () => { close(); document.querySelector('#theme-btn')?.click(); } }, '🌗 สลับธีม กลางวัน / กลางคืน / ตามเครื่อง'),
      h('button.menu-item', { onclick: () => { close(); toggleOnline(); } }, c.settings?.online ? '🎲 โหมดออนไลน์: เปิดอยู่ (กดเพื่อปิด)' : '🎲 เปิดโหมดออนไลน์ (ทอยเต๋าในเว็บ)'),
      h('button.menu-item', { onclick: () => { close(); copyChar(); } }, '📋 คัดลอกตัวละครเป็นข้อความ (แปะให้ AI DM)'),
      h('button.menu-item', { onclick: () => { close(); customSheet(); } }, '🛠️ ปรับค่าเอง (ของวิเศษ / สิ่งที่ DM ให้)'),
      h('button.menu-item', { onclick: () => { close(); const copy = structuredClone(c); delete copy.id; copy.name = (c.name || 'Character ') + ' (สำเนา)'; S.save(copy); nav(`#/c/${copy.id}`); toast('ทำสำเนาแล้ว'); } }, '📄 ทำสำเนา'),
      h('button.menu-item.danger', { onclick: async () => { close(); if (await confirmSheet('ลบตัวละคร?', `ลบ "${c.name || 'Character ไร้ชื่อ'}" ออกจากเครื่องนี้ (ถ้าไม่ได้สำรองไว้จะกู้คืนไม่ได้)`, 'ลบเลย')) { S.remove(c.id); nav('#/'); } } }, '🗑️ ลบตัวละคร')));
  }

  function toggleOnline() {
    const on = !c.settings?.online;
    c.settings = { ...(c.settings || {}), online: on || null };
    setDice({ on }); S.save(c); redraw();
    toast(on ? '🎲 โหมดออนไลน์: กดดูค่าไหนก็มีปุ่มทอยให้ · ผลทอยกดคัดลอกไปแปะในแชตได้' : 'ปิดโหมดออนไลน์แล้ว — กลับไปทอยเต๋าจริง');
  }

  async function copyChar() {
    const t = charText(c);
    try { await navigator.clipboard.writeText(t); toast('คัดลอกข้อมูลตัวละครแล้ว แปะให้ AI DM ได้เลย'); }
    catch { sheet('คัดลอกข้อความนี้', h('textarea.inp', { rows: 14, readonly: true, onfocus: e => e.target.select() }, t)); }
  }

  async function levelDown() {
    const li = levelInfo(c).at(-1);
    if (!await confirmSheet(`ย้อนเป็นเลเวล ${c.level - 1}?`, `ลบเลเวล ${c.level} (${levelSummary(c, li)}) ออก — ตัวเลือกของเลเวลนี้ (HP / ASI / feat) จะหายไปด้วย`, 'ย้อนเลเวล')) return;
    const before = compute(c).hpMax;
    c.levels.pop();
    c.level = c.levels.length;
    P.hp = Math.max(0, Math.min(compute(c).hpMax, (P.hp ?? before) - (before - compute(c).hpMax)));
    const x2 = compute(c);
    for (const k of Object.keys(P.hdu)) P.hdu[k] = Math.min(P.hdu[k], x2.hitDice.filter(hd => hd.die === +k).reduce((t, hd) => t + hd.n, 0));
    S.save(c); redraw(); toast(`กลับเป็นเลเวล ${c.level} แล้ว`);
  }

  async function share() {
    const url = await S.shareUrl(c);
    if (navigator.share) {
      try { await navigator.share({ title: c.name || 'ตัวละคร', text: `ตัวละคร ${c.name || ''}`, url }); return; } catch { /* ยกเลิก */ }
    }
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว ส่งเข้า LINE ได้เลย'); }
    catch { sheet('ลิงก์ตัวละคร', h('textarea.inp', { rows: 5, readonly: true }, url)); }
  }

  // ---------- ส่วนบน: สแตททั้งหมด ----------
  const box = (en, th, val, unit, onclick, cls = '') => h('button.box' + cls, { onclick }, h('small.en', en), h('b', val, unit ? h('span.unit', unit) : null), th ? h('small.th', th) : null);

  // เหนือแท็บ: กล่อง HP + Death Saves + สถานะที่ติด + ป้ายร่างสัตว์/สมาธิ (ต้องเห็นทุกแท็บ)
  function top(x) {
    const nCond = P.conditions.length + (P.exh ? 1 : 0);
    const spdTxt = [['climb', 'ปีน'], ['swim', 'ว่าย'], ['fly', 'บิน']].filter(([k]) => x.speeds[k]).map(([k, l]) => `${l} ${x.speeds[k]}`).join(' · ');
    return h('section.sh-top',
      hpBox(x),
      h('div.stat3',
        h('div.st-ac', box('AC', 'Armor Class', String(x.ac), null, () => explain('Armor Class (AC)', [
          h('div.formula', h('div.f-main', h('span', 'AC'), h('b', String(x.ac))), h('div.f-parts', h('span', x.acNote))),
          ...helpBody('ac'), h('p.muted.small', 'เปลี่ยนเกราะหรือโล่ได้ที่ขั้น EQUIPMENT ในหน้าแก้ไข')]))),
        h('div.st-init', box('INIT', 'ลำดับเริ่ม', [sign(x.init), fxMark(x.rf('init', 'dex'))], null, () => explain('Initiative', [
          formula('ทอย Initiative', x.init, x.initParts, x.rf('init', 'dex')), ...helpBody('init')]))),
        h('div.st-spd', box('SPEED', spdTxt || 'ความเร็ว', String(x.speed), 'ft', () => explain('Speed', [
          h('div.formula', h('div.f-main', h('span', 'เดินได้ต่อเทิร์น'), h('b', `${x.speed} ft`)), h('div.f-parts', h('span', `= ${Math.floor(x.speed / 5)} ช่องบนแผนที่ (ช่องละ 5 ฟุต)`), x.sp ? h('span', `${x.sp.name} เริ่มต้น ${x.sp.speed} ft`) : null, x.exh ? h('span', `Exhaustion ${x.exh} `, h('b', `−${5 * x.exh}`)) : null)),
          spdTxt ? h('p', h('b', 'ความเร็วแบบอื่น: '), spdTxt) : null,
          x.speedNotes.map(n => h('p.small', '💡 ' + n)),
          ...helpBody('speed')])))),
      P.hp === 0 ? deathBox() : null,
      nCond ? h('p.cond-line', '⚠ ติดอยู่: ', [...P.conditions.map(k => h('button.link', { onclick: () => showTerm(k.toLowerCase()) }, k)),
        P.exh ? h('button.link', { onclick: () => condSheet() }, `Exhaustion ${P.exh}`) : null].filter(Boolean).flatMap((b, i) => (i ? [', ', b] : [b]))) : null,
      wildBanner(x),
      P.conc ? h('div.conc-chip', h('span', '🧠 Concentration: ', h('b', D.spell[P.conc]?.name || P.conc)),
        h('button.link', { onclick: () => explain('Concentration', helpBody('conc')) }, 'คืออะไร'),
        h('button.btn.small', { onclick: () => { dropConc('เลิกเอง'); done(); } }, 'เลิกใช้สมาธิ')) : null);
  }
  // แท็บ MAIN: ค่าพลัง PB/Speed Init/AC เซฟ ประสาทสัมผัส ความชำนาญ สกิล
  function main(x) {
    const sk = n => 10 + (x.skills.find(s => s.name === n)?.bonus || 0) + passAdj(x, n);
    const spdTxt = [['climb', 'ปีน'], ['swim', 'ว่าย'], ['fly', 'บิน']].filter(([k]) => x.speeds[k]).map(([k, l]) => `${l} ${x.speeds[k]}`).join(' · ');
    const DEF_TH = { res: 'Resistance (โดนครึ่งเดียว)', imm: 'Immunity (ไม่โดนเลย)', vul: 'Vulnerability (โดน 2 เท่า)' };
    const defMain = x.defenses.filter(d => !d.when);
    const nCond = P.conditions.length + (P.exh ? 1 : 0);
    const cm = combat();
    // ค่าพลังสำคัญ: ค่าพลังหลักของทุกคลาสที่มี + ค่าพลังที่ใช้ร่ายเวท
    const EN = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
    const keyAb = new Set([...Object.keys(x.CLs || {}).flatMap(id => (D.cls[id]?.core?.['Primary Ability'] || '').toLowerCase().split(/\s+(?:or|and)\s+|,\s*/).map(w => EN[w.trim()])), ...x.casting.map(b => b.ab)].filter(Boolean));
    const subAb = new Set(Object.keys(x.CLs || {}).map(id => SUB_AB[id]).filter(a => a && !keyAb.has(a)));
    if (!subAb.size && !keyAb.has('con')) subAb.add('con');
    return h('div.sh-main' + (cm ? '.combat' : ''),
      cm ? null : head('ABILITY SCORES', 'ค่าพลัง', h('span.star-legend', h('i.st1', '★'), ' หลัก  ', h('i.st2', '☆'), ' รอง')),
      cm ? null : h('div.abil6', ABIL.map(a => h('button.ab6', { onclick: () => abilInfo(a, x) },
        h('small', ABIL_EN[a].toUpperCase(), keyAb.has(a) ? h('i.st1', ' ★') : subAb.has(a) ? h('i.st2', ' ☆') : null), h('b', sign(x.m[a])), h('span.oval', `ค่า ${x.score[a]}`)))),
      h('div.box4.sub4',
        box('PROFICIENCY', 'โบนัสชำนาญ', sign(x.pb), null, () => explain('Proficiency Bonus', [
          h('div.formula', h('div.f-main', h('span', `เลเวลรวม ${x.L}`), h('b', sign(x.pb))), h('div.f-parts', h('span', 'Lv 1–4 +2 · 5–8 +3 · 9–12 +4 · 13–16 +5 · 17–20 +6'))),
          ...helpBody('pb')])),
        box('HEROIC', 'Inspiration', P.inspiration ? '✨' : '—', null, () => explain('Heroic Inspiration', [
          h('p.formula', P.inspiration ? '✨ ตอนนี้มีอยู่ 1 ครั้ง' : 'ตอนนี้ยังไม่มี'), ...helpBody('insp')], [
          { label: P.inspiration ? 'ใช้ไปแล้ว (เอาออก)' : 'ได้รับ Heroic Inspiration', primary: true, onClick: () => { P.inspiration = !P.inspiration; done(); } }]), P.inspiration ? '.lit' : ''),
        box('DEFENSES', defMain.length ? defMain.map(d => d.type).join(', ') : 'ต้านทาน', defMain.length ? String(defMain.length) : '—', null, () => explain('Defenses', [
          ...['imm', 'res', 'vul'].map(k => { const L = x.defenses.filter(d => d.kind === k); return L.length ? [h('h4', DEF_TH[k]), h('ul', L.map(d => h('li', h('b', d.type), ` — ${d.src}${d.when ? ` (${d.when})` : ''}`)))] : null; }),
          x.condImm.length ? [h('h4', 'ไม่ติดสถานะ (Condition Immunity)'), h('ul', x.condImm.map(d => h('li', h('b', d.type), ` — ${d.src}`)))] : null,
          !x.defenses.length && !x.condImm.length ? h('p.formula', 'ตอนนี้ยังไม่มีดาเมจที่ทนได้เป็นพิเศษ') : null,
          ...helpBody('defenses'),
          h('p.muted.small', 'ได้ Resistance จากของวิเศษหรือฟีเจอร์ที่เว็บไม่ได้คำนวณให้? เพิ่มเองได้ที่เมนู ⋯ → ปรับค่าเอง')])),
        box('CONDITIONS', 'สถานะ', nCond ? String(nCond) : '—', null, () => condSheet(), nCond ? '.bad' : '')),
      condFx(),
      head('SAVING THROWS', 'การทอยเซฟ', infoBtn('save')),
      h('div.card.list.saves-list', [...x.saves].sort((a, b) => (b.prof ? 1 : 0) - (a.prof ? 1 : 0)).map(sv => h('button.sv-row' + (sv.prof ? '.prof' : ''), { onclick: () => explain(`${ABIL_EN[sv.ab]} Saving Throw`, [
        formula('ทอยเซฟ', sv.bonus, sv.parts, x.rf('save', sv.ab), 'd20', { tag: `${ABIL_EN[sv.ab]} Save` }),
        D.th.help?.abilities?.[sv.ab] ? h('p.th', h('b', `เซฟ ${ABIL_SHORT[sv.ab]} ใช้ตอน: `), D.th.help.abilities[sv.ab].save) : null,
        ...helpBody('save').slice(1),
        sv.prof ? h('p.muted.small', '● เราชำนาญเซฟนี้ จึงได้บวก Proficiency ด้วย') : null]) },
        h('span.sv-ico', { html: sv.prof ? SHIELD_OK : SHIELD }), h('span.sv-name', h('b', ABIL_SHORT[sv.ab]), h('small', SAVE_TH[sv.ab] + (sv.prof ? ' · ชำนาญ' : ''))), h('b.sv-val', sign(sv.bonus), fxMark(x.rf('save', sv.ab)))))),
      x.saveNotes.length ? h('ul.save-notes', x.saveNotes.map(n => h('li', n))) : null,
      cm ? null : head('SENSES', 'ประสาทสัมผัส', infoBtn('passive')),
      cm ? null : h('div.card.list.senses',
        senseRow(`Passive Perception`, 'WIS · สังเกตเห็นอะไรโดยไม่ต้องทอย', sk('Perception'), 'Perception'),
        senseRow(`Passive Insight`, 'WIS · จับได้ว่าใครโกหก', sk('Insight'), 'Insight'),
        senseRow(`Passive Investigation`, 'INT · หากับดัก ของซ่อน', sk('Investigation'), 'Investigation'),
        x.darkvision ? h('button.sense', { onclick: () => explain('Darkvision', [h('p.formula', `ระยะ ${x.darkvision} ฟุต`), ...helpBody('darkvision')]) }, h('div', h('b', 'Darkvision'), h('small', 'มองในที่มืดได้เหมือนแสงสลัว (เห็นเป็นขาวดำ)')), h('span.sv', `${x.darkvision} ft`)) : null,
        x.blindsight ? h('button.sense', { onclick: () => explain('Blindsight', [h('p.formula', `ระยะ ${x.blindsight} ฟุต`), ...helpBody('blindsight')]) }, h('div', h('b', 'Blindsight'), h('small', 'รับรู้รอบตัวได้โดยไม่ต้องใช้ตา')), h('span.sv', `${x.blindsight} ft`)) : null,
        x.truesight ? h('button.sense', { onclick: () => explain('Truesight', [h('p.formula', `ระยะ ${x.truesight} ฟุต`), ...helpBody('truesight')]) }, h('div', h('b', 'Truesight'), h('small', 'มองทะลุภาพลวง ความมืดเวท และร่างแปลง')), h('span.sv', `${x.truesight} ft`)) : null),
      cm ? null : head('PROFICIENCIES & TRAINING', 'สิ่งที่เราชำนาญ'),
      cm ? null : h('dl.kv.profs',
        h('dt', 'Armor'), h('dd', x.training.join(', ') || '—'),
        h('dt', 'Weapons'), h('dd', x.cls?.core['Weapon Proficiencies'] + (x.weaponRule === 'all' && !/Martial/.test(x.cls?.core['Weapon Proficiencies']) ? ' + Martial' : '') || '—'),
        h('dt', 'Tools'), h('dd', [x.cls?.core['Tool Proficiencies'], x.bg?.tool].filter(t => t && t !== 'None').join(', ').replace(/\s*\(see.*?\)/g, '') || '—'),
        h('dt', 'Languages'), h('dd', x.langs.join(', ')),
        x.customProfs ? [h('dt', 'อื่น ๆ'), h('dd', x.customProfs)] : null),
      cm ? null : head('SKILLS', 'สกิล', infoBtn('pb')),
      cm ? null : h('div.card.list.skills-tb',
        h('div.sk-row.sk-head', h('small', 'PROF'), h('small', 'MOD'), h('small', 'SKILL'), h('small', 'BONUS')),
        x.skills.map(s => h('button.sk-row' + (s.exp ? '.exp' : s.prof ? '.prof' : ''), { onclick: () => skillInfo(s, x) },
          h('span.dot' + (s.exp ? '.exp' : s.prof ? '.prof' : '')), h('small.sk-ab', ABIL_SHORT[s.ab]),
          h('div', h('b', s.name), h('small', D.th.misc?.skills?.[s.name] || '')), h('span.skill-bonus', sign(s.bonus), fxMark(x.rf('check', s.ab, s.name)))))),
      cm ? h('p.muted.small', '⚔️ โหมดสู้ — ค่าพลัง สกิล และแท็บอื่น ๆ ซ่อนไว้ กด 📄 ที่หัวใบเพื่อกลับใบเต็ม') : h('p.muted.small', '● ชำนาญ (บวก Proficiency) · ◉ Expertise (บวก Proficiency 2 เท่า) · แตะแถวไหนก็ได้เพื่อดูสูตร'));
  }
  // Passive ตอนมี Advantage +5 / Disadvantage −5 (กฎ 2024)
  function passAdj(x, n) {
    const s = x.skills.find(z => z.name === n), k = s ? flagSum(x.rf('check', s.ab, n)) : '';
    return k === 'adv' ? 5 : k === 'dis' ? -5 : 0;
  }
  function senseRow(name, sub, v, skill, x = curX) {
    const adj = passAdj(x, skill), fl = x.rf('check', x.skills.find(z => z.name === skill)?.ab, skill);
    return h('button.sense', { onclick: () => explain(name, [
      h('div.formula', h('div.f-main', h('span', name), h('b', String(v))), h('div.f-parts', h('span', '10 + ', h('b', sign(v - 10 - adj)), ` (โบนัส ${skill})`),
        adj ? h('span', adj > 0 ? 'Advantage ' : 'Disadvantage ', h('b', sign(adj))) : null), adj ? fxNode(fl) : null),
      ...helpBody('passive'), D.th.help?.skills?.[skill] ? h('p.small', h('b', `${skill}: `), D.th.help.skills[skill].what) : null]) },
      h('div', h('b', name), h('small', sub)), h('span.sv', String(v), adj ? fxMark(fl) : null));
  }
  function abilInfo(a, x) {
    const sv = x.saves.find(s => s.ab === a);
    const sks = x.skills.filter(s => s.ab === a), H = D.th.help?.abilities?.[a];
    explain(`${ABIL_EN[a]} (${ABIL_SHORT[a]})`, [
      h('p.th', H?.what || `${ABIL_SHORT[a]} คือ ${ABIL_TH[a]}`),
      h('p.small', `ค่าพลัง ${x.score[a]} → ตัวบวก ${sign(x.m[a])} (คิดจาก ค่าพลังลบ 10 แล้วหาร 2 ปัดลง)`),
      formula(`ทอย ${ABIL_SHORT[a]} Check เปล่า ๆ`, x.m[a], [[ABIL_SHORT[a], x.m[a]]], x.rf('check', a), 'd20', { tag: `${ABIL_EN[a]} Check` }),
      H?.check ? h('p.help-use', h('b', 'Check ใช้ตอน: '), H.check) : null,
      formula(`ทอย ${ABIL_SHORT[a]} Saving Throw`, sv.bonus, sv.parts, x.rf('save', a), 'd20', { tag: `${ABIL_EN[a]} Save` }),
      H?.save ? h('p.help-use', h('b', 'เซฟใช้ตอน: '), H.save) : null,
      sks.length ? h('p.small', h('b', 'สกิลที่ใช้ค่านี้: '), sks.map(s => `${s.name} ${sign(s.bonus)}`).join(' · ')) : null,
      H?.extra ? h('p.small', '💡 ' + H.extra) : null,
      H?.classes ? h('p.muted.small', '🎭 ' + H.classes) : null,
    ]);
  }
  function skillInfo(s, x = curX) {
    const H = D.th.help?.skills?.[s.name];
    explain(`${s.name} (${ABIL_SHORT[s.ab]})`, [
      H ? h('p.th', H.what) : null,
      formula(`ทอย ${s.name}`, s.bonus, s.parts, x.rf('check', s.ab, s.name)),
      H ? h('p.help-use', h('b', 'ใช้ตอน: '), H.when) : null,
      H ? h('p.help-ex', h('b', 'ตัวอย่าง: '), H.ex) : null,
      h('p.muted.small', 'เราบอก DM ว่าจะทำอะไร แล้ว DM จะบอกว่าให้ทอยสกิลไหน — ทอย d20 บวกเลขนี้ แล้วบอกผลรวมให้ DM'),
    ]);
  }

  function hpBox(x) {
    const hdLeft = c.level - hdUsedAll();
    const pct = v => Math.max(0, Math.min(100, v / x.hpMax * 100)), r = P.hp / x.hpMax;
    return h('div.hp-box' + (P.hp === 0 ? '.zero' : r <= .25 ? '.low' : r <= .5 ? '.mid' : ''),
      h('div.hp-row',
        h('div.hp-main',
          h('div.hp-lbl', h('b', 'HIT POINTS'), h('small', 'พลังชีวิต'), infoBtn('hp', [hpFormula(x), h('h4', 'Temp HP'), ...helpBody('temp')])),
          h('button.hp-num', { onclick: () => hpSheet(x, 'dmg'), 'aria-label': 'แก้ HP' }, h('b', String(P.hp)), h('span', `/ ${x.hpMax}`), P.temp ? h('em.temp-pill', `Temp +${P.temp}`) : null)),
        h('div.hp-btns',
          h('button.btn.heal', { onclick: () => hpSheet(x, 'heal') }, '+ ฮีล'),
          h('button.btn.dmg', { onclick: () => hpSheet(x, 'dmg') }, '− โดนตี'))),
      h('div.hp-bar', h('i', { style: { width: pct(P.hp) + '%' } }), P.temp ? h('i.t', { style: { width: Math.min(pct(P.temp), 100 - pct(P.hp)) + '%' } }) : null),
      h('div.hp-sub',
        h('button.link', { onclick: () => hpSheet(x, 'temp') }, P.temp ? `Temp HP ${P.temp}` : '+ Temp HP'),
        h('button.link', { onclick: () => explain('Hit Dice', [h('p.formula', `เหลือ ${hdLeft} จาก ${c.level} ลูก`), ...helpBody('hd')], [{ label: 'พักสั้น (ใช้ Hit Dice)', primary: true, onClick: () => { setTimeout(() => shortRest(x), 220); } }]) }, `Hit Dice ${hdLeft}/${c.level} (${x.hitDice.map(d => `${d.n}d${d.die}`).join(' + ') || 'd8'})`)));
  }
  // แผ่นใส่ตัวเลข HP: ฮีล / โดนตี / Temp HP
  function hpSheet(x, mode = 'dmg') {
    const amt = h('input.inp.num.hp-amt', { type: 'number', inputmode: 'numeric', min: 0, placeholder: '0', 'aria-label': 'จำนวน HP' });
    const val = () => Math.max(0, parseInt(amt.value, 10) || 0);
    const heal = () => { const n = val(); if (!n) return toast('ใส่ตัวเลขก่อน แล้วค่อยกดฮีล'); if (P.hp === 0) P.death = { s: 0, f: 0 }; P.hp = Math.min(x.hpMax, P.hp + n); close(); done(); };
    const dmg = () => { let n = val(); if (!n) return toast('ใส่ดาเมจที่โดนก่อน แล้วค่อยกด'); const d = n, t = Math.min(P.temp, n); P.temp -= t; n -= t; P.hp = Math.max(0, P.hp - n);
      close(); if (P.conc && P.hp === 0) dropConc('HP เหลือ 0'); else if (P.conc) concCheck(x, d); done(); };
    const temp = () => { const n = val(); if (!n) return toast('ใส่จำนวน Temp HP ก่อนแล้วกดอีกที'); P.temp = Math.max(P.temp, n); close(); done(); toast(`ได้ Temp HP ${P.temp} (Temp HP ไม่ทบกัน เก็บค่าที่สูงกว่าไว้)`); };
    const fn = { heal, dmg, temp }[mode];
    amt.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
    const b = (k, label, f) => h('button.btn.' + k + (k === mode ? '.on' : ''), { onclick: f }, label);
    const close = sheet({ heal: 'ฮีล HP', dmg: 'โดนตี (รับดาเมจ)', temp: 'Temp HP' }[mode], h('div.hp-sheet',
      h('p.muted.small', `HP ตอนนี้ ${P.hp}/${x.hpMax}${P.temp ? ` · Temp ${P.temp}` : ''}`),
      amt,
      h('div.hp-sheet-btns', b('heal', '+ ฮีล', heal), b('dmg', '− โดนตี', dmg), b('temp', 'Temp HP', temp)),
      h('p.muted.small', 'ดาเมจจะหัก Temp HP ก่อน แล้วค่อยหัก HP จริง · Temp HP ไม่บวกทบกัน (เก็บค่าที่สูงกว่า)')));
    setTimeout(() => amt.focus(), 250);
  }
  // โดนดาเมจตอนใช้สมาธิ → เตือนเซฟ CON
  function concCheck(x, dmg) {
    const dc = Math.min(30, Math.max(10, Math.floor(dmg / 2))), sv = x.saves.find(z => z.ab === 'con'), sp = D.spell[P.conc];
    explain(`เซฟสมาธิ: ${sp?.name || ''}`, [
      h('p', `โดนดาเมจ ${dmg} ตอนกำลังใช้สมาธิ — ต้องทอยเซฟ CON ให้ได้ ${dc} ขึ้นไป ไม่งั้นเวทหลุด`),
      formula('ทอยเซฟ CON', sv.bonus, sv.parts, x.rf('save', 'con'), 'd20', { tag: 'CON Save (Concentration)' }),
      h('p.muted.small', `DC = 10 หรือครึ่งหนึ่งของดาเมจ (${Math.floor(dmg / 2)}) เอาค่าที่สูงกว่า และไม่เกิน 30`)], [
      { label: 'ไม่ผ่าน — สมาธิหลุด', onClick: () => { dropConc(); done(); } },
      { label: 'ผ่าน ยังรักษาสมาธิไว้', primary: true }]);
  }

  // ปรับค่าเอง: ของวิเศษ / สิ่งที่ DM ให้ → c.custom
  function customSheet() {
    const cu = c.custom = Object.assign({}, c.custom);
    const x = compute(c);
    const setN = (obj, k) => e => { const v = parseInt(e.target.value, 10); if (v) obj[k] = v; else delete obj[k]; save(); redraw(); };
    const num = (label, obj, k, ph = '0') => h('label.fld.cu-n', h('small', label), h('input.inp.num', { type: 'number', inputmode: 'numeric', value: obj[k] || '', placeholder: ph, onchange: setN(obj, k) }));
    cu.saves = cu.saves || {}; cu.skills = cu.skills || {}; cu.attack = cu.attack || {}; cu.defenses = cu.defenses || [];
    const TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
    const defList = h('div');
    const fillDef = () => defList.replaceChildren(...cu.defenses.map((d, i) => h('div.row.cu-def', h('span', `${d.type} · ${{ res: 'Resistance', imm: 'Immunity', vul: 'Vulnerability' }[d.kind]}`),
      h('button.icon-btn', { 'aria-label': 'ลบ', onclick: () => { cu.defenses.splice(i, 1); save(); redraw(); fillDef(); } }, '✕'))));
    fillDef();
    const tSel = h('select.inp', TYPES.map(t => h('option', { value: t }, t))), kSel = h('select.inp', [['res', 'Resistance'], ['imm', 'Immunity'], ['vul', 'Vulnerability']].map(([v, l]) => h('option', { value: v }, l)));
    const txt = (k, label, ph) => h('label.fld', h('small', label), h('input.inp', { value: cu[k] || '', placeholder: ph, onchange: e => { cu[k] = e.target.value; save(); redraw(); } }));
    sheet('ปรับค่าเอง', h('div.custom',
      h('p.muted.small', 'ใส่ตัวเลขที่จะ "บวกเพิ่ม" จากที่เว็บคำนวณ (ติดลบได้) เช่น ได้ Cloak of Protection ให้ใส่ AC +1 และเซฟทุกช่อง +1 · เว้นว่าง = ไม่ปรับ'),
      h('h4', 'ค่าหลัก'), h('div.cu-grid', num('AC', cu, 'ac'), num('HP สูงสุด', cu, 'hpMax'), num('Speed (ฟุต)', cu, 'speed'), num('Initiative', cu, 'init'), num('Spell Save DC', cu, 'spellDc'), num('Spell Attack', cu, 'spellAtk')),
      h('h4', 'ความเร็วแบบอื่น / ประสาทสัมผัส (ใส่เป็นระยะฟุต)'), h('div.cu-grid', num('ปีน', cu, 'climb', '—'), num('ว่าย', cu, 'swim', '—'), num('บิน', cu, 'fly', '—'), num('Darkvision', cu, 'darkvision', '—'), num('Blindsight', cu, 'blindsight', '—')),
      h('h4', 'Saving Throws'), h('div.cu-grid', ABIL.map(a => num(ABIL_SHORT[a], cu.saves, a))),
      h('h4', 'อาวุธ (ของวิเศษ +1 / +2 ใส่ทั้งโจมตีและดาเมจ)'), x.attacks.map(a => { cu.attack[a.id] = cu.attack[a.id] || {}; return h('div.cu-atk', h('b', a.name), num('โจมตี', cu.attack[a.id], 'hit'), num('ดาเมจ', cu.attack[a.id], 'dmg')); }),
      h('details.orig', h('summary', 'สกิล 18 อย่าง'), h('div.cu-grid', x.skills.map(z => num(z.name, cu.skills, z.name)))),
      h('h4', 'ดาเมจที่ทนได้ (Defenses)'), defList,
      h('div.row.cu-def', tSel, kSel, h('button.btn.small', { onclick: () => { cu.defenses.push({ type: tSel.value, kind: kSel.value }); save(); redraw(); fillDef(); } }, '+ เพิ่ม')),
      h('h4', 'ภาษา / ความชำนาญเพิ่ม'),
      txt('langs', 'ภาษาเพิ่ม (คั่นด้วยจุลภาค)', 'เช่น Elvish, Draconic'),
      txt('profs', 'ความชำนาญอื่น ๆ (เครื่องมือ อาวุธ ฯลฯ)', "เช่น Thieves' Tools, Longbow")));
  }

  function hpFormula(x) {
    let dice = 0;
    for (const li of levelInfo(c)) { const d = li.cls?.hitDie; if (d) dice += li.i === 0 ? d : li.e.hp || hitDieAvg(d); }
    const con = x.m.con * c.level, other = x.hpMax - dice - con;
    return h('div.formula', h('div.f-main', h('span', 'HP สูงสุด'), h('b', String(x.hpMax))),
      h('div.f-parts', h('span', 'Hit Die ทุกเลเวล ', h('b', '+' + dice)), h('span', `CON ×${c.level} `, h('b', (con < 0 ? '−' : '+') + Math.abs(con))), other ? h('span', 'ฟีเจอร์อื่น ', h('b', (other < 0 ? '−' : '+') + Math.abs(other))) : null),
      h('p.muted.small', 'เลเวลแรกได้ Hit Die เต็มลูก เลเวลต่อ ๆ ไปได้ค่าเฉลี่ยหรือผลที่ทอยไว้'));
  }
  function deathBox() {
    const pips = (k, label) => h('div.death-row', h('span', label), [0, 1, 2].map(i => h('button.pip' + (P.death[k] > i ? '.on' : ''), { 'aria-label': `${label} ${i + 1}`, onclick: () => { P.death[k] = P.death[k] > i ? i : i + 1; done(); } })));
    return h('div.card.death', h('h3.sec2', h('span', 'DEATH SAVES'), h('small', 'ทอยกันตาย'), infoBtn('death')),
      h('p.small', 'HP เหลือ 0 = หมดสติ ทุกต้นเทิร์นให้ทอย d20 เปล่า ๆ: ได้ 10 ขึ้นไปนับสำเร็จ ต่ำกว่า 10 นับล้มเหลว · ได้ 20 ฟื้นขึ้นมามี HP 1 · ได้ 1 นับล้มเหลว 2 ครั้ง · สำเร็จครบ 3 = อาการคงที่ ล้มเหลวครบ 3 = ตาย'),
      pips('s', 'สำเร็จ'), pips('f', 'ล้มเหลว'),
      diceOn() ? h('button.btn.primary.sm', { onclick: rollDeath }, '🎲 ทอย Death Save') : null);
  }
  function rollDeath() {
    const r = rollD20('Death Save', -2 * (P.exh || 0)), d = P.death = P.death || { s: 0, f: 0 };
    if (r.nat === 20) { P.hp = 1; P.death = { s: 0, f: 0 }; r.note = 'ฟื้นขึ้นมามี HP 1'; }
    else if (r.nat === 1) { d.f = Math.min(3, d.f + 2); r.note = `ล้มเหลว 2 ช่อง (${d.f}/3)`; }
    else if (r.total >= 10) { d.s = Math.min(3, d.s + 1); r.note = d.s >= 3 ? 'สำเร็จครบ 3 — อาการคงที่ (Stable)' : `สำเร็จ ${d.s}/3`; }
    else { d.f = Math.min(3, d.f + 1); r.note = `ล้มเหลว ${d.f}/3`; }
    if (d.f >= 3) r.note = '💀 ล้มเหลวครบ 3 — ตัวละครตาย';
    show(r); done();
  }
  // ผลของสถานะที่ติดอยู่ (เว็บใส่ป้าย Advantage/Disadvantage บนสูตรให้แล้ว)
  function condFx() {
    const L = P.conditions.filter(k => COND_FX[k]);
    return L.length ? h('ul.cond-fx', L.map(k => h('li', h('b', k), ' — ', COND_FX[k].th))) : null;
  }
  function condSheet() {
    const list = h('div.chips'), fxl = h('div');
    const exBox = h('div.exh');
    const fill = () => {
      list.replaceChildren(...CONDITIONS.filter(k => k !== 'Exhaustion').map(k => {
        const on = P.conditions.includes(k);
        return h('button.chip' + (on ? '.on.bad' : ''), { onclick: () => {
          if (on) P.conditions = P.conditions.filter(z => z !== k);
          else {
            P.conditions.push(k); const t = D.th.misc?.conditions?.[k]; if (t) toast(`${k}: ${t}`);
            if (INCAP.includes(k)) dropConc(`ติด ${k}`);
          }
          done(); fill();
        } }, k);
      }));
      fxl.replaceChildren(condFx() || '');
      const e = P.exh || 0;
      exBox.replaceChildren(h('div.exh-row', h('b', 'Exhaustion'),
        h('button.icon-btn', { 'aria-label': 'ลด', disabled: !e, onclick: () => { P.exh = Math.max(0, e - 1); done(); fill(); } }, '−'),
        h('b.exh-n', String(e)),
        h('button.icon-btn', { 'aria-label': 'เพิ่ม', disabled: e >= 6, onclick: () => { P.exh = Math.min(6, e + 1); done(); fill(); if (P.exh >= 6) toast('💀 Exhaustion ระดับ 6 = ตัวละครตาย'); } }, '+')),
        h('p.muted.small', e ? `ทอย d20 ทุกอย่างลดลง ${2 * e} · Speed ลด ${5 * e} ฟุต — เว็บหักให้ในสูตรแล้ว · พักยาวลดได้ 1 ระดับ${e >= 6 ? ' · ⚠ ระดับ 6 = ตาย' : ''}` : 'ความเหนื่อยล้า 1–6 ระดับ: ทุกระดับทอย d20 ลดลง 2 และ Speed ลด 5 ฟุต · ถึงระดับ 6 = ตาย'));
    };
    fill();
    sheet('Conditions (สถานะที่ติดอยู่)', h('div', h('p.muted.small', 'แตะเพื่อใส่หรือเอาออก — DM จะบอกเวลาเราติดสถานะอะไร · ผลของสถานะ เว็บใส่ป้าย ▲ Advantage / ▼ Disadvantage บนสูตรทอยให้เอง'), list, fxl, exBox,
      h('p.muted.small', 'อยากรู้ว่าแต่ละอันมีผลยังไง ดูได้ที่หน้า "ศัพท์" หรือแตะชื่อสถานะใต้กล่อง CONDITIONS')));
  }

  // ทรัพยากร: กดแล้ว = ใช้ไปแล้ว (ช่องระบายเต็ม)
  function setUse(obj, key, v, hook) {
    const old = obj[key] || 0;
    obj[key] = v;
    if (v > old && P.turn) { const m = hook(); if (m) toast(m); }
    done();
  }
  function boxes(n, used, onSet, label) {
    return h('div.pips', Array.from({ length: n }, (_, i) => h('button.pip' + (i < used ? '.on' : ''), {
      'aria-label': `${label} ${i + 1}${i < used ? ' (ใช้แล้ว)' : ''}`, onclick: () => onSet(i < used ? i : i + 1),
    })));
  }

  function shortRest(x) {
    const log = h('p.small');
    const rows = h('div.hd-rows');
    const fill = () => rows.replaceChildren(...x.hitDice.map(({ die, n }) => {
      const left = n - (P.hdu[die] || 0);
      const inp = h('input.inp.num', { type: 'number', inputmode: 'numeric', min: 1, max: die, placeholder: `1–${die}`, disabled: left <= 0, 'aria-label': `ผลทอย d${die}` });
      return h('div.hd-row', h('span', h('b', `d${die}`), ` เหลือ ${left}/${n}`), inp, h('button.btn.primary', { disabled: left <= 0, onclick: () => {
        const r = parseInt(inp.value, 10);
        if (!(r >= 1 && r <= die)) return toast(`ใส่เลขที่ทอย d${die} ได้ (1–${die})`);
        const gain = Math.max(1, r + x.m.con);
        P.hdu[die] = (P.hdu[die] || 0) + 1; if (P.hp === 0) P.death = { s: 0, f: 0 }; P.hp = Math.min(x.hpMax, P.hp + gain); done();
        log.textContent = `d${die} ได้ ${r} ${sign(x.m.con)} (CON) = ฟื้น ${gain} HP → ตอนนี้ ${P.hp}/${x.hpMax}`;
        fill();
      } }, 'ใช้'), diceOn() ? h('button.btn.sm', { disabled: left <= 0, 'aria-label': `ทอย d${die}`, onclick: () => { inp.value = rollDie(die); } }, '🎲') : null);
    }));
    fill();
    sheet('พักสั้น (1 ชั่วโมง)', h('div',
      h('p', 'ระหว่างพักสั้นใช้ Hit Dice ฟื้น HP ได้: ทอยเต๋าจริงทีละลูก แล้วพิมพ์เลขที่ได้ เว็บจะบวก CON ให้เอง จะใช้กี่ลูกก็ได้เท่าที่เหลือ'), rows, log),
      [{ label: 'พักสั้นกับพักยาวต่างกันยังไง', onClick: () => { nav(`#/help/${c.id}/rest`); } }, { label: 'พักเสร็จ', primary: true, onClick: () => {
        for (const r of x.res) if (r.reset === 'short') P.res[r.id] = 0; else if (r.reset === 'short1') P.res[r.id] = Math.max(0, (P.res[r.id] || 0) - 1);
        for (const k of Object.keys(P.slots)) if (k.startsWith('p')) delete P.slots[k]; // Pact Magic คืนตอนพักสั้น
        T.endCombat(P); done(); toast('พักสั้นเรียบร้อย ความสามารถที่คืนตอนพักสั้นกลับมาแล้ว');
      } }]);
  }
  async function longRest(x) {
    if (!(await confirmSheet('พักยาว 8 ชั่วโมง?', `HP เต็ม · Hit Dice คืนหมด · Spell Slot และความสามารถทุกอย่างคืนหมด${P.exh ? ` · Exhaustion ลดเหลือ ${P.exh - 1}` : ''}`))) return;
    P.hp = x.hpMax; P.temp = 0; P.hdUsed = 0; P.hdu = {}; P.slots = {}; P.res = {}; P.death = { s: 0, f: 0 };
    P.exh = Math.max(0, (P.exh || 0) - 1); P.conc = null; P.turn = null; T.dropFx(P, () => true);
    done(); toast('พักยาวแล้ว พร้อมลุยต่อ!');
  }

  // ---------- ACTIONS ----------
  function actions(x) {
    const F = ui.act, show = k => F === 'all' || F === k;
    const out = [h('div.chips.filter', [['all', 'ทั้งหมด'], ['attack', 'Attack'], ['a', 'Action'], ['b', 'Bonus Action'], ['r', 'Reaction'], ['other', 'อื่น ๆ'], ['limited', 'Limited Use']]
      .map(([id, l]) => h('button.chip' + (F === id ? '.on' : ''), { onclick: () => { ui.act = id; redraw(); } }, l)))];
    const feats = T.featureActions(x);
    const item = (it, extra) => h((it.open ? 'button' : 'div') + '.titem' + (extra?.off ? '.off' : ''), { onclick: it.open },
      h('div', h('b', it.name), it.tag ? h('i.tag', it.tag) : null, it.s ? h('small', it.s) : null), it.note ? h('span.badge', it.note) : null);
    const fItems = k => feats.filter(f => f.k === k).map(f => {
      const left = T.resLeft(P, f.r);
      return item({ name: f.name, s: f.th.s, tag: TYPE_LABEL[f.th.t], note: f.r ? `เหลือ ${left}/${f.r.max}` : null, open: () => T.useFeature(P, f, done) }, { off: left === 0 });
    });
    const atk = a => h('button.atk', { onclick: () => explain(a.name, attackBody(a, x), [T.pinAct(P, 'atk:' + a.id, done), ...(P.turn && !diceOn() ? [{ label: 'ใช้โจมตี', primary: true, onClick: () => { toast(`⚔️ ${a.name} · ${T.attack(P, x) || 'โจมตี'}`); done(); } }] : [])]) },
      h('div', h('b', a.name), a.mastery ? h('i.tag.mastery', a.mastery) : null, h('small', a.props || (a.id === 'unarmed' ? 'ต่อย เตะ โขก' : ''))),
      h('span.atk-hit', sign(a.hit), fxMark(x.rf('atk', a.ab))), h('span.atk-dmg', ...dmgText(a.dmg)));
    if (show('attack')) out.push(headK('atk', 'ATTACKS', 'การโจมตี', x.atkPer > 1 ? h('i.tag', `Extra Attack ×${x.atkPer}`) : null),
      h('div.card.list', h('div.atk.atk-head', h('small', 'อาวุธ'), h('small', 'HIT'), h('small', 'DAMAGE')), x.attacks.map(atk)),
      x.wild ? h('p.small', `🐾 ท่าโจมตีของร่าง ${x.wild.name}${x.wild.multi ? ` · Multiattack: ${x.wild.multi}` : ''}`) : null,
      h('p.muted.small', x.atkPer > 1 ? `ใช้ Attack action หนึ่งครั้ง ตีได้ ${x.atkPer} ที · แตะอาวุธเพื่อดูสูตรทอยแบบละเอียด` : 'แตะอาวุธเพื่อดูสูตรทอยแบบละเอียด'));
    if (show('a')) {
      out.push(headK('a', 'ACTION', 'ทำได้ 1 อย่างต่อเทิร์น'), h('div.titems',
        item({ name: 'Attack', tag: 'Action', s: x.atkPer > 1 ? `โจมตีด้วยอาวุธหรือมือเปล่า ${x.atkPer} ครั้ง` : 'โจมตีด้วยอาวุธหรือมือเปล่า 1 ครั้ง', open: () => go2('attack') }),
        x.casting.length && !x.noCast ? item({ name: 'Magic', tag: 'Action', s: 'ร่ายเวทที่ใช้เวลาร่าย 1 Action — ดูได้ที่แท็บ SPELLS', open: () => go('spells') }) : null,
        fItems('a')),
      h('details.orig', h('summary', 'Action พื้นฐานที่ทุกคนทำได้ (Dash, Dodge, Hide…)'), h('div.titems', T.BASIC.map(b => item({ name: b[1], s: b[2], open: () => T.basicSheet(P, b, done) })))));
    }
    if (show('b')) {
      const light = x.attacks.filter(a => /\bLight\b/.test(a.props || '')).length >= 2;
      const list = [
        light ? item({ name: 'โจมตีมือรอง (Light)', tag: 'Bonus Action', s: 'หลังตีด้วยอาวุธ Light แล้ว ตีด้วยอาวุธ Light อีกมือได้ 1 ที (ดาเมจไม่บวกค่าพลัง ยกเว้นค่าติดลบ)', open: () => T.attackSheet(x, P, 'b', 'โจมตีมือรอง', done) }) : null,
        ...fItems('b')].filter(Boolean);
      out.push(headK('b', 'BONUS ACTION', 'ทำได้ 1 อย่างต่อเทิร์น'), list.length ? h('div.titems', list) : h('p.muted.small', 'ตอนนี้ยังไม่มีอะไรที่ใช้ Bonus Action ได้ — จะมีเมื่อได้ฟีเจอร์หรือเวทที่บอกว่าใช้ Bonus Action'));
    }
    if (show('r')) out.push(headK('r', 'REACTION', 'ใช้ได้ 1 ครั้งต่อรอบ แม้ไม่ใช่เทิร์นเรา'), h('div.titems',
      item({ name: 'Opportunity Attack', tag: 'Reaction', s: 'ศัตรูเดินออกจากระยะที่เราเอื้อมถึง → ตีมันได้ 1 ที', open: () => T.attackSheet(x, P, 'r', 'Opportunity Attack', done) }),
      fItems('r')));
    if (show('other')) {
      const once = T.onceItems(x);
      out.push(headK('o', 'OTHER', 'อื่น ๆ'), h('div.titems',
        item({ name: 'หยิบ / ใช้ของชิ้นเล็ก', tag: 'ฟรี', s: 'ทุกเทิร์นทำเรื่องเล็ก ๆ ได้ฟรี 1 อย่าง เช่น ชักหรือเก็บอาวุธ เปิดประตู หยิบของจากพื้น' }),
        item({ name: 'พูด / ตะโกนสั้น ๆ', tag: 'ฟรี', s: 'พูดสั้น ๆ หรือส่งสัญญาณให้เพื่อนได้ ไม่เสีย Action' }),
        once.map(([, name, s]) => item({ name, tag: '1 ครั้งต่อเทิร์น', s, open: featureMath(name, x, name === 'Sneak Attack' ? 'rogue' : null).length ? () => explain(name, [...featureMath(name, x, 'rogue'), h('p.th', s)]) : null })),
        x.CLs.barbarian ? item({ name: 'ดาเมจตอน Rage', s: `ตอน Rage การโจมตีที่ใช้ STR ได้ดาเมจเพิ่ม ${featureMath('Rage', x, 'barbarian').length ? D.cls.barbarian.table.rows[x.CLs.barbarian - 1][4] : ''}` }) : null),
        head('COMMON MOVES', 'ท่าทั่วไปที่ทุกคนทำได้'), h('div.titems', T.MOVES.map(m => item({ name: m.name, tag: T.MOVE_TAG[m.k], s: m.s, open: () => T.moveCard(m, x, P, done) }))));
    }
    if (show('limited')) {
      out.push(headK('l', 'LIMITED USE', 'ใช้ได้จำกัดครั้ง'));
      if (!x.res.length) out.push(h('p.muted.small', 'ตอนนี้ไม่มีความสามารถที่ต้องนับจำนวนครั้ง'));
      else out.push(h('p.muted.small.k-l-note', 'ช่องสี่เหลี่ยม: กดแล้วระบายเต็ม = ใช้ไปแล้ว · กดช่องที่ระบายแล้วเพื่อคืน'), h('div.card.list', x.res.map(r => {
        const used = P.res[r.id] || 0;
        return h('div.res',
          h('span.res-ico', { html: iconSvg(r.icon) }),
          h('div.res-name', h('b', r.name), h('small', `${r.reset === 'long' ? 'คืนตอนพักยาว' : r.reset === 'short' ? 'คืนตอนพักสั้นหรือพักยาว' : 'พักสั้นคืน 1 · พักยาวคืนหมด'} · เหลือ ${r.max - used}/${r.max}`)),
          r.max > 8 ? h('div.res-num',
            h('button.icon-btn', { onclick: () => setUse(P.res, r.id, Math.min(r.max, used + 1), () => T.resUsed(P, r.id, x)), 'aria-label': 'ใช้ 1' }, '−'),
            h('b', `${r.max - used}`), h('small', `/${r.max}`),
            h('button.icon-btn', { onclick: () => { P.res[r.id] = Math.max(0, used - 1); done(); }, 'aria-label': 'คืน 1' }, '+'))
            : boxes(r.max, used, v => setUse(P.res, r.id, v, () => T.resUsed(P, r.id, x)), r.name));
      })));
    }
    if (F === 'all') out.push(h('a.btn.ghost.help-link', { href: `#/help/${c.id}/turn` }, '🎓 เล่นยังไง — เทิร์นหนึ่งทำอะไรได้ ตีกี่ที ทอยอะไรบ้าง'));
    return out;
  }
  function go2(f) { ui.act = f; redraw(); }

  // ---------- SPELLS ----------
  function spells(x) {
    if (!x.casting.length) return [h('p.muted', 'ตัวละครนี้ยังไม่ได้ใช้เวท')];
    const out = [];
    if (x.noCast) out.push(h('p.tip', `🐾 อยู่ในร่าง ${x.wild?.name || 'สัตว์'} — ร่ายเวทไม่ได้จนกว่าจะกลับร่าง (เวทที่ใช้สมาธิอยู่ก่อนแปลงร่างยังคงอยู่)`));
    const all = x.casting.flatMap(b => [...b.cantrips, ...b.always, ...b.prepared, ...(b.book || [])]).map(id => D.spell[id]).filter(Boolean);
    const lvs = [...new Set(all.map(s => s.level))].sort((a, b) => a - b);
    const q = h('input.inp.sp-q', { type: 'search', placeholder: 'ค้นหาสเปล (ชื่ออังกฤษหรือคำไทย)', value: ui.spQ, oninput: e => { ui.spQ = e.target.value; apply(); } });
    const chipBar = (opts, key) => h('div.chips.filter', opts.map(([id, l]) => h('button.chip' + (ui[key] === id ? '.on' : ''), { 'data-k': key, 'data-v': id, onclick: e => {
      ui[key] = ui[key] === id && key === 'spF' ? '' : id;
      e.currentTarget.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', ui[key] === b.dataset.v));
      apply();
    } }, l)));
    ui.spLv = 'all';
    out.push(q, chipBar([['c', 'Concentration'], ['r', 'Ritual'], ['a', 'Action'], ['b', 'Bonus Action'], ['re', 'Reaction']], 'spF'));
    const empty = h('p.muted.small.sp-empty', 'ไม่เจอสเปลที่ตรงกับที่ค้นหา');
    const TIME = s => ({ a: 'Action', b: 'Bonus', r: 'Reaction' })[T.castKind(s)] || s.time.replace(/^1 Minute.*/i, '1 นาที').replace(/^(\d+) Minutes?.*/i, '$1 นาที').replace(/^(\d+) Hours?.*/i, '$1 ชม.').replace(/,.*$/, '');
    const slotInfo = () => explain('Spell Slots', [...helpBody('slot'), h('p.small', 'กดช่องสี่เหลี่ยมเมื่อร่ายเวทเลเวลนั้น (ช่องจะระบายทึบ = ใช้แล้ว) · กดช่องที่ระบายแล้วเพื่อคืน · สลอตคืนตอนพักยาว (Pact Slot ของ Warlock คืนตอนพักสั้นด้วย)'),
      h('p.small', 'เวทเลเวลต่ำ ร่ายด้วยสลอตเลเวลสูงกว่าได้ (Upcast) มักแรงขึ้น — ดูในรายละเอียดเวท'), h('button.link', { onclick: () => nav(`#/help/${c.id}/slot`) }, 'อ่านเพิ่ม: ร่ายเวทใช้สลอตยังไง')]);
    for (const b of x.casting) {
      out.push(h('div.sp-src', h('h2.sec.src-spell', b.source), h('button.link.sp-ab', { onclick: () => abilInfo(b.ab, x) }, `ร่ายด้วย ${ABIL_SHORT[b.ab]}`)),
        h('div.sp-stats',
          box('SAVE DC', 'ความยากเซฟ', String(b.dc), null, () => explain('Spell Save DC', [
            h('div.formula', h('div.f-main', h('span', 'DC'), h('b', String(b.dc))), h('div.f-parts', h('span', '8 + ', h('b', sign(x.pb)), ' (Prof) + ', h('b', sign(x.m[b.ab])), ` (${ABIL_SHORT[b.ab]})`))),
            ...helpBody('dc')])),
          box('SPELL ATTACK', 'โจมตีด้วยเวท', sign(b.atk), null, () => explain('Spell Attack', [
            formula('ทอยโจมตีด้วยเวท', b.atk, [['Proficiency', x.pb], [ABIL_SHORT[b.ab], x.m[b.ab]]], x.rf('atk', b.ab), 'd20', { tag: 'Spell Attack' }),
            ...helpBody('spellatk')]))));
      if (b.casterLv) out.push(h('p.muted.small', `สลอตรวมจาก Multiclass (caster level ${b.casterLv}) — ทุกคลาสใช้สลอตกองเดียวกัน`));
      const slotPips = lv0 => { const n = b.slots[lv0]; if (!n) return null; const lv = (b.pact ? 'p' : '') + lv0, used = P.slots[lv] || 0;
        return h('span.lv-slots', boxes(n, used, v => setUse(P.slots, lv, v, () => T.slot(P)), `slot ${lv}`), h('small', `${n - used}/${n}`)); };
      if (b.pact) out.push(h('div.lv-head.pact', h('b', `PACT SLOTS · Lv ${Object.keys(b.slots)[0]}`), slotPips(Object.keys(b.slots)[0]), infoBtnFn(slotInfo)));
      const always = new Set(b.always);
      const ids = [...new Set([...b.cantrips, ...b.always, ...b.prepared])];
      const ss = ids.map(id => D.spell[id]).filter(Boolean);
      const lvs = [...new Set([...ss.map(z => z.level), ...(b.pact ? [] : Object.keys(b.slots).map(Number))])].sort((p, q) => p - q);
      for (const L of lvs) {
        const list = ss.filter(z => z.level === L).sort((p, q) => p.name.localeCompare(q.name));
        out.push(h('div.sp-group', h('div.lv-head', h('b', L ? `LEVEL ${L}` : 'CANTRIP'), L ? (b.pact ? h('small', `ใช้ Pact Slot (ร่ายเป็น Lv ${Object.keys(b.slots)[0]})`) : slotPips(L)) : h('small', 'ร่ายได้ไม่จำกัด'), L && !b.pact && b.slots[L] ? infoBtnFn(slotInfo) : null),
          list.length ? h('div.spell-list', list.map(z => {
            const row = spellRow(z, { badge: TIME(z), tag: always.has(z.id) ? 'ติดตัว' : null, actions: () => [...T.castActions(z, x, P, done), T.pinAct(P, 'spell:' + z.id, done)], extra: () => spellMath(z, b, x) });
            Object.assign(row.dataset, { lv: z.level, c: z.concentration ? 1 : '', r: z.ritual ? 1 : '', t: T.castKind(z) || '', q: `${z.name} ${D.th.spells?.[z.id] || ''}`.toLowerCase() });
            return row;
          })) : h('p.muted.small.lv-none', 'ยังไม่มีเวทเลเวลนี้ — ใช้สลอตนี้ร่ายเวทเลเวลต่ำกว่าแบบ Upcast ได้')));
      }
      const group = (title, gids) => {
        const g = gids.map(id => D.spell[id]).filter(Boolean).sort((p, q) => p.level - q.level || p.name.localeCompare(q.name));
        return g.length ? h('div.sp-group', h('div.spell-list', g.map(z => { const row = spellRow(z, { badge: TIME(z), actions: () => [...T.castActions(z, x, P, done), T.pinAct(P, 'spell:' + z.id, done)], extra: () => spellMath(z, b, x) });
          Object.assign(row.dataset, { lv: z.level, c: z.concentration ? 1 : '', r: z.ritual ? 1 : '', t: T.castKind(z) || '', q: `${z.name} ${D.th.spells?.[z.id] || ''}`.toLowerCase() }); return row; }))) : null;
      };
      if (b.book?.length) out.push(h('details.orig.sp-book', h('summary', `สมุดเวท (${b.book.length})`), group('', b.book)));
      if (!b.fixed) out.push(h('button.btn.ghost', { onclick: () => nav(`#/edit/${c.id}/spells`) }, '✏️ เปลี่ยนเวท'));
    }
    out.push(empty);
    function apply() {
      const body = root.querySelector('.sh-body'), qq = ui.spQ.trim().toLowerCase();
      let any = 0;
      body.querySelectorAll('.spell-row').forEach(r => {
        const d = r.dataset, F = ui.spF;
        const ok = (!qq || d.q.includes(qq)) && (ui.spLv === 'all' || d.lv === ui.spLv)
          && (!F || (F === 'c' ? d.c : F === 'r' ? d.r : F === 're' ? d.t === 'r' : d.t === F));
        r.hidden = !ok; any += ok;
      });
      const filtering0 = qq || ui.spF;
      body.querySelectorAll('.sp-group').forEach(g => { g.hidden = !!filtering0 && !g.querySelector('.spell-row:not([hidden])'); });
      const filtering = qq || ui.spLv !== 'all' || ui.spF;
      body.querySelectorAll('.sp-book').forEach(d => { if (filtering && d.querySelector('.spell-row:not([hidden])')) d.open = true; });
      empty.hidden = !!any;
    }
    requestAnimationFrame(apply);
    return out;
  }

  // ---------- INVENTORY ----------
  function inventory(x) {
    const e = c.equipment;
    const COIN_TH = { pp: 'แพลทินัม', gp: 'ทอง', ep: 'อิเล็กตรัม', sp: 'เงิน', cp: 'ทองแดง' };
    const coin = k => {
      const inp = h('input.inp.num', { type: 'number', inputmode: 'numeric', value: e[k] || 0, 'aria-label': `เหรียญ${COIN_TH[k]} (${k.toUpperCase()})`, onchange: ev => { e[k] = Math.max(0, parseInt(ev.target.value, 10) || 0); done(); } });
      const step = d => () => { e[k] = Math.max(0, (e[k] || 0) + d); done(); };
      return h('div.coin-row.c-' + k, h('span.coin-ico', { 'aria-hidden': 'true' }, k.toUpperCase()), inp,
        h('span.coin-name', h('b', k.toUpperCase()), h('small', COIN_TH[k])),
        h('div.coin-step', h('button', { onclick: step(-1), 'aria-label': `ลด ${k.toUpperCase()} 1` }, '−'), h('button', { onclick: step(1), 'aria-label': `เพิ่ม ${k.toUpperCase()} 1` }, '+')));
    };
    const coinInfo = () => explain('เหรียญ (Currency)', [
      h('div.coin-rates', ['pp', 'gp', 'ep', 'sp', 'cp'].map(k => h('div.coin.c-' + k, h('span.coin-ico', k.toUpperCase()), h('small', COIN_TH[k])))),
      h('ul', h('li', h('b', '1 PP'), ' (แพลทินัม) = 10 GP'), h('li', h('b', '1 GP'), ' (ทอง) = 2 EP = 10 SP = 100 CP'), h('li', h('b', '1 EP'), ' (อิเล็กตรัม) = 5 SP'), h('li', h('b', '1 SP'), ' (เงิน) = 10 CP (ทองแดง)')),
      h('p.small', 'ราคาของในเกมส่วนใหญ่คิดเป็น GP · เหรียญ 50 เหรียญหนักประมาณ 1 lb'),
      h('p.muted.small', 'กด + / − เพื่อเพิ่มลดทีละ 1 หรือแตะช่องตัวเลขเพื่อพิมพ์จำนวนเองก็ได้')]);
    const kindIco = it => it.weapon ? '⚔️' : it.armor ? '🛡️' : /potion|elixir|philter|oil of/i.test(it.name) ? '🧪' : /scroll/i.test(it.name) ? '📜' : it.magic ? '✨' : /arrow|bolt|bullet|needle/i.test(it.name) ? '🏹' : /tools?$|kit$|supplies$|instrument/i.test(it.name) ? '🛠️' : '🎒';
    const isOn = it => worn(it) || (it.weapon && it.equipped !== false);
    const cw = carry(c, x), att = e.items.filter(it => it.attuned).length;
    const worn = it => (it.armor === 'shield' ? e.shield : it.armor && e.armor === it.armor);
    const row = (it, i) => h('button.item-row.inv', { onclick: () => itemSheet(it, i, x) },
      h('span.inv-ico', { 'aria-hidden': 'true' }, kindIco(it)),
      h('div.inv-main', h('b', it.name, it.qty > 1 ? h('small', ` ×${it.qty}`) : null),
        h('small', [it.weapon ? (it.equipped === false ? 'อาวุธ · เก็บในกระเป๋า' : 'อาวุธ · ถืออยู่') : null, it.armor ? (worn(it) ? (it.armor === 'shield' ? 'ถือโล่อยู่' : 'สวมอยู่') : 'เกราะ · ไม่ได้สวม') : null,
          it.magic ? '✨ ของวิเศษ' : null, it.attune ? (it.attuned ? 'Attune แล้ว' : 'ต้อง Attune') : null, itemWeight(it) ? `${+(itemWeight(it) * (it.qty || 1)).toFixed(2)} lb` : null].filter(Boolean).join(' · '))),
      worn(it) || (it.weapon && it.equipped !== false) ? h('span.badge.on', '✓') : null);
    return [
      headK('coin', 'CURRENCY', 'เงิน', infoBtnFn(coinInfo)),
      h('div.card.list.coin-list', ['gp', 'sp', 'cp', 'pp', 'ep'].map(coin)),
      h('div.box3.inv-stats',
        box('WEIGHT', 'น้ำหนักที่แบก', `${cw.total}`, `/${cw.max}`, () => explain('น้ำหนักที่แบก', [
          h('div.formula', h('div.f-main', h('span', 'แบกอยู่'), h('b', `${cw.total} lb`)), h('div.f-parts', h('span', `แบกได้สูงสุด STR ${x.score.str} × 15 = `, h('b', `${cw.max} lb`)), h('span', 'เหรียญ 50 เหรียญ = 1 lb'))),
          h('p', 'ถ้าแบกเกินจากนี้ DM อาจให้เดินช้าลง น้ำหนักของมาจากตาราง SRD ถ้าของไหนไม่ตรง แตะของชิ้นนั้นแล้วใส่น้ำหนักเองได้')]), cw.total > cw.max ? '.bad' : ''),
        box('ATTUNEMENT', 'ของวิเศษที่ผูกไว้', `${att}`, '/3', () => explain('Attunement', [
          h('p.th', 'ของวิเศษบางชิ้นต้อง "Attune" (ผูกพลังกับตัวเรา) ก่อนถึงจะใช้พลังได้ — ใช้เวลาพักสั้น 1 ครั้งจับของชิ้นนั้นไว้'),
          h('p', 'ผูกได้พร้อมกันสูงสุด 3 ชิ้น ถ้าอยากผูกชิ้นใหม่ต้องเลิกผูกชิ้นเก่าก่อน · ตั้งค่าได้โดยแตะที่ของชิ้นนั้น')]), att > 3 ? '.bad' : ''),
        box('ARMOR', 'Class (AC)', String(x.ac), null, () => explain('Armor Class (AC)', [h('div.formula', h('div.f-main', h('span', 'AC'), h('b', String(x.ac))), h('div.f-parts', h('span', x.acNote))), ...helpBody('ac')]))),
      headK('eq', 'EQUIPPED', 'ใส่ / ถืออยู่ · แตะเพื่อถอดหรือแก้'),
      h('div.card.list', e.items.some(isOn) ? e.items.map((it, i) => (isOn(it) ? row(it, i) : null)) : h('p.muted.small', 'ยังไม่ได้ใส่หรือถืออะไร')),
      headK('bag', 'BACKPACK', 'ในกระเป๋า · แตะเพื่อใส่/ใช้/แก้'),
      h('div.card.list', e.items.some(it => !isOn(it)) ? e.items.map((it, i) => (isOn(it) ? null : row(it, i))) : h('p.muted.small', 'กระเป๋ายังว่าง')),
      h('button.btn.primary.add-item', { onclick: () => itemPicker(x) }, '＋ เพิ่มไอเทม', h('small', 'ค้นหาจากคลังไอเทมในเกม หรือพิมพ์ชื่อเอง')),
    ];
  }

  // ---------- คลังไอเทม (เฟส 10) ----------
  const ICAT_TH = { weapon: 'อาวุธ', armor: 'เกราะ', gear: 'อุปกรณ์', pack: 'ชุดแพ็ก', ammo: 'กระสุน', focus: 'โฟกัสเวท', tool: 'เครื่องมือ', consumable: 'ใช้แล้วหมด', magic: 'ของวิเศษ' };
  const KIND_TH = { wondrous: 'ของวิเศษ', weapon: 'อาวุธวิเศษ', armor: 'เกราะวิเศษ', ring: 'แหวน', potion: 'ยา', wand: 'ไม้กายสิทธิ์', staff: 'ไม้เท้า' };
  const RAR_TH = { Common: 'ธรรมดา', Uncommon: 'ไม่ธรรมดา', Rare: 'หายาก', 'Very Rare': 'หายากมาก', Legendary: 'ตำนาน', Artifact: 'อาร์ติแฟกต์' };
  const rarTh = r => (RAR_TH[r] ? `${r} (${RAR_TH[r]})` : r || '');
  const itIco = it => (it.w || it.kind === 'weapon' ? '⚔️' : it.a || it.kind === 'armor' ? '🛡️' : it.kind === 'potion' || /^(Potion|Oil|Philter|Elixir)/.test(it.name) ? '🧪' : /Scroll/.test(it.name) ? '📜'
    : it.kind === 'ring' ? '💍' : it.kind === 'wand' || it.kind === 'staff' || it.cat === 'focus' ? '🪄' : it.cat === 'magic' ? '✨' : it.cat === 'tool' ? '🛠️' : it.cat === 'ammo' ? '🏹' : it.cat === 'pack' ? '🎒' : it.cat === 'consumable' ? '🧪' : '🎒');
  const itMeta = it => [it.w ? `${it.w.damage} · ${it.w.properties || ''}` : null, it.a ? `AC ${it.a['armor class (ac)']}` : null,
    it.cat === 'magic' ? `${KIND_TH[it.kind] || 'ของวิเศษ'} · ${rarTh(it.rarity)}` : it.w || it.a ? null : ICAT_TH[it.cat], it.att ? 'ต้อง Attune' : null, it.cost || it.w?.cost || it.a?.cost, it.lb ? `${it.lb} lb` : null].filter(Boolean).join(' · ');
  const itText = (it, opt = {}) => {
    const T = D.itemTh?.[it.id];
    const lines = t => t.split('\n').filter(l => l.trim()).map(l => h('p', l));
    return [it.sub ? h('p.muted.small', it.sub) : null,
      T?.t ? h('div.th-full', lines(T.t)) : null,
      it.contents ? h('p.small', h('b', 'ในชุดมี: '), it.contents.join(', ')) : null,
      it.text ? (T?.t ? h('details.orig', h('summary', 'ต้นฉบับ (EN) — SRD 5.2.1'), h('div.md', { html: md(it.text) })) : [h('div.md', { html: md(it.text) }), opt.note !== false ? h('p.muted.small', '🔤 คำแปลไทยเต็มของไอเทมนี้กำลังทยอยเพิ่ม') : null]) : null];
  };
  // ของวิเศษที่ต้องเลือกอาวุธ/เกราะฐาน (เช่น Weapon +1 → Longsword +1)
  function baseOf(it) {
    if (it.cat !== 'magic' || !/^(weapon|armor)$/.test(it.kind) || /^Ammunition/.test(it.name)) return { none: true };
    const m = /\(([^)]*)\)/.exec(it.sub || ''), inner = m ? m[1] : '';
    if (/Shield/.test(inner) || /^Shield/.test(it.name)) return { a: D.armorById.shield };
    if (/Any/.test(inner)) return { pick: it.kind };
    const w = D.weapons.find(z => z.name.toLowerCase() === inner.toLowerCase()), a = D.armor.find(z => z.name.toLowerCase() === inner.toLowerCase());
    return w ? { w, auto: true } : a ? { a, auto: true } : { pick: it.kind };
  }
  function addItem(it, base, after) {
    const e = c.equipment;
    let rec;
    if (it.w) rec = { name: it.w.name, qty: 1, weapon: it.w.id };
    else if (it.a) rec = { name: it.a.name, qty: 1, armor: it.a.id };
    else {
      const b = base || baseOf(it);
      if (b.pick) return pickBase(it, after);
      const bw = b.w, ba = b.a, bn = (bw || ba)?.name;
      const plus = /^(Weapon|Armor) \+(\d)$/.exec(it.name);
      rec = { name: !bn || b.auto || ba?.id === 'shield' ? it.name : plus ? `${bn} +${plus[2]}` : `${bn} (${it.name})`, qty: 1, ref: it.id };
      if (bw) rec.weapon = bw.id;
      if (ba) rec.armor = ba.id;
      if (it.cat === 'magic') { rec.magic = true; if (it.att) rec.attune = true; }
      if (it.lb && !itemWeight({ name: it.name })) rec.weight = it.lb;
    }
    const same = !rec.weapon && !rec.armor && e.items.find(z => z.name === rec.name && !z.weapon && !z.armor);
    if (same) same.qty = (same.qty || 1) + 1; else e.items.push(rec);
    e.touched = true; done();
    toast(`เพิ่ม ${rec.name}${same ? ` (มี ${same.qty} ชิ้น)` : ''} ลงกระเป๋าแล้ว`);
    after?.();
  }
  function pickBase(it, after) {
    const opts = it.kind === 'weapon' ? D.weapons.map(w => ({ w, n: w.name, s: `${w.damage} · ${w.category || ''}` })) : D.armor.filter(a => a.id !== 'shield').map(a => ({ a, n: a.name, s: `AC ${a['armor class (ac)']} · ${a.group}` }));
    const close = sheet(`${it.name}: เลือก${it.kind === 'weapon' ? 'อาวุธ' : 'เกราะ'}ฐาน`, h('div.ip',
      h('p.muted.small', `${it.sub || ''} — เลือกว่าเป็น${it.kind === 'weapon' ? 'อาวุธ' : 'เกราะ'}ชนิดไหน เว็บจะตั้งชื่อและผูกกับช่องโจมตี/AC ให้`),
      h('div.ip-list', opts.map(o => h('button.ip-row.ip-one', { onclick: () => { close(); addItem(it, { w: o.w, a: o.a }, after); } }, h('span.inv-ico', o.w ? '⚔️' : '🛡️'), h('div.ip-main', h('b', o.n), h('small', o.s)))),
        h('button.ip-row.ip-one', { onclick: () => { close(); addItem(it, { none: true }, after); } }, h('span.inv-ico', '✨'), h('div.ip-main', h('b', 'ไม่ระบุ'), h('small', 'เพิ่มเป็นของวิเศษเฉย ๆ ไม่ผูกกับอาวุธ/เกราะ'))))));
  }
  async function itemPicker(x) {
    try { await loadItems(); } catch { return toast('โหลดคลังไอเทมไม่ได้ ลองใหม่อีกครั้ง'); }
    const TH = D.itemTh || {};
    const all = [...D.weapons.map(w => ({ id: 'w:' + w.id, name: w.name, cat: 'weapon', w })), ...D.armor.map(a => ({ id: 'a:' + a.id, name: a.name, cat: 'armor', a })), ...D.items];
    const CATS = [['all', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'เกราะ/โล่'], ['gear', 'อุปกรณ์'], ['tool', 'เครื่องมือ'], ['use', 'ยา/ใช้แล้วหมด'], ['magic', 'ของวิเศษ']];
    const inCat = (it, k) => k === 'all' || (k === 'gear' ? /^(gear|pack|ammo|focus)$/.test(it.cat) : k === 'use' ? it.cat === 'consumable' || !!it.use : it.cat === k);
    let cat = 'all', q = '';
    const list = h('div.ip-list');
    const qi = h('input.inp.ip-q', { type: 'search', placeholder: 'ค้นหา เช่น potion, ยาฟื้น, rope, เชือก', 'aria-label': 'ค้นหาไอเทม', oninput: ev => { q = ev.target.value; render(); } });
    const chips = h('div.chips.filter.ip-cats', CATS.map(([k, l]) => h('button.chip' + (k === cat ? '.on' : ''), { onclick: ev => { cat = k; chips.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === ev.currentTarget)); render(); } }, l)));
    const preview = it => explain(it.name, [h('p.ip-pv-meta', h('span.inv-ico', itIco(it)), h('span', [TH[it.id]?.n, itMeta(it)].filter(Boolean).join(' · '))), ...itText(it)],
      [{ label: '＋ เพิ่มลงกระเป๋า', primary: true, onClick: () => { addItem(it); } }]);
    const row = it => h('div.ip-row',
      h('button.ip-pick', { onclick: () => preview(it) }, h('span.inv-ico', itIco(it)), h('div.ip-main', h('b', it.name), h('small', [TH[it.id]?.n, itMeta(it)].filter(Boolean).join(' · ')))),
      h('button.ip-add', { onclick: () => addItem(it), 'aria-label': `เพิ่ม ${it.name}` }, '＋'));
    function render() {
      const qq = q.trim().toLowerCase();
      const res = all.filter(it => inCat(it, cat) && (!qq || it.name.toLowerCase().includes(qq) || (TH[it.id]?.n || '').includes(qq)));
      list.replaceChildren(...[
        qq ? h('button.ip-row.ip-one.ip-custom', { onclick: () => { const n = q.trim(); c.equipment.items.push({ name: n, qty: 1 }); c.equipment.touched = true; done(); toast(`เพิ่ม ${n} แล้ว · แตะที่ของในกระเป๋าเพื่อใส่น้ำหนัก/คำอธิบาย`); } },
          h('span.inv-ico', '✏️'), h('div.ip-main', h('b', `เพิ่ม "${q.trim()}" เป็นของที่ตั้งชื่อเอง`), h('small', 'สำหรับของที่ DM ให้ หรือของที่ไม่มีในคลัง'))) : null,
        ...res.slice(0, 80).map(row),
        res.length > 80 ? h('p.muted.small.ip-more', `แสดง 80 จาก ${res.length} ชิ้น — พิมพ์ค้นหาหรือเลือกหมวดเพื่อให้แคบลง`) : null,
        !res.length ? h('p.muted.small.ip-more', 'ไม่เจอในคลัง ลองคำอื่น หรือกดเพิ่มเป็นของตั้งชื่อเองด้านบน') : null].filter(Boolean));
    }
    sheet('เพิ่มไอเทม', h('div.ip', qi, chips, list, h('p.muted.small', 'แตะชื่อเพื่ออ่านรายละเอียด · กด ＋ เพื่อใส่กระเป๋าทันที · ข้อมูลจาก SRD 5.2.1')));
    render();
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => qi.focus(), 250);
  }

  // แก้ของหนึ่งชิ้น: ถือ/สวม, จำนวน, น้ำหนัก, ของวิเศษ + Attunement, คำอธิบาย
  async function itemSheet(it, i, x) {
    const e = c.equipment;
    if (it.ref && !D.item) { try { await loadItems(); } catch { /* ไม่มีเน็ต — ไม่โชว์รายละเอียด */ } }
    const ref = it.ref && D.item?.[it.ref];
    let close;
    const ch = (fn, keep) => () => { fn(); e.touched = true; done(); if (!keep) { close(); itemSheet(it, e.items.indexOf(it), x); } };
    const chk = (label, val, fn) => h('label.row.check-row', h('input', { type: 'checkbox', checked: !!val, onchange: ch(fn) }), ' ' + label);
    const w = D.weapon[it.weapon], a = D.armorById[it.armor];
    const attN = e.items.filter(z => z.attuned && z !== it).length;
    close = sheet(it.name, h('div.item-edit',
      ref ? h('div.item-ref', h('p.ip-pv-meta', h('span.inv-ico', itIco(ref)), h('span', [D.itemTh?.[ref.id]?.n, itMeta(ref)].filter(Boolean).join(' · '))), ...itText(ref, { note: false })) : null,
      ref && (ref.use || ref.cat === 'consumable') && it.qty > 0 ? h('button.btn.use-one', { onclick: () => { it.qty -= 1; if (it.qty <= 0) e.items.splice(e.items.indexOf(it), 1); e.touched = true; done(); close(); toast(`ใช้ ${it.name} ไป 1 ชิ้น${it.qty > 0 ? ` · เหลือ ${it.qty}` : ' · หมดแล้ว'}`); if (it.qty > 0) itemSheet(it, e.items.indexOf(it), x); } }, `🧪 ใช้ 1 ชิ้น (เหลือ ${it.qty})`) : null,
      h('label.fld', h('small', 'ชื่อ'), h('input.inp', { value: it.name, onchange: ev => { const n = ev.target.value.trim(); if (n) { it.name = n; e.touched = true; done(); } } })),
      w ? h('p.small', `${w.damage} · ${w.properties || '—'}${w.mastery ? ` · Mastery: ${w.mastery}` : ''}`) : null,
      a ? h('p.small', `AC ${a['armor class (ac)']} · ${a.group}${a.strength && a.strength !== '-' ? ` · ต้องมี ${a.strength}` : ''}${a.stealth === 'Disadvantage' ? ' · Stealth เสียเปรียบ' : ''}`) : null,
      it.weapon ? chk('ถืออยู่ — ขึ้นในช่องโจมตี (เอาออก = เก็บในกระเป๋า)', it.equipped !== false, () => { it.equipped = it.equipped === false; }) : null,
      it.armor === 'shield' ? chk('ถือโล่ (AC +2)', e.shield, () => { e.shield = !e.shield; }) : null,
      it.armor && it.armor !== 'shield' ? chk('สวมเกราะนี้อยู่', e.armor === it.armor, () => { e.armor = e.armor === it.armor ? null : it.armor; }) : null,
      h('div.cu-grid',
        h('label.fld', h('small', 'จำนวน'), h('input.inp.num', { type: 'number', min: 0, value: it.qty, onchange: ev => { const q = parseInt(ev.target.value, 10) || 0; if (q <= 0) { e.items.splice(e.items.indexOf(it), 1); close(); } else it.qty = q; done(); } })),
        h('label.fld', h('small', 'น้ำหนัก/ชิ้น (lb)'), h('input.inp.num', { type: 'number', step: '0.25', min: 0, value: it.weight ?? '', placeholder: String(itemWeight({ ...it, weight: null })), onchange: ev => { if (ev.target.value === '') delete it.weight; else it.weight = +ev.target.value; done(); } }))),
      chk('✨ ของวิเศษ', it.magic, () => { it.magic = !it.magic; }),
      it.magic ? chk('ต้อง Attune ก่อนใช้', it.attune, () => { it.attune = !it.attune; if (!it.attune) delete it.attuned; }) : null,
      it.magic && it.attune ? chk(`Attune แล้ว (ตอนนี้ผูกอยู่ ${attN + (it.attuned ? 1 : 0)}/3)`, it.attuned, () => { if (!it.attuned && attN >= 3) return toast('ผูกครบ 3 ชิ้นแล้ว ต้องเลิกผูกชิ้นอื่นก่อน'); it.attuned = !it.attuned; }) : null,
      it.magic ? h('p.muted.small', 'ของวิเศษที่ให้โบนัส (เช่น ดาบ +1, Cloak of Protection) ใส่ตัวเลขได้ที่เมนู ⋯ → ปรับค่าเอง') : null,
      h('label.fld', h('small', 'คำอธิบาย / โน้ต'), h('textarea.inp', { rows: 3, placeholder: 'ใส่ความสามารถของของชิ้นนี้ หรือจดว่าได้มาจากไหน', oninput: ev => { it.desc = ev.target.value; save(); } }, it.desc || ''))),
      [{ label: '🗑️ ทิ้ง', onClick: () => { e.items.splice(e.items.indexOf(it), 1); if (it.armor === e.armor) e.armor = null; if (it.armor === 'shield' && !e.items.some(z => z.armor === 'shield')) e.shield = false; e.touched = true; done(); } },
        { label: 'เสร็จ', primary: true }]);
  }

  // ---------- FEATURES & TRAITS ----------
  function features(x) {
    const F = ui.feat, show = k => F === 'all' || F === k;
    const out = [h('div.chips.filter', [['all', 'ทั้งหมด'], ['class', 'Class'], ['species', 'Species'], ['feats', 'Feats']].map(([id, l]) => h('button.chip' + (F === id ? '.on' : ''), { onclick: () => { ui.feat = id; redraw(); } }, l)))];
    if (show('class') && x.cls) {
      out.push(h('button.btn.primary.lvup-btn', { onclick: () => openLevelUp(c, () => { S.save(c); redraw(); }) }, `⬆️ เลเวลอัป (→ Lv ${c.level + 1})`));
      out.push(previewNext(c, () => openLevelUp(c, () => { S.save(c); redraw(); })));
      out.push(h('h2.sec.src-class', h('span.src-tag', 'คลาส'), `${x.cls.name} ${x.CL}`));
      for (const f of x.feats) out.push(classFeatureCard(x.cls, f, f.src === 'sub'), ...featureMath(f.name, x, x.cls.id));
      if (x.CL >= 3 && x.sub?.stub) out.push(stubSubBox(x.sub, x.cls.id));
      const ch = c.choices || {};
      const chS = x.CLs.sorcerer ? chOf(c, 'sorcerer') : {}, chW = x.CLs.warlock ? chOf(c, 'warlock') : {};
      const opts = [...(chS.metamagic || []).map(id => D.cls.sorcerer.options['metamagic-options']?.items.find(i => i.id === id)), ...(chW.invocations || []).map(id => D.cls.warlock.options['eldritch-invocation-options']?.items.find(i => i.id === id))].filter(Boolean);
      if (opts.length) { out.push(h('h3', 'ตัวเลือกที่เลือกไว้')); opts.forEach(o => out.push(featureCard({ name: o.name, text: o.text, th: { s: D.th.options?.[o.id] }, full: ['options', o.id] }))); }
      if (ch.huntersPrey && x.sub === x.cls.subclass) out.push(h('p', h('b', "Hunter's Prey: "), ch.huntersPrey));
      if (ch.divineOrder || ch.primalOrder) out.push(h('p', h('b', 'บทบาท: '), ch.divineOrder || ch.primalOrder));
      if (x.masteryIds.length) out.push(h('p', h('b', 'Weapon Mastery: '), x.masteryIds.map(id => `${D.weapon[id]?.name} (${D.weapon[id]?.mastery})`).join(', ')));
      for (const mc of x.mcFeats) {
        out.push(h('h2.sec.src-class', h('span.src-tag', 'คลาส'), `${mc.cls.name} ${mc.n}`), h('p.muted.small', `Multiclass${mc.n >= 3 ? ` · ซับคลาส ${mc.sub.name}` : ''}`));
        for (const f of mc.feats) out.push(classFeatureCard(mc.cls, f, f.src === 'sub'), ...featureMath(f.name, x, mc.cls.id));
        if (mc.n >= 3 && mc.sub?.stub) out.push(stubSubBox(mc.sub, mc.cls.id));
      }
      if (c.level > 1) out.push(h('details.orig', h('summary', `ประวัติเลเวล (${c.level})`),
        h('ol.lv-hist', levelInfo(c).map(li => h('li', levelSummary(c, li, x))))));
    }
    if (show('species') && x.sp) {
      out.push(h('h2.sec.src-species', h('span.src-tag', 'เผ่า'), x.sp.name));
      for (const t of x.sp.traits) out.push(featureCard({ name: t.name, text: t.text, th: D.th.species?.[x.sp.id]?.f?.[t.id] || (x.sp.open ? { t: t.t } : null), full: traitFull(x.sp, t.id), pack: x.sp.open ? x.sp.pack : null, open: x.sp.open }), ...featureMath(t.name, x));
    }
    if (show('feats') && x.featIds.length) {
      out.push(h('h2.sec.src-feat', h('span.src-tag', 'Feat'), 'Feats'));
      for (const id of new Set(x.featIds)) { const f = D.feat[id]; if (f) out.push(featureCard({ name: f.name, text: f.text, th: D.th.feats?.[id], tag: f.category, full: featFull(id), pack: f.pack, open: f.open })); }
    }
    return out;
  }

  // ---------- BACKGROUND ----------
  const field = (k, label, opt) => detailField(Dt, save, k, label, opt);

  function background(x) {
    const out = [];
    if (x.bg) {
      const th = D.th.backgrounds?.[x.bg.id];
      out.push(head('BACKGROUND', 'ภูมิหลัง'), h('div.card',
        h('b', x.bg.name), x.bg.pack ? h('span.pack-badge', srcTag(x.bg)) : null,
        th?.s ? h('p.th', th.s) : null,
        h('dl.kv',
          h('dt', 'ค่าพลังที่ได้โบนัส'), h('dd', (x.bg.abilities || []).join(', ')),
          h('dt', 'Skills'), h('dd', x.bg.skills.join(', ')),
          x.bg.tool ? [h('dt', 'Tool'), h('dd', x.bg.tool.replace(/\s*\(see.*?\)/g, ''))] : null,
          h('dt', 'Origin Feat'), h('dd', x.bg.feat))));
    } else out.push(h('p.muted', 'ยังไม่ได้เลือก Background'));
    for (const [k, en, th, el] of detailGroups(Dt, save)) if (k !== 'people') out.push(head(en, th), el);
    out.push(built(x));
    return out;
  }

  // ตัวละครนี้สร้างมายังไง (สรุปทุกอย่างที่เลือกในวิซาร์ด)
  function built(x) {
    const A = c.abilities || {}, rows = [];
    const row = (k, v) => v && rows.push(h('dt', k), h('dd', v));
    const join = a => a.filter(Boolean).join(' · ');
    const names = (ids, f) => (ids || []).map(f).filter(Boolean).join(', ');
    const METH = { standard: 'ชุดมาตรฐาน', pointbuy: 'ซื้อแต้ม', roll: 'ทอยเต๋า' };
    row('ค่าพลังตั้งต้น', `${METH[A.method || 'standard']}: ` + ABIL.map(a => `${ABIL_SHORT[a]} ${A.base?.[a] ?? 10}`).join(' '));
    row(`โบนัส ${x.bg?.name || 'Background'}`, Object.entries(A.bonus || {}).filter(([, n]) => n).map(([a, n]) => `${ABIL_SHORT[a]} +${n}`).join(' '));
    row('ASI / Feat', levelInfo(c).filter(li => (li.asi || li.boon) && li.e.feat).map(li => `Lv ${li.lv} ${D.feat[li.e.feat]?.name || li.e.feat}` +
      Object.entries(li.e.asi || {}).filter(([, n]) => n).map(([a, n]) => ` ${ABIL_SHORT[a]}+${n}`).join('')).join(' · '));
    row('ค่าพลังตอนนี้', ABIL.map(a => `${ABIL_SHORT[a]} ${x.score[a]}`).join(' '));
    for (const [id, n] of Object.entries(x.CLs)) {
      const k = D.cls[id], ch = chOf(c, id), primary = id === c.classId;
      const sub = primary ? x.sub : x.mcFeats.find(m => m.cls.id === id)?.sub;
      const opt = (key, list) => names(ch[key], o => D.cls[id].options?.[list]?.items.find(i => i.id === o)?.name);
      row(`${k?.name} ${n}`, join([
        n >= 3 && sub ? `ซับคลาส ${sub.name}` : null,
        (primary ? c.skills : c.mc?.[id]?.skills)?.length ? 'สกิล ' + (primary ? c.skills : c.mc[id].skills).join(', ') : null,
        ch.fightingStyle ? 'Fighting Style ' + (D.feat[ch.fightingStyle]?.name || ch.fightingStyle) : null,
        ch.divineOrder || ch.primalOrder ? 'บทบาท ' + (ch.divineOrder || ch.primalOrder) : null,
        ch.mastery?.length ? 'Mastery ' + names(ch.mastery, w => D.weapon[w]?.name) : null,
        ch.expertise?.length ? 'Expertise ' + ch.expertise.join(', ') : null,
        ch.primalSkill ? 'Primal Knowledge ' + ch.primalSkill : null,
        ch.loreSkills?.length ? 'Bonus Proficiencies ' + ch.loreSkills.join(', ') : null,
        ch.land ? 'ดินแดน ' + ch.land : null,
        ch.huntersPrey ? "Hunter's Prey " + ch.huntersPrey : null,
        ch.metamagic?.length ? 'Metamagic ' + opt('metamagic', 'metamagic-options') : null,
        ch.invocations?.length ? 'Invocations ' + opt('invocations', 'eldritch-invocation-options') : null,
        ...Object.values(ch.packOpt || {}).map(v => 'เลือก ' + v)]));
    }
    if (x.bg) row(x.bg.name, join([`สกิล ${x.bg.skills.join(', ')}`, x.bg.tool ? 'เครื่องมือ ' + x.bg.tool.replace(/\s*\(see.*?\)/g, '') : null, 'Origin Feat ' + x.bg.feat]));
    if (x.sp) row(x.sp.name, join(Object.entries(c.speciesOpt || {}).map(([k2, v]) => (k2 === 'feat' ? 'Origin Feat ' + (D.feat[v]?.name || v) : k2 === 'skill' ? 'สกิล ' + v : typeof v === 'string' ? v : null))));
    row('ภาษา', x.langs.join(', '));
    return h('details.orig.built', h('summary', '🧾 ตัวละครนี้สร้างมายังไง'), h('dl.kv', rows),
      h('button.btn.ghost.small', { onclick: () => nav(`#/edit/${c.id}/basic`) }, '✏️ แก้ไขตัวเลือก'));
  }

  // ---------- EXTRAS: ร่าง Wild Shape + สัตว์คู่ใจ / สิ่งที่เรียกมา ----------
  if (P.wild && !D.animals) loadAnimals().then(() => redraw()).catch(() => {});
  const wildOf = () => (c.extras || []).find(z => z.id === P.wild);
  const crTxt = n => (n === 0.125 ? '1/8' : n === 0.25 ? '1/4' : n === 0.5 ? '1/2' : String(n));
  function wildBanner(x) {
    const w = wildOf();
    if (!P.wild || !w) return null;
    const a = D.animal?.[w.animal], f = x?.wild?.from;
    const ch = (l, o, n) => (o !== n ? `${l} ${o}→${n}` : null);
    return h('div.conc-chip.wild-chip', h('span', '🐾 อยู่ในร่าง ', h('b', w.name),
      f ? h('small', ' — ' + [ch('AC', f.ac, x.ac), ch('Speed', f.speed, x.speed), ch('STR', f.str, x.score.str), ch('DEX', f.dex, x.score.dex), ch('CON', f.con, x.score.con)].filter(Boolean).join(' · ') + ' · ร่ายเวทไม่ได้') : a ? '' : ' (กำลังโหลดค่าสถานะ…)'),
      a ? h('button.link', { onclick: () => statSheet(a) }, 'ค่าสถานะ') : null,
      h('button.btn.small', { onclick: () => { P.wild = null; done(); toast(`กลับร่างเดิมแล้ว`); } }, 'กลับร่าง'));
  }
  function statSheet(a) {
    const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    sheet(a.name, h('div.statblock',
      h('p.muted', a.meta),
      h('div.box3', box('AC', null, String(a.ac), null, null), box('HP', a.hpDice, String(a.hp), null, null), box('CR', null, a.cr, null, null)),
      h('p', h('b', 'Speed: '), a.speed),
      h('div.sb-abil', AB.map(k => h('div', h('small', k.toUpperCase()), h('b', String(a.abil[k] ?? 10)), h('span', sign(Math.floor(((a.abil[k] ?? 10) - 10) / 2)))))),
      a.info ? h('div.md', { html: md(a.info.replace(/ \*\*/g, '\n\n**')) }) : null,
      h('div.md', { html: md(a.md) })));
  }
  function pickAnimal(title, filter, onPick, hint) {
    const q = h('input.inp', { type: 'search', placeholder: 'ค้นหาชื่อสัตว์ (อังกฤษ)', oninput: () => { const v = q.value.trim().toLowerCase(); list.querySelectorAll('.titem').forEach(r => { r.hidden = !r.dataset.n.includes(v); }); } });
    let close;
    const list = h('div.titems', D.animals.filter(filter).sort((a, b) => a.crN - b.crN || a.name.localeCompare(b.name)).map(a => h('button.titem', { 'data-n': a.name.toLowerCase(), onclick: () => { close(); onPick(a); } },
      h('div', h('b', a.name), h('i.tag', `CR ${a.cr}`), h('small', `AC ${a.ac} · HP ${a.hp} · ${a.speed}`)))));
    close = sheet(title, h('div', hint ? h('p.muted.small', hint) : null, q, list));
  }
  function extras(x) {
    if (!D.animals) { loadAnimals().then(() => cur === 'extras' && redraw()).catch(() => toast('โหลดข้อมูลสัตว์ไม่ได้')); return [h('p.muted', 'กำลังโหลดข้อมูลสัตว์…')]; }
    const E = c.extras = c.extras || [];
    const out = [];
    const dl = x.CLs.druid || 0;
    if (dl >= 2) {
      const [nF, maxCR, fly] = dl >= 8 ? [8, 1, true] : dl >= 4 ? [6, 0.5, false] : [4, 0.25, false];
      const forms = E.filter(z => z.kind === 'wild');
      const res = x.res.find(r => /(^|-)wild$/.test(r.id));
      const left = res ? res.max - (P.res[res.id] || 0) : null;
      out.push(head('WILD SHAPE', 'แปลงร่างเป็นสัตว์'),
        h('p.small', `รู้ร่างได้ ${nF} แบบ (ตอนนี้ ${forms.length}) · เลือกได้ถึง CR ${crTxt(maxCR)} · ${fly ? 'ร่างที่บินได้ก็ได้' : 'ยังใช้ร่างที่บินได้ไม่ได้'}${left != null ? ` · ใช้ได้อีก ${left} ครั้ง` : ''}`),
        h('p.muted.small', `แปลงร่างใช้ Bonus Action · อยู่ได้ ${Math.floor(dl / 2)} ชั่วโมง · ได้ Temp HP เท่ากับเลเวล Druid (${dl}) · HP, INT, WIS, CHA และสกิลยังเป็นของเราเอง ส่วน STR, DEX, CON, AC และ Speed ใช้ของสัตว์`),
        wildBanner(x),
        h('div.titems', forms.map(f => { const a = D.animal[f.animal]; return h('div.titem.extra', h('div', h('b', f.name), a ? h('i.tag', `CR ${a.cr}`) : null, a ? h('small', `AC ${a.ac} · ${a.speed}`) : null),
          h('div.ex-btns', a ? h('button.btn.small', { onclick: () => statSheet(a) }, 'ค่าสถานะ') : null,
            P.wild === f.id ? null : h('button.btn.small.primary', { onclick: () => {
              if (left === 0 && !confirm('Wild Shape ใช้ครบแล้ว — แปลงร่างต่อไหม?')) return;
              if (res) P.res[res.id] = (P.res[res.id] || 0) + 1;
              P.wild = f.id; P.temp = Math.max(P.temp, dl);
              const m = P.turn ? T.spend(P, 'b') : '';
              done(); toast(`🐾 แปลงร่างเป็น ${f.name} · Temp HP ${P.temp}${m ? ' · ' + m : ''}`);
            } }, 'แปลงร่าง'),
            h('button.icon-btn', { 'aria-label': 'ลบร่าง', onclick: () => { E.splice(E.indexOf(f), 1); if (P.wild === f.id) P.wild = null; done(); } }, '✕'))); })),
        forms.length < nF ? h('button.btn', { onclick: () => pickAnimal('เพิ่มร่างที่รู้', a => a.crN <= maxCR && (fly || !/Fly/i.test(a.speed)) && /Beast/.test(a.meta),
          a => { E.push({ id: uid(), kind: 'wild', name: a.name, animal: a.id }); done(); }, `แสดงเฉพาะสัตว์ CR ${crTxt(maxCR)} ลงไป${fly ? '' : ' ที่บินไม่ได้'}`) }, '+ เพิ่มร่างที่รู้') : null);
    }
    const KIND = { familiar: 'Familiar', steed: 'Steed', summon: 'Summon', pet: 'สัตว์เลี้ยง / พาหนะ', other: 'อื่น ๆ' };
    const comps = E.filter(z => z.kind !== 'wild');
    out.push(head('COMPANIONS', 'สัตว์คู่ใจ / สิ่งที่เรียกมา'),
      comps.length ? null : h('p.muted.small', 'เช่น Familiar จากเวท Find Familiar, ม้าที่ขี่ หรือสิ่งที่เรียกมาด้วยเวท Summon — เพิ่มไว้เพื่อจด HP และดูค่าสถานะตอนเล่น'),
      comps.map(z => {
        const a = D.animal[z.animal];
        const amt = h('input.inp.num', { type: 'number', inputmode: 'numeric', min: 0, placeholder: '0', 'aria-label': 'จำนวน' });
        const v = () => Math.max(0, parseInt(amt.value, 10) || 0);
        return h('div.card.extra-card',
          h('div.ex-head', h('div', h('b', z.name), h('i.tag', KIND[z.kind] || z.kind), h('small', [`AC ${z.ac}`, z.speed].filter(Boolean).join(' · '))),
            h('div.ex-hp', h('b', String(z.hp)), h('small', `/${z.hpMax} HP`))),
          h('div.hp-ctl.ex-ctl',
            h('button.btn.heal', { onclick: () => { z.hp = Math.min(z.hpMax, z.hp + v()); done(); } }, '+ ฮีล'), amt,
            h('button.btn.dmg', { onclick: () => { z.hp = Math.max(0, z.hp - v()); done(); if (!z.hp) toast(`${z.name} HP เหลือ 0`); } }, '− โดนตี')),
          z.notes ? h('p.small', z.notes) : null,
          h('div.ex-btns', a ? h('button.btn.small', { onclick: () => statSheet(a) }, 'ค่าสถานะ') : null,
            h('button.btn.small', { onclick: () => { z.hp = z.hpMax; done(); } }, 'HP เต็ม'),
            h('button.btn.small', { onclick: async () => { if (await confirmSheet(`ลบ ${z.name}?`, 'ลบออกจากรายการสัตว์คู่ใจ', 'ลบ')) { E.splice(E.indexOf(z), 1); done(); } } }, 'ลบ')));
      }),
      h('div.row.wrap',
        h('button.btn', { onclick: () => pickAnimal('เลือกสัตว์จาก SRD', () => true, a => { E.push({ id: uid(), kind: a.crN === 0 ? 'familiar' : 'pet', name: a.name, animal: a.id, ac: a.ac, hp: a.hp, hpMax: a.hp, speed: a.speed }); done(); },
          'Find Familiar เลือกได้: Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider, Weasel หรือสัตว์ CR 0 ตัวอื่น') }, '+ เพิ่มจากสัตว์ SRD'),
        h('button.btn', { onclick: customExtra }, '+ สร้างเอง')),
      h('p.muted.small', '💡 สิ่งที่เรียกด้วยเวท (เช่น Find Steed หรือเวท Summon) มีค่าสถานะอยู่ในคำอธิบายเวท — กด "สร้างเอง" แล้วกรอก AC กับ HP ตามนั้น'));
    return out;
  }
  function customExtra() {
    const f = { kind: 'other' };
    const inp = (k, label, type = 'text') => h('label.fld', h('small', label), h('input.inp' + (type === 'number' ? '.num' : ''), { type, inputmode: type === 'number' ? 'numeric' : null, oninput: e => { f[k] = e.target.value; } }));
    sheet('สร้างสัตว์คู่ใจเอง', h('div',
      inp('name', 'ชื่อ'),
      h('label.fld', h('small', 'ประเภท'), h('select.inp', { onchange: e => { f.kind = e.target.value; } }, [['other', 'อื่น ๆ'], ['familiar', 'Familiar'], ['steed', 'Steed (Find Steed)'], ['summon', 'Summon (เรียกด้วยเวท)'], ['pet', 'สัตว์เลี้ยง / พาหนะ']].map(([v, l]) => h('option', { value: v, selected: v === 'other' }, l)))),
      h('div.cu-grid', inp('ac', 'AC', 'number'), inp('hp', 'HP สูงสุด', 'number'), inp('speed', 'Speed')),
      h('label.fld', h('small', 'โน้ต (ท่าโจมตี ความสามารถ)'), h('textarea.inp', { rows: 3, oninput: e => { f.notes = e.target.value; } }))),
      [{ label: 'เพิ่ม', primary: true, onClick: () => {
        if (!f.name?.trim()) { toast('ใส่ชื่อก่อนนะ'); return false; }
        const hp = Math.max(1, parseInt(f.hp, 10) || 1);
        (c.extras = c.extras || []).push({ id: uid(), kind: f.kind, name: f.name.trim(), ac: parseInt(f.ac, 10) || 10, hp, hpMax: hp, speed: f.speed || '', notes: f.notes || '' });
        done();
      } }]);
  }

  // ---------- NOTES ----------
  function notes() {
    return [
      head('ADVENTURE NOTES', 'โน้ตการผจญภัย'),
      h('textarea.inp', { rows: 10, placeholder: 'ชื่อ NPC เควสที่รับมา ของที่ได้ เบาะแสที่เจอ…', oninput: e => { c.notes = e.target.value; save(); } }, c.notes || ''),
      head('ORGANIZATIONS', 'องค์กร / กลุ่มที่สังกัด'), field('orgs', '', { rows: 3 }),
      head('ALLIES', 'พันธมิตร'), field('allies', '', { rows: 3 }),
      head('ENEMIES', 'ศัตรู'), field('enemies', '', { rows: 3 }),
      head('OTHER', 'อื่น ๆ'), field('other', '', { rows: 3 }),
    ];
  }

  draw();
}
