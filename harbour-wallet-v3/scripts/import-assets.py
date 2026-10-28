#!/usr/bin/env python3
"""Bundle compact logo files from a local clone of the public asset library into the extension.

Usage: python3 scripts/import-assets.py [path/to/assets]   (default: ../assets)

Writes (all committed, the 1+ GB library itself is not):
  public-production/chains/<chain>.png            chain logos (128px)
  public-production/tokens/<chain>/<addr>.webp    tokens from each chain's tokenlist.json (64px)
  public-production/dapps/<domain>.webp           dApp logos (96px)
  public-production/validators/<chain>/<id>.webp  staking-validator logos (64px)
  src/core/{tokenLogos,staking/validatorLogos,discover/dappLogos}.json   manifests (what exists locally)
  public-production/icons, favicon.*, icon-*.png, apple-touch-icon.png  Harbour app icons (from scripts/brand/harbour-logo-source.png)

Third-party brand logos that are not Harbour's are excluded on purpose: the Trust Wallet token (TWT) and the trustwallet.com dApps.
"""
import base64, io, json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'assets'))
PUB = os.path.join(ROOT, 'public-production')

def is_trust_brand(*parts):
    s = ' '.join(str(p) for p in parts).lower()
    return 'trustwallet' in s or 'trust wallet' in s or s.strip() in ('twt', 'trust.logo') or 'discover_trust' in s or '.twt' in s

def fit(img, size):
    img = img.convert('RGBA')
    img.thumbnail((size, size), Image.LANCZOS)
    return img

def save_png(img, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fit(img, size).save(path, 'PNG', optimize=True)

def save_webp(img, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fit(img, size).save(path, 'WEBP', quality=82, method=6)

def fresh(d):
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d, exist_ok=True)

def dump(path, obj):
    with open(path, 'w') as f: json.dump(obj, f, separators=(',', ':'), sort_keys=True)

# ---- chains -----------------------------------------------------------------
bc = os.path.join(SRC, 'blockchains')
chains = sorted(c for c in os.listdir(bc) if os.path.isfile(os.path.join(bc, c, 'info', 'logo.png')))
n = 0
for c in chains:
    save_png(Image.open(os.path.join(bc, c, 'info', 'logo.png')), os.path.join(PUB, 'chains', c + '.png'), 128); n += 1
print('chains', n)

# ---- tokens (each chain's curated tokenlist.json + anything Harbour hard-codes) -
fresh(os.path.join(PUB, 'tokens'))
tokens, skipped = {}, 0
extra = {'solana': ['JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN']}
for c in chains:
    ids = set(extra.get(c, []))
    tl = os.path.join(bc, c, 'tokenlist.json')
    if os.path.isfile(tl):
        try: ids |= {t['address'] for t in json.load(open(tl)).get('tokens', []) if 'address' in t}
        except Exception: pass
    for a in sorted(ids):
        logo = os.path.join(bc, c, 'assets', a, 'logo.png')
        if not os.path.isfile(logo): continue
        info = {}
        try: info = json.load(open(os.path.join(bc, c, 'assets', a, 'info.json')))
        except Exception: pass
        if is_trust_brand(info.get('symbol', ''), info.get('name', '')): skipped += 1; continue
        try: save_webp(Image.open(logo), os.path.join(PUB, 'tokens', c, a + '.webp'), 64)
        except Exception: continue
        tokens.setdefault(c, []).append(a)
dump(os.path.join(ROOT, 'src/core/tokenLogos.json'), tokens)
print('tokens', sum(map(len, tokens.values())), 'chains', len(tokens), 'skipped trust-brand', skipped)

# ---- dApps ------------------------------------------------------------------
fresh(os.path.join(PUB, 'dapps'))
dapps = []
dd = os.path.join(SRC, 'dapps')
for f in sorted(os.listdir(dd)):
    stem, ext = os.path.splitext(f)
    if ext.lower() != '.png' or is_trust_brand(stem): continue
    try: save_webp(Image.open(os.path.join(dd, f)), os.path.join(PUB, 'dapps', stem + '.webp'), 96)
    except Exception: continue
    dapps.append(stem)
dump(os.path.join(ROOT, 'src/core/discover/dappLogos.json'), dapps)
print('dapps', len(dapps))

# ---- validators (chains that Harbour can stake on = keys of the bundled snapshot) -
fresh(os.path.join(PUB, 'validators'))
snap = json.load(open(os.path.join(ROOT, 'src/core/staking/validators.snapshot.json')))
vals = {}
for c in sorted(snap):
    vd = os.path.join(bc, c, 'validators', 'assets')
    if not os.path.isdir(vd): continue
    for v in sorted(os.listdir(vd)):
        logo = os.path.join(vd, v, 'logo.png')
        if not os.path.isfile(logo): continue
        try: save_webp(Image.open(logo), os.path.join(PUB, 'validators', c, v + '.webp'), 64)
        except Exception: continue
        vals.setdefault(c, []).append(v)
dump(os.path.join(ROOT, 'src/core/staking/validatorLogos.json'), vals)
print('validators', sum(map(len, vals.values())))

# ---- Harbour app icons -------------------------------------------------------
src = Image.open(os.path.join(ROOT, 'scripts/brand/harbour-logo-source.png')).convert('RGB')
w, h = src.size
side = int(min(w, h) * 0.92)                      # trim the empty dark margin around the tile
l, t = (w - side) // 2, int((h - side) // 2 + h * 0.005)
sq = src.crop((l, t, l + side, t + side))
for name, size in [('icons/icon16.png', 16), ('icons/icon32.png', 32), ('icons/icon48.png', 48), ('icons/icon128.png', 128),
                   ('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180), ('brand/harbour-logo.png', 256)]:
    save_png(sq, os.path.join(PUB, name), size)
sq.resize((48, 48), Image.LANCZOS).save(os.path.join(PUB, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
buf = io.BytesIO(); sq.resize((128, 128), Image.LANCZOS).save(buf, 'PNG', optimize=True)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128" viewBox="0 0 128 128">'
       '<image width="128" height="128" href="data:image/png;base64,%s"/></svg>' % base64.b64encode(buf.getvalue()).decode())
for p in ('favicon.svg', 'icons/harbour.svg'):
    open(os.path.join(PUB, p), 'w').write(svg)
print('icons done')
