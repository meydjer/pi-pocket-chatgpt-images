// Import first: the real Pi Pocket harness isolates its agent and data folders.
import {
    cleanUp,
    context,
    lastText,
    loadTools,
    modelTexts,
    newSession,
    openApp,
    owner,
    root,
    say,
    scriptedModel,
    until,
} from "./.cache/pi-pocket/test/helpers.ts";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { ImageControl } from "./chatgpt-images.ts";
import { shareDraft } from "./.cache/pi-pocket/src/server/gallery/share.ts";

after(cleanUp);
const model = () =>
    scriptedModel((transcript) => {
        const { role, text } = lastText(transcript as never);
        if (role === "toolResult") return fauxAssistantMessage([fauxText(`result: ${text}`)]);
        return fauxAssistantMessage(
            [fauxToolCall("chatgpt_image", { prompt: "Um círculo azul sobre fundo branco" })],
            { stopReason: "toolUse" },
        );
    });
const fakeHostSource = `
  const fakeHost = new Proxy(host, { get(target, key) {
    if (key === "ask") return async () => { throw new Error("Per-image confirmation must not run"); };
    if (key === "modelProblem") return async () => undefined;
    if (key === "subagentModels") return () => [];
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  }});
`;

function setupDropIn(name: string, wrapper?: string): string {
    const data = join(root, name),
        dropIns = join(data, "extensions");
    mkdirSync(dropIns, { recursive: true });
    if (wrapper) {
        copyFileSync(
            join(import.meta.dirname, "chatgpt-images.ts"),
            join(dropIns, "_images-implementation.ts"),
        );
        writeFileSync(join(dropIns, "chatgpt-images.ts"), wrapper);
    } else
        copyFileSync(
            join(import.meta.dirname, "chatgpt-images.ts"),
            join(dropIns, "chatgpt-images.ts"),
        );
    return data;
}

test("real drop-in loads disabled, registers its tool/settings and unloads without real data", async () => {
    const data = setupDropIn("drop-in-load");
    const app = await openApp(scriptedModel(), data);
    try {
        let module = (await app.extensions(owner(app))).modules.find(
            (m) => m.file === "chatgpt-images.ts",
        )!;
        assert.equal(module.enabled, false);
        await app.setExtensionEnabled(owner(app), "chatgpt-images.ts", true);
        module = (await app.extensions(owner(app))).modules.find(
            (m) => m.file === "chatgpt-images.ts",
        )!;
        assert.equal(module.enabled, true);
        assert.equal(module.error, undefined);
        const draft = await shareDraft({
            root: join(data, "extensions"),
            module,
            owner: "Offline test owner",
            repoUrl: "https://github.com/TannerMidd/pi-pocket-extensions",
            packages: new Set([
                "@earendil-works/pi-ai",
                "@earendil-works/pi-durable",
                "@earendil-works/pi-schema",
                "@earendil-works/chord",
            ]),
            version: "0.28.2",
        });
        assert.deepEqual(draft.problems, []);
        assert.equal(draft.declaresKnown, true);
        assert.deepEqual(
            draft.entry.files.map((file) => file.name),
            ["chatgpt-images.ts"],
        );
        assert.ok(draft.entry.description.length <= 600);
        assert.ok(
            draft.entry.description.endsWith("Full permissions below."),
            "description must not be truncated by Share",
        );
        assert.equal(draft.entry.pocketApi, 2);
        assert.deepEqual(draft.entry.declares, {
            extensions: ["chatgpt-images"],
            tools: ["chatgpt_image"],
            readOnlyTools: [],
            hooks: [],
            sections: [],
            wraps: [],
            routes: [],
            client: null,
            access: "owner",
            commands: ["global chatgpt-images"],
        });
        const id = await newSession(app);
        await loadTools(app, id, "chatgpt_image");
        await app.setExtensionEnabled(owner(app), "chatgpt-images.ts", false);
        assert.equal(
            (await app.extensions(owner(app))).modules.find((m) => m.file === "chatgpt-images.ts")
                ?.enabled,
            false,
        );
    } finally {
        await app.close();
    }
});

