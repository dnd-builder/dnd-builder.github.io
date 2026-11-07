#!/usr/bin/env python3
"""แปลงคอนเทนต์เปิด (OGL 1.0a) จาก Open5e → data/open/*.json ในรูปแบบไอเทมแพ็ก + แปลงเป็นกฎ 2024
ใช้: python3 tools/build_open.py <open5e-api/data/v1> data/open
ซอร์ส: git clone --depth 1 --filter=blob:none --sparse https://github.com/open5e/open5e-api && git sparse-checkout set data/v1
"""
import json, re, sys, os

SRC, OUT = sys.argv[1], sys.argv[2]
DOCS = ['toh', 'o5e', 'taldorei']          # ซับคลาส / Background / Feat / เผ่า
SPELL_DOCS = ['toh', 'o5e', 'kp', 'warlock', 'dmag', 'dmag-e']

def load(doc, model):
    p = os.path.join(SRC, doc, model + '.json')
    return json.load(open(p)) if os.path.exists(p) else []

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', '')).strip('-')

def clean(t):
    t = t.replace('/n', '\n').replace('\r', '')
    t = '\n'.join(l.strip() if l.lstrip().startswith(('#', '|')) else l.rstrip() for l in t.split('\n'))
    t = re.sub(r'(?m)^(#{2,6})(?=[^\s#])', r'\1 ', t)
    t = re.sub(r'(\w)-(s|t)\b', r"\1'\2", t)          # don-t → don't, Smuggler-s → Smuggler's
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

ORD = r'(\d+)(?:st|nd|rd|th)'
def lv_of(t):
    m = re.search(ORD + r'[- ]level\b', t[:500], re.I) or re.search(r'\blevel ' + r'(\d+)', t[:300], re.I)
    return int(m.group(1)) if m else None

# ช่องเลเวลซับคลาสของกฎ 2024
SLOTS = {'barbarian': [3, 6, 10, 14], 'bard': [3, 6, 14], 'cleric': [3, 6, 17], 'druid': [3, 6, 10, 14],
         'fighter': [3, 7, 10, 15, 18], 'monk': [3, 6, 11, 17], 'paladin': [3, 7, 15, 20], 'ranger': [3, 7, 11, 15],
         'rogue': [3, 9, 13, 17], 'sorcerer': [3, 6, 14, 18], 'warlock': [3, 6, 10, 14], 'wizard': [3, 6, 10, 14]}
def slot(cls, L):
    if L <= 3: return 3
    return min(SLOTS[cls], key=lambda s: (abs(s - L), s))

CAST_SUB = re.compile(r'^(Cantrips|Spell Slots|Spells Known.*|Spellcasting Ability)$', re.I)
SPELLS_FEAT = re.compile(r'(Spells|Spell List|Magic)$', re.I)
# ฟีเจอร์ที่ทับกับของคลาสในกฎ 2024 → ติดหมายเหตุ "DM ตัดสิน"
CONFLICT = [
    (re.compile(r'Divine Strike|Potent Spellcasting', re.I), {'cleric'}, 'กฎ 2024 คลาส Cleric ได้ Blessed Strikes ที่เลเวล 7 อยู่แล้ว — ใช้ฟีเจอร์นี้แทนหรือเลือกอย่างใดอย่างหนึ่ง ให้ DM ตัดสิน'),
    (re.compile(r'Pact Boon', re.I), {'warlock'}, 'กฎ 2024 ไม่มี Pact Boon แยกแล้ว (Pact of the Blade/Chain/Tome เป็น Eldritch Invocation) — ให้ DM ตัดสินว่าใช้กับ Invocation ที่เลือกยังไง'),
    (re.compile(r'^Bonus Proficienc', re.I), {'cleric'}, 'Cleric 2024 เลือก Divine Order (Protector/Thaumaturge) อยู่แล้ว ถ้าซ้ำกันให้ DM ตัดสิน'),
    (re.compile(r'^Spellcasting$', re.I), {'fighter', 'rogue'}, 'ซับคลาสร่ายเวทแบบ 1/3 ใช้ตารางสลอตของเว็บ (กฎ 2024: เตรียมเวทได้ ไม่ใช่ "รู้" เวท) — รายละเอียดอื่นตามต้นฉบับให้ DM ตัดสิน'),
]

def parse_table(txt):
    rows = [l for l in txt.split('\n') if l.startswith('|')]
    if len(rows) < 3: return None
    cells = lambda l: [c.strip() for c in l.strip().strip('|').split('|')]
    return cells(rows[0]), [cells(r) for r in rows[2:]]

