# Runtime permissions and service boundaries

Read this document and `chatgpt-images.ts` before enabling the module. A Pocket drop-in runs with the server owner's OS rights. Its code is not sandboxed by Lancet Guard.

## Programs and admission

The extension starts only the already-installed programs `timeout` and `codex`. It uses argument arrays, never a shell. It installs or downloads no executable, package, model or plugin.

The model supplies only a visual description. It cannot supply a program, command, path, URL, provider or account. The owner selects the intermediate text model once in Pocket's extension settings. Missing/invalid settings fail before a memo write, reservation or process. An unavailable or unauthorized model fails without fallback.

Only a conversation's owner requester can generate. Pocket's spending holds, allowed models and cancellation remain active. Authorization is checked after asynchronous model lookup, after queue waits and before the request can reach Codex. Guests/viewers cannot generate or run the owner-only status/recovery command.

### Child-process controls

Both the status App Server and the generation process receive `--strict-config` plus explicit overrides. Preflight refuses missing or conflicting effective controls before calling `account/read` and `account/rateLimits/read`. Native startup can itself fetch authenticated workspace policy before these RPC checks; this is not a claim of zero network use during initialization.

- Disabled: shell/unified execution, shell snapshots, browser/computer tools, view-image, code-mode hosts, hooks, MCP tools, apps/plugins, subagents, memories, goals, tool suggestions, skill dependency installation and unrelated workspace helpers.
- Disabled: analytics, feedback, OTEL **logs, traces and metrics**, prompt/response export and update checks. Disabling analytics alone would not disable an explicit OTLP exporter.
- The built-in `openai` provider and initial ChatGPT status/inference addresses are explicitly selected in both processes, without replacing a protected provider definition. Custom initial provider/base URLs are rejected. Web search is disabled and verified.
- Credential storage is fixed to `file`. The module does not select another account or use an OS keyring fallback.
- Codex0.169's per-process `CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED=1` startup control suppresses persisted remote-control sessions. Daemon auto-start and step-model switching are disabled. No preference is changed on disk.
- Generation uses `--ignore-user-config`, `--ephemeral`, `--sandbox read-only`, no repository lookup and a fresh temporary working directory. Approval policy is `never`; the module does not answer an approval affirmatively.
- Project document budget is `0`; bundled skills and automatic skill instructions are off. This is **not** a claim that global Codex instructions or all local skill metadata are unread. The native client controls that behavior.

Status intentionally reads user configuration to discover MCP names; generation ignores user configuration and reapplies the pinned controls. The first status process performs only initialization/config discovery, with configured MCP entries still present; it never receives a thread/turn request. A second status process disables every discovered MCP name before account/quota RPCs. This is not a claim that the native program reads no configuration or performs no startup work.

These controls constrain the tested official CLI. They cannot make a malicious executable, launcher, OS configuration or future CLI safe. Because a startup control is version-sensitive, this release first requires the exact `codex-cli 0.169.0` version response under a separate 5-second timeout. An unknown version/launcher fails before loading credential files or account/quota RPCs. A version string is not a cryptographic binary attestation; the installed executable remains trusted.

## Files, environment and persistence

| Resource                                  | Read/write and purpose                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Pi agentDir>/auth.json`                 | Read locally to compare the `openai-codex` OAuth account ID. The file may contain other providers' secrets; none are returned or copied.                                                                                                                                                                                                                                                                                                                |
| `<CODEX_HOME>/auth.json`                  | Read locally for the same-account check and by native Codex for ChatGPT authentication. Native token refresh can update this file in place.                                                                                                                                                                                                                                                                                                             |
| Codex user/system configuration           | The status process reads effective configuration to discover and disable configured MCP servers and verify controls. This includes `CODEX_HOME/config.toml`, selected profile files and applicable system/managed configuration, such as `/etc/codex/`. Native policy can reference additional local files.                                                                                                                                             |
| Native global instructions/skills         | Codex can read global `AGENTS.md`/`AGENTS.override.md`, local skill metadata and its normal configuration roots. Global instructions can enter the model request. Project budget `0` does not remove global instructions. No claim is made that every native file probe is eliminated.                                                                                                                                                                  |
| `<CODEX_HOME>/generated_images/<thread>/` | Native Codex writes the image. The extension reads exactly one regular PNG in that request's directory and verifies its origin, path, structure, CRC and bounded decompression. It rejects symlinks, extra files and invalid PNGs.                                                                                                                                                                                                                      |
| Native state/cache/logs                   | Codex can read/write its normal auth cache, installation metadata, SQLite state, model cache and logs under `CODEX_HOME` and standard user/cache directories. `--ephemeral` is not a promise of zero local writes or log retention.                                                                                                                                                                                                                     |
| Temporary working directory               | The extension creates a fresh `chatgpt-images-*` directory under the OS temporary directory and removes only that directory in `finally`. It does not use the task's project directory as Codex's working directory.                                                                                                                                                                                                                                    |
| Pocket durable documents                  | `x.chatgpt-images.control`, version `1`, keeps pending/last request IDs, stage, deadline, image path and attempt statistics. Existing state/kind is preserved. For a successful generation, the framework usage ledger records reported input/cached-input/output text-model tokens once; no image price is invented. Uncertain or unreported usage and cache-write details are not fabricated, so this ledger is not a complete remote billing record. |

`CODEX_HOME` comes from the server environment, or defaults to `~/.codex`. The child receives a small allowlist: HOME/PATH, user/locale, XDG paths, SSL certificate paths and CODEX_HOME, plus the fixed remote-control-disabled startup variable. API keys, provider base-URL variables, HTTP(S)_PROXY variables, NODE_OPTIONS, LD_PRELOAD and other arbitrary environment values are not inherited. Proxy-dependent installations need separate compatibility review; a custom CA can use SSL_CERT_FILE.

Native logs can contain request details. Keep Codex's directories private. The extension discards raw process stderr, sanitizes failures and does not put account IDs, tokens or raw provider errors in tool results/status cards.

## Network destinations and timing

The TypeScript module has no direct HTTP client or browser module. The installed native CLI performs network requests after an owner-authorized tool call:

| Host                                        | Data and timing                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatgpt.com` (HTTPS/WSS)                   | Codex authentication headers, account/quota requests and native client/session metadata. Generation sends the fixed task instructions, visual description and any native global instruction context. It receives model events and image data.                                                                                                                                                                         |
| `auth.openai.com` (HTTPS)                   | Native OAuth refresh material when Codex renews the owner's existing ChatGPT session. The extension does not initiate a login or select another account.                                                                                                                                                                                                                                                              |
| Workspace/backend origin returned by OpenAI | Native workspace routing can replace the initial inference origin with an authenticated, service-discovered HTTPS origin for the same account. Native code checks routing structure/account identity and rejects redirects, but this extension cannot enumerate or OS-allowlist every service-chosen regional/workspace hostname. These managed/residency routes are outside the exercised consumer-account baseline. |

