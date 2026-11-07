// หน้าแรก (รายชื่อตัวละคร), นำเข้าจากลิงก์, เครดิต
import { D } from '../data.js';
import { h, iconSvg, toast } from '../util.js';
import * as S from '../store.js';
import { compute, newCharacter } from '../rules.js';
import { md } from '../md.js';

export function renderHome(root, nav) {
  const chars = S.list();
  const m = S.meta();
  const stale = chars.length && (!m.lastBackup || Date.now() - m.lastBackup > 7 * 864e5);
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    try { const n = await S.importFile(e.target.files[0]); toast(`นำเข้า ${n} ตัวละครแล้ว`); renderHome(root, nav); }
    catch (err) { toast(err.message === 'pack' ? 'นี่เป็นไฟล์ Content Pack — นำเข้าที่หน้า "แพ็ก"' : 'ไฟล์นี้อ่านไม่ได้'); }
  } });
  root.replaceChildren(...[
    h('section.hero',
      h('h1', 'Character ของคุณ'),
      h('p', 'สร้างตัวละครภาษาไทย ใช้กฎ D&D 2024 (SRD 5.2.1) — เซฟในเครื่องอัตโนมัติ ไม่ต้องล็อกอิน'),
      h('button.btn.primary.big', { onclick: () => { const c = newCharacter(); S.save(c); nav(`#/edit/${c.id}/basic`); } }, '+ สร้างตัวละครใหม่'),
      h('p', h('a', { href: '#/help' }, '🎓 เพิ่งเล่นครั้งแรก? อ่าน "เล่นยังไง" ก่อนได้'))),
    stale ? h('div.banner', '💾 ข้อมูลอยู่ในเครื่องนี้เท่านั้น ถ้าล้างข้อมูลเบราว์เซอร์จะหาย — ',
      h('button.link', { onclick: () => { S.exportFile(chars); toast('ดาวน์โหลดไฟล์สำรองแล้ว'); renderHome(root, nav); } }, 'สำรองไว้ตอนนี้')) : null,
    chars.length ? h('div.char-list', chars.map(c => {
      let x = null;
      try { x = compute(c); } catch { /* ข้อมูลไม่ครบ */ }
      return h('a.char-card', { href: `#/c/${c.id}` },
        c.portrait ? h('img.char-ico.pic', { src: c.portrait, alt: '' }) : h('span.char-ico', { html: iconSvg(c.classId || 'd20') }),
        h('div', h('b', c.name || 'Character ไร้ชื่อ'), h('small', [x?.sp?.name, x?.cls ? x.classLine : 'ยังไม่เลือกคลาส'].filter(Boolean).join(' · '))),
        x?.cls ? h('div.char-stats', h('span', `AC ${x.ac}`), h('span', `HP ${c.play?.hp ?? x.hpMax}/${x.hpMax}`)) : null);
    })) : h('p.empty', 'ยังไม่มีตัวละคร — กดปุ่มด้านบนเพื่อเริ่มสร้างเลย'),
    h('div.row.home-tools',
      h('button.btn.ghost', { onclick: () => fileIn.click() }, h('span', { html: iconSvg('upload') }), ' นำเข้าไฟล์'),
      chars.length ? h('button.btn.ghost', { onclick: () => { S.exportFile(chars); toast('ดาวน์โหลดไฟล์สำรองแล้ว'); } }, h('span', { html: iconSvg('download') }), ' สำรองทั้งหมด') : null,
      fileIn),
  ].filter(Boolean));
}

export async function renderImport(root, data, nav) {
  root.replaceChildren(h('div.loading', 'กำลังเปิดตัวละคร…'));
  try {
    const c = await S.decodeChar(data);
    const x = compute(c);
    root.replaceChildren(h('section.hero',
      h('span.hero-ico', { html: iconSvg(c.classId || 'd20') }),
      h('h1', c.name || 'Character ไร้ชื่อ'),
      h('p', [x.sp?.name, x.cls ? x.classLine : null, x.bg?.name].filter(Boolean).join(' · ')),
      h('p.muted', 'มีคนแชร์ตัวละครนี้ให้คุณ — บันทึกลงเครื่องเพื่อเปิดดูและใช้งาน'),
      c.packs?.length ? h('p.muted.small', `📦 มีของจาก Content Pack ${c.packs.reduce((n, p) => n + Object.values(p.items).flat().length, 0)} รายการ (${c.packs.map(p => p.name).join(', ')}) — จะเพิ่มลงเครื่องให้ตอนบันทึก`) : null,
      h('div.row', h('button.btn.primary.big', { onclick: () => { S.save(c); nav(`#/c/${c.id}`); toast('บันทึกลงเครื่องแล้ว'); } }, 'บันทึกลงเครื่องนี้'),
        h('a.btn.ghost', { href: '#/' }, 'ยกเลิก'))));
  } catch {
    root.replaceChildren(h('section.hero', h('h1', 'ลิงก์นี้เปิดไม่ได้'), h('p', 'ลิงก์อาจถูกตัดตอนคัดลอก ลองขอลิงก์ใหม่หรือใช้ไฟล์สำรองแทน'), h('a.btn', { href: '#/' }, 'กลับหน้าแรก')));
  }
}

