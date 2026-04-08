# Copilot Instructions for This Repository

## Objective

Prioritize reliable real-time propagation of patient workflow state across firmware and web UI:

- registration
- queueing
- diagnosis start/progress
- measurement completion
- queue transitions

## Persistent Issue Rule

- Treat propagation mismatch as the highest-risk regression until hardware proves it is fixed.
- Do not mark work complete unless serial monitor, LCD, dashboard, and event stream all agree in real time.
- If behavior is intermittent, treat it as unresolved and re-run end-to-end validation.

## Engineering Preferences

- Make behavior observable first (logs, events, status endpoints), then optimize.
- Prefer deterministic smoke tests for API and event-stream paths.
- Avoid regressions in `npm run smoke` and `npm run smoke:events`.
- Keep docs synchronized with actual behavior.

## Validation Baseline

Before calling a change complete:

1. `npm run lint`
2. `npm run smoke`
3. `npm run smoke:events`
4. Hardware validation on ESP32 when available

## Runtime Notes

- The local Node test harness is used for rapid iteration.
- Firmware/hardware verification is still required for final signoff.
- If browser automation is requested, support either:
  - conda-provided Playwright, or
  - project-local Playwright setup, based on user preference.

## Session Continuity

When starting new work, first read:

- `docs/copilot-handoff.md`
- `README.md`
- `DATA_PROPAGATION.md`

## Release Rule

- Only push to public remote after tests pass and the working tree is intentional.
- Never commit secrets, local machine paths, or temporary build artifacts.
