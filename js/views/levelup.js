// เลเวลอัป: ตัวแก้ไขรายเลเวล (ใช้ทั้งในวิซาร์ดและหน้าต่าง Level Up บนใบตัวละคร)
import { D } from '../data.js';
import { chips } from './parts.js';
import { h, sheet, toast, sign } from '../util.js';
import {
  ABIL, ABIL_SHORT, SKILLS, MAX_LEVEL, MC_PROF, compute, levelInfo, ensureLevels, featChoices, featAsiRule, meetsPrimary, hitDieAvg, subOf,
} from '../rules.js';
import { classFeatureCard, original } from './parts.js';
import { missing } from '../rules.js';
import { thFeature } from '../data.js';


/** สรุปสั้นของเลเวลหนึ่ง เช่น "Fighter 4 · HP +8 · ASI STR+2" */
export function levelSummary(c, li, x = compute(c)) {
  const d = li.cls?.hitDie;
  const hp = d ? Math.max(1, (li.i === 0 ? d : li.e.hp || hitDieAvg(d)) + x.m.con) : 0;
  const parts = [`${li.cls?.name || '?'} ${li.cl}`, `HP +${hp}`];
  if (li.asi || li.boon) {
    const f = D.feat[li.e.feat];
    if (!f) parts.push(`⚠ ยังไม่เลือก ${li.boon ? 'Epic Boon' : 'ASI/Feat'}`);
    else {
      const up = Object.entries(li.e.asi || {}).filter(([, n]) => n > 0).map(([a, n]) => `${ABIL_SHORT[a]}+${n}`).join(' ');
      parts.push(f.id === 'ability-score-improvement' ? `ASI ${up}` : `${f.name}${up ? ' ' + up : ''}`);
    }
  }
  return parts.join(' · ');
}

/** ตัวแก้ไขของเลเวลที่ i (c.levels[i]) — คืน array ของ node */
export function levelEditor(c, i, changed) {
  const LI = levelInfo(c), li = LI[i], e = li.e;
  const x = compute(c);
  const out = [];

  // ---- คลาส ----
  if (i === 0) {
    out.push(h('p', h('b', `${li.cls?.name || '?'} 1`), ' — คลาสหลัก (เปลี่ยนได้ที่ขั้น Class)'));
  } else {
    const before = {};
    for (const o of LI.slice(0, i)) if (o.e.c) before[o.e.c] = (before[o.e.c] || 0) + 1;
    out.push(h('label.lbl', 'เลเวลนี้อัปคลาสไหน'),
      h('select.inp', { onchange: ev => { e.c = ev.target.value; delete e.feat; delete e.asi; delete e.hp; changed(); } },
        D.classes.map(k => h('option', { value: k.id, selected: k.id === e.c },
          `${k.name} ${(before[k.id] || 0) + 1}${k.id === c.classId ? ' (คลาสหลัก)' : before[k.id] ? '' : ' — Multiclass ใหม่'}`))));
    if (e.c !== c.classId) {
      const bad = [D.cls[c.classId], ...Object.keys(before).map(id => D.cls[id]), li.cls].filter((k, j, a) => k && a.indexOf(k) === j && !meetsPrimary(k, x.score));
      if (bad.length) out.push(h('p.warn', `Multiclass ต้องมีค่าพลังหลัก 13+ ทั้งคลาสเดิมและคลาสใหม่ — ยังไม่ผ่าน: ${bad.map(k => `${k.name} (${k.core['Primary Ability']})`).join(', ')} · ถ้า DM อนุญาตก็เลือกได้`));
      if (!before[e.c]) {
        const mp = MC_PROF[e.c] || {};
        const got = [...(mp.armor || []).map(a => ({ light: 'Light armor', medium: 'Medium armor', shield: 'Shields' })[a]), mp.martial ? 'Martial weapons' : null, mp.tools, mp.skills ? `สกิล ${mp.skills} อย่าง` : null].filter(Boolean);
        out.push(h('p.muted.small', `Multiclass เข้า ${li.cls?.name}: ได้ ${got.join(', ') || 'ไม่มี proficiency เพิ่ม'} (ไม่ได้ Saving Throw/ของเริ่มต้น) · ตัวเลือกของคลาสนี้ (สกิล, ซับคลาส, เวท ฯลฯ) เลือกได้ที่ขั้น Class และ เวทมนตร์`));
      }
    }
  }

  // ---- ได้อะไรที่เลเวลนี้ ----
  if (li.cls) {
    const sub = subOf(c, li.cls.id);
    const fs = [
      ...li.cls.features.filter(f => f.level === li.cl && !/Subclass$|^Ability Score Improvement$|^Epic Boon$/.test(f.name)).map(f => [f, false]),
      ...(sub && li.cl >= 3 ? sub.features.filter(f => f.level === li.cl).map(f => [f, true]) : []),
    ];
    out.push(h('div.lv-gains', h('small.muted', 'ได้ที่เลเวลนี้: '), li.gains ? li.gains.split(/,\s*/).map(g => h('i.tag', g)) : h('i.tag', '—')));
    if (fs.length) out.push(h('details.orig', h('summary', `อ่านฟีเจอร์ใหม่ (${fs.length})`), fs.map(([f, s]) => classFeatureCard(li.cls, f, s))));
  }

  // ---- HP ----
  const d = li.cls?.hitDie;
  if (d) {
    const con = x.m.con;
    if (i === 0) out.push(h('p.small', `HP: เลเวลแรกได้เต๋าเต็ม d${d} = ${d} ${sign(con)} (CON) = `, h('b', String(Math.max(1, d + con)))));
    else {
      const avg = hitDieAvg(d);
      out.push(h('label.lbl', `HP เลเวลนี้ (d${d})`),
        h('div.seg',
          c.settings?.hp === 'roll' ? null : h('button.seg-btn' + (!e.hp ? '.on' : ''), { type: 'button', onclick: () => { delete e.hp; changed(); } }, `ค่าเฉลี่ย ${avg}`),
          h('label.seg-btn.hp-roll' + (e.hp ? '.on' : ''), `ทอย d${d} เอง ได้`, h('input.inp.num', { type: 'number', inputmode: 'numeric', min: 1, max: d, value: e.hp || '', placeholder: `1–${d}`, 'aria-label': `ผลทอย d${d}`,
            onchange: ev => { const v = parseInt(ev.target.value, 10); if (v >= 1 && v <= d) e.hp = v; else delete e.hp; changed(); } }))),
        c.settings?.hp === 'roll' && !e.hp ? h('p.tip', `ตัวละครนี้ตั้งไว้ว่าให้ทอย HP เอง — ทอย d${d} แล้วใส่เลขที่ได้ในช่องด้านบน (ระหว่างนี้คิดเป็นค่าเฉลี่ย ${avg} ไปก่อน)`) : null,
        h('p.muted.small', `ได้ HP +${Math.max(1, (e.hp || avg) + con)} (เต๋า ${e.hp || avg} ${sign(con)} CON) · ถ้าอัป CON ทีหลัง HP จะเพิ่มย้อนหลังให้อัตโนมัติ`));
    }
  }

  // ---- ASI / Feat / Epic Boon ----
  if (li.asi || li.boon) {
    const opts = featChoices(c, li);
    out.push(h('label.lbl', li.boon ? 'Epic Boon (หรือ feat อื่นที่เข้าเงื่อนไข)' : 'Ability Score Improvement หรือ Feat'),
      h('select.inp', { onchange: ev => { if (ev.target.value) e.feat = ev.target.value; else delete e.feat; e.asi = {}; delete e.sub; changed(); } },
        h('option', { value: '' }, '— เลือก —'),
        opts.map(f => h('option', { value: f.id, selected: f.id === e.feat }, `${f.pack ? (f.open ? '📖 ' : '📦 ') : ''}${f.name} (${f.category})`))));
    const f = D.feat[e.feat];
    if (f) {
      const r = featAsiRule(f);
      if (r) {
        const asi = e.asi = e.asi || {};
        const used = Object.values(asi).reduce((s, n) => s + n, 0);
        out.push(h('p.small', r.total === 2 ? `แจกแต้มรวม 2 (ค่าเดียว +2 หรือสองค่า +1) · สูงสุด ${r.cap}` : `เลือกค่าพลัง +1 · สูงสุด ${r.cap}`, h('b', ` เหลือ ${r.total - used}`)),
          h('div.asi-grid', r.abil.map(a => {
            const n = asi[a] || 0;
            return h('div.asi-cell' + (n ? '.on' : ''),
              h('small', ABIL_SHORT[a]), h('b', String(x.score[a])),
              h('div.stepper-inp',
                h('button.icon-btn', { disabled: n <= 0, 'aria-label': 'ลด', onclick: () => { asi[a] = n - 1; if (!asi[a]) delete asi[a]; changed(); } }, '−'),
                h('span', n ? `+${n}` : '0'),
                h('button.icon-btn', { disabled: used >= r.total || n >= r.per || x.score[a] >= r.cap, 'aria-label': 'เพิ่ม', onclick: () => { asi[a] = n + 1; changed(); } }, '+')));
          })));
      }
      const th = D.th.feats?.[f.id];
      if (th?.s) out.push(h('p.th', th.s));
      if (f.id === 'skilled') {
        const q = e.sub = e.sub || { skills: [] };
        out.push(h('label.lbl', 'Skilled: เลือกสกิล 3 อย่าง'),
          chips(SKILLS.map(k => k[0]), q.skills, 3, v => { q.skills = v; changed(); }, { locked: x.skills.filter(k => k.prof && !q.skills.includes(k.name)).map(k => k.name) }));
      }
      if (f.id === 'magic-initiate') {
        const q = e.sub = e.sub || {};
        out.push(h('label.lbl', 'Magic Initiate: รายการเวท'),
          chips(['cleric', 'druid', 'wizard'], q.miList ? [q.miList] : [], 1, v => { q.miList = v[0]; q.miCantrips = []; q.miSpell = null; changed(); }, { labels: { cleric: 'Cleric', druid: 'Druid', wizard: 'Wizard' } }),
          h('label.lbl', 'ค่าพลังที่ใช้ร่าย'),
          chips(['int', 'wis', 'cha'], q.miAb ? [q.miAb] : [], 1, v => { q.miAb = v[0]; changed(); }, { labels: { int: 'INT', wis: 'WIS', cha: 'CHA' } }),
          h('p.muted.small', 'เลือก cantrip 2 อย่าง + เวทเลเวล 1 อีก 1 อย่าง ได้ที่ขั้น "เวทมนตร์" (หรือปุ่ม ✏️ เปลี่ยนเวท ในใบตัวละคร)'));
      }
      out.push(original(f.text, `${f.name} (EN)`));
    }
  }
  return out;
}

