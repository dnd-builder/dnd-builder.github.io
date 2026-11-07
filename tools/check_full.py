"""เช็คว่าคำแปลเต็ม (data/th/full/*.json) ครบทุก id — python3 tools/check_full.py"""
import json, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
L = lambda p: json.load(open(p))
cls = L('data/srd/classes.json'); cls = {c['id']: c for c in (cls if isinstance(cls, list) else cls.values())}
want = {
  'options': [i['id'] for c, k in [('sorcerer', 'metamagic-options'), ('warlock', 'eldritch-invocation-options')] for i in cls[c]['options'][k]['items']],
  'feats': [i['id'] for i in L('data/srd/feats.json')],
  'mastery': [i['id'] for i in L('data/srd/mastery.json') + L('data/srd/weaponProps.json')],
}
# classes/species เป็นแบบซ้อน → แปลงเป็นคีย์ 'a/b/c'
MAX_LEVEL = 20   # แปลเต็มครบทุกเลเวลแล้ว (Lv4+ ไม่นับ ASI / Epic Boon / หัวข้อ "X Subclass")
skipHi = lambda f: int(f['level']) > 3 and (f['name'] in ('Ability Score Improvement', 'Epic Boon') or f['name'].endswith('Subclass'))
want['classes'] = list(dict.fromkeys([f"{c}/f/{f['id']}" for c, x in cls.items() for f in x['features'] if int(f['level']) <= MAX_LEVEL and not skipHi(f)] + \
  [f"{c}/sub/{f['id']}" for c, x in cls.items() for f in x['subclass'].get('features', []) if int(f['level']) <= MAX_LEVEL]))
want['species'] = [f"{s['id']}/{t['id']}" for s in L('data/srd/species.json') for t in s['traits']]
def flat(d, pre=''):
  out = {}
  for k, v in d.items():
    if isinstance(v, dict): out.update(flat(v, pre + k + '/'))
    else: out[pre + k] = v
  return out
SPELL_MAX = 9   # สเปลที่แปลแล้วถึงเลเวลนี้ (เพิ่มทีละรอบ)
SP = L('data/srd/spells.json')
want['spells'] = [s['id'] for s in SP if s['level'] <= SPELL_MAX]
want['spells-short'] = want['spells']
want['glossary-short'] = [g['id'] for g in L('data/srd/glossary.json')]
O = lambda k: L(f'data/open/{k}.json')
want['open-subclasses'] = [f"{s['id']}/{f['id']}" for s in O('subclasses') for f in s['features']]
want['open-backgrounds'] = [f"{b['id']}/{k}" for b in O('backgrounds') for k in ('text', 'feature') if b.get(k)]
want['open-feats'] = [f['id'] for f in O('feats')]
want['open-species'] = [f"{s['id']}/{t['id']}" for s in O('species') for t in s['traits'] + [t for l in s.get('lineages', []) for t in l['traits']]]
OG = lambda src: 'open-spells-' + ('toh' if src == 'toh' else 'dmag' if src.startswith('dmag') else 'small')
for x in O('spells'): want.setdefault(OG(x['src']), []).append(x['id'])
bad = 0
for g, ids in want.items():
  p = {'glossary-short': 'data/th/glossary.json', 'spells-short': 'data/th/spells.json'}.get(g, f'data/th/full/{g}.json')
  have = (L(p) if g in ('glossary-short', 'spells-short') else flat(L(p))) if os.path.exists(p) else {}
  miss = [i for i in ids if not have.get(i)]; extra = [k for k in have if k not in ids]
  bad += len(miss) + len(extra)
  print(f'{g}: {len(ids) - len(miss)}/{len(ids)}', 'ขาด: ' + ', '.join(miss) if miss else '', 'เกิน: ' + ', '.join(extra) if extra else '')
fs = L('data/th/full/spells.json')
print('สเปลแปลเต็มตามเลเวล:', ' · '.join(f"Lv{l} {sum(1 for x in SP if x['level'] == l and fs.get(x['id']))}/{sum(1 for x in SP if x['level'] == l)}" for l in range(10)))
fg = L('data/th/full/glossary.json') if os.path.exists('data/th/full/glossary.json') else {}
print(f'glossary (แปลเต็ม): {len(fg)}/{len(want["glossary-short"])} ', 'id ผิด: ' + ', '.join(k for k in fg if k not in want['glossary-short']) if any(k not in want['glossary-short'] for k in fg) else '')

# ไทยแบบสรุป (ทุกเลเวล) ของฟีเจอร์คลาส/ซับคลาส
ths = L('data/th/classes.json')
skip = lambda f: f['name'] in ('Ability Score Improvement', 'Epic Boon') or f['name'].endswith('Subclass')
need = [(c, 'f', f['id']) for c, x in cls.items() for f in x['features'] if not skip(f)] + [(c, 'sub', f['id']) for c, x in cls.items() for f in x['subclass'].get('features', [])]
miss = [f'{c}/{k}/{i}' for c, k, i in need if not (ths[c]['f'] if k == 'f' else ths[c]['sub']['f']).get(i, {}).get('s')]
bad += len(miss)
print(f'classes-short: {len(need) - len(miss)}/{len(need)}', 'ขาด: ' + ', '.join(miss) if miss else '')
raise SystemExit(1 if bad else 0)
