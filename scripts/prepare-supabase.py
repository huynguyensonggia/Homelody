"""Prepare a local demo backup for the authorized Supabase project setup."""
from pathlib import Path
import base64, json, hashlib

root = Path(__file__).resolve().parents[1]
work = root / 'reports/supabase-connection'
source = json.loads((work / 'backup.json').read_text(encoding='utf-8'))
images = work / 'images'
images.mkdir(exist_ok=True)
base = 'https://qtoiphhaxmqkuggsiidy.supabase.co/storage/v1/object/public/menu-images/'

def image_url(value):
    if not value or not value.startswith('data:image/'):
        return value
    header, encoded = value.split(',', 1)
    raw = base64.b64decode(encoded)
    ext = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg'}[header[5:].split(';')[0]]
    name = 'import-' + hashlib.sha256(raw).hexdigest()[:20] + '.' + ext
    (images / name).write_bytes(raw)
    return base + name

for row in source['drinks']:
    row.pop('id', None)
    row['image_url'] = image_url(row.get('image_url', ''))
for group in ['story_images', 'space_images']:
    for row in source['shop'].get(group, []):
        row['image_url'] = image_url(row.get('image_url', ''))
(work / 'converted.json').write_text(json.dumps(source, ensure_ascii=False), encoding='utf-8')
payload = json.dumps(source['drinks'], ensure_ascii=False)
shop = json.dumps(source['shop'], ensure_ascii=False)
seed = f"""begin;
insert into public.drinks (name,category,price,description,note,ingredients,image_url,image_alt,is_active,is_featured,sort_order)
select r.name,r.category,r.price,r.description,r.note,r.ingredients,r.image_url,r.image_alt,r.is_active,r.is_featured,r.sort_order
from jsonb_to_recordset($menu${payload}$menu$::jsonb) as r(name text,category text,price integer,description text,note text,ingredients text[],image_url text,image_alt text,is_active boolean,is_featured boolean,sort_order integer)
where not exists(select 1 from public.drinks d where lower(d.name)=lower(r.name) and lower(d.category)=lower(r.category));
update public.shop_settings s set address=r.address,hours=r.hours,phone=r.phone,directions_url=r.directions_url,contact_url=r.contact_url,facebook_url=r.facebook_url,instagram_url=r.instagram_url,tiktok_url=r.tiktok_url,story_images=r.story_images,space_images=r.space_images
from jsonb_to_record($shop${shop}$shop$::jsonb) as r(address text,hours text,phone text,directions_url text,contact_url text,facebook_url text,instagram_url text,tiktok_url text,story_images jsonb,space_images jsonb) where s.id=1;
commit;
select count(*) as products,count(*) filter(where image_url<>'') as product_images from public.drinks;
"""
(work / 'seed.sql').write_text(seed, encoding='utf-8')
print(json.dumps({'drinks': len(source['drinks']), 'images': len(list(images.iterdir())), 'seed_bytes': len(seed.encode('utf-8'))}))
