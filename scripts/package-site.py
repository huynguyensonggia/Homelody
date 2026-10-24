"""Package dist with portable ZIP paths, including when run on Windows."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
site = root / 'dist'
if not (site / 'index.html').is_file():
    raise SystemExit('Run node scripts/build-site.mjs first')
with ZipFile(root / 'homelody-netlify.zip', 'w', ZIP_DEFLATED) as archive:
    for file in sorted(site.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(site).as_posix())
print('Created homelody-netlify.zip')
