> To activate these as Claude Code subagents, move this folder to `.claude/agents/`
> (the desktop sync tool can't write into `.claude/` directly).

# Harbour Wallet — agent roles

These define specialized agents for the build. They are task-scoped (invoked per
task, then stop), not always-on. The human + main session acts as supervisor,
dispatching the right agent and gating output against the RE docs, BUILD-LOG, and
passing tests/compare reports.

Roles: supervisor, frontend, backend, db, re (reverse-engineering), testing,
review, compare (runs Trust Wallet vs Harbour and diffs the flows).

Non-negotiables enforced across all: no custom crypto (wallet-core only),
RE-aligned behavior with cited spec sections, own branding, and every feature
gated by a passing test + a compare report.
