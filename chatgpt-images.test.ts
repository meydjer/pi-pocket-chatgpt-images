import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import {
    sameAccount,
    safeEnvironment,
    executionArgs,
    checkQuota,
    imageAtThread,
    createChatGPTImages,
    ImageControl,
    ImageError,
} from "./chatgpt-images.ts";

const thread = "11111111-1111-4111-8111-111111111111";
const accountPi = { "openai-codex": { type: "oauth", accountId: "acct-1" } };
const accountCodex = { auth_mode: "chatgpt", tokens: { account_id: "acct-1" } };
const goodQuota = {
    rateLimitsByLimitId: {
        codex: {
            limitId: "codex",
            credits: { hasCredits: false, unlimited: false },
            primary: { usedPercent: 20 },
            secondary: { usedPercent: 40 },
        },
    },
};
function crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
    const name = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
}
const png = () => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(1, 4);
    ihdr[8] = 8;
    ihdr[9] = 6; // 8-bit RGBA, 1 × 1.
    const signature = Buffer.from("89504e470d0a1a0a", "hex");
    return Buffer.concat([
        signature,
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
};
const pngHeaderOnly = () => {
    const b = Buffer.alloc(33);
    Buffer.from("89504e470d0a1a0a", "hex").copy(b);
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(1, 16);
    b.writeUInt32BE(1, 20);
    return b;
};

function harness(
    options: {
        runner?: any;
        owner?: boolean;
        held?: boolean;
        legacyDailyLimit?: number;
        codexModel?: unknown; // present (even undefined/null) = explicit fake owner choice
    } = {},
) {
    let state = { day: "", attempts: 0, active: null as any, last: null as any };
    const listeners = new Set<(event: any) => void>();
    let watchStarts = 0;
    const publish = () => {
        for (const listener of listeners) listener({ kind: "value", value: state });
    };
    const commands = new Map<string, any>();
    let outputCalls = 0;
    const settings = new Map<string, unknown>();
    // Fixtures simulate an explicit owner choice; nothing depends on a personal default.
    if ("codexModel" in options) settings.set("codexModel", options.codexModel);
    else settings.set("codexModel", "gpt-6.1-sol");
    let declared: any[] = [];
    let preflightCalls = 0;
    if (options.legacyDailyLimit !== undefined)
        settings.set("dailyLimit", options.legacyDailyLimit);
    const web: any = {
        onDispose(fn: () => void) {
            this.dispose = fn;
        },
        settings(list: any[]) {
            declared = list;
        },
        setting(key: string) {
            return settings.get(key);
        },
        command(name: string, definition: any) {
            commands.set(name, definition);
        },
        error(status: number, message: string) {
            return Object.assign(new Error(message), { status });
        },
    };
    let isOwner = options.owner !== false;
    let isHeld = options.held === true;
    let isModelAvailable = true;
    const host: any = {
        agentDir: "/offline/agent",
        requesterOf: () => (isOwner ? "owner" : "member"),
        roleOf: () => (isOwner ? "owner" : "member"),
        heldBack: () => (isHeld ? "blocked" : undefined),
        subagentModels: () => {
            preflightCalls++;
            const chosen =
                typeof settings.get("codexModel") === "string"
                    ? (settings.get("codexModel") as string).trim()
                    : "gpt-6.1-sol";
            return [isModelAvailable ? `openai-codex/${chosen}` : "openai-codex/other-model"];
        },
        modelProblem: async () => {
            preflightCalls++;
            return isModelAvailable ? undefined : "modelo revogado";
        },
        ask: async () => {
            throw new Error("host.ask não pode ser chamado para imagens");
        },
    };
    const doc = () => state;
    const api: any = {
        conversationId: 17,
        taskId: "task",
        callId: "call",
        models: { getModel: () => undefined },
        async output() {
            outputCalls++;
        },
        memoStore: new Map<string, unknown>(),
        async memo(key: string, value?: unknown, _context?: unknown) {
            if (arguments.length > 2) this.memoStore.set(key, value);
            return this.memoStore.get(key);
        },
        async commit(fn: (tx: any) => unknown) {
            const result = await fn({ doc });
            publish();
            return result;
        },
        watchDoc(_definition: any, _context: any) {
            let stopped = false;
            let resolveClosed!: () => void;
            const closed = new Promise<void>((resolve) => {
                resolveClosed = resolve;
            });
            let callback: ((event: any) => void) | undefined;
            return {
                get value() {
                    return state;
                },
                closed,
                start(next: (event: any) => void) {
                    watchStarts++;
                    callback = next;
                    listeners.add(next);
                },
                stop() {
                    if (!stopped) {
                        stopped = true;
                        if (callback) listeners.delete(callback);
                        resolveClosed();
                    }
                },
            };
        },
    };
    const ctx: any = {
        user: { role: "owner" },
        context: {},
        abortSignal: undefined,
        async commit(fn: (tx: any) => unknown) {
            const result = await fn({ doc });
            publish();
            return result;
        },
        async snapshot() {
            return state;
        },
    };
    const extension: any = createChatGPTImages(
        host,
        web,
        options.runner ??
            (async () => {
                throw new Error("runner should not run");
            }),
    );
    const tool = extension.tools.find((t: any) => t.name === "chatgpt_image");
    assert.ok(tool, "tool chatgpt_image deve ser registrado");
    return {
        state: () => state,
        setState: (v: any) => {
            state = v;
            publish();
        },
        setOwner: (value: boolean) => {
            isOwner = value;
        },
        setHeld: (value: boolean) => {
            isHeld = value;
        },
        setModelAvailable: (value: boolean) => {
            isModelAvailable = value;
        },
        watchStarts: () => watchStarts,
        outputCalls: () => outputCalls,
        declared: () => declared,
        preflightCalls: () => preflightCalls,
        web,
        host,
        api,
        ctx,
        tool,
        commands,
        settings,
    };
}

async function generate(h: ReturnType<typeof harness>, ctx = h.ctx, prompt = "paisagem") {
    return h.tool.execute({ prompt }, h.api, ctx);
}
async function waitUntil(predicate: () => boolean, label: string) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.fail(`timeout: ${label}`);
}

