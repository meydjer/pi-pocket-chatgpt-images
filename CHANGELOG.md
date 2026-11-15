# Changelog

## 1.2.0 — gallery candidate

### Explicit model choice

- Removed the personal default for `codexModel`. The owner must choose an available, authorized text model once.
- Missing, blank and non-string settings fail before memo, reservation or Codex startup. Invalid/unavailable models fail without substitution.
- Status remains available before configuration and never echoes arbitrary setting values.
- Existing explicit settings continue to work. An old implicit default is not silently preserved as a new choice.

### Compatibility and privacy

- Documented the exercised Linux / Pocket `0.28.2` / Node `24.22.1` / Codex `0.169.0` baseline and experimental Pocket APIs.
- Added strict effective-configuration checks before account/quota RPCs; documented native authenticated policy fetches during startup.
- Correctly distinguished Codex0.169 warning/deprecation items from fatal errors. Model reroutes, top-level errors and failed turns still stop without retry.
- Preserved uncertain live-test journals. A fresh run ID represents a separately owner-authorized test, never automatic deletion/replay.
- Disabled analytics, feedback, OTEL logs/traces/metrics, prompt exports, update checks and unrelated native capabilities per process.
- Selected the built-in OpenAI provider and pinned the initial ChatGPT backend addresses for both status and generation. No protected provider definition is replaced.
- Kept the native file credential store; resolved relative CODEX_HOME consistently before child startup.
- Documented global native instruction context, local auth/cache/log/SQLite writes, launcher behavior, service-controlled quota/billing and non-atomic checks.

### Packaging and verification

- Added MIT licensing with standalone-file notices and preserved Pocket attribution.
- Added exact dependencies, a lockfile, strict runtime/tooling/test type checks, formatting, lint and offline tests.
- Pinned the public Pocket development fixture and kept all development dependencies project-local. Setup refuses modified caches.
- Updated development linters and applied a scoped `minimatch` override for GHSA-g3hv-75wg-m249.
- Added a minimal-permission GitHub Actions workflow without real account credentials, live images or automatic publication.
- Added a separately authorized live-smoke script with an exclusive private journal that prevents accidental resubmission. It is not part of normal validation or CI.

## 1.1.0 — local behavior baseline

- Requested native GPT Image 2 assets through the same ChatGPT account, without a separate paid API.
- Removed the old daily cap, 90% cutoff, per-image confirmation and artificial description-length cap.
- Queued concurrent requests automatically and preserved durable attempt state across restart.
- Rechecked owner/model/spending authorization before generation; recorded reported intermediate-model tokens once, without inventing image prices.
- Kept interrupted requests uncertain instead of automatically resubmitting them.

The durable kind `x.chatgpt-images.control`, version `1`, and the normal multi-image workflow remain unchanged in 1.2.0. Runtime messages remain in Portuguese.
