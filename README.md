# ChatGPT Images for Pi Pocket

> **Candidate 1.2.0, not a validated public release.** All 89 offline tests pass. Two separately authorized live checks exposed an adapter bug that confused native warnings with fatal errors. That bug is corrected and covered by regression tests, but no post-fix real generation has run. Earlier attempts remain uncertain. Gallery CI also pins an older Pocket baseline. See [release evidence and blockers](PUBLICATION-CHECKLIST.md). Do not automatically repeat an uncertain attempt.

Generate product images through the installed Codex CLI and the owner's existing ChatGPT subscription. Built-in Codex image generation is documented as `gpt-image-2`; this extension requests GPT Image 2 but does not invent a remote model ID or a separate image price when the CLI does not report them.

This is a community extension, not an official OpenAI integration. It is for a trusted, owner-operated Pi Pocket installation, not a public or pooled-account image service.

## Requirements and compatibility

| Component                            | Exercised baseline                                                         |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Platform                             | Linux only                                                                 |
| Pi Pocket                            | `0.28.2`, Extensions API `2`                                               |
| Earendil packages provided by Pocket | `1.5.2`                                                                    |
| Node.js                              | `24.22.1`                                                                  |
| Codex CLI                            | `0.169.0`                                                                  |
| Process timeout                      | GNU coreutils `timeout`, exercised with `9.12`                             |
| Authentication                       | File-based Codex ChatGPT login, matching Pi's `openai-codex` OAuth account |

Other versions and platforms are not claimed as tested. The extension uses the experimental Pocket settings and `host.roleOf` APIs, plus the version-sensitive Codex App Server status protocol. The native startup-control contract is version-sensitive: this release requires `codex-cli 0.169.0` before loading credentials or querying quota. Unknown versions, flags or unverifiable controls stop the request rather than selecting a fallback.

Codex and GNU `timeout` must already be on the server's `PATH`; this extension installs nothing. Prefer the official Codex executable rather than a version-manager shim. See [PERMISSIONS.md](PERMISSIONS.md) for launcher, file, network and billing details.

## Install and choose a model once

1. Review `chatgpt-images.ts` and [PERMISSIONS.md](PERMISSIONS.md).
2. Put `chatgpt-images.ts` in the configured Pi Pocket data directory's `extensions/` folder. The gallery entry, when merged, installs this same standalone file. It starts disabled.
3. The owner enables it in **Menu → Extensions**.
4. In that module's settings, set **codexModel** to the bare ID of a text model available through the owner's `openai-codex` provider and permitted by Pocket. Do not enter an API key or provider prefix.

**There is no default text model.** Missing, blank or non-string settings stop before a generation attempt, reservation, or Codex process starts. A configured but unavailable or unauthorized model also stops; the extension never substitutes another model. The setting does not change the conversation's model. It is trimmed and captured for each request.

The image model and the intermediate text model are different things. `codexModel` selects the text model that calls the native image tool; GPT Image 2 remains the requested image model.

## Use

Ask Pi to create an image or product asset as part of the task. The deferred tool is `chatgpt_image`, with one `prompt` string. Use separate calls for separate assets.

- No extension-imposed daily image cap, 90% cutoff, per-image approval, or prompt-length ceiling.
- Concurrent requests wait automatically. Queue ordering is not guaranteed to be FIFO.
- The owner, Pocket spending limits, model authorization and cancellation are checked before admission and again before generation.
- The extension checks the reported Codex quota, not an invented local allowance. It refuses exhausted or unverifiable windows and credit states it cannot verify as included-only.
- The service controls actual usage. Official documentation says image turns use included limits about 3–5× faster on average than similar non-image turns. This is not a per-image price or a guarantee.

### Interrupted requests

Run `/chatgpt-images` or `/chatgpt-images status`. Status works even before model setup.

An interrupted request may have consumed quota or produced an image. Do not resubmit it automatically. After its deadline, inspect the status and use `/chatgpt-images clear <id>` to acknowledge the uncertain attempt. This does not retry, refund quota, or delete the generated image.

## Privacy and limits

Read [PERMISSIONS.md](PERMISSIONS.md) before enabling the module. Generation uses the owner's Codex credentials, sends the visual request to OpenAI, and writes an image under `CODEX_HOME/generated_images`. Native Codex can also read its global instructions/skills metadata and maintain authentication, cache, logs and SQLite state. The extension does not copy authentication files, expose credentials in results, or configure a separate paid API.

All Codex child processes receive explicit controls disabling analytics, feedback and OTEL log/trace/metrics exporters, update checks and unrelated capabilities. Preflight verifies the effective controls before account/quota RPCs. Native initialization can already fetch authenticated workspace policy, and native service routing can select a workspace backend. These controls do not make an already-installed executable or launcher untrusted-code-safe. No OS-level network capture or absolute zero-billing guarantee is claimed.

Quota/account checks and generation are separate operations. Another client or an account change can race them. Included-image consumption is not separately priced by the CLI, and protected internal provider retries cannot be guaranteed to be zero. The extension never automatically resubmits an uncertain generation.

## Development

[GitHub CI passed](https://github.com/meydjer/pi-pocket-chatgpt-images/actions/runs/43715870837) on the pinned 1.2.0 source: formatting, types, lint and **89 offline tests**. The official gallery validator also passed locally on Pocket **0.28.2**, including a download/hash/load check of the public pinned file. Neither check proves real image generation or compatibility with the gallery's older CI baseline.

```sh
npm ci --ignore-scripts
npm run setup:pocket
npm run validate
npm audit
```

Node.js `>=24.22.1`, npm and Git are required. `setup:pocket` fetches the public Pocket source at the full commit in `tooling/pi-pocket.json` into `.cache/pi-pocket`. Its internal relative dependency alias resolves this project's locked `node_modules`, never a live Pocket installation. Setup refuses modified caches rather than resetting them.

For offline setup from existing Git objects:

```sh
npm run setup:pocket -- --source /path/to/local/pi-pocket-checkout
```

Normal validation uses synthetic accounts, fake Codex transport and isolated Pocket data. It must not contact model services or use real credentials. Any live smoke check is separately authorized, runs outside normal validation and CI, and must never retry an uncertain result. `npm run smoke:live -- ...` requires an explicit opt-in, model and credential directories. It tests transport outside Pocket's live usage ledger; normal owner/model/spending admission is covered by the isolated tool tests. Its exclusive `.cache/live-smoke/attempt.json` journal prevents accidental resubmission; never delete it to retry an uncertain request.

See [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md) and the release evidence in [PUBLICATION-CHECKLIST.md](PUBLICATION-CHECKLIST.md). Runtime messages remain in Portuguese.

## License and references

MIT; see [LICENSE](LICENSE), [NOTICE](NOTICE) and [LICENSES/pi-pocket-MIT.txt](LICENSES/pi-pocket-MIT.txt). Codex, GNU coreutils, Pocket and their service terms remain separate.

- [Pocket publishing guide](https://github.com/TannerMidd/pi-pocket/blob/main/docs/extensions/publishing.md)
- [Gallery contribution rules](https://github.com/TannerMidd/pi-pocket-extensions/blob/main/CONTRIBUTING.md)
- [Native image generation](https://learn.chatgpt.com/docs/image-generation?surface=cli)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