test("sameAccount só aceita a mesma conta OAuth/ChatGPT e rejeita modo API", () => {
    assert.equal(sameAccount(accountPi, accountCodex), true);
    assert.equal(
        sameAccount(accountPi, { ...accountCodex, tokens: { account_id: "outro" } }),
        false,
    );
    assert.equal(sameAccount(accountPi, { ...accountCodex, auth_mode: "api" }), false);
    assert.equal(
        sameAccount(
            { "openai-codex": { ...accountPi["openai-codex"], type: "api" } },
            accountCodex,
        ),
        false,
    );
    assert.equal(sameAccount(accountPi, {}), false);
});

test("safeEnvironment remove segredos e fixa CODEX_HOME e controle remoto desativado", () => {
    const env: NodeJS.ProcessEnv = safeEnvironment(
        {
            HOME: "/h",
            PATH: "/bin",
            OPENAI_API_KEY: "secret",
            CODEX_HOME: "/old",
            NODE_OPTIONS: "evil",
            LD_PRELOAD: "evil",
        },
        "/codex",
    );
    for (const key of ["OPENAI_API_KEY", "NODE_OPTIONS", "LD_PRELOAD"])
        assert.equal(env[key], undefined);
    assert.deepEqual(env, {
        HOME: "/h",
        PATH: "/bin",
        CODEX_HOME: "/codex",
        CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED: "1",
    });
});

test("executionArgs isola sandbox/configuração e rejeita nomes de modelo inválidos", () => {
    const args = executionArgs("gpt-6.1-sol");
    assert.ok(args.includes("--sandbox") && args.includes("read-only"));
    assert.ok(args.includes("--ignore-user-config"));
    for (const flag of [
        "shell_tool",
        "unified_exec",
        "hooks",
        "apps",
        "plugins",
        "view_image",
        "multi_agent",
        "multi_agent_v2",
        "code_mode",
        "unbounded_connection_retries",
    ]) {
        assert.ok(
            args.some((v, i) => v === "--disable" && args[i + 1] === flag),
            `faltou --disable ${flag}`,
        );
    }
    assert.throws(() => executionArgs("; echo inseguro"), ImageError);
});

