import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readlink,
    rename,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pocketPin, setupPocket, verifyPocket } from "./scripts/pocket-source.mjs";

const execute = promisify(execFile);
async function git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execute(
        "git",
        [
            "-c",
            `core.hooksPath=${devNull}`,
            "-c",
            "core.fsmonitor=false",
            "-c",
            "commit.gpgsign=false",
            ...args,
        ],
        {
            cwd,
            encoding: "utf8",
            env: {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                GIT_CONFIG_NOSYSTEM: "1",
                GIT_CONFIG_GLOBAL: devNull,
                GIT_TERMINAL_PROMPT: "0",
            },
        },
    );
    return stdout.trim();
}

async function fixture(t: TestContext) {
    const root = await mkdtemp(join(tmpdir(), "chatgpt-tooling-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = join(root, "source"),
        base = join(root, "project");
    await Promise.all([
        mkdir(join(source, "types"), { recursive: true }),
        mkdir(join(source, "test"), { recursive: true }),
        mkdir(join(source, "src/server"), { recursive: true }),
        mkdir(join(base, "node_modules"), { recursive: true }),
    ]);
    await Promise.all([
        writeFile(
            join(source, "package.json"),
            JSON.stringify({ name: "pi-pocket", version: pocketPin.version }),
        ),
        writeFile(join(source, "types/pocket.d.ts"), "export interface Host {}\n"),
        writeFile(
            join(source, "test/helpers.ts"),
            "// Synthetic fixture. Never reads real credentials.\n",
        ),
        writeFile(
            join(source, "src/server/app.ts"),
            "// Synthetic fixture, not the real server.\n",
        ),
        writeFile(join(source, ".gitignore"), "node_modules\n"),
    ]);
    await git(source, ["init", "--quiet"]);
    await git(source, ["add", "--all"]);
    await git(source, [
        "-c",
        "user.name=Offline test fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "Synthetic offline fixture",
    ]);
    const pin = { ...pocketPin, commit: await git(source, ["rev-parse", "HEAD"]) };
    return { root, source, base, pin };
}

test("fixture setup is pinned, idempotent and uses only an internal relative dependency alias", async (t) => {
    const { source, base, pin } = await fixture(t);
    const checkout = await setupPocket({ source, base, pin });
    assert.equal(await verifyPocket(base, pin), checkout);
    assert.equal(await setupPocket({ source, base, pin }), checkout);
    assert.equal(await git(checkout, ["rev-parse", "HEAD"]), pin.commit);
    assert.ok((await lstat(join(checkout, "node_modules"))).isSymbolicLink());
    assert.equal(await readlink(join(checkout, "node_modules")), "../../node_modules");
});

test("fixture setup accepts a project path through a legitimate parent alias", async (t) => {
    const { root, source, base, pin } = await fixture(t);
    const alias = join(root, "linked-project");
    await symlink(base, alias, "dir");
    const checkout = await setupPocket({ source, base: alias, pin });
    assert.equal(checkout, await verifyPocket(base, pin));
    assert.equal(checkout, await verifyPocket(alias, pin));
});

test("fixture setup rejects a mutable ref before creating its cache", async (t) => {
    const { source, base, pin } = await fixture(t);
    await assert.rejects(
        setupPocket({ source, base, pin: { ...pin, commit: "main" } }),
        /immutable/,
    );
    await assert.rejects(lstat(join(base, ".cache")), { code: "ENOENT" });
});

test("modified cached source is rejected without resetting or overwriting it", async (t) => {
    const { source, base, pin } = await fixture(t);
    const checkout = await setupPocket({ source, base, pin });
    const changed = join(checkout, "test/helpers.ts"),
        sentinel = "// preserve this developer change\n";
    await writeFile(changed, sentinel);
    await assert.rejects(verifyPocket(base, pin), /modified/);
    await assert.rejects(setupPocket({ source, base, pin }), /modified/);
    assert.equal(await readFile(changed, "utf8"), sentinel);
});

test("a different cached revision is rejected without fetching or replacing it", async (t) => {
    const { source, base, pin } = await fixture(t);
    const checkout = await setupPocket({ source, base, pin });
    await assert.rejects(
        setupPocket({ source, base, pin: { ...pin, commit: "0".repeat(40) } }),
        /different revision/,
    );
    assert.equal(await git(checkout, ["rev-parse", "HEAD"]), pin.commit);
});

test("an external dependency alias or Git metadata alias is rejected", async (t) => {
    const { root, source, base, pin } = await fixture(t);
    const checkout = await setupPocket({ source, base, pin });
    const alias = join(checkout, "node_modules"),
        other = join(root, "other-modules");
    await mkdir(other);
    await rm(alias);
    await symlink(other, alias, "dir");
    await assert.rejects(verifyPocket(base, pin), /own locked dependencies/);
    await rm(alias);
    await symlink("../../node_modules", alias, "dir");
    await rename(join(checkout, ".git"), join(checkout, ".git-original"));
    await symlink(join(source, ".git"), join(checkout, ".git"), "dir");
    await assert.rejects(verifyPocket(base, pin), /real project-owned directories/);
});

test("a cache redirected outside the project is rejected before provisioning", async (t) => {
    const { root, source, base, pin } = await fixture(t);
    const other = join(root, "other-cache");
    await mkdir(other);
    await symlink(other, join(base, ".cache"), "dir");
    await assert.rejects(setupPocket({ source, base, pin }), /real project-owned directories/);
    await assert.rejects(lstat(join(other, "pi-pocket")), { code: "ENOENT" });
});
