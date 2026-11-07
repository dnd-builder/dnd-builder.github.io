# ดูข้อความ EN แบบย่อของซับคลาส OGL ทีละคลาส (ไว้เขียนสรุปไทย/แปลเต็ม)
# ใช้: python3 tools/dump_open.py barbarian,bard [จำนวนตัวอักษรต่อฟีเจอร์]
import json,re,sys
d=json.load(open('data/open/subclasses.json')); cls=sys.argv[1].split(','); n=int(sys.argv[2]) if len(sys.argv)>2 else 420
def c(t,k):
    t=re.sub(r'(?m)^\|.*$','',t); t=re.sub(r'\s+',' ',t).strip(); return t[:k]+('…' if len(t)>k else '')
for s in d:
    if s['classId'] not in cls: continue
    print(f"## {s['id']} | {s['name']} | {c(s['text'],220)}")
    for f in s['features']: print(f"- {f['id']} L{f['level']} {f['t'][0]} | {f['name']}: {c(f['text'],n)}")