test("checkQuota aceita uso válido até 99.999% e recusa cota esgotada ou não incluída", () => {
    assert.doesNotThrow(() => checkQuota(goodQuota));
    for (const usedPercent of [90, 99, 99.999]) {
        assert.doesNotThrow(() =>
            checkQuota({
                ...goodQuota,
                rateLimitsByLimitId: {
                    codex: { ...goodQuota.rateLimitsByLimitId.codex, primary: { usedPercent } },
                },
            }),
        );
    }
    for (const usedPercent of [100, 100.001, NaN, -1, "20", undefined]) {
        assert.throws(
            () =>
                checkQuota({
                    ...goodQuota,
                    rateLimitsByLimitId: {
                        codex: {
                            ...goodQuota.rateLimitsByLimitId.codex,
                            primary: { usedPercent },
                            secondary: { usedPercent },
                        },
                    },
                }),
            ImageError,
            `usedPercent inválido deve ser rejeitado: ${String(usedPercent)}`,
        );
    }
    assert.throws(
        () =>
            checkQuota({
                rateLimits: {
                    limitId: "codex",
                    credits: { hasCredits: true, unlimited: false },
                    primary: { usedPercent: 1 },
                },
            }),
        ImageError,
    );
    assert.throws(
        () =>
            checkQuota({
                rateLimits: {
                    limitId: "codex",
                    credits: { hasCredits: false, unlimited: true },
                    primary: { usedPercent: 1 },
                },
            }),
        ImageError,
    );
    assert.throws(
        () =>
            checkQuota({
                rateLimits: {
                    limitId: "codex",
                    rateLimitReachedType: "daily_limit",
                    credits: { hasCredits: false, unlimited: false },
                    primary: { usedPercent: 1 },
                },
            }),
        ImageError,
    );
    assert.throws(
        () =>
            checkQuota({
                rateLimits: { limitId: "codex", credits: { hasCredits: false, unlimited: false } },
            }),
        ImageError,
    );
    assert.throws(
        () =>
            checkQuota({
                rateLimits: {
                    limitId: "api",
                    credits: { hasCredits: false, unlimited: false },
                    primary: { usedPercent: 1 },
                },
            }),
        ImageError,
    );
});

test("imageAtThread rejeita IHDR duplicado, paleta ausente e chunks críticos ou IDAT inválidos", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "image-structure-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const dir = join(root, "generated_images", thread);
    await mkdir(dir, { recursive: true });
    const signature = Buffer.from("89504e470d0a1a0a", "hex");
    const header = png().subarray(16, 29);
    const ihdr = pngChunk("IHDR", header);
    const compressed = deflateSync(Buffer.from([0, 0, 0, 0, 0]));
    const idat = pngChunk("IDAT", compressed);
    const iend = pngChunk("IEND", Buffer.alloc(0));
    const indexed = Buffer.from(header);
    indexed[9] = 3;
    const indexedHeader = pngChunk("IHDR", indexed);
    const indexedData = pngChunk("IDAT", deflateSync(Buffer.from([0, 0])));
    const palette = pngChunk("PLTE", Buffer.from([0, 0, 255]));
    const invalid = [
        Buffer.concat([signature, ihdr, ihdr, idat, iend]),
        Buffer.concat([signature, indexedHeader, indexedData, iend]),
        Buffer.concat([signature, ihdr, pngChunk("ABCD", Buffer.alloc(0)), idat, iend]),
        Buffer.concat([
            signature,
            ihdr,
            pngChunk("IDAT", compressed.subarray(0, 2)),
            pngChunk("tEXt", Buffer.from("key\0value")),
            pngChunk("IDAT", compressed.subarray(2)),
            iend,
        ]),
        Buffer.concat([signature, indexedHeader, indexedData, palette, iend]),
        Buffer.concat([
            signature,
            indexedHeader,
            pngChunk("PLTE", Buffer.from([1, 2])),
            indexedData,
            iend,
        ]),
    ];
    for (const bytes of invalid) {
        await writeFile(join(dir, "image.png"), bytes);
        await assert.rejects(imageAtThread(root, thread), ImageError);
    }
    await writeFile(
        join(dir, "image.png"),
        Buffer.concat([signature, indexedHeader, palette, indexedData, iend]),
    );
    assert.equal((await imageAtThread(root, thread)).width, 1);
});

