# Reference docs (local copies)

Markdown exports of the shared claude.ai docs that `audit/HANDOFF.md` references, so an agent working only from this repository can read them. Exported 2026-11-02. The shared doc stays the editable original; re-export if it changes.

Order: newest and most relevant first. "Historical" docs describe earlier states (often `harbour-wallet-v2`) and are context, not current fact.

| File | Title | Written | Status | Original |
| --- | --- | --- | --- | --- |
| [audit-framework-shared.md](audit-framework-shared.md) | Harbour Wallet — Security Audit Framework & Checklist | 2026-10-30 | current (shared copy of audit/FRAMEWORK.md) | https://claude.ai/artifact/Jd31QzSXNn6CgXojxXhrWt |
| [security-attack-review-2026-11-04.md](security-attack-review-2026-11-04.md) | Harbour v3 — attacker code review A1–A9 and fixes | 2026-11-04 | current (A1–A8 closed, A9 open) | Project doc `claude/v3-attack-review-2026-11-04.md` + `claude/v3-attack-review-fixes-2026-11-04.md` |
| [security-pentest-2026-11-04-seed-typing.md](security-pentest-2026-11-04-seed-typing.md) | Seed typing and reveal hardening (threat-model 1.1) | 2026-11-04 | current | Repo only |
| [security-pentest-2026-11-03-fixes.md](security-pentest-2026-11-03-fixes.md) | Harbour v3 — pentest PT-01…PT-12: fixes and verification | 2026-11-03 | current (all 12 fixed) | Project doc `claude/v3-pentest-fixes-2026-11-03.md` |
| [new-developer-guide.md](new-developer-guide.md) | Harbour v3 — New Developer Guide | 2026-10-30 | current (banner added 2026-11-02 for the TLS change) | https://claude.ai/artifact/6x85gJ2duGXZ3ax9p3RMku |
| [production-readiness-report-v3.md](production-readiness-report-v3.md) | Harbour v3 — Production Readiness Report | 2026-10-29 | snapshot before the audit; banner lists what is out of date | https://claude.ai/artifact/ERWMnUGTgEuPAJWbVhbExp |
| [development-progress-report.md](development-progress-report.md) | Harbour Wallet — Development Progress Report | 2026-10-28 | historical (written for v2; has unfilled placeholders) | https://claude.ai/artifact/8aBZqg2gnsF9QJaXBCkDPo |
| [redesign-backend-db-architecture.md](redesign-backend-db-architecture.md) | Harbour Redesign REA-Verified Backend, Database and Architecture | 2026-10-27 | historical design | https://claude.ai/artifact/WZh8S5DcV2H8sjxS5NGwBY |
| [backend-go-services-indexer-rpc-plan.md](backend-go-services-indexer-rpc-plan.md) | Harbour Backend Go Services, Indexer and RPC Plan | 2026-10-27 | historical design (backend plan the v3 code follows) | https://claude.ai/artifact/BAEjCM3s4m8mVRhsqdspVq |
| [backend-plan-trust-wallet-equivalent.md](backend-plan-trust-wallet-equivalent.md) | Harbour Backend Plan Trust Wallet-Equivalent Services | 2026-10-27 | historical design (superseded by the Go services plan) | https://claude.ai/artifact/1noUpyBHo5KKjBKA4sVMh4 |
| [production-readiness-and-architecture-v2.md](production-readiness-and-architecture-v2.md) | Harbour Wallet Production Readiness and Architecture | 2026-10-23 | historical (reviews harbour-wallet-v2) | https://claude.ai/artifact/AcqiuC43HS3hDHmDZ1jMFt |
| [implementation-documentation-v2.md](implementation-documentation-v2.md) | Harbour Wallet — Implementation Documentation | 2026-10-22 | historical (harbour-wallet-v2) | https://claude.ai/artifact/AeKzNNvjvfTVkw7wo95wHY |
| [extension-wallet-audit-SKILL.md](extension-wallet-audit-SKILL.md) | Claude skill: extension-wallet-audit | 2026-10-30 | current (copy of the installed skill) | Claude skill |

Audit working files (findings, results, fixes, handoff) live in `../../audit/`. `audit/FRAMEWORK.md` is the canonical framework the audit was scored against; `audit-framework-shared.md` is the shared-doc version of it.