/** หน้าต่าง Level Up บนใบตัวละคร */
export function openLevelUp(c, onDone) {
  ensureLevels(c);
  if (c.level >= MAX_LEVEL) { toast(`เลเวล ${MAX_LEVEL} แล้ว สุดทางแล้ว 🎉`); return; }
  const t = structuredClone(c);
  ensureLevels(t);
  t.levels.push({ c: t.levels[t.levels.length - 1].c || t.classId });
  t.level = t.levels.length;
  const x0 = compute(c);
  const body = h('div.lvup');
  const draw = () => {
    const x1 = compute(t);
    body.replaceChildren(
      h('p.lvup-head', h('b', `Lv ${c.level} → ${t.level}`), ` · HP สูงสุด ${x0.hpMax} → ${x1.hpMax}`, x1.pb !== x0.pb ? ` · Prof ${sign(x0.pb)} → ${sign(x1.pb)}` : ''),
      ...levelEditor(t, t.levels.length - 1, draw));
  };
  draw();
  sheet('⬆️ เลเวลอัป', body, [
    { label: 'ยกเลิก' },
    { label: 'ยืนยันเลเวลอัป', primary: true, onClick: () => {
      const li = levelInfo(t)[t.levels.length - 1];
      if ((li.asi || li.boon) && !t.levels[li.i].feat && !confirm('ยังไม่ได้เลือก ASI/Feat — อัปไปก่อนแล้วค่อยเลือกทีหลังก็ได้ ตกลงไหม?')) return false;
      c.levels = t.levels;
      c.level = t.level;
      const gain = compute(c).hpMax - x0.hpMax;
      if (c.play && c.play.hp != null) c.play.hp = Math.max(0, c.play.hp + gain);
      onDone?.();
      toast(`ยินดีด้วย! เลเวล ${c.level} แล้ว (HP +${gain})`);
    } },
  ]);
}