export function renderCredits(root) {
  root.replaceChildren(h('section.prose',
    h('h1', 'เครดิตและไลเซนส์'),
    h('h3', 'ข้อมูลกฎเกม'),
    h('p', 'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at ',
      h('a', { href: 'https://www.dndbeyond.com/srd', target: '_blank', rel: 'noopener' }, 'https://www.dndbeyond.com/srd'),
      '. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at ',
      h('a', { href: 'https://creativecommons.org/licenses/by/4.0/legalcode', target: '_blank', rel: 'noopener' }, 'https://creativecommons.org/licenses/by/4.0/legalcode'), '.'),
    h('p', 'คำอธิบายภาษาไทยในเว็บนี้เป็นการสรุปและแปลความจาก SRD 5.2.1 (มีการดัดแปลง) ส่วนข้อความภาษาอังกฤษแสดงตามต้นฉบับ เว็บนี้เป็นงานแฟนเมด ใช้ได้กับกฎ "fifth edition" (5E compatible) และไม่ได้เกี่ยวข้องหรือได้รับการรับรองจาก Wizards of the Coast'),
    h('p', 'ข้อมูล SRD แปลงเป็นมาร์กดาวน์โดย ', h('a', { href: 'https://github.com/oldmanumby/dnd.srd.5.2', target: '_blank', rel: 'noopener' }, 'oldmanumby/dnd.srd.5.2'), ' (CC-BY-4.0)'),
    D.open?.docs?._ogl ? [
      h('h3', 'คอนเทนต์เสริม (Open Game License 1.0a)'),
      h('p', 'ซับคลาส Background Feat สเปล และเผ่าที่ขึ้นป้าย 📖 มาจากหนังสือต่อไปนี้ ซึ่งเผยแพร่เป็น Open Game Content ภายใต้ Open Game License v1.0a ข้อมูลดึงจาก ',
        h('a', { href: 'https://github.com/open5e/open5e-api', target: '_blank', rel: 'noopener' }, 'Open5e'), ' แล้วดัดแปลงให้เข้ากับกฎ 2024 และแปลเป็นภาษาไทย (การแปลและดัดแปลงนี้ก็เป็น Open Game Content ด้วย) · ไม่มีการใช้ Product Identity ของผู้จัดพิมพ์'),
      h('ul', Object.entries(D.open.docs).filter(([k]) => k[0] !== '_').map(([, d]) => h('li', h('b', d.title), d.organization ? ` — ${d.organization}` : '', d.url ? [' · ', h('a', { href: d.url, target: '_blank', rel: 'noopener' }, 'ลิงก์')] : null))),
      h('details.orig', h('summary', 'Open Game License v1.0a + Section 15 (ต้นฉบับ)'), h('div.md', { html: md(D.open.docs._ogl) }))] : null,
    h('h3', 'ไอคอน'),
    h('p', 'Icons by Lorc, Delapouite and contributors from ', h('a', { href: 'https://game-icons.net', target: '_blank', rel: 'noopener' }, 'game-icons.net'), ', licensed under ',
      h('a', { href: 'https://creativecommons.org/licenses/by/3.0/', target: '_blank', rel: 'noopener' }, 'CC BY 3.0'), '.'),
    h('h3', 'ข้อมูลของคุณ'),
    h('p', 'ตัวละครทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ไม่มีการส่งขึ้นเซิร์ฟเวอร์ ลิงก์แชร์คือข้อมูลตัวละครที่บีบอัดไว้ในลิงก์เอง'),
    h('details.orig', h('summary', 'SRD 5.2.1 Legal Information (ต้นฉบับ)'), h('div.md', { html: md(D.legal) }))));
}