test("imageAtThread aceita PNG mínimo e rejeita thread/path, symlink e arquivos extras", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "image-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const generated = join(root, "generated_images");
    const dir = join(generated, thread);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "image.png"), png());
    assert.deepEqual(await imageAtThread(root, thread), {
        path: join(dir, "image.png"),
        width: 1,
        height: 1,
    });
    await assert.rejects(imageAtThread(root, "../escape"), ImageError);
    await writeFile(join(dir, "extra.txt"), "x");
    await assert.rejects(imageAtThread(root, thread), ImageError);
    await rm(join(dir, "extra.txt"));
    await writeFile(join(dir, "extra.png"), png());
    await assert.rejects(imageAtThread(root, thread), ImageError);
    await rm(join(dir, "extra.png"));
    await rm(join(dir, "image.png"));
    await writeFile(join(dir, "incomplete.png"), pngHeaderOnly());
    await assert.rejects(
        imageAtThread(root, thread),
        ImageError,
        "um cabeçalho IHDR sem chunks de imagem não é PNG válido",
    );
    await rm(join(dir, "incomplete.png"));
    const corrupt = png();
    corrupt[corrupt.length - 1] ^= 1;
    await writeFile(join(dir, "corrupt.png"), corrupt);
    await assert.rejects(
        imageAtThread(root, thread),
        ImageError,
        "CRC corrompido deve ser rejeitado",
    );
    await rm(join(dir, "corrupt.png"));
    await writeFile(join(dir, "truncated.png"), png().subarray(0, png().length - 5));
    await assert.rejects(
        imageAtThread(root, thread),
        ImageError,
        "PNG truncado deve ser rejeitado",
    );
    await rm(join(dir, "truncated.png"));
    await symlink("/etc/passwd", join(dir, "linked.png"));
    await assert.rejects(imageAtThread(root, thread), ImageError);
});

test("somente proprietário e heldBack; não há confirmação host.ask", async () => {
    let calls = 0;
    const runner = async ({ onGenerating }: any) => {
        calls++;
        await onGenerating();
        return { path: "/x.png", width: 1, height: 1 };
    };
    const member = harness({ runner, owner: false });
    await assert.rejects(generate(member), /proprietário/i);
    const held = harness({ runner, held: true });
    await assert.rejects(generate(held), /limite de gastos/i);
    const allowed = harness({ runner });
    await generate(allowed);
    assert.equal(calls, 1);
    assert.equal(allowed.state().attempts, 1);
    assert.equal(allowed.settings.has("dailyLimit"), false);
});

test("autorização é lida depois da verificação assíncrona, antes de admitir a geração", async () => {
    let late = false;
    let allowed = ["openai-codex/gpt-6.1-sol"];
    const h = harness({
        runner: async ({ onGenerating }: any) => {
            late = true;
            await onGenerating();
            throw new Error("Não pode admitir a geração com modelo revogado");
        },
    });
    h.host.subagentModels = () => allowed;
    h.host.modelProblem = async () => {
        if (late) allowed = ["openai-codex/gpt-6.1-terra"];
        return undefined;
    };
    await assert.rejects(generate(h), /modelos autorizados/);
    assert.equal(h.state().attempts, 0);
    assert.equal(h.state().active, null);
});

test("mais de 10 gerações novas funcionam sem confirmação ou limite diário", async () => {
    let calls = 0;
    const h = harness({
        legacyDailyLimit: 1,
        runner: async ({ onGenerating }: any) => {
            calls++;
            await onGenerating();
            return { path: "/x.png", width: 1, height: 1 };
        },
    });
    for (let i = 0; i < 12; i++) {
        h.api.callId = `call-${i}`;
        h.api.taskId = `task-${i}`;
        h.api.memoStore.clear();
        h.api.conversationId = 17 + i;
        await generate(h, h.ctx, i === 0 ? "x".repeat(5000) : "paisagem");
    }
    assert.equal(calls, 12);
    assert.equal(h.state().attempts, 12);
    assert.equal(
        h.settings.get("dailyLimit"),
        1,
        "a configuração legada deve ser ignorada sem bloquear o uso",
    );
});

test("reservas checking/generating entram em fila e executam após liberação", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
        finish = resolve;
    });
    let calls = 0;
    const h = harness({
        runner: async ({ onGenerating }: any) => {
            calls++;
            await onGenerating();
            if (calls === 1) await gate;
            return { path: `/image-${calls}.png`, width: 1, height: 1 };
        },
    });
    const first = generate(h);
    await waitUntil(() => h.state().active?.stage === "generating", "primeira geração");
    h.api.callId = "queued-call";
    h.api.taskId = "queued-task";
    h.api.conversationId = 18;
    h.api.memoStore.clear();
    const second = generate(h);
    await waitUntil(() => h.watchStarts() > 0, "início do watch da fila");
    finish();
    await Promise.all([first, second]);
    assert.equal(h.outputCalls(), 1, "a chamada em espera deve emitir apenas uma atualização");
    assert.equal(calls, 2);
    assert.equal(h.state().attempts, 2);
});