// ---------- ดูก่อนเลเวลอัป (เฟส 4E) ----------
/** กล่องพับ "เลเวลหน้าจะได้อะไร" — เลือกคลาสที่จะอัปได้ (Multiclass) */
export function previewNext(c, onLevelUp) {
  ensureLevels(c);
  if (c.level >= MAX_LEVEL) return null;
  const x0 = compute(c);
  const last = c.levels[c.levels.length - 1]?.c || c.classId;
  const body = h('div.preview');
  const draw = cid => {
    const t = structuredClone(c);
    ensureLevels(t);
    t.levels.push({ c: cid });
    t.level = t.levels.length;
    const x1 = compute(t), cls = D.cls[cid], n = x1.CLs[cid] || 1, li = levelInfo(t)[t.levels.length - 1];
    const key = f => `${f.src}:${f.id}`;
    const had = new Set([...(x0.feats || []).map(key), ...x0.mcFeats.flatMap(mc => mc.feats.map(f => mc.cls.id + key(f)))]);
    const isMain = cid === t.classId;
    const fresh = isMain ? x1.feats.filter(f => !had.has(key(f))) : (x1.mcFeats.find(mc => mc.cls.id === cid)?.feats || []).filter(f => !had.has(cid + key(f)));
    const newFeats = fresh.filter(f => !/^(ability-score-improvement|epic-boon)$/.test(f.id));
    const L = [];
    const hp = x1.hpMax - x0.hpMax;
    L.push(h('li', h('b', 'HP สูงสุด '), `${x0.hpMax} → ${x1.hpMax} (+${hp})`, h('small', ` · ทอย d${cls.hitDie} + CON หรือเอาค่าเฉลี่ย ${hitDieAvg(cls.hitDie)}`)));
    if (x1.pb !== x0.pb) L.push(h('li', h('b', 'Proficiency Bonus '), `${sign(x0.pb)} → ${sign(x1.pb)} (สกิล เซฟ โจมตีที่ชำนาญขึ้นหมด)`));
    if (x1.atkPer !== x0.atkPer) L.push(h('li', h('b', 'Extra Attack '), `โจมตีได้ ${x1.atkPer} ครั้งต่อ Attack action`));
    // สลอต
    const slotSum = x => { const o = {}; for (const b of x.casting) for (const [lv, k] of Object.entries(b.slots || {})) { const kk = (b.pact ? 'Pact ' : '') + 'Lv ' + lv; o[kk] = Math.max(o[kk] || 0, k); } return o; };
    const s0 = slotSum(x0), s1 = slotSum(x1);
    const sd = Object.keys(s1).filter(k => s1[k] !== (s0[k] || 0)).map(k => `${k} ${s0[k] || 0}→${s1[k]}`);
    if (sd.length) L.push(h('li', h('b', 'Spell Slot '), sd.join(' · ')));
    const cast = x => x.casting.find(b => b.cid === cid);
    const b0 = cast(x0), b1 = cast(x1);
    if (b1 && (b1.cantripMax !== (b0?.cantripMax || 0) || b1.preparedMax !== (b0?.preparedMax || 0)))
      L.push(h('li', h('b', 'เวท '), [b1.cantripMax !== (b0?.cantripMax || 0) ? `Cantrip ${b0?.cantripMax || 0}→${b1.cantripMax}` : null, b1.preparedMax !== (b0?.preparedMax || 0) ? `เตรียมได้ ${b0?.preparedMax || 0}→${b1.preparedMax}` : null].filter(Boolean).join(' · ')));
    // ทรัพยากร
    const rd = x1.res.map(r => { const o = x0.res.find(z => z.id === r.id); return !o ? `${r.name} ใหม่ (${r.max})` : o.max !== r.max ? `${r.name} ${o.max}→${r.max}` : null; }).filter(Boolean);
    if (rd.length) L.push(h('li', h('b', 'ใช้ได้กี่ครั้ง '), rd.join(' · ')));
    if (li.asi) L.push(h('li', h('b', 'Ability Score Improvement '), 'เพิ่มค่าพลัง +2 (หรือ +1 สองค่า) หรือเลือก Feat'));
    if (li.boon) L.push(h('li', h('b', 'Epic Boon '), 'เลือก Epic Boon 1 อัน'));
    const m0 = new Set(missing(c)), need = missing(t).filter(z => !m0.has(z));
    body.replaceChildren(...[
      h('p.small', h('b', `${cls.name} ${n}`), ` · เลเวลตัวละคร ${t.level}`, !isMain && !x0.CLs[cid] ? h('span.badge', 'Multiclass') : null),
      !isMain && !x0.CLs[cid] && !meetsPrimary(cls, x0.score) ? h('p.tip', `⚠ จะ Multiclass เป็น ${cls.name} ต้องมี ${cls.core['Primary Ability']} อย่างน้อย 13`) : null,
      h('ul.preview-list', L),
      newFeats.length ? [h('h4', 'ฟีเจอร์ใหม่'), h('ul.preview-list', newFeats.map(f => {
        const th = f.pack ? f.th : thFeature(cid, f.id, f.src === 'sub');
        return h('li', h('b', f.name), th?.s ? ' — ' + th.s : '');
      }))] : h('p.muted.small', 'เลเวลนี้ไม่มีฟีเจอร์ใหม่'),
      need.length ? [h('h4', 'ต้องเลือกตอนอัป'), h('ul.preview-list', need.map(z => h('li', z)))] : null,
      onLevelUp ? h('button.btn.primary', { onclick: () => onLevelUp() }, `⬆️ เลเวลอัปเลย`) : null].flat().filter(Boolean));
  };
  const sel = h('select', { onchange: e => draw(e.target.value) },
    Object.values(D.cls).map(k => h('option', { value: k.id, selected: k.id === last }, `${k.name}${x0.CLs[k.id] ? ` ${x0.CLs[k.id]} → ${x0.CLs[k.id] + 1}` : ' (คลาสใหม่)'}`)));
  draw(last);
  return h('details.orig.preview-box', h('summary', `👀 เลเวลหน้า (Lv ${c.level + 1}) จะได้อะไร`),
    h('label.fld', h('small', 'ถ้าอัปเป็นคลาส'), sel), body);
}
