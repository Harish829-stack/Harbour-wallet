<!-- Local copy of the Claude skill "extension-wallet-audit" (2026-11-02). The installed skill is the original. -->
---
name: "extension-wallet-audit"
description: "Audit a browser-extension + backend crypto wallet codebase against the Extension Wallet Security Audit Framework (139 controls, L1-L3), using code as the only evidence."
---

# Extension Wallet Security Audit

## Inputs
- FRAMEWORK: the "Extension Wallet Security Audit Framework & Checklist" doc (https://claude.ai/artifact/Jd31QzSXNn6CgXojxXhrWt). Export it as Markdown and save it at `audit/FRAMEWORK.md` before starting; quote controls from that file, never from memory.
- CODEBASE: the wallet repo (extension + backend + DB + CI).
- Target level: default L3 (all 139 controls) unless the user says otherwise.

## Source of truth
- The FRAMEWORK defines WHAT to check. The CODEBASE is the ONLY evidence.
- Valid evidence: source code, manifest.json, config files, CI/CD workflows, lockfiles, infra-as-code, DB migrations/schemas, tool output you ran.
- NOT evidence: README, /docs, code comments, commit messages, TODOs, naming, prior knowledge of how wallets usually work.
- Record the commit (`git rev-parse HEAD`). Read-only: never modify, fix or refactor code.

## Status values (exactly one per control)
- PASS: code shows the control is fully implemented.
- FAIL: code shows it is missing or wrong.
- PARTIAL: implemented but incomplete; state exactly what is missing.
- NOT FOUND IN CODE: searched, nothing found; list search terms and directories.
- NEEDS EXTERNAL EVIDENCE: process/people/account control not verifiable from code. Never guess.
- N/A: not applicable to this architecture; give the code-based reason.

## Evidence rules
- Every PASS/FAIL/PARTIAL cites file path + line range + a 1-5 line excerpt. No citation = cannot be PASS/FAIL/PARTIAL.
- Never infer behaviour from a function name; open and read it.
- Quote actual values (KDF params, CSP string, permissions, TLS settings).

## Process
1. Map the repo: components (service worker, popup, content scripts, inpage provider, backend, DB, RPC/indexer clients, CI) with paths -> `audit/00-architecture.md`.
2. Audit area by area A -> M. For each area evaluate every control, append rows to `audit/results.md`:
   `| ID | Level | Status | Evidence (file:lines) | Excerpt | Notes |`
   Do not start the next area until every ID in the current one has a row.
3. Run tooling where available, save raw output in `audit/tool-output/`: npm/pnpm audit, semgrep (p/javascript, p/secrets), gitleaks. Cite as evidence.
4. Coverage check. Expected rows: A11 B12 C12 D10 E15 F10 G13 H12 I9 J7 K10 L9 M9 = 139. Fill any gap; report counts.
5. Verification pass: re-open every cited line for PASS/FAIL/PARTIAL and confirm it matches; list corrections.
6. Findings: each FAIL/PARTIAL -> `audit/findings.md` using FRAMEWORK Section 18 template and severity, sorted Critical -> Info.
7. Summary `audit/summary.md`: commit, date, scope found, status counts per level and area, Section 19 sign-off status from the code side, blocking NEEDS EXTERNAL EVIDENCE items, top 10 risks.

## Output discipline
- No summary before the full table is complete.
- If uncertain, say "uncertain" and why; never round up to PASS.
- Large repos: split A-F (extension) and G-M (backend/DB/ops) into separate passes or sub-agents, plus one verifier pass.
- If context runs low, stop at an area boundary, state the last completed ID, resume from there.
- Spot-check: before reporting, re-open 10 random PASS citations yourself.