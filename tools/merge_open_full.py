"""รวมคำแปลเต็มคอนเทนต์ OGL เข้า data/th/full/open-*.json
python3 tools/merge_open_full.py <โฟลเดอร์ txt>
ไฟล์ txt รูปแบบ:  '@@@ <key>' แล้วตามด้วย markdown จนถึง @@@ ถัดไป
key: ซับคลาส '<subId>|<featId>' · Background '<bgId>|text' / '<bgId>|feature' · Feat '<featId>' · เผ่า '<spId>|<traitId>' · สเปล '<spellId>'
ทับค่าเดิมได้ (ใช้แก้คำแปลทีละอันก็ได้) · เรียงตามลำดับใน data/open/*.json"""
import json, os, re, sys, glob
R = os.path.join(os.path.dirname(__file__), '..')
L = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
O = lambda k: L(f'data/open/{k}.json')

# ลำดับ key ของแต่ละกลุ่ม (ตามข้อมูลต้นฉบับ)
order = {}
order['open-subclasses'] = [f"{s['id']}|{f['id']}" for s in O('subclasses') for f in s['features']]
order['open-backgrounds'] = [f"{b['id']}|{k}" for b in O('backgrounds') for k in ('text', 'feature') if b.get(k)]
order['open-feats'] = [f['id'] for f in O('feats')]
order['open-species'] = [f"{s['id']}|{t['id']}" for s in O('species') for t in s['traits'] + [t for l in s.get('lineages', []) for t in l['traits']]]
G = lambda src: 'open-spells-' + ('toh' if src == 'toh' else 'dmag' if src.startswith('dmag') else 'small')
for x in O('spells'): order.setdefault(G(x['src']), []).append(x['id'])
group = {k: g for g, ks in order.items() for k in ks}

def unlink(t):
  """ลิงก์ Open5e ([ชื่อ](https://api.open5e.com/spells/x)) → ชื่อตัวเอียง (สเปล) / ข้อความเฉย ๆ (อย่างอื่น)"""
  def f(m):
    txt, url = m.group(1), m.group(2)
    if '/spells/' in url and not txt.startswith('*'): return f'*{txt}*'
    return txt
  return re.sub(r'\[([^\]]+)\]\(\s*(https?://[^)\s]*open5e[^)]*|/[^)]*)\)', f, t)

new = {}
for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.txt'))):
  key, buf = None, []
  for line in open(p, encoding='utf-8').read().split('\n') + ['@@@ END']:
    m = re.match(r'^@@@ (\S+)\s*$', line)
    if m:
      if key: new[key] = unlink(re.sub(r'\n{3,}', '\n\n', '\n'.join(buf).strip()))
      key, buf = (None if m.group(1) == 'END' else m.group(1)), []
    else: buf.append(line)
bad = [k for k in new if k not in group]
if bad: print('key ไม่รู้จัก:', ' '.join(bad))

for g, keys in order.items():
  p = os.path.join(R, f'data/th/full/{g}.json')
  cur = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
  flat = {}
  for k, v in cur.items():
    if isinstance(v, dict): flat.update({f'{k}|{k2}': v2 for k2, v2 in v.items()})
    else: flat[k] = v
  flat.update({k: v for k, v in new.items() if group.get(k) == g})
  if not flat: continue
  out = {}
  for k in keys:
    if k not in flat: continue
    if '|' in k: a, b = k.split('|', 1); out.setdefault(a, {})[b] = flat[k]
    else: out[k] = flat[k]
  json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
  print(f'{g}: {sum(1 for k in keys if k in flat)}/{len(keys)}')