test("12 images run without confirmation or daily cap; stats and uncertain jobs survive restart", async () => {
    // Fake account/model/runner only. No Codex process, credentials or network.
    const data = setupDropIn(
        "drop-in-behavior",
        `
import { createChatGPTImages } from "./_images-implementation.ts";
export const pocketApi = 2;
export default function(host, web) {
${fakeHostSource}
  return createChatGPTImages(fakeHost, web, async options => {
    if (options.model !== "gpt-fake-explicit") throw new Error("unexpected model");
    await options.onGenerating();
    await options.onThread("11111111-1111-4111-8111-111111111111");
    return { path: "/offline/test-circle.png", width: 32, height: 32 };
  });
}
`,
    );
    let app = await openApp(model(), data);
    let id: Awaited<ReturnType<typeof newSession>>;
    try {
        await app.setExtensionEnabled(owner(app), "chatgpt-images.ts", true);
        id = await newSession(app);
        await loadTools(app, id, "chatgpt_image");
        // Isolated default is empty: generation fails before any reservation or attempt.
        const shown = app.extensionSettings(owner(app), "chatgpt-images");
        assert.equal(shown.values.codexModel, "");
        assert.deepEqual(shown.set, []);
        await say(app, id, "Imagem sem modelo configurado");
        assert.match((await modelTexts(app, id)).join("\n"), /Extensions/);
        const before = await app.harness.snapshot(ImageControl, context);
        assert.equal(before?.attempts ?? 0, 0);
        assert.equal(before?.active ?? null, null);
        // Explicit fake choice through the harness API, once; later requests use it.
        app.setExtensionSettings(owner(app), "chatgpt-images", {
            codexModel: "  gpt-fake-explicit  ",
        });
        // Pocket preserves text settings; the runtime trims the model only when it uses it.
        assert.equal(
            app.extensionSettings(owner(app), "chatgpt-images").values.codexModel,
            "  gpt-fake-explicit  ",
        );
        for (let i = 0; i < 12; i++) await say(app, id, `Imagem simulada ${i + 1}`);
        assert.match((await modelTexts(app, id)).join("\n"), /test-circle\.png/);
        const state = await app.harness.snapshot(ImageControl, context);
        assert.equal(state?.attempts, 12);
        assert.equal(state?.active, null);
        assert.equal(state?.last?.stage, "done");
        assert.equal(state?.last?.threadId, "11111111-1111-4111-8111-111111111111");
    } finally {
        await app.close();
    }
    app = await openApp(model(), data);
    try {
        const state = await app.harness.snapshot(ImageControl, context);
        assert.equal(state?.attempts, 12);
        assert.equal(state?.last?.path, "/offline/test-circle.png");
        assert.equal(state?.active, null);
        await app.harness.commit(async (tx) => {
            (await tx.doc(ImageControl)).active = {
                id: "22222222-2222-4222-8222-222222222222",
                conversationId: id!,
                stage: "uncertain",
                startedAt: 1,
                deadline: 2,
            };
        }, context);
    } finally {
        await app.close();
    }
    app = await openApp(model(), data);
    try {
        assert.equal(
            (await app.harness.snapshot(ImageControl, context))?.active?.stage,
            "uncertain",
        );
        const next = await newSession(app);
        await loadTools(app, next, "chatgpt_image");
        await say(app, next, "Não repita a tentativa interrompida");
        assert.match((await modelTexts(app, next)).join("\n"), /tentativa pendente/);
        assert.equal((await app.harness.snapshot(ImageControl, context))?.attempts, 12);
    } finally {
        await app.close();
    }
});

test("two real sessions queue automatically and complete without a concurrent-generation error", async () => {
    const key = "chatgpt-images-test-unblock",
        queuedKey = `${key}-queued`;
    const data = setupDropIn(
        "drop-in-concurrent",
        `
import { createChatGPTImages } from "./_images-implementation.ts";
export const pocketApi = 2;
export default function(host, web) {
${fakeHostSource}
  let calls = 0;
  const extension = createChatGPTImages(fakeHost, web, async options => {
    await options.onGenerating();
    if (++calls === 1) await new Promise(resolve => { globalThis[Symbol.for(${JSON.stringify(key)})] = resolve; });
    return { path: "/offline/concurrent.png", width: 1, height: 1 };
  });
  return { ...extension, tools: extension.tools.map(tool => ({ ...tool,
    execute(args, api, context) {
      const watchedApi = new Proxy(api, { get(target, property) {
        if (property === "watchDoc") return async (...parameters) => {
          const watch = await target.watchDoc(...parameters);
          globalThis[Symbol.for(${JSON.stringify(queuedKey)})] = true;
          return watch;
        };
        const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
      }});
      return tool.execute(args, watchedApi, context);
    }
  })) };
}
`,
    );
    const app = await openApp(model(), data);
    const global = globalThis as unknown as Record<symbol, unknown>;
    let firstRun: Promise<void> | undefined, secondRun: Promise<void> | undefined;
    try {
        await app.setExtensionEnabled(owner(app), "chatgpt-images.ts", true);
        app.setExtensionSettings(owner(app), "chatgpt-images", { codexModel: "gpt-fake-queue" });
        const first = await newSession(app),
            second = await newSession(app);
        await loadTools(app, first, "chatgpt_image");
        await loadTools(app, second, "chatgpt_image");
        firstRun = say(app, first, "Primeira imagem simulada");
        await until(() => typeof global[Symbol.for(key)] === "function", "first runner waiting");
        secondRun = say(app, second, "Segunda imagem simulada");
        await until(
            () => global[Symbol.for(queuedKey)] === true,
            "second request watching the durable queue",
        );
        assert.equal((await app.harness.snapshot(ImageControl, context))?.attempts, 1);
        (global[Symbol.for(key)] as () => void)();
        await Promise.all([firstRun, secondRun]);
        const state = await app.harness.snapshot(ImageControl, context);
        assert.equal(state?.attempts, 2);
        assert.equal(state?.active, null);
        assert.match((await modelTexts(app, second)).join("\n"), /concurrent\.png/);
        assert.doesNotMatch((await modelTexts(app, second)).join("\n"), /resultado incerto/);
    } finally {
        (global[Symbol.for(key)] as (() => void) | undefined)?.();
        await app.close();
        await Promise.allSettled([firstRun, secondRun].filter(Boolean));
        delete global[Symbol.for(key)];
        delete global[Symbol.for(queuedKey)];
    }
});
