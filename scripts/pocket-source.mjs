import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { devNull } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/** @typedef {{ repository: string, commit: string, version: string }} PocketPin */
const execute = promisify(execFile);
export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
/** @type {PocketPin} */
export const pocketPin = JSON.parse(
    await readFile(new URL("../tooling/pi-pocket.json", import.meta.url), "utf8"),
);

/** @param {PocketPin} pin */
function validatePin(pin) {
    if (!/^[0-9a-f]{40}$/.test(pin.commit)) {
        throw new Error("The Pi Pocket fixture must use a full, immutable Git commit.");
    }
    if (pin.repository !== "https://github.com/TannerMidd/pi-pocket.git") {
        throw new Error("The fixture repository must be the declared public Pi Pocket repository.");
    }
    if (!/^\d+\.\d+\.\d+$/.test(pin.version)) {
        throw new Error("The fixture package version must be an exact stable version.");
    }
}

/** @param {string[]} args @param {string} cwd */
async function git(args, cwd) {
    const allowed = [
        "PATH",
        "HOME",
        "USER",
        "LANG",
        "LC_ALL",
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "NO_PROXY",
        "ALL_PROXY",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
    ];
    /** @type {NodeJS.ProcessEnv} */
    const env = Object.fromEntries(
        allowed
            .filter((key) => process.env[key] !== undefined)
            .map((key) => [key, process.env[key]]),
    );
    Object.assign(env, {
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: devNull,
        GIT_TERMINAL_PROMPT: "0",
    });
    const { stdout } = await execute(
        "git",
        ["-c", `core.hooksPath=${devNull}`, "-c", "core.fsmonitor=false", ...args],
        { cwd, env, encoding: "utf8", timeout: 120_000, maxBuffer: 1_000_000 },
    );
    return stdout.trim();
}

/** @param {string} path */
async function plainDirectory(path) {
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== resolve(path)) {
        throw new Error(
            "Fixture directories must be real project-owned directories, not external links.",
        );
    }
}

/** @param {string} checkout @param {PocketPin} pin @param {string} modules */
async function verifyCheckout(checkout, pin, modules) {
    validatePin(pin);
    await plainDirectory(checkout);
    await plainDirectory(join(checkout, ".git"));
    if ((await git(["rev-parse", "HEAD"], checkout)) !== pin.commit) {
        throw new Error(
            "Cached Pi Pocket has a different revision. Preserve any work and remove the cache explicitly before setup.",
        );
    }
    const changes = await git(["status", "--porcelain", "--untracked-files=all"], checkout);
    if (
        changes
            .split("\n")
            .some((line) => line && line !== "?? node_modules" && line !== "?? node_modules/")
    ) {
        throw new Error("Cached Pi Pocket is modified. Setup never resets or discards changes.");
    }
    for (const file of [
        "package.json",
        "types/pocket.d.ts",
        "test/helpers.ts",
        "src/server/app.ts",
    ]) {
        const stat = await lstat(join(checkout, file));
        if (!stat.isFile() || stat.isSymbolicLink()) {
            throw new Error("The pinned fixture is missing a regular required source file.");
        }
    }
    const pkg = JSON.parse(await readFile(join(checkout, "package.json"), "utf8"));
    if (pkg.name !== "pi-pocket" || pkg.version !== pin.version) {
        throw new Error("The fixture package identity does not match its pinned metadata.");
    }
    await plainDirectory(modules);
    if ((await realpath(join(checkout, "node_modules"))) !== (await realpath(modules))) {
        throw new Error("The test fixture must resolve this project's own locked dependencies.");
    }
}

/** Verify the development fixture without fetching, resetting, or changing it.
 * @param {string} [base] @param {PocketPin} [pin]
 */
export async function verifyPocket(base = projectRoot, pin = pocketPin) {
    validatePin(pin);
    const canonicalBase = await realpath(base);
    const cache = join(canonicalBase, ".cache");
    await plainDirectory(cache);
    const checkout = join(cache, "pi-pocket");
    await verifyCheckout(checkout, pin, join(canonicalBase, "node_modules"));
    return checkout;
}

/** Fetch only the pinned public fixture, or use a local Git object source for offline setup.
 * Existing cache modifications are never reset. The relative dependency alias stays inside this project.
 * @param {{base?: string, pin?: PocketPin, source?: string}} [options]
 */
export async function setupPocket(options = {}) {
    const pin = options.pin ?? pocketPin;
    validatePin(pin);
    const base = await realpath(resolve(options.base ?? projectRoot));
    const modules = join(base, "node_modules");
    await plainDirectory(modules);
    const cache = join(base, ".cache");
    await mkdir(cache, { recursive: true });
    await plainDirectory(cache);
    const checkout = join(cache, "pi-pocket");
    let exists = false;
    try {
        await lstat(checkout);
        exists = true;
    } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (exists) return await verifyPocket(base, pin);
    let source = pin.repository;
    if (options.source !== undefined) {
        source = await realpath(resolve(options.source));
        await plainDirectory(source);
    }
    const stage = await mkdtemp(join(cache, "pocket-setup-"));
    try {
        await git(["init", "--quiet"], stage);
        await git(["fetch", "--quiet", "--no-tags", "--depth=1", "--", source, pin.commit], stage);
        await git(["checkout", "--quiet", "--detach", pin.commit, "--"], stage);
        await symlink(
            relative(stage, modules),
            join(stage, "node_modules"),
            process.platform === "win32" ? "junction" : "dir",
        );
        await verifyCheckout(stage, pin, modules);
        await rename(stage, checkout);
        return await verifyPocket(base, pin);
    } finally {
        await rm(stage, { recursive: true, force: true });
    }
}
