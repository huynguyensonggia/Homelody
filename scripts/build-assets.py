"""Bundle first-party CSS using the standard library; keep source files editable."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
css='\n'.join((root/'assets/css'/p).read_text(encoding='utf-8') for p in ['fonts.css','styles.css','motion.css','landing.css'])
css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
css=re.sub(r'\s+',' ',css)
css=re.sub(r'\s*([{};,>])\s*',r'\1',css)
css=re.sub(r':\s+',':',css)
(root/'assets/css/site.min.css').write_text(css.strip(),encoding='utf-8')
print('CSS bundle: '+str(len(css.encode('utf-8')))+' bytes')
