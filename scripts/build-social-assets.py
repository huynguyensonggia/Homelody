"""Export small brand icons and a social preview from existing artwork (Pillow)."""
from pathlib import Path

from PIL import Image, ImageOps

images = Path(__file__).resolve().parents[1] / 'assets' / 'images'
logo = Image.open(images / 'homelody-logo-transparent.png').convert('RGBA')
icon = Image.new('RGBA', (256, 256), '#2C2F1E')
mark = ImageOps.contain(logo, (240, 240), Image.Resampling.LANCZOS)
icon.alpha_composite(mark, ((256 - mark.width) // 2, (256 - mark.height) // 2))
icon.save(images / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
for name, size in [('favicon-192.png', 192), ('apple-touch-icon.png', 180)]:
    icon.resize((size, size), Image.Resampling.LANCZOS).save(images / name, optimize=True)

hero = Image.open(images / 'hero-coffee-banner.webp').convert('RGB')
ImageOps.fit(hero, (1200, 630), Image.Resampling.LANCZOS).save(
    images / 'homelody-social.jpg', quality=88, optimize=True, progressive=True
)