The effective initial `chatgpt_base_url` must equal `https://chatgpt.com/backend-api`; the initial inference `openai_base_url` must equal `https://chatgpt.com/backend-api/codex`. Native initialization may fetch workspace policy or model metadata, and service-side routing is a separate native behavior, not an extension fallback. The source audit uses official Codex tag `rust-v0.169.0`, commit `d32063f96c2dff1dc96af839b3952abb6acfeda4`.

API-key mode is rejected. The extension does not configure `api.openai.com` as a paid fallback. It never uses OpenRouter or another image provider.

**Launchers are separate programs.** Prefer the official Codex executable on PATH. A version-manager shim can perform its own resolution/update requests before Codex receives its arguments. For example, mise can contact `mise-versions.jdx.dev` and `api.github.com`; those launchers are outside the audited native process behavior. Use a known executable and review local launchers/proxies. The isolated release smoke check uses the actual installed Codex binary, not a shim.

No runtime package install or self-update is performed. Development-only `npm ci` and pinned Git bootstrap contact the npm registry and GitHub; they are not generation actions and are not shipped as a runtime installer.

This is a source/configuration audit, not OS-level packet capture or an absolute network-containment guarantee. Native executables and system policy remain trusted prerequisites.

## Quota, cost and uncertain results

Preflight compares the stored OAuth account IDs and asks only `config/read`, `account/read` and `account/rateLimits/read`. The App Server never starts a thread or model turn. Generation runs separately through `codex exec`.

The quota response must identify Codex, report a valid window below `100%` and explicitly report both `credits.hasCredits === false` and `credits.unlimited === false`. Unknown/missing values, exhaustion or a state that might use additional credits stop the request. A `99.999%` window is not arbitrarily cut off at `90%`.

These checks are not an atomic reservation with the remote service. Other clients or credential changes can race them. OpenAI controls quota consumption, account/workspace eligibility and actual billing. Built-in image turns are documented to consume included limits about 3–5× faster on average than similar non-image turns. The CLI does not separately report an image price, and protected internal provider retries cannot be guaranteed to be zero.

There is no extension-imposed daily allowance, per-image approval or artificial prompt-length ceiling. The UTC day/attempt count is statistical only. Waiting in the queue does not submit a generation; ordering is not guaranteed to be FIFO.

A top-level `error` or `turn.failed`, and an `item.type="error"` whose message starts with Codex0.169's fixed `model rerouted:` prefix, stop the attempt. The pinned CLI also serializes configuration warnings, ordinary warnings and deprecation notices as `item.type="error"`; those are not failed turns and are not forwarded to the model. Successful completion and a valid PNG remain mandatory. Detecting a reroute cannot undo a server decision or usage that already occurred.

A memo and durable reservation prevent automatic resubmission after restart. A post-submission failure remains uncertain until the owner inspects it and acknowledges it after its deadline. Acknowledgment does not retry, remove an image or refund usage.

Technical bounds are unchanged: each process has a 240-second timeout plus forced termination after 5 seconds; the PNG is at most 15 MiB and decompression is bounded. These are safety bounds, not image-quantity quotas.

## Supported use and evidence

Use this as a trusted, local, owner-operated integration under the applicable OpenAI terms, plan limits and workspace policy. MIT licenses this extension's code; it does not grant additional service rights or authorize resale/shared-account access. No public or untrusted execution service is supported.

The automated suite uses fake Codex processes, synthetic accounts and isolated Pocket data. It checks admission, account/quota refusals, privacy controls, replay/cancellation, PNG validation and persistence without real credentials or model requests. A separate empty-HOME native probe checks effective configuration using only `initialize` and `config/read`. Any real smoke check is separately authorized, outside CI, limited to the approved test, and never retried if its result is uncertain.

See [PUBLICATION-CHECKLIST.md](PUBLICATION-CHECKLIST.md) for the current checks and remaining publication work.
