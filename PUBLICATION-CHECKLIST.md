# Release candidate 1.2.0 — current evidence

The owner approved repository `meydjer/pi-pocket-chatgpt-images`, GitHub-profile/noreply authorship, one live test using `gpt-6.1-sol`, and the gallery submission goal. The installed extension and the original working source tree remain untouched.

## Completed checks

- [x] MIT license, standalone-file notices and preserved Pocket attribution.
- [x] Explicit `codexModel`, no personal default or silent fallback; missing settings stop before memo/reservation/process.
- [x] Exact, project-local dependencies and lockfile; pinned public Pocket fixture `0.28.2` at `992a50a3c27dbd6c3625c9978d3108df5716ac09`.
- [x] Formatting, strict runtime/tooling/test type checks and lint pass.
- [x] All **89 offline tests** pass, including account/quota/config refusals, unknown CLI versions, model-reroute refusal, queue/restart/cancellation and PNG checks.
- [x] Clean installation of this 1.2.0 candidate passes with empty HOME, fresh npm cache, public Git bootstrap and no provider credentials: formatting, types, lint, **89/89 tests**, and audit with **0 known vulnerabilities**.
- [x] Real Pocket **Share** draft checks pass locally: standalone file, complete description within 600 characters, matching declarations and API2.
- [x] `npm audit` reports **0 known vulnerabilities** for this dependency snapshot.
- [x] Native Codex0.169.0 accepts the exact production `exec` argv with `--help`, without a turn.
- [x] An empty-HOME native probe accepts exact production controls via `initialize` + `config/read`, without account/quota/turn RPCs.
- [x] Linux / Node `24.22.1` / Codex `0.169.0` / GNU timeout `9.12` recorded. Other platforms are not claimed.
- [x] Minimal-permission CI prepared with pinned action commits, no credentials/live images and no automatic publication.
- [x] Independent Sonnet review and follow-up source audit completed. Concrete findings led to effective controls, provider/initial-URL pins, native-version gating and model-reroute refusal. Haiku confirmed public configuration behavior offline.
- [x] Local Git author configured from the approved public profile and its GitHub noreply address, not a personal email.

## Live-test outcome — blocked, not a pass

Two separately owner-authorized live checks passed preflight and reached the possible-submission boundary. Both were interrupted when the adapter treated a native `item.type="error"` as fatal. The second safe diagnostic was `native-item-error`, not a detected model reroute.

A subsequent audit of the exact Codex0.169 source confirmed an adapter defect: configuration warnings, ordinary warnings and deprecation notices use this same item shape and remain `CodexStatus::Running`. Only the fixed `model rerouted:` item prefix must stop for model changes; fatal errors are top-level `error`/`turn.failed` events. The adapter is corrected, with regression tests for warnings before/after completion and a fatal failure that still rejects a written PNG.

The private journals `.cache/live-smoke/attempt.json` and `.cache/live-smoke-authorized-2/attempt.json` remain **uncertain**. They were preserved, not deleted or automatically replayed. A successful post-fix real generation has not yet run. Do not assert that no quota was consumed.

The real test is outside Pocket's live usage ledger; normal owner/model/spending admission is covered by isolated tool integration tests. Do not delete the journal or automatically resubmit an uncertain attempt.

## Gallery CI blocker

The current gallery validation workflow at gallery commit `779e407858812a8569f1c0a52e1582c88beb0567` pins **POCKET_REF: v0.22.0**. This candidate needs the public experimental `host.roleOf` API added in `0.27.0` and is exercised against `0.28.2`.

Gallery CI explicitly rejects an entry whose `minPocket` is newer than its baseline. Do not lower `minPocket`, remove owner checks, use private Pocket APIs or modify the gallery workflow in the one-entry PR to force a pass. A gallery maintainer must raise the supported baseline before this candidate can pass there.

## Remaining work

- [x] Create the approved public repository: https://github.com/meydjer/pi-pocket-chatgpt-images. It is labeled experimental with live validation pending.
- [x] Correct the warning/error protocol interpretation against pinned native source and add regression tests without weakening fatal-error or model-reroute refusals.
- [ ] Authorize and run a fresh post-fix live check. No third generation has been submitted; never delete an uncertain journal to retry.
- [ ] Make and upload the approved initial source commit, then run its CI on GitHub.
- [ ] Resolve GitHub CLI workflow authorization before uploading `.github/workflows/ci.yml`: the current account token has `repo` but not `workflow`. Preserve the approved noreply author; do not change account email/privacy preferences or use a personal commit email.
- [ ] Validate the final pinned payload: full source commit, SHA-256, byte size, API2, conservative `minPocket` and declarations.
- [ ] Submit only `entries/chatgpt-images.json` to the gallery, clearly describing the live-test limitation and baseline blocker. Do not edit `index.json`.