def spell_rows(cls, txt):
    """ตารางสเปลประจำซับคลาส → [{level: เลเวลคลาส 2024, list}]"""
    out = []
    for m in re.finditer(r'(?:^\|.*\n?)+', txt, re.M):
        t = parse_table(m.group(0))
        if not t: continue
        head, rows = t
        h0 = head[0].lower()
        if not re.search(r'level', h0) or len(head) < 2 or not re.search(r'spell', head[1], re.I): continue
        spell_lv = 'spell level' in h0
        for r in rows:
            n = re.match(r'(\d+)', r[0])
            if not n: continue
            n = int(n.group(1))
            L = {1: 3, 2: 3, 3: 5, 4: 7, 5: 9}.get(n, 9) if spell_lv else max(3, n)
            names = [re.sub(r'\s+', ' ', re.sub(r'\(.*?\)', '', x)).strip(' *_') for x in re.split(r',', re.sub(r'\*|_', '', r[1]))]
            names = [' '.join(w if w in ('of', 'the', 'and', 'from', 'to', 'with') else w[:1].upper() + w[1:] for w in x.split()) for x in names if x]
            if names: out.append({'level': L, 'list': ', '.join(names)})
        if out: break
    return out

def act_of(t):
    s = re.sub(r'\s+', ' ', t)
    if re.search(r'\b(use|using|take|as) (a|your) reaction\b|\bas a reaction\b|\bReaction\b', s): return 'reaction'
    if re.search(r'bonus action', s, re.I): return 'bonus'
    if re.search(r'\b(use|using|take|as) (an|your) action\b|\bas an action\b', s, re.I): return 'action'
    return 'passive'

def uses_of(t):
    s = re.sub(r'\s+', ' ', t)
    reset = 'short' if re.search(r'finish a short or long rest|short rest or long rest|finish a short rest', s, re.I) else 'long' if re.search(r'long rest', s, re.I) else None
    if not reset: return None
    if re.search(r'number of times equal to your proficiency bonus', s, re.I): return {'n': 'pb', 'reset': reset}
    m = re.search(r'number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier', s, re.I)
    if m: return {'n': m.group(1)[:3].lower(), 'reset': reset}
    if re.search(r"(Once you use this (feature|ability)|you can't use (it|this feature) again until)", s, re.I): return {'n': '1', 'reset': reset}
    m = re.search(r'\b(two|three|four|five) times\b', s, re.I)
    if m and re.search(r'regain all expended uses', s, re.I): return {'n': str(['two', 'three', 'four', 'five'].index(m.group(1).lower()) + 2), 'reset': reset}
    return None

CAST = {('toh', 'Soulspy'): ('cleric', 'wis'), ('toh', 'Underfoot'): ('druid', 'wis'),
        ('o5e', 'Arcane Warrior'): ('wizard', 'int'), ('o5e', 'Eldritch Trickster'): ('wizard', 'int')}

def subclasses():
    out = []
    for doc in DOCS:
        for e in load(doc, 'Archetype'):
            f = e['fields']; cls = f['char_class'].lower(); name = f['name'].strip()
            desc = clean(f['desc'])
            parts = re.split(r'(?m)^#{3,6} +(.+?)\s*$', desc)
            intro, feats, notes = parts[0].strip(), [], []
            spells = spell_rows(cls, desc)
            prev = None
            for i in range(1, len(parts), 2):
                fn, ft = parts[i].strip().rstrip('.'), parts[i + 1].strip()
                if re.match(r'Restriction', fn, re.I):
                    notes.append(f'**{fn}.** {ft}'); continue
                if re.match(r'Tenets of', fn, re.I):
                    intro += f'\n\n**{fn}**\n\n{ft}'; continue
                if feats and (CAST_SUB.match(fn) and feats[-1]['name'] == 'Spellcasting' or fn == 'Elemental Strike'):
                    feats[-1]['text'] += f'\n\n**{fn}.** {ft}'; continue
                L = lv_of(ft)
                if L is None: L = prev or 1
                if SPELLS_FEAT.search(fn) and re.search(r'^\|', ft, re.M): L = min(L, 3)
                prev = L
                feats.append({'name': fn, 'orig': L, 'text': ft})
            if not feats:            # ต้นฉบับไม่มีหัวข้อ (Blood Domain) → แยกตามย่อหน้า "At Nth level"
                print('!! ไม่มีหัวข้อ:', doc, name)
            sid = f'open:{doc}:{slug(name)}'
            fo, seen = [], {}
            for x in feats:
                fid = slug(x['name']) or 'feature'
                if fid in seen: seen[fid] += 1; fid += f'-{seen[fid]}'
                else: seen[fid] = 1
                it = {'id': fid, 'level': slot(cls, x['orig']), 'name': x['name'], 't': act_of(x['text']), 'text': x['text']}
                if x['orig'] != it['level']: it['orig'] = x['orig']
                u = uses_of(x['text'])
                if u: it['uses'] = u
                for rx, cs, note in CONFLICT:
                    if cls in cs and rx.search(x['name']): it['note'] = note
                fo.append(it)
            s = {'id': sid, 'src': doc, 'classId': cls, 'name': name, 'text': intro, 'features': fo, 'spells': spells}
            if notes: s['req'] = '\n\n'.join(notes)
            if (doc, name) in CAST: s['casting'] = dict(zip(('list', 'ab'), CAST[(doc, name)]))
            out.append(s)
    return out

SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation',
          'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival']
def skills_in(t):
    return sorted([k for k in SKILLS if re.search(r'\b' + k + r'\b', t, re.I)], key=lambda k: t.lower().index(k.lower()))

def backgrounds():
    """Background 2014 → กฎ 2024 แบบ "สร้างเอง": ผู้เล่นเลือกค่าพลัง 3 ตัว + Origin Feat 1 อัน (custom)"""
    out = []
    for doc in DOCS:
        for e in load(doc, 'Background'):
            f = e['fields']; name = f['name'].strip(); sk = f.get('skill_proficiencies') or ''
            m = re.search(r'\b(plus|your choice)\b', sk, re.I)
            fixed, pick = skills_in(sk[:m.start()] if m else sk), None
            if m:
                pick = {'n': 2 if re.search(r'\btwo\b', sk, re.I) else 1, 'from': skills_in(sk[m.start():])}
            if not fixed and not pick: pick = {'n': 2, 'from': []}          # ไม่มีสกิล → เลือก 2 อย่างอะไรก็ได้ (กฎ 2024)
            tool = (f.get('tool_proficiencies') or '').strip().rstrip('.')
            if re.match(r'(none|no additional)', tool, re.I): tool = ''
            lang = (f.get('languages') or '').strip().rstrip('.')
            if re.match(r'(none|no additional)', lang, re.I): lang = ''
            b = {'id': f'open:{doc}:{slug(name)}', 'src': doc, 'name': name, 'custom': True, 'abilities': [], 'feat': '',
                 'skills': fixed, 'tool': tool, 'equipA': clean(f.get('equipment') or ''), 'gpB': 50, 'text': clean(f.get('desc') or '')}
            if pick: b['skillPick'] = pick
            if lang: b['lang'] = lang
            if f.get('feature'): b['feature'] = {'name': f['feature'].strip(), 'text': clean(f.get('feature_desc') or '')}
            out.append(b)
    return out

def feats():
    """Feat 2014 → General Feat ของกฎ 2024 (เลเวล 4+ ตามเงื่อนไขเดิม)"""
    out = []
    for doc in DOCS:
        for e in load(doc, 'Feat'):
            f = e['fields']; name = f['name'].strip()
            eff = json.loads(f.get('effects_desc_json') or '[]')
            text = clean(f.get('desc') or '') + ('\n\n' + '\n'.join(x.strip() for x in eff) if eff else '')
            pre = re.sub(r'^\*|\*$', '', (f.get('prerequisite') or '').strip()).replace('*', '').strip()
            if re.match(r'n/?a$', pre, re.I): pre = ''
            out.append({'id': f'open:{doc}:{slug(name)}', 'src': doc, 'name': name, 'category': 'General',
                        'prereq': 'Level 4+' + (f'; {pre}' if pre else ''), 't': act_of(text), 'text': text})
    return out

def docs():
    out = {}
    for d in DOCS + SPELL_DOCS:
        for e in load(d, 'Document'):
            f = e['fields']
            out[d] = {k: f.get(k) for k in ('title', 'author', 'organization', 'copyright', 'license', 'url')}
    # ข้อความ OGL 1.0a เต็ม (จาก SRD 5.1 ใน Open5e) + Section 15 ของทุกหนังสือที่ใช้
    leg = next(e['fields']['desc'] for e in load('wotc-srd', 'Section') if 'OPEN GAME LICENSE' in e['fields']['desc'])
    body = leg[leg.index('OPEN GAME LICENSE Version 1.0a'):leg.index('15. COPYRIGHT NOTICE')]
    sec15 = ['Open Game License v 1.0a Copyright 2000, Wizards of the Coast, Inc.',
             'System Reference Document 5.1 Copyright 2016, Wizards of the Coast, Inc.; Authors Mike Mearls, Jeremy Crawford, Chris Perkins, Rodney Thompson, Peter Lee, James Wyatt, Robert J. Schwalb, Bruce R. Cordell, Chris Sims, and Steve Townshend, based on original material by E. Gary Gygax and Dave Arneson.']
    sec15 += [v['copyright'] for v in out.values() if v.get('copyright')]
    out['_ogl'] = clean(body) + '\n\n15. COPYRIGHT NOTICE\n\n' + '\n\n'.join(dict.fromkeys(sec15)) + '\n\nEND OF LICENSE'
    return out

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    subs = subclasses()
    json.dump(subs, open(os.path.join(OUT, 'subclasses.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(docs(), open(os.path.join(OUT, 'docs.json'), 'w'), ensure_ascii=False, indent=1)
    for k, fn in (('backgrounds', backgrounds), ('feats', feats)):
        v = fn(); json.dump(v, open(os.path.join(OUT, k + '.json'), 'w'), ensure_ascii=False, separators=(',', ':')); print(k, len(v))
    print('subclasses', len(subs), 'features', sum(len(s['features']) for s in subs))