test("cancelamento na fila não inicia geração; owner e heldBack são revalidados ao sair dela", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
        finish = resolve;
    });
    let calls = 0;
    const h = harness({
        runner: async ({ onGenerating }: any) => {
            calls++;
            await onGenerating();
            if (calls === 1) await gate;
            return { path: "/queued.png", width: 1, height: 1 };
        },
    });
    const first = generate(h);
    await waitUntil(() => h.state().active?.stage === "generating", "geração inicial");
    h.api.callId = "cancelled-call";
    h.api.taskId = "cancelled-task";
    h.api.conversationId = 18;
    h.api.memoStore.clear();
    const controller = new AbortController();
    const canceled = generate(h, { ...h.ctx, abortSignal: controller.signal });
    await waitUntil(() => h.watchStarts() > 0, "watch da fila cancelável");
    controller.abort();
    await assert.rejects(canceled, /cancel|abort/i);
    assert.equal(h.outputCalls(), 1);
    finish();
    await first;
    assert.equal(calls, 1);

    for (const change of ["owner", "heldBack"] as const) {
        let release!: () => void;
        const hold = new Promise<void>((resolve) => {
            release = resolve;
        });
        let runs = 0;
        const queued = harness({
            runner: async ({ onGenerating }: any) => {
                runs++;
                await onGenerating();
                if (runs === 1) await hold;
                return { path: "/x.png", width: 1, height: 1 };
            },
        });
        const firstCall = generate(queued);
        await waitUntil(
            () => queued.state().active?.stage === "generating",
            "geração inicial owner/heldBack",
        );
        queued.api.callId = `${change}-call`;
        queued.api.taskId = `${change}-task`;
        queued.api.conversationId = 18;
        queued.api.memoStore.clear();
        const waiting = generate(queued);
        await waitUntil(() => queued.watchStarts() > 0, "watch da fila owner/heldBack");
        if (change === "owner") queued.setOwner(false);
        else queued.setHeld(true);
        release();
        await firstCall;
        await assert.rejects(waiting, change === "owner" ? /proprietário/i : /limite de gastos/i);
        assert.equal(runs, 1);
    }
});

test("memo impede segunda execução; mudança de proprietário após início aborta antes do runner", async () => {
    let calls = 0;
    const once = harness({
        runner: async ({ onGenerating }: any) => {
            calls++;
            await onGenerating();
            return { path: "/ok.png", width: 1, height: 1 };
        },
    });
    await generate(once);
    await assert.rejects(generate(once), /já foi iniciada/i);
    assert.equal(calls, 1);
    const changedOwnerRunner = async () => {
        calls++;
        return { path: "/never.png", width: 1, height: 1 };
    };
    const changing = harness({ runner: changedOwnerRunner });
    changing.setOwner(false);
    await assert.rejects(generate(changing), /proprietário/i);
    assert.equal(calls, 1);
    assert.equal(changing.state().active, null);
});

test("modelo revogado durante a execução é revalidado em onGenerating antes de contar uso", async () => {
    let calls = 0;
    const h: ReturnType<typeof harness> = harness({
        runner: async ({ onGenerating }: any) => {
            calls++;
            h.setModelAvailable(false);
            await onGenerating();
            return { path: "/não-gerada.png", width: 1, height: 1 };
        },
    });
    await assert.rejects(generate(h), /modelo|disponível|revogado/i);
    assert.equal(calls, 1);
    assert.equal(h.state().attempts, 0);
});

