# Contributing

Small, focused contributions are welcome. The source repository is `meydjer/pi-pocket-chatgpt-images`; gallery submissions change only `entries/chatgpt-images.json` in the gallery repository. Do not edit its generated `index.json`.

## Local workflow

Use Node.js `>=24.22.1`. In a clean checkout, run:

```sh
npm ci --ignore-scripts
npm run setup:pocket
npm run validate
```

`setup:pocket` fetches the public Pi Pocket checkout into `.cache/pi-pocket`, pinned by `tooling/pi-pocket.json`. Development helpers and typings come from that checkout. Its internal relative dependency alias resolves this project's locked `node_modules`; do not depend on a live Pocket installation, machine-specific absolute paths or globally installed npm packages.

`validate` runs format checking, TypeScript checks, lint, and tests. After setup, tests should need no network, Codex CLI, authentication, API access, or real account. If a check fails, report the command and relevant output without sharing credentials or private data.

## Dependency and type checks

`npm run check` checks both the runtime/tooling project and a separate strict test project. The test project disables unused-declaration diagnostics for the imported upstream fixture; ESLint still checks this project's tests for unused variables.

Development uses `minimatch` `11.0.8` and a scoped override for `@typescript-eslint/typescript-estree` to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). This is a deliberate development-only difference from the pinned Pocket dependency graph. It does not patch an installed Pocket server. Keep the lockfile and validate overrides with the full suite; do not run `npm audit fix --force` blindly.

## Safe contributions

- Keep changes small and scoped. Preserve the current behavior unless a change is explicitly intended and tested.
- Do not use real ChatGPT accounts, credentials, API calls, generated private images, or user data in tests. Use mocks and synthetic fixtures only. Never commit authentication files, tokens, logs containing secrets, generated private assets, or caches.
- Do not add tests that silently contact Codex, OpenAI, or another network service. Any separately proposed live smoke test must be opt-in, clearly documented, and must not be part of normal validation.
- Do not claim guaranteed zero billing or absolute security. Report the exact behavior and limits demonstrated by tests.
- Do not add a paid API fallback, automatic retry of an uncertain generation, a daily cap, a 90% quota cutoff, or per-image approval without an explicit product decision.
- Keep setup reproducible and pinned. Do not change the Pi Pocket checkout revision or dependency setup without documenting why and validating from a clean environment.

Before proposing a user-facing behavior change, update the English documentation and changelog. The runtime interface remains in Portuguese; localization is a separate change.
