# PROGRESS

Running log for the eve agent lab. Newest entries on top.

## Legend
- ✅ done & tested (logs captured)  · 🟡 in progress  · ⬜ not started

## Status
- ✅ Phase 0 — Research (RESEARCH.md): eve / SuperServe / Monid verified real; keys validated; versions pinned.
- 🟡 Phase 1 — Scaffold & verify happy path
  - ✅ Toolchain: Node 24.17.0 (nvm), git identity = Ravindra Kumar <ravidsrk@gmail.com>, root .gitignore.
  - ⬜ Scaffold eve-lab, OpenRouter provider, SuperServe backend, Monid tools, get_weather HTTP round-trip.
- ⬜ Phase 2 — 20-archetype matrix
- ⬜ Phase 3 — Evals & robustness
- ⬜ Phase 4 — Deliverables (README, FINDINGS, reproducibility)

## Decisions taken (autonomous, per user's "use your wisdom")
1. **Layout:** single npm-workspaces monorepo in `/workspace` (hoist one node_modules; each archetype still its own dir/project).
2. **Monid budget:** hard cap **$5 total / ≤$0.25 per task**; prefer free discover/inspect; log every paid run's USD.
3. **Test depth:** every archetype builds + typechecks + boots + one live smoke session; deep end-to-end on a representative subset (durable-resume, swarm, data-analyst, web-research).
4. **Channel #10:** Slack channel; if no bot token, prove agent logic via a mocked channel transport.
5. **Priority:** land the SuperServe custom backend + durable-resume proof early.

## Log
- 2026-06-18: Installed Node 24, set git identity, wrote .gitignore + RESEARCH.md. Verified API keys (OpenRouter ok, Monid wallet $495.34, SuperServe ok via X-API-Key). Confirmed no Docker/KVM → custom SuperServe backend is the real-execution path.