test("tokens do intermediário são registrados uma vez no ledger sem preço inventado para a imagem", async () => {
    const h = harness({
        runner: async ({ onGenerating }: any) => {
            await onGenerating();
            return {
                path: "/x.png",
                width: 1,
                height: 1,
                usage: { input_tokens: 12, cached_input_tokens: 3, output_tokens: 4 },
            };
        },
    });
    const usage = { models: {} as Record<string, any> };
    h.api.models.getModel = () => getBuiltinModel("openai-codex", "gpt-6.1-sol");
    h.api.commit = async (fn: any) =>
        fn({
            doc: async (token: any) =>
                token.definition.kind === ImageControl.definition.kind ? h.state() : usage,
        });
    await generate(h);
    const totals = usage.models["openai-codex/gpt-6.1-sol"];
    assert.equal(totals.input, 9);
    assert.equal(totals.cacheRead, 3);
    assert.equal(totals.output, 4);
    assert.equal(totals.totalTokens, 16);
    assert.ok(totals.cost.total > 0);
    await assert.rejects(generate(h), /já foi iniciada/);
    assert.equal(totals.totalTokens, 16);
});

test("falha pós-reserva fica incerta; falha antes da submissão libera reserva", async () => {
    const after = harness({
        runner: async ({ onGenerating }: any) => {
            await onGenerating();
            throw new ImageError("falha simulada");
        },
    });
    await assert.rejects(generate(after), /falha simulada/);
    assert.equal(after.state().attempts, 1);
    assert.equal(after.state().active.stage, "uncertain");
    const before = harness({
        runner: async () => {
            throw new ImageError("preflight recusado");
        },
    });
    await assert.rejects(generate(before), /preflight recusado/);
    assert.equal(before.state().active, null);
    assert.equal(before.state().last.stage, "not-submitted");
    assert.equal(before.state().attempts, 0);
});

test("cancelamento e dispose abortam o sinal do runner", async () => {
    let signal: AbortSignal | undefined;
    const canceled = harness({
        runner: async (opts: any) => {
            signal = opts.signal;
            await opts.onGenerating();
            return await new Promise((_resolve, reject) =>
                opts.signal.addEventListener("abort", () => reject(new ImageError("cancelada")), {
                    once: true,
                }),
            );
        },
    });
    const pending = generate(canceled);
    await new Promise((resolve) => setImmediate(resolve));
    canceled.web.dispose();
    assert.equal(signal?.aborted, true);
    await assert.rejects(pending, /cancelada/);
    assert.equal(canceled.state().active.stage, "uncertain");
    const withContext = harness({
        runner: async (opts: any) => {
            await opts.onGenerating();
            return new Promise((_resolve, reject) =>
                opts.signal.addEventListener(
                    "abort",
                    () => reject(new ImageError("contexto cancelado")),
                    { once: true },
                ),
            );
        },
    });
    const controller = new AbortController();
    const ctx = { ...withContext.ctx, abortSignal: controller.signal };
    const pendingContext = generate(withContext, ctx);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pendingContext, /contexto cancelado/);
});

test("day e attempts permanecem estatística, sem reinício que bloqueie o uso", async () => {
    const h = harness({
        runner: async ({ onGenerating }: any) => {
            await onGenerating();
            return { path: "/day.png", width: 1, height: 1 };
        },
    });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    h.setState({ ...h.state(), day: yesterday, attempts: 7 });
    await generate(h);
    assert.equal(h.state().day, new Date().toISOString().slice(0, 10));
    assert.equal(h.state().attempts, 1);
    assert.equal(h.settings.has("dailyLimit"), false);
});

test("clear rejeita id incorreto, prazo futuro e guest; reconhece expirado sem reenvio", async () => {
    let calls = 0;
    const h = harness({
        runner: async () => {
            calls++;
            throw new Error("não esperado");
        },
    });
    const id = "22222222-2222-4222-8222-222222222222";
    h.setState({
        ...h.state(),
        active: { id, conversationId: 17, startedAt: 1, stage: "uncertain", deadline: 1 },
    });
    const command = h.commands.get("chatgpt-images");
    h.setState({ ...h.state(), active: { ...h.state().active, deadline: Date.now() + 60_000 } });
    await assert.rejects(
        command.handler("clear 33333333-3333-4333-8333-333333333333", h.ctx),
        /identificação não corresponde/i,
    );
    await assert.rejects(command.handler(`clear ${id}`, h.ctx), /Aguarde o prazo/i);
    const guest = { ...h.ctx, user: { role: "guest" } };
    await assert.rejects(command.handler(`clear ${id}`, guest), /Somente o proprietário/i);
    h.setState({ ...h.state(), active: { ...h.state().active, deadline: 1 } });
    const response = await command.handler(`clear ${id}`, h.ctx);
    assert.match(response.message, /reconhecida/i);
    assert.equal(h.state().active, null);
    assert.equal(h.state().last.stage, "acknowledged");
    assert.equal(calls, 0);
});

