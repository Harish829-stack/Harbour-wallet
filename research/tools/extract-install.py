"""Preserve exact shipped code ranges; add statement separators, never mocks."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent.parent
source = root / 'evidences/extension/reference-26.41.0/background.js'
data = source.read_bytes()
target = root / 'evidences/re-evidence/01-install/2026-10-15-local'
target.mkdir(parents=True, exist_ok=True)
markers = [
    (b'function registerInstallListener(){', b'async function init(){'),
    (b'async function init(){', b'var init_background='),
    (b'var init_background=', b',background_default='),
]
chunks, ranges = [], []
for start_marker, end_marker in markers:
    start = data.index(start_marker)
    end = data.index(end_marker, start)
    part = data[start:end]
    ranges.append({'original_start': start, 'original_end': end,
                   'bytes': len(part), 'sha256': hashlib.sha256(part).hexdigest(),
                   'output_start': sum(map(len, chunks)), 'inserted_after': ';\n'})
    chunks.extend([part, b';\n'])
out = b''.join(chunks)
(target / 'install-entry-exact.js').write_bytes(out)
(target / 'source-ranges.json').write_text(json.dumps({
    'source': str(source.relative_to(root)), 'source_sha256': hashlib.sha256(data).hexdigest(),
    'ranges': ranges, 'offset_semantics': 'half-open UTF-8 bytes',
    'transform': 'Concatenate exact ranges with explicit semicolon/newline separators; no stubs.',
    'output_sha256': hashlib.sha256(out).hexdigest(),
}, indent=2) + '\n')
print(target / 'install-entry-exact.js')
