# สร้าง data/srd/items.json (อุปกรณ์ เครื่องมือ ของวิเศษ จาก SRD 5.2.1) สำหรับหน้าค้นหาไอเทม
# ใช้: python3 tools/build_items.py <โฟลเดอร์ 5e-database/src/2024/en>
# ที่มา: github.com/5e-bits/5e-database (MIT) · เนื้อหา SRD 5.2.1 (CC-BY-4.0) · อาวุธ/เกราะใช้ไฟล์เดิมของเว็บ
import json, re, sys, os

src = sys.argv[1]
eq = json.load(open(os.path.join(src, '5e-SRD-Equipment.json')))
mi = json.load(open(os.path.join(src, '5e-SRD-Magic-Items.json')))
gear_txt = {g['name'].lower(): g['text'] for g in json.load(open('data/srd/gear.json'))}

CAT = {'adventuring-gear': 'gear', 'ammunition': 'ammo', 'artisans-tools': 'tool', 'other-tools': 'tool',
       'musical-instruments': 'tool', 'gaming-sets': 'tool', 'arcane-foci': 'focus', 'druidic-foci': 'focus', 'holy-symbols': 'focus'}
SKIP = {'weapon', 'armor', 'melee-weapons', 'ranged-weapons', 'simple-weapons', 'martial-weapons', 'martial-melee-weapons',
        'martial-ranged-weapons', 'simple-melee-weapons', 'simple-ranged-weapons', 'light-armor', 'medium-armor', 'heavy-armor', 'shields'}


# แก้ข้อความต้นฉบับที่ตัด PDF มาเพี้ยน (ข้อความปนกันระหว่างยา)
FIX = {
 'potion-of-flying': "When you drink this potion, you gain a Fly Speed equal to your Speed for 1 hour and can hover. If you're in the air when the potion wears off, you fall unless you have some other means of staying aloft.\nThis potion's clear liquid floats at the top of its container and has cloudy white impurities drifting in it.",
 'potions-of-healing': "You regain Hit Points when you drink this potion. The number of Hit Points depends on the potion's rarity:\n- Potion of Healing (Common): 2d4 + 2\n- Potion of Greater Healing (Uncommon): 4d4 + 4\n- Potion of Superior Healing (Rare): 8d4 + 8\n- Potion of Supreme Healing (Very Rare): 10d4 + 20\nWhatever its potency, the potion's red liquid glimmers when agitated.",
 'potion-of-gaseous-form': "When you drink this potion, you gain the effect of the Gaseous Form spell for 1 hour (no Concentration required) or until you end the effect as a Bonus Action.\nThis potion's container seems to hold fog that moves and pours like water.",
 'potion-of-heroism': "When you drink this potion, you gain 10 Temporary Hit Points that last for 1 hour. For the same duration, you are under the effect of the Bless spell (no Concentration required).\nThis potion's blue liquid bubbles and steams as if boiling.",
 'potion-of-giant-strength': "When you drink this potion, your Strength score changes for 1 hour. The type of giant determines the score. The potion has no effect on you if your Strength is equal to or greater than that score.\n- Hill giant: STR 21 (Uncommon)\n- Frost or stone giant: STR 23 (Rare)\n- Fire giant: STR 25 (Rare)\n- Cloud giant: STR 27 (Very Rare)\n- Storm giant: STR 29 (Legendary)\nThis potion's transparent liquid has floating in it a sliver of light resembling a giant's fingernail.",
 'potion-of-resistance': "When you drink this potion, you have Resistance to one type of damage for 1 hour. The GM chooses the type or determines it randomly (1d10): 1 Acid, 2 Cold, 3 Fire, 4 Force, 5 Lightning, 6 Necrotic, 7 Poison, 8 Psychic, 9 Radiant, 10 Thunder.",
 'spell-scroll': "A Spell Scroll bears the words of a single spell, written in a mystical cipher. If the spell is on your spell list, you can read the scroll and cast its spell without Material components. Otherwise, the scroll is unintelligible. Casting the spell by reading the scroll requires the spell's normal casting time. Once the spell is cast, the scroll crumbles to dust. If the casting is interrupted, the scroll isn't lost.\nIf the spell is on your spell list but of a higher level than you can normally cast, you make an ability check using your spellcasting ability to determine whether you cast the spell. The DC equals 10 plus the spell's level. On a failed check, the spell disappears from the scroll with no other effect.\nSpell level → rarity, save DC, attack bonus: Cantrip/1 Common DC 13 +5 · 2 Uncommon DC 13 +5 · 3 Uncommon DC 15 +7 · 4 Rare DC 15 +7 · 5 Rare DC 17 +9 · 6 Very Rare DC 17 +9 · 7 Very Rare DC 18 +10 · 8 Very Rare DC 18 +10 · 9 Legendary DC 19 +11.\nCopying a Scroll into a Spellbook. A Wizard spell on a Spell Scroll can be copied into a spellbook. The copier must succeed on an Intelligence (Arcana) check with a DC equal to 10 plus the spell's level. Whether the check succeeds or fails, the Spell Scroll is destroyed.",
}

