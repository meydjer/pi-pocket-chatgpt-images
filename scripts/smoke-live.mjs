// Explicit developer smoke check, never called by validate or CI.
// This checks native transport, not Pocket's live usage ledger. Normal tool admission is tested separately.
import { copyFile, mkdir, open, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { executionArgs, ImageError, runCodexImage } from "../chatgpt-images.ts";

const argv = process.argv.slice(2);
const usage =
    "npm run smoke:live -- --allow-live --model MODEL --agent-dir DIR --codex-home DIR --codex-bin-dir DIR [--run-id NEW_ID]";
/** @type {Map<string, string>} */
const values = new Map();
let allow = false;
for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === "--allow-live") allow = true;
    else if (
        ["--model", "--agent-dir", "--codex-home", "--codex-bin-dir", "--run-id"].includes(
            name ?? "",
        ) &&
        argv[i + 1]
    ) {
        values.set(name, argv[++i]);
    } else throw new Error(usage);
}
if (
    !allow ||
    ["--model", "--agent-dir", "--codex-home", "--codex-bin-dir"].some((k) => !values.get(k))
) {
    throw new Error(
        "Live generation needs explicit owner approval, a model and credential locations. " + usage,
    );
}
/** @param {string} key */
function requiredValue(key) {
    const value = values.get(key);
    if (!value) throw new Error(usage);
    return value;
}
const model = requiredValue("--model").trim();
executionArgs(model);
const root = fileURLToPath(new URL("../", import.meta.url));
const runId = values.get("--run-id") ?? "";
if (runId && !/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(runId))
    throw new Error("Invalid fresh live-test ID.");
// A fresh ID is an explicit new owner-authorized test, not deletion/reuse of an uncertain journal.
const resultDir = join(root, ".cache", runId ? `live-smoke-${runId}` : "live-smoke");
await mkdir(resultDir, { recursive: true, mode: 0o700 });
const journal = join(resultDir, "attempt.json");
// Exclusive creation is the replay boundary. Never delete this file to retry an uncertain request.
const handle = await open(journal, "wx", 0o600);
/** @type {Record<string, unknown>} */
const record = {
    state: "preflight",
    model,
    startedAt: new Date().toISOString(),
    requestedImageModel: "GPT Image 2",
};
await handle.writeFile(JSON.stringify(record, null, 2) + "\n");
await handle.sync();
await handle.close();
async function persist() {
    await writeFile(journal, JSON.stringify(record, null, 2) + "\n", { mode: 0o600 });
}
const oldHome = process.env.CODEX_HOME,
    oldPath = process.env.PATH;
process.env.CODEX_HOME = resolve(requiredValue("--codex-home"));
process.env.PATH = [
    resolve(requiredValue("--codex-bin-dir")),
    dirname(process.execPath),
    oldPath ?? "",
].join(delimiter);
const controller = new AbortController();
const abort = () => controller.abort();
process.once("SIGINT", abort);
process.once("SIGTERM", abort);
let mayHaveSubmitted = false;
try {
    const result = await runCodexImage({
        model,
        agentDir: resolve(requiredValue("--agent-dir")),
        prompt: "Generate one minimal flat blue circle centered on a plain white background. No text, watermark, reference files or additional assets.",
        signal: controller.signal,
        onGenerating: async () => {
            record.state = "may-have-submitted";
            await persist();
            mayHaveSubmitted = true;
        },
        onThread: async (id) => {
            record.threadId = id;
            await persist();
        },
    });
    const image = join(resultDir, "smoke.png");
    await copyFile(result.path, image, constants.COPYFILE_EXCL);
    record.state = "done";
    record.width = result.width;
    record.height = result.height;
    record.usage = result.usage ?? null;
    record.completedAt = new Date().toISOString();
    await persist();
    console.log(
        JSON.stringify(
            {
                state: "done",
                image,
                width: result.width,
                height: result.height,
                requestedImageModel: "GPT Image 2",
                remoteImageModelId: "not reported",
                imagePrice: "not reported",
            },
            null,
            2,
        ),
    );
} catch (error) {
    record.state = mayHaveSubmitted ? "uncertain" : "refused-before-submit";
    record.failureCode = error instanceof ImageError ? (error.code ?? null) : null;
    await persist();
    console.error(
        error instanceof ImageError
            ? error.message
            : "Live smoke check interrupted. Inspect the private journal; never resubmit automatically.",
    );
    process.exitCode = 1;
} finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
    if (oldHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = oldHome;
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
}
// Assert the journal remains readable. It contains no credential values and is excluded from Git.
await readFile(journal, "utf8");
