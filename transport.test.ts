import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executionArgs, runCodexImage } from "./chatgpt-images.ts";

const threadId = "44444444-4444-4444-8444-444444444444";
const account = { "openai-codex": { type: "oauth", accountId: "offline-test-account" } };
const codexAccount = { auth_mode: "chatgpt", tokens: { account_id: "offline-test-account" } };

const fixture = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { deflateSync } = require("node:zlib");
const home = process.env.CODEX_HOME;
const mode = JSON.parse(fs.readFileSync(path.join(home, "fixture-mode.json"), "utf8"));
const audit = path.join(home, "fixture-audit.jsonl");
function log(value) { fs.appendFileSync(audit, JSON.stringify(value) + "\n"); }
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); sum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, sum]);
}
// Effective config is derived from argv only (-c key=value, --disable name), over an unsafe baseline.
// mode.overrides simulates a Codex that ignores a flag or reports something unexpected: [path, value] or [path].
function setPath(target, dotted, value) {
  const keys = dotted.split("."); let node = target;
  for (const key of keys.slice(0, -1)) { if (typeof node[key] !== "object" || node[key] === null) node[key] = {}; node = node[key]; }
  if (value === undefined) delete node[keys.at(-1)]; else node[keys.at(-1)] = value;
}
function effectiveConfig() {
  const argv = process.argv.slice(2);
  const config = {
    mcp_servers: { fake: { enabled: true } }, features: {},
    analytics: { enabled: true }, feedback: { enabled: true },
    otel: { exporter: "otlp-http", trace_exporter: "otlp-http", metrics_exporter: "statsig",
      log_user_prompt: true, log_agent_responses: true, log_guardian_assessments: true },
    check_for_update_on_startup: true, cli_auth_credentials_store: "keyring",
    project_doc_max_bytes: 32768, developer_instructions: "personal", skills: { bundled: { enabled: true }, include_instructions: true },
    approval_policy: "on-request",
    model_provider: "custom", openai_base_url: "https://example.invalid/v1",
    chatgpt_base_url: "https://example.invalid/backend-api", web_search: "live",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--disable") setPath(config, "features." + argv[++i], false);
    else if (argv[i] === "-c") {
      const raw = argv[++i], eq = raw.indexOf("=");
      setPath(config, raw.slice(0, eq), JSON.parse(raw.slice(eq + 1)));
    }
  }
  for (const [dotted, ...value] of mode.overrides ?? []) setPath(config, dotted, value[0]);
  return config;
}
if (process.argv.includes("--version")) {
  log({ kind: "version", argv: process.argv.slice(2),
    remoteControlDisabled: process.env.CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED });
  if (mode.versionError) { process.stderr.write("FIXTURE_VERSION_SECRET\n"); process.exitCode = 3; }
  else process.stdout.write((mode.codexVersion ?? "codex-cli 0.169.0") + "\n");
} else if (process.argv.includes("app-server")) {
  const disabledFake = process.argv.includes("mcp_servers.fake.enabled=false");
  log({ kind: "start", mode: "app-server", argv: process.argv.slice(2), disabledFake,
    remoteControlDisabled: process.env.CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED,
    leaked: ["OPENAI_API_KEY", "NODE_OPTIONS", "LD_PRELOAD"].filter(k => process.env[k] !== undefined) });
  process.on("SIGTERM", () => process.exit(0));
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunkText => {
    buffer += chunkText;
    for (;;) {
      const i = buffer.indexOf("\n"); if (i < 0) break;
      const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
      if (!line) continue;
      const request = JSON.parse(line);
      if (request.method) log({ kind: "rpc", method: request.method, notification: request.id === undefined });
      if (request.id === undefined) continue;
      let result = {};
      if (request.method === "config/read") result = { config: effectiveConfig() };
      if (request.method === "account/read") result = { account: { type: "chatgpt" } };
      if (request.method === "account/rateLimits/read") result = { rateLimits: {
        limitId: "codex", credits: { hasCredits: false, unlimited: false },
        primary: { usedPercent: mode.badQuota ? 100 : 20 },
      } };
      process.stdout.write(JSON.stringify({ id: request.id, result }) + "\n");
    }
  });
} else {
  log({ kind: "start", mode: "exec", argv: process.argv.slice(2),
    remoteControlDisabled: process.env.CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED,
    leaked: ["OPENAI_API_KEY", "NODE_OPTIONS", "LD_PRELOAD"].filter(k => process.env[k] !== undefined) });
  process.stdin.resume();
  process.stdin.on("end", () => {
    if (mode.execWait) { log({ kind: "exec-wait", pid: process.pid }); setInterval(() => {}, 1000); return; }
    if (mode.execError) {
      process.stdout.write(JSON.stringify({ type: "error", message: "FIXTURE_SECRET_PROVIDER_ERROR" }) + "\n");
      return;
    }
    const dir = path.join(home, "generated_images", "44444444-4444-4444-8444-444444444444");
    fs.mkdirSync(dir, { recursive: true });
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(Buffer.from([0, 10, 20, 30, 255]))), chunk("IEND", Buffer.alloc(0))]);
    fs.writeFileSync(path.join(dir, "image.png"), png);
    process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "44444444-4444-4444-8444-444444444444" }) + "\n");
    const reroute = { type: "item.completed", item: { id: "item_0", type: "error", message: "model rerouted: gpt-6.1-sol -> gpt-fake-unapproved (FIXTURE_REROUTE_SECRET)" } };
    const warning = { type: "item.completed", item: { id: "warning_0", type: "error", message: "Configuration/deprecation warning FIXTURE_WARNING_SECRET" } };
    if (mode.warning === "before") process.stdout.write(JSON.stringify(warning) + "\n");
    if (mode.reroute === "before") process.stdout.write(JSON.stringify(reroute) + "\n");
    process.stdout.write(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 12, cached_input_tokens: 3, output_tokens: 4 } }) + "\n");
    if (mode.reroute === "after") process.stdout.write(JSON.stringify(reroute) + "\n");
    if (mode.warning === "after") process.stdout.write(JSON.stringify(warning) + "\n");
    if (mode.fatalAfterWarning) process.stdout.write(JSON.stringify({ type: "turn.failed", error: { message: "FIXTURE_FATAL_SECRET" } }) + "\n");
  });
}
`;

async function setup(t: any, mode: Record<string, unknown> = {}) {
    const root = await mkdtemp(join(tmpdir(), "chatgpt-transport-test-"));
    const bin = join(root, "bin"),
        home = join(root, "codex-home"),
        agentDir = join(root, "agent");
    await Promise.all([mkdir(bin), mkdir(home), mkdir(agentDir)]);
    const codex = join(bin, "codex");
    await writeFile(codex, fixture, { mode: 0o700 });
    await chmod(codex, 0o700);
    await writeFile(join(home, "auth.json"), JSON.stringify(codexAccount));
    await writeFile(join(agentDir, "auth.json"), JSON.stringify(account));
    await writeFile(join(home, "fixture-mode.json"), JSON.stringify(mode));
    const old = {
        PATH: process.env.PATH,
        CODEX_HOME: process.env.CODEX_HOME,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        NODE_OPTIONS: process.env.NODE_OPTIONS,
        LD_PRELOAD: process.env.LD_PRELOAD,
    };
    process.env.PATH = `${bin}:${old.PATH ?? "/usr/bin:/bin"}`;
    process.env.CODEX_HOME = home;
    process.env.OPENAI_API_KEY = "fixture-secret-must-not-leak";
    process.env.NODE_OPTIONS = "--require=/must/not/load";
    process.env.LD_PRELOAD = "/must/not/load.so";
    t.after(async () => {
        for (const [key, value] of Object.entries(old)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await rm(root, { recursive: true, force: true });
    });
    const audit = async () => {
        try {
            return (await readFile(join(home, "fixture-audit.jsonl"), "utf8"))
                .trim()
                .split("\n")
                .filter(Boolean)
                .map((line) => JSON.parse(line));
        } catch {
            return [];
        }
    };
    const setMode = async (next: Record<string, unknown>) =>
        writeFile(join(home, "fixture-mode.json"), JSON.stringify(next));
    return { root, bin, home, agentDir, audit, setMode };
}

const options = (
    agentDir: string,
    signal: AbortSignal,
    counters: { generating: number; threads: string[] },
) => ({
    agentDir,
    model: "gpt-6.1-sol",
    prompt: "imagem de teste offline",
    signal,
    onGenerating: async () => {
        counters.generating++;
    },
    onThread: async (id: string) => {
        counters.threads.push(id);
    },
});

const requiredConfig = [
    'otel.metrics_exporter="none"',
    'otel.exporter="none"',
    'otel.trace_exporter="none"',
    "analytics.enabled=false",
    "feedback.enabled=false",
    "check_for_update_on_startup=false",
    'cli_auth_credentials_store="file"',
    "project_doc_max_bytes=0",
    "skills.bundled.enabled=false",
    'approval_policy="never"',
    'developer_instructions=""',
    "skills.include_instructions=false",
    "otel.log_user_prompt=false",
    "otel.log_agent_responses=false",
    "otel.log_guardian_assessments=false",
    'web_search="disabled"',
    'model_provider="openai"',
    'openai_base_url="https://chatgpt.com/backend-api/codex"',
    'chatgpt_base_url="https://chatgpt.com/backend-api"',
];
function assertIsolationArgv(argv: string[], mode: string) {
    assert.ok(argv.includes("--strict-config"), `${mode}: --strict-config`);
    const configs = argv.flatMap((arg, i) => (argv[i - 1] === "-c" ? [arg] : []));
    for (const value of requiredConfig) assert.ok(configs.includes(value), `${mode}: -c ${value}`);
    const disabled = argv.flatMap((arg, i) => (argv[i - 1] === "--disable" ? [arg] : []));
    assert.ok(disabled.length >= 10, `${mode}: capabilities desativadas`);
    for (const name of [
        "hooks",
        "apps",
        "plugins",
        "shell_tool",
        "unified_exec",
        "memories",
        "step_model_switching",
        "daemon_auto_start",
    ])
        assert.ok(disabled.includes(name), `${mode}: --disable ${name}`);
    assert.ok(
        !argv.some((arg) => /config\.toml|--profile|--config-file/.test(arg)),
        `${mode}: não troca a configuração em disco`,
    );
    if (mode === "exec") assert.ok(argv.includes("--ignore-user-config"));
}

for (const timing of ["before", "after"]) {
    test(`aviso/deprecação do CLI em item error (${timing}) não é falha nem mudança de modelo`, async (t) => {
        const env = await setup(t, { warning: timing });
        const counters = { generating: 0, threads: [] as string[] };
        const result = await runCodexImage(
            options(env.agentDir, new AbortController().signal, counters),
        );
        assert.equal(result.width, 1);
        assert.equal(result.height, 1);
        assert.equal(counters.generating, 1);
        assert.deepEqual(counters.threads, [threadId]);
        assert.doesNotMatch(JSON.stringify(result), /FIXTURE_WARNING_SECRET/);
        assert.equal((await env.audit()).filter((record) => record.mode === "exec").length, 1);
    });
}

test("aviso não esconde turn.failed nem transforma PNG já escrito em sucesso", async (t) => {
    const env = await setup(t, { warning: "before", fatalAfterWarning: true });
    const counters = { generating: 0, threads: [] as string[] };
    await assert.rejects(
        runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
        (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Falha|interromp|Codex/i);
            assert.doesNotMatch(error.message, /FIXTURE_WARNING_SECRET|FIXTURE_FATAL_SECRET/);
            return true;
        },
    );
    assert.equal(counters.generating, 1);
    assert.equal((await env.audit()).filter((record) => record.mode === "exec").length, 1);
});

test("executionArgs mantém o isolamento estrito e o mesmo conjunto -c/--disable do app-server", () => {
    assertIsolationArgv(executionArgs("gpt-6.1-sol"), "exec");
});

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 4000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail("timeout aguardando o evento da fixture");
}

test("transporte offline faz preflight isolado, redescobre MCP desabilitado e executa imagem", async (t) => {
    const env = await setup(t);
    const counters = { generating: 0, threads: [] as string[] };
    const result = await runCodexImage(
        options(env.agentDir, new AbortController().signal, counters),
    );
    assert.equal(result.width, 1);
    assert.equal(result.height, 1);
    assert.deepEqual(result.usage, { input_tokens: 12, cached_input_tokens: 3, output_tokens: 4 });
    assert.deepEqual(counters, { generating: 1, threads: [threadId] });
    assert.equal(result.path, join(env.home, "generated_images", threadId, "image.png"));
    const records = await env.audit();
    const starts = records.filter((record) => record.kind === "start");
    assert.equal(starts.filter((record) => record.mode === "app-server").length, 2);
    assert.equal(starts.filter((record) => record.mode === "exec").length, 1);
    assert.equal(
        starts
            .find((record) => record.mode === "app-server" && record.disabledFake)
            ?.argv.includes("mcp_servers.fake.enabled=false"),
        true,
    );
    assert.ok(
        starts.every((record) => record.leaked.length === 0),
        "nenhuma chave/configuração de processo deve chegar ao fixture",
    );
    for (const start of starts) {
        assertIsolationArgv(start.argv, start.mode);
        assert.equal(start.remoteControlDisabled, "1", `${start.mode}: controle remoto desativado`);
    }
    assert.deepEqual(
        (await readdir(env.home)).sort(),
        ["auth.json", "fixture-audit.jsonl", "fixture-mode.json", "generated_images"],
        "nenhuma configuração do Codex pode ser escrita em disco",
    );
    assert.deepEqual(await readdir(env.agentDir), ["auth.json"]);
    assert.deepEqual(JSON.parse(await readFile(join(env.home, "auth.json"), "utf8")), codexAccount);
    const methods = records
        .filter((record) => record.kind === "rpc")
        .map((record) => record.method);
    assert.deepEqual(methods, [
        "initialize",
        "initialized",
        "config/read",
        "initialize",
        "initialized",
        "config/read",
        "account/read",
        "account/rateLimits/read",
    ]);
    assert.ok(
        !methods.some((method) => /thread|turn\/start|model\/invoke/.test(method)),
        "preflight não deve abrir thread nem submeter geração",
    );
});

test("cota esgotada bloqueia antes de onGenerating e antes do processo exec", async (t) => {
    const env = await setup(t, { badQuota: true });
    const counters = { generating: 0, threads: [] as string[] };
    await assert.rejects(
        runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
        /Cota.*Codex.*(esgotada|insuficiente)/i,
    );
    assert.equal(counters.generating, 0);
    assert.deepEqual(counters.threads, []);
    assert.equal((await env.audit()).filter((record) => record.mode === "exec").length, 0);
});

test("erro do fixture é sanitizado pelo transporte", async (t) => {
    const env = await setup(t, { execError: true });
    const counters = { generating: 0, threads: [] as string[] };
    await assert.rejects(
        runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
        (error) => {
            assert.ok(error instanceof Error);
            assert.ok(!error.message.includes("FIXTURE_SECRET_PROVIDER_ERROR"));
            return true;
        },
    );
    assert.equal(counters.generating, 1);
    assert.equal(counters.threads.length, 0);
});

test("cancelamento aborta o subprocesso fixture", async (t) => {
    const env = await setup(t, { execWait: true });
    const counters = { generating: 0, threads: [] as string[] };
    const controller = new AbortController();
    const pending = runCodexImage(options(env.agentDir, controller.signal, counters));
    let pid = 0;
    await waitFor(async () => {
        const records = await env.audit();
        const waiting = records.find((record) => record.kind === "exec-wait");
        if (!waiting) return false;
        pid = waiting.pid;
        return true;
    });
    controller.abort();
    await assert.rejects(pending, /cancelad|interrompid|Codex/i);
    assert.ok(counters.generating > 0);
    await waitFor(async () => {
        try {
            process.kill(pid, 0);
            return false;
        } catch (error: any) {
            return error.code === "ESRCH";
        }
    });
});

const hostile: [string, unknown[][]][] = [
    ["analytics ativo", [["analytics.enabled", true]]],
    ["feedback ativo", [["feedback.enabled", true]]],
    ["OTLP logs ativo", [["otel.exporter", "otlp-http"]]],
    ["OTLP trace ativo", [["otel.trace_exporter", "otlp-grpc"]]],
    ["OTLP metrics ativo", [["otel.metrics_exporter", "otlp-http"]]],
    ["exporter desconhecido", [["otel.metrics_exporter", "novo-exporter-0.169"]]],
    ["exporter em formato de objeto", [["otel.exporter", { "otlp-http": { endpoint: "x" } }]]],
    ["log de prompt ativo", [["otel.log_user_prompt", true]]],
    ["feature perigosa ativa", [["features.memories", true]]],
    ["feature perigosa ausente", [["features.shell_tool"]]],
    ["credential store diferente", [["cli_auth_credentials_store", "keyring"]]],
    ["update check ativo", [["check_for_update_on_startup", true]]],
    ["docs de projeto ativos", [["project_doc_max_bytes", 32768]]],
    ["skills automáticas ativas", [["skills.bundled.enabled", true]]],
    ["privacidade ausente", [["analytics"], ["otel"]]],
    ["developer_instructions pessoais", [["developer_instructions", "personal"]]],
    ["instruções de skills ativas", [["skills.include_instructions", true]]],
    ["skills.bundled ausente", [["skills"]]],
    ["approval_policy diferente", [["approval_policy", "on-request"]]],
    ["log de respostas do agente ativo", [["otel.log_agent_responses", true]]],
    ["log guardian ativo", [["otel.log_guardian_assessments", true]]],
    ["web_search ativo", [["web_search", "live"]]],
    ["web_search ausente", [["web_search"]]],
    ["provider não oficial", [["model_provider", "custom"]]],
    ["openai_base_url não oficial", [["openai_base_url", "https://example.invalid/v1"]]],
    [
        "chatgpt_base_url não oficial",
        [["chatgpt_base_url", "https://chatgpt.com.evil.test/backend-api"]],
    ],
    ["chatgpt_base_url ausente", [["chatgpt_base_url"]]],
    ["step_model_switching ativo", [["features.step_model_switching", true]]],
    ["daemon_auto_start ativo", [["features.daemon_auto_start", true]]],
    ["MCP continua ativo no 2º start", [["mcp_servers.fake.enabled", true]]],
];
for (const [label, overrides] of hostile) {
    test(`configuração efetiva insegura (${label}) falha antes de account/read, cota e geração`, async (t) => {
        const env = await setup(t, { overrides });
        const counters = { generating: 0, threads: [] as string[] };
        await assert.rejects(
            runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
            /isolad|isolar|privacidade/i,
        );
        assert.deepEqual(counters, { generating: 0, threads: [] });
        const records = await env.audit();
        const starts = records.filter((record) => record.kind === "start");
        assert.ok(starts.length > 0 && starts.every((record) => record.mode === "app-server"));
        for (const start of starts) {
            assertIsolationArgv(start.argv, start.mode);
            assert.equal(
                start.remoteControlDisabled,
                "1",
                `${start.mode}: controle remoto desativado`,
            );
        }
        const methods = records.filter((record) => record.kind === "rpc").map((r) => r.method);
        assert.ok(methods.includes("config/read"));
        assert.ok(!methods.includes("account/read"), "account/read não pode ser chamado");
        assert.ok(!methods.includes("account/rateLimits/read"), "cota não pode ser consultada");
    });
}

test("MCP fake começa ativo e só é aceito depois de desabilitado explicitamente por argv", async (t) => {
    const env = await setup(t);
    await runCodexImage(
        options(env.agentDir, new AbortController().signal, { generating: 0, threads: [] }),
    );
    const apps = (await env.audit()).filter(
        (record) => record.kind === "start" && record.mode === "app-server",
    );
    assert.equal(apps[0].argv.includes("mcp_servers.fake.enabled=false"), false);
    assert.equal(apps[1].argv.includes("mcp_servers.fake.enabled=false"), true);
});

for (const order of ["before", "after"]) {
    test(`modelo redirecionado (item error ${order} de turn.completed) nunca é sucesso, sem retry`, async (t) => {
        const env = await setup(t, { reroute: order });
        const counters = { generating: 0, threads: [] as string[] };
        await assert.rejects(
            runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
            (error) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /mudança do modelo escolhido.*model-rerouted/);
                assert.equal((error as { code?: string }).code, "model-rerouted");
                assert.match(error.message, /não repita automaticamente/);
                assert.ok(!error.message.includes("FIXTURE_REROUTE_SECRET"));
                assert.ok(!/model rerouted/i.test(error.message));
                return true;
            },
        );
        assert.equal(counters.generating, 1);
        assert.deepEqual(counters.threads, [threadId]);
        const records = await env.audit();
        const execs = records.filter((record) => record.kind === "start" && record.mode === "exec");
        assert.equal(execs.length, 1, "nenhum retry nem novo exec");
        assert.equal(
            records.filter((record) => record.kind === "start" && record.mode === "app-server")
                .length,
            2,
        );
        assertIsolationArgv(execs[0].argv, "exec");
        assert.equal(execs[0].remoteControlDisabled, "1");
        assert.ok(execs[0].argv.includes("--model") && execs[0].argv.includes("gpt-6.1-sol"));
    });
}

test("falha com débito de imagem incerto não reexecuta: segunda chamada é decisão do chamador", async (t) => {
    const env = await setup(t, { reroute: "before" });
    const counters = { generating: 0, threads: [] as string[] };
    await assert.rejects(
        runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
        /não repita automaticamente/,
    );
    const execs = () =>
        env.audit().then((r) => r.filter((x) => x.kind === "start" && x.mode === "exec").length);
    assert.equal(await execs(), 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await execs(), 1, "o transporte não repete por conta própria");
    assert.equal(counters.generating, 1);
});

const badVersions: [string, Record<string, unknown>][] = [
    ["versão posterior", { codexVersion: "codex-cli 0.170.0" }],
    ["versão anterior", { codexVersion: "codex-cli 0.168.9" }],
    ["saída com texto extra", { codexVersion: "codex-cli 0.169.0 (custom launcher)" }],
    ["launcher desconhecido", { codexVersion: "wrapper 0.169.0" }],
    ["saída vazia", { codexVersion: "" }],
    ["versão não verificável (--version falha)", { versionError: true }],
];
for (const [label, mode] of badVersions) {
    test(`Codex ${label} é rejeitado antes de auth, RPC, geração e exec`, async (t) => {
        const env = await setup(t, mode);
        const counters = { generating: 0, threads: [] as string[] };
        await assert.rejects(
            runCodexImage(options(env.agentDir, new AbortController().signal, counters)),
            (error) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /0\.169\.0/);
                assert.ok(!error.message.includes("FIXTURE_VERSION_SECRET"));
                return true;
            },
        );
        assert.deepEqual(counters, { generating: 0, threads: [] });
        const records = await env.audit();
        assert.ok(records.length >= 1 && records.every((record) => record.kind === "version"));
        assert.deepEqual(records[0].argv, ["--version"]);
        assert.equal(records[0].remoteControlDisabled, "1");
        assert.ok(!records.some((record) => record.kind === "start" || record.kind === "rpc"));
    });
}

test("versão exata é verificada uma vez, com ambiente sanitizado, antes de qualquer app-server", async (t) => {
    const env = await setup(t);
    await runCodexImage(
        options(env.agentDir, new AbortController().signal, { generating: 0, threads: [] }),
    );
    const records = await env.audit();
    const versions = records.filter((record) => record.kind === "version");
    assert.equal(versions.length, 1);
    assert.equal(records[0].kind, "version", "versão antes de qualquer start/RPC");
    assert.equal(versions[0].remoteControlDisabled, "1");
});