out = []
for e in eq:
    cats = [c['index'] for c in e.get('equipment_categories', [])]
    if any(c in SKIP for c in cats) or e.get('damage') or e.get('armor_class'):
        continue
    cat = next((CAT[c] for c in cats if c in CAT), 'gear')
    if re.search(r"'s Pack$", e['name']):
        cat = 'pack'
    if re.match(r'Potion|Antitoxin|Acid|Alchemist|Holy Water|Oil$|Poison', e['name']):
        cat = 'consumable'
    if re.match(r'Spell Scroll', e['name']):
        cat = 'consumable'
    c = e.get('cost') or {}
    it = {'id': e['index'], 'name': e['name'], 'cat': cat}
    if c.get('quantity') is not None:
        it['cost'] = f"{c['quantity']} {c.get('unit', 'gp')}"
    if e.get('weight'):
        it['lb'] = e['weight']
    txt = gear_txt.get(e['name'].lower()) or e.get('desc') or e.get('description')
    if isinstance(txt, list):
        txt = '\n'.join(txt)
    if txt:
        it['text'] = txt
    if e.get('contents'):
        it['contents'] = [f"{x.get('quantity', 1)} {x['item']['name']}" for x in e['contents']]
    out.append(it)

KIND = {'Wondrous Items': 'wondrous', 'Weapons': 'weapon', 'Armor': 'armor', 'Rings': 'ring', 'Potions': 'potion', 'Wands': 'wand', 'Staffs': 'staff'}
for m in mi:
    if m.get('variants'):  # หัวข้อรวม เช่น "Weapon, +1, +2, or +3" — ใช้ตัวย่อยแทน
        continue
    desc = m['desc'].replace('\r', '')
    first, _, rest = desc.partition('\n')
    it = {'id': m['index'], 'name': m['name'], 'cat': 'magic', 'kind': KIND.get(m['equipment_category']['name'], 'wondrous'),
          'rarity': (m.get('rarity') or {}).get('name', ''), 'sub': first.strip(), 'text': FIX.get(m['index']) or re.sub(r'[ \t]+\n', '\n', rest).strip()}
    if m.get('attunement'):
        it['att'] = 1
    if m['equipment_category']['name'] == 'Potions' or re.search(r'Potion|Oil of|Elixir|Philter|Dust of|Bead of|Scroll', m['name']):
        it['use'] = 1  # ใช้แล้วหมด
    if it['id'] == 'potion-of-heroism': it['rarity'] = 'Rare'
    if it['id'] == 'potion-of-gaseous-form': it['rarity'] = 'Rare'
    out.append(it)

json.dump(out, open('data/srd/items.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'items', {k: sum(1 for i in out if i['cat'] == k) for k in sorted({i['cat'] for i in out})})
