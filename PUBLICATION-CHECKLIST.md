# Release candidate 1.2.0 — current evidence

The owner approved repository `meydjer/pi-pocket-chatgpt-images`, GitHub-profile/noreply authorship, three separately authorized live attempts using `gpt-6.1-sol`, and the gallery submission goal. The installed extension and the original working source tree remain untouched.

## Completed checks

- [x] MIT license, standalone-file notices and preserved Pocket attribution.
- [x] Explicit `codexModel`, no personal default or silent fallback; missing settings stop before memo/reservation/process.
- [x] Exact, project-local dependencies and lockfile; pinned public Pocket fixture `0.28.2` at `992a50a3c27dbd6c3625c9978d3108df5716ac09`.
- [x] Formatting, strict runtime/tooling/test type checks and lint pass.
- [x] The public snapshot passed **89 offline tests**, including account/quota/config refusals, unknown CLI versions, model-reroute refusal, queue/restart/cancellation and PNG checks. The local suite adds a completed-turn-without-PNG regression; see the current local verification below.
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

## Current local verification

`npm run validate && npm audit` passes: formatting, types, lint, **90/90 offline tests**, no failures/cancellations/skips, and **0 known vulnerabilities**. This is a local result, not a new public CI run. `git diff --check` passes. The standalone payload remains unchanged at 49,239 bytes and SHA-256 `697772a25f6de91630f21d8fe30cef5b6368dad77389512053a4a5348545b480`; the public pin below is the earlier snapshot, without this local test/documentation update.

## Live-test outcome — blocked, not a pass

Two separately owner-authorized live checks passed preflight and reached the possible-submission boundary. Both were interrupted when the adapter treated a native `item.type="error"` as fatal. The second safe diagnostic was `native-item-error`, not a detected model reroute.

A subsequent audit of the exact Codex0.169 source confirmed an adapter defect: configuration warnings, ordinary warnings and deprecation notices use this same item shape and remain `CodexStatus::Running`. Only the fixed `model rerouted:` item prefix must stop for model changes; fatal errors are top-level `error`/`turn.failed` events. The adapter is corrected, with regression tests for warnings before/after completion and a fatal failure that still rejects a written PNG.

The owner explicitly authorized 1 additional post-fix live check using the same account and `gpt-6.1-sol`. This third attempt used real Codex CLI0.169.0 and the unchanged public payload with the SHA-256 recorded below. `npm run smoke:live -- --allow-live --run-id authorized-3-postfix ...` exited with code 1 after approximately 11 seconds. Its safe message reported that the exclusive generation directory did not contain exactly 1 valid PNG. The `runCodexImage` control flow establishes that native `exec` returned 0 and `turn.completed` occurred before the PNG check.

Read-only local inspection confirmed that this thread's image directory did not exist and no image directory was modified during that window. No raw JSONL was preserved, so the specific cause remains unconfirmed. No real image generation has passed for this candidate. No fourth generation ran.

All three private journals (`.cache/live-smoke/attempt.json`, `.cache/live-smoke-authorized-2/attempt.json` and `.cache/live-smoke-authorized-3-postfix/attempt.json`) remain **uncertain**, with mode 0600 as previously verified. They were preserved, not deleted or automatically replayed. Do not assert that no quota was consumed.

### Read-only native-source investigation

Source: tag `rust-v0.169.0`, commit `d32063f96c2dff1dc96af839b3952abb6acfeda4`, inspected with local Git only. No native executable, account data or provider service was accessed during this investigation.

- `codex-rs/features/src/lib.rs:2003–2008`: `image_generation` is stable and enabled by default. The adapter does not disable it. Adding an enable flag is not a demonstrated fix.
- `codex-rs/core/src/tools/spec_plan.rs:821–855`: availability requires the feature, a non-Free plan, provider image-generation capability, image input modality and supported authentication. The actual third-turn model metadata and tool availability were not recorded; a gate failure remains a hypothesis, not a finding.
- `codex-rs/app-server/src/extensions.rs:109–139`: image generation is installed separately from skills. `skills.bundled.enabled=false` and `skills.include_instructions=false` control skills, not image-tool registration. Enabling skills is not a demonstrated fix.
- `codex-rs/exec/src/lib.rs:790–817`: exec uses the embedded app-server. Its image extension resolves storage to `config.codex_home`. `codex-rs/ext/image-generation/src/artifact.rs:33–62` constructs `generated_images/<session_id>/<call_id>.png` (or GIF). `tool.rs:362–404` writes through local filesystem calls without the command sandbox. The existing thread-directory lookup and read-only command sandbox do not demonstrate a storage mismatch.
- `codex-rs/exec/src/event_processor_with_jsonl_output.rs:146–324`: the item mapper omits image-generation items through its catch-all `None`. Absence of an image item in exec JSONL cannot distinguish no tool call from a tool failure or save failure. A completed turn is not proof of an image.

The production transport and controls remain unchanged. The added offline regression supplies a completed turn with a warning but no image directory; it must reject safely after exactly 1 exec, without retry. Determining the live cause requires separately approved, privacy-filtered native diagnostics that expose actual tool availability and image-call/save outcome; repeating the existing smoke alone does not supply that evidence.

A subsequent read-only native diagnostic verified the same account, effective isolation, a non-Free plan, provider image-generation capability and available included Codex quota. It found no explicitly disabled image-generation feature and no separately reported image-quota group. It sent only `initialize`, `config/read`, `account/read`, `modelProvider/capabilities/read` and `account/rateLimits/read`; no thread or turn was requested. These current gates do not reconstruct the third attempt or prove image-service quota. No raw provider data was persisted or exposed.

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
- [x] Receive explicit owner authorization and run 1 additional post-fix live check with the same account and `gpt-6.1-sol`; the third attempt remains uncertain, not successful.
- [ ] Establish the third attempt's missing-PNG cause before changing transport. A further real generation requires new explicit authorization and useful safe diagnostics; never delete an uncertain journal to retry.
- [x] Publish the approved initial source commit and verify its successful GitHub CI run.
- [x] Receive owner authorization for the GitHub CLI `workflow` scope. Preserve the approved noreply author without changing account email/privacy preferences or using a personal commit email.
- [x] Validate the pinned payload: full public source commit, SHA-256, byte size, API2, conservative `minPocket` and declarations.
- [ ] Submit only `entries/chatgpt-images.json` to the gallery, clearly describing the live-test limitation and baseline blocker. Do not edit `index.json`.
