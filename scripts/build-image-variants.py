"""Build WebP variants without altering originals or the live database.

Usage: python scripts/build-image-variants.py   (needs Pillow: python -m pip install --user pillow)
Reads the public drinks/shop_settings rows live with the site's publishable key (read-only),
writes resized copies to assets/images/optimized/ and the URL map to assets/js/image-variants.js.
Nothing is uploaded to Supabase. Photos added in admin after the last run keep their original URL.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import urllib.request

from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
out = root / 'assets/images/optimized'
out.mkdir(parents=True, exist_ok=True)
cache = root / 'reports/performance/source-images'
cache.mkdir(parents=True, exist_ok=True)

# Widths follow the largest rendered slot: thumbnails 52px, menu card/glass/dialog <= 342px, story 320px, space 650px.
DRINK, STORY, SPACE = [160, 480, 720], [480, 720], [480, 720, 960]
QUALITY = 78

config = (root / 'assets/js/config.js').read_text(encoding='utf-8')
setting = lambda name: re.search(name + r":\s*'([^']+)'", config).group(1)
api, key, bucket = setting('supabaseUrl'), setting('supabaseKey'), setting('imageBucket')
media_prefix = f'{api}/storage/v1/object/public/{bucket}/'

def rows(table, columns):
    request = urllib.request.Request(f'{api}/rest/v1/{table}?select={columns}',
                                     headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

sources = {}
# Local photos are only fallbacks when Supabase has no row, so they keep fewer sizes.
for p in (root / 'public/cau-chuyen').glob('*.png'):
    sources[p.relative_to(root).as_posix()] = [480]
for p in (root / 'public/khong-gian').glob('*.webp'):
    sources[p.relative_to(root).as_posix()] = [480, 960]
sources['public/banh-nha-lam/banh-homelody.png'] = [480, 800]   # index.html links the 800px file directly
for name in ['drink-matcha-latte.webp', 'drink-iced-latte.webp']:
    sources['assets/images/' + name] = DRINK
for drink in rows('drinks', 'image_url'):
    if drink.get('image_url'):
        sources[drink['image_url']] = DRINK
for shop in rows('shop_settings', 'story_images,space_images'):
    for field, widths in [('story_images', STORY), ('space_images', SPACE)]:
        for row in shop.get(field) or []:
            if row.get('image_url'):
                sources[row['image_url']] = widths

def convert(item):
    url, widths = item
    digest = hashlib.sha256(url.encode()).hexdigest()[:16]
    if url.startswith('https://'):
        # Live URLs must refer to this project's public media bucket.
        if not url.startswith(media_prefix):
            raise ValueError('Unexpected media source: ' + url)
        source = cache / digest
        if not source.exists():
            try:
                with urllib.request.urlopen(url, timeout=30) as response:
                    source.write_bytes(response.read())
            except OSError as error:
                print(f'Skipped {url}: {error}')   # the site falls back to the original URL
                return url, None
    elif url.startswith('data:'):
        return url, None
    else:
        source = (root / url).resolve()
        if not source.is_relative_to(root):
            raise ValueError('Source outside project')
    variants = []
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.mode or 'transparency' in im.info else 'RGB')
        sizes = []
        for width in widths:
            size = min(width, im.width)
            # A capped size barely larger than the previous one is a re-encode, not a useful step.
            if not sizes or size > sizes[-1] * 1.2:
                sizes.append(size)
        for size in sizes:
            height = round(im.height * size / im.width)
            target = out / f'{digest}-{size}.webp'
            im.resize((size, height), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=QUALITY, method=6)
            variants.append({'src': target.relative_to(root).as_posix(), 'width': size, 'height': height})
    return url, variants

manifest = {}
with ThreadPoolExecutor(max_workers=6) as pool:
    for url, variants in pool.map(convert, sources.items()):
        if variants:
            manifest[url] = variants

# Remove generated files that no current image uses.
kept = {Path(v['src']).name for variants in manifest.values() for v in variants}
removed = 0
for f in out.glob('*.webp'):
    if re.fullmatch(r'[0-9a-f]{16}-\d+\.webp', f.name) and f.name not in kept:
        f.unlink()
        removed += 1

# Keep the same complete canvas and transparent padding as the existing logo.
with Image.open(root / 'assets/images/homelody-logo-transparent.png') as logo:
    ImageOps.contain(logo, (192, 192), Image.Resampling.LANCZOS).save(
        root / 'assets/images/homelody-logo.webp', 'WEBP', quality=90, method=6
    )
manifest_file = root / 'assets/js/image-variants.js'
manifest_file.write_text('/* Generated by scripts/build-image-variants.py. */\nwindow.HOMELODY_IMAGE_VARIANTS = ' +
                         json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print(f'Built variants for {len(manifest)}/{len(sources)} images ({len(kept)} files, {removed} stale files removed); originals retained.')