const unconfigured: [string, unknown][] = [
    ["ausente", undefined],
    ["null", null],
    ["branco", "  \t "],
    ["vazio", ""],
    ["número", 42],
    ["objeto", { model: "gpt-6.1-sol" }],
    ["booleano", true],
];
for (const [label, value] of unconfigured) {
    test(`codexModel ${label} não escolhe modelo: falha antes de memo, reserva, runner e preflight`, async () => {
        let runs = 0;
        const h = harness({
            codexModel: value,
            runner: async () => {
                runs++;
                throw new Error("runner não deve rodar");
            },
        });
        if (label === "ausente") h.settings.delete("codexModel");
        let memoWrites = 0;
        const memo = h.api.memo.bind(h.api);
        h.api.memo = async (...a: unknown[]) => {
            memoWrites++;
            return memo(...a);
        };
        await assert.rejects(generate(h), /Extensions/);
        assert.equal(memoWrites, 0);
        assert.equal(h.api.memoStore.size, 0);
        assert.equal(runs, 0);
        assert.equal(h.preflightCalls(), 0);
        assert.equal(h.state().attempts, 0);
        assert.equal(h.state().active, null);
        assert.equal(h.watchStarts(), 0);
    });
}

test("setting codexModel declara default vazio e a falha orienta o proprietário", async () => {
    const h = harness({ codexModel: "" });
    const entry = h.declared().find((s: any) => s.name === "codexModel");
    assert.ok(entry);
    assert.equal(entry.default, "");
    await assert.rejects(
        generate(h),
        (e: any) => /Menu/.test(e.message) && /Extensions/.test(e.message),
    );
});

test("modelo explícito é trimado e usado exatamente, sem substituição por default", async () => {
    const seen: string[] = [];
    const h = harness({
        codexModel: "  gpt-explicito-9  ",
        runner: async (o: any) => {
            seen.push(o.model);
            await o.onGenerating();
            await o.onThread("11111111-1111-4111-8111-111111111111");
            return { path: "/offline/x.png", width: 1, height: 1 };
        },
    });
    await generate(h);
    assert.deepEqual(seen, ["gpt-explicito-9"]);
    h.settings.set("codexModel", "gpt-outro-3");
    h.api.memoStore.clear();
    await generate(h);
    assert.deepEqual(seen, ["gpt-explicito-9", "gpt-outro-3"]);
});

test("modelo explícito inválido continua recusado por executionArgs, sem runner", async () => {
    let runs = 0;
    const h = harness({
        codexModel: "../mal; rm -rf",
        runner: async () => {
            runs++;
            throw new Error("runner não deve rodar");
        },
    });
    await assert.rejects(generate(h));
    assert.equal(runs, 0);
    assert.equal(h.state().attempts, 0);
});

test("modelo explícito indisponível falha sem fallback para outro modelo", async () => {
    let runs = 0;
    const h = harness({
        codexModel: "gpt-6.1-sol",
        runner: async () => {
            runs++;
            throw new Error("runner não deve rodar");
        },
    });
    h.setModelAvailable(false);
    await assert.rejects(generate(h));
    assert.equal(runs, 0);
    assert.equal(h.state().attempts, 0);
    assert.equal(h.state().active, null);
});

test("/chatgpt-images status funciona sem configuração, informa modelo não configurado e não vaza valores", async () => {
    for (const value of [undefined, null, "   ", 12345, { k: "segredo-xyz" }]) {
        const h = harness({ codexModel: value });
        const result = await h.commands.get("chatgpt-images").handler("status", h.ctx);
        assert.match(result.output, /modelo não configurado/);
        assert.doesNotMatch(result.output, /segredo-xyz|12345/);
    }
    // A nonempty string is an explicit choice, not an absent setting. Status must not echo it.
    // Authorization and availability remain generation-time checks, tested separately above.
    const configured = harness({ codexModel: "segredo-xyz" });
    const result = await configured.commands
        .get("chatgpt-images")
        .handler("status", configured.ctx);
    assert.match(result.output, /modelo configurado explicitamente/);
    assert.doesNotMatch(result.output, /segredo-xyz/);
});
