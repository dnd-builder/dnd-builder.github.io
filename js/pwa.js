// เว็บแอป: ปุ่มติดตั้งลงหน้าจอ, แจ้งเมื่อมีเวอร์ชันใหม่, ความสูงแถบบน
import { h, sheet, toast } from './util.js';

let deferred = null;           // beforeinstallprompt (Android / Chrome / Edge)
const slots = new Set();
const ua = navigator.userAgent;

export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inAppBrowser = () => /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|Messenger|Discord/i.test(ua);
const mobile = () => isIOS() || /Android/i.test(ua);
export const canInstall = () => !standalone() && (!!deferred || (mobile() && (isIOS() || inAppBrowser())));

const refresh = () => slots.forEach(f => (f.el.isConnected ? f() : slots.delete(f)));

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
window.addEventListener('appinstalled', () => { deferred = null; refresh(); toast('ติดตั้งแล้ว เปิดจากไอคอน DnD Builder บนหน้าจอได้เลย'); });

// ขั้นตอนติดตั้งแบบเลือกตามเครื่อง
function guide() {
  const step = (n, t) => h('li', h('b', n), ' ', t);
  let title = 'ติดตั้งเป็นแอป', body;
  if (inAppBrowser()) {
    title = 'เปิดในเบราว์เซอร์ก่อนนะ';
    body = [
      h('p', 'ตอนนี้เปิดอยู่ในแอปแชต (เช่น LINE) ซึ่งติดตั้งแอปไม่ได้ ให้เปิดลิงก์นี้ในเบราว์เซอร์หลักของเครื่องก่อน'),
      h('ol.ins-steps',
        step('1.', 'แตะปุ่ม ⋯ หรือ ⋮ มุมขวาบน/ขวาล่างของหน้าจอ'),
        step('2.', isIOS() ? 'เลือก "เปิดใน Safari" (หรือ "เปิดในเบราว์เซอร์")' : 'เลือก "เปิดในเบราว์เซอร์" หรือ "เปิดใน Chrome"'),
        step('3.', 'พอเปิดแล้ว กดปุ่ม "ติดตั้งเป็นแอป" ในหน้าแรกอีกครั้ง')),
      h('p.muted.small', 'ตัวละครที่สร้างในแอปแชตจะอยู่แยกกับในเบราว์เซอร์ ถ้าสร้างไว้แล้ว ให้กด "สำรองทั้งหมด" แล้วนำเข้าไฟล์ในเบราว์เซอร์อีกที'),
    ];
  } else if (isIOS()) {
    const safari = !/CriOS|FxiOS|EdgiOS/.test(ua);
    body = [
      h('p', 'เพิ่มไอคอนไว้บนหน้าจอโฮม แล้วเปิดใช้แบบเต็มจอเหมือนแอปทั่วไป ใช้ได้แม้ไม่มีเน็ต'),
      h('ol.ins-steps',
        step('1.', safari ? 'แตะปุ่ม "แชร์" (สี่เหลี่ยมมีลูกศรชี้ขึ้น ⬆︎) ที่แถบด้านล่างหรือด้านบนของ Safari' : 'แตะปุ่ม "แชร์" (⬆︎) ที่แถบที่อยู่ของเบราว์เซอร์'),
        step('2.', 'เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)'),
        step('3.', 'แตะ "เพิ่ม" มุมขวาบน แล้วเปิดจากไอคอน DnD Builder ได้เลย')),
      h('p.muted.small', 'ถ้าไม่เห็นเมนูนี้ ให้เปิดลิงก์ใน Safari ก่อน · ตัวละครที่สร้างในเบราว์เซอร์จะไม่ตามไปในแอปเอง ใช้ "สำรองทั้งหมด" แล้วนำเข้าในแอปได้'),
    ];
  } else {
    body = [
      h('p', 'เพิ่มไอคอนไว้บนหน้าจอ แล้วเปิดใช้แบบเต็มจอเหมือนแอปทั่วไป ใช้ได้แม้ไม่มีเน็ต'),
      h('ol.ins-steps',
        step('1.', 'แตะปุ่ม ⋮ มุมขวาบนของ Chrome'),
        step('2.', 'เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"'),
        step('3.', 'แตะ "ติดตั้ง" แล้วเปิดจากไอคอน DnD Builder ได้เลย')),
    ];
  }
  sheet(title, h('div.ins-guide', body), [{ label: 'เข้าใจแล้ว', primary: true }]);
}

export async function install() {
  if (!deferred) return guide();
  const e = deferred;
  deferred = null;
  e.prompt();
  try { await e.userChoice; } catch { /* ผู้ใช้ปิดเอง */ }
  refresh();
}

// การ์ดชวนติดตั้งในหน้าแรก (ซ่อนเองถ้าติดตั้งแล้ว / ปิดทิ้งได้)
export function installCard({ dismissable = true } = {}) {
  const el = h('div.install-slot');
  const fill = () => {
    let hide = false;
    try { hide = dismissable && localStorage.getItem('hh.installHide') === '1'; } catch {}
    el.replaceChildren(...(canInstall() && !hide ? [h('div.install-card',
      h('span.ic-ico', '📲'),
      h('div.ic-txt', h('b', 'ติดตั้งเป็นแอป'), h('small', 'เปิดจากไอคอนบนมือถือ เต็มจอ และใช้ได้แม้ไม่มีเน็ตตอนเล่น')),
      h('button.btn.primary', { onclick: install }, 'ติดตั้ง'),
      dismissable ? h('button.icon-btn', { 'aria-label': 'ซ่อน', onclick: () => { try { localStorage.setItem('hh.installHide', '1'); } catch {} fill(); toast('ซ่อนแล้ว — ติดตั้งภายหลังได้ที่หน้า "เครดิต"'); } }, '✕') : null)] : []));
  };
  fill.el = el;
  slots.add(fill);
  fill();
  return el;
}

// ความสูงแถบบน (รวมขอบรอยบาก) ให้ส่วนที่ติดหนึบด้านบนวางถูกที่
export function syncBarHeight() {
  const set = () => document.documentElement.style.setProperty('--topbar-h', (document.querySelector('.topbar')?.offsetHeight || 53) + 'px');
  set();
  addEventListener('resize', set);
  addEventListener('orientationchange', () => setTimeout(set, 300));
}

// service worker + แถบ "มีเวอร์ชันใหม่"
export function initSW() {
  if (standalone()) document.documentElement.classList.add('standalone');
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    // แอปที่เปิดค้างไว้ในมือถือ: เช็กอัปเดตทุกครั้งที่กลับมาเปิด
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let shown = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || shown) return;
    shown = true;
    document.body.append(h('button.update-bar', { type: 'button', onclick: () => location.reload() },
      h('span', '✨ มีเวอร์ชันใหม่แล้ว'), h('b', 'แตะเพื่อโหลดใหม่'), h('small', 'ตัวละครไม่หาย')));
  });
}
