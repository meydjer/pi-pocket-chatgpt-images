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
- [x] Minimal-permission CI prepared with pinned action commits, no provider credentials/live images and no automatic publication.
- [x] [GitHub CI run 43715870837](https://github.com/meydjer/pi-pocket-chatgpt-images/actions/runs/43715870837) passes on public source commit `6c2500775fbf518beba2a9ac7368cd77c82e831c`: formatting, types, lint and **89 tests**, with **0 failures, cancellations or skips**.
- [x] Independent Sonnet review and follow-up source audit completed. Concrete findings led to effective controls, provider/initial-URL pins, native-version gating and model-reroute refusal. Haiku confirmed public configuration behavior offline.
- [x] Local Git author configured from the approved public profile and its GitHub noreply address, not a personal email.

## Live-test outcome — blocked, not a pass

Two separately owner-authorized live checks passed preflight and reached the possible-submission boundary. Both were interrupted when the adapter treated a native `item.type="error"` as fatal. The second safe diagnostic was `native-item-error`, not a detected model reroute.

A subsequent audit of the exact Codex0.169 source confirmed an adapter defect: configuration warnings, ordinary warnings and deprecation notices use this same item shape and remain `CodexStatus::Running`. Only the fixed `model rerouted:` item prefix must stop for model changes; fatal errors are top-level `error`/`turn.failed` events. The adapter is corrected, with regression tests for warnings before/after completion and a fatal failure that still rejects a written PNG.

The private journals `.cache/live-smoke/attempt.json` and `.cache/live-smoke-authorized-2/attempt.json` remain **uncertain**. They were preserved, not deleted or automatically replayed. A successful post-fix real generation has not yet run. Do not assert that no quota was consumed.

The real test is outside Pocket's live usage ledger; normal owner/model/spending admission is covered by isolated tool integration tests. Do not delete the journal or automatically resubmit an uncertain attempt.

## Gallery CI blocker

The gallery validation workflow at gallery commit `779e407858812a8569f1c0a52e1582c88beb0567` pins **POCKET_REF: v0.22.0**. A fresh browser check of the current `main` workflow confirms that this pin remains unchanged. This candidate needs the public experimental `host.roleOf` API added in `0.27.0` and is exercised against `0.28.2`.

Gallery CI explicitly rejects an entry whose `minPocket` is newer than its baseline. Do not lower `minPocket`, remove owner checks, use private Pocket APIs or modify the gallery workflow in the one-entry PR to force a pass. A gallery maintainer must raise the supported baseline before this candidate can pass there.

## Pinned package evidence

Pocket Share generated a complete entry with known declarations and no problems. The entry pins public source commit `6c2500775fbf518beba2a9ac7368cd77c82e831c`, API **2**, and conservative `minPocket` **0.28.2**. Its only file is `chatgpt-images.ts`: **49,239 bytes**, SHA-256 `697772a25f6de91630f21d8fe30cef5b6368dad77389512053a4a5348545b480`.

The unmodified official gallery validator passes locally against Pocket **0.28.2**, both with local files and with the file downloaded from its public pinned GitHub commit. It checks the schema, Pocket reader, names against 21 existing gallery entries, size/hash, isolated module loading and declarations. This does **not** prove compatibility with the gallery's older CI baseline or successful real image generation.

The proposed entry remains local in `.cache/gallery-submission/entries/chatgpt-images.json`. No gallery PR has been opened.

## Remaining work

- [x] Create the approved public repository: https://github.com/meydjer/pi-pocket-chatgpt-images. It is labeled experimental with live validation pending.
- [x] Correct the warning/error protocol interpretation against pinned native source and add regression tests without weakening fatal-error or model-reroute refusals.
- [ ] Authorize and run a fresh post-fix live check. No third generation has been submitted; never delete an uncertain journal to retry.
- [x] Publish the approved initial source commit and verify its successful GitHub CI run.
- [x] Receive owner authorization for the GitHub CLI `workflow` scope. Preserve the approved noreply author without changing account email/privacy preferences or using a personal commit email.
- [x] Validate the pinned payload: full public source commit, SHA-256, byte size, API2, conservative `minPocket` and declarations.
- [ ] Submit only `entries/chatgpt-images.json` to the gallery, clearly describing the live-test limitation and baseline blocker. Do not edit `index.json`.
