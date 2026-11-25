#!/usr/bin/env python3
"""Builds TEST_GAP_REPORT.md section 3 (per-test status table) and the summary counts from TEST_PLAN.md + tools/recon.tsv."""
import re, collections, pathlib, sys
Q = pathlib.Path(__file__).resolve().parent.parent
rows = []
for line in (Q / 'TEST_PLAN.md').read_text().splitlines():
    c = [x.strip() for x in line.split('|')]
    if len(c) > 4 and re.fullmatch(r'T-[A-Z]+-\d{3}', c[1]):
        tid = c[1]
        if tid.startswith('T-REG'): rows.append((tid, c[2], 'REG', c[4], c[-2]))
        else: rows.append((tid, c[2], c[3], c[4], c[-2]))
rec = {}
for line in (Q / 'tools' / 'recon.tsv').read_text().splitlines():
    if not line.strip() or line.startswith('#'): continue
    p = line.split('\t'); rec[p[0]] = (p[1], p[2] if len(p) > 2 else '', p[3] if len(p) > 3 else '')
status = {}
for r in rows: status[r[0]] = rec.get(r[0], ('MISSING', '—', ''))
unknown = [k for k in rec if k not in status]
if unknown: print('recon ids not in plan:', unknown, file=sys.stderr); sys.exit(1)
S = ['COVERED', 'WEAK', 'BROKEN', 'MISSING']
bycat = collections.defaultdict(collections.Counter); bypri = collections.defaultdict(collections.Counter); tot = collections.Counter()
for tid, feat, cat, pri, layer in rows:
    s = status[tid][0]; bycat[cat][s] += 1; bypri[pri][s] += 1; tot[s] += 1
out = ['| Category | ' + ' | '.join(S) + ' | Total |', '|---|' + '---|' * (len(S) + 1)]
for k in sorted(bycat): out.append(f'| {k} | ' + ' | '.join(str(bycat[k][s]) for s in S) + f' | {sum(bycat[k].values())} |')
out.append('| **All** | ' + ' | '.join(f'**{tot[s]}**' for s in S) + f' | **{sum(tot.values())}** |')
out2 = ['| Priority | ' + ' | '.join(S) + ' | Total |', '|---|' + '---|' * (len(S) + 1)]
for k in sorted(bypri): out2.append(f'| {k} | ' + ' | '.join(str(bypri[k][s]) for s in S) + f' | {sum(bypri[k].values())} |')
table = ['| Test ID | Feature | Cat | Pri | Status | Evidence (file / test) | Note |', '|---|---|---|---|---|---|---|']
for tid, feat, cat, pri, layer in rows:
    s, ev, note = status[tid]; table.append(f'| {tid} | {feat} | {cat} | {pri} | {s} | {ev} | {note} |')
(Q / 'tools' / 'gap.counts.md').write_text('### By category\n\n' + '\n'.join(out) + '\n\n### By priority\n\n' + '\n'.join(out2) + '\n')
(Q / 'tools' / 'gap.table.md').write_text('\n'.join(table) + '\n')
print(dict(tot))
