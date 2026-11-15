import { setupPocket, pocketPin } from "./pocket-source.mjs";

const args = process.argv.slice(2);
try {
    if (args.length && !(args.length === 2 && args[0] === "--source" && args[1])) {
        throw new Error(
            "Usage: npm run setup:pocket [-- --source /path/to/local/pi-pocket-checkout]",
        );
    }
    await setupPocket(args.length ? { source: args[1] } : {});
    console.log(
        `Pi Pocket development fixture ready: ${pocketPin.version} at ${pocketPin.commit}.`,
    );
    console.log(
        "Only this project's cache and dependencies are used. No live Pocket data or credentials are needed.",
    );
} catch (error) {
    console.error(error instanceof Error ? error.message : "Pi Pocket fixture setup failed.");
    console.error(
        "Prerequisites: Git on PATH and npm ci --ignore-scripts in this project. Setup never discards an existing cache.",
    );
    process.exitCode = 1;
}
