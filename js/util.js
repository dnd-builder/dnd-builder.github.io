// ตัวช่วยพื้นฐาน: สร้าง element, ไอคอน, toast, bottom sheet
import { D } from './data.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** h('div.card#x', {onclick}, child...) */
export function h(tag, attrs, ...kids) {
  const [, name, rest] = tag.match(/^([a-z0-9]+)?(.*)$/i);
  const el = document.createElement(name || 'div');
  (rest.match(/[.#][^.#]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) return k.forEach(add);
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

export function iconSvg(name, cls = '') {
  const body = D.icons?.[name];
  if (!body) return '';
  return `<svg class="ico ${cls}" viewBox="0 0 512 512" aria-hidden="true">${body}</svg>`;
}
export const icon = (name, cls) => h('span.ico-wrap', { html: iconSvg(name, cls) });

export function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => { el.innerHTML = iconSvg(el.dataset.icon); });
}

export const sign = n => (n >= 0 ? '+' : '−') + Math.abs(n);

let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/** bottom sheet แบบมือถือ — คืนฟังก์ชันปิด */
export function sheet(title, content, actions = [], opt = {}) {
  const root = $('#sheet-root');
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey); };
  const onKey = e => e.key === 'Escape' && close();
  const acts = cls => h('div.bs-actions' + cls, actions.map(a => h('button.btn' + (a.primary ? '.primary' : ''), {
    onclick: () => { if (a.onClick?.() !== false) close(); },
  }, a.label)));
  const wrap = h('div.bs-wrap',
    h('div.bs-backdrop', { onclick: close }),
    h('div.bs', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div.bs-head', h('div.bs-grip'), h('h2', title), h('button.icon-btn', { 'aria-label': 'ปิด', onclick: close }, '✕')),
      h('div.bs-body', opt.top && actions.length ? acts('.top') : null, content),
      actions.length && !opt.top ? acts('') : null));
  root.append(wrap);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return close;
}

export function confirmSheet(title, msg, okLabel = 'ตกลง') {
  return new Promise(res => {
    sheet(title, h('p', msg), [
      { label: 'ยกเลิก', onClick: () => res(false) },
      { label: okLabel, primary: true, onClick: () => res(true) },
    ]);
  });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
