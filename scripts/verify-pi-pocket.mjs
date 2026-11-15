import { verifyPocket, pocketPin } from "./pocket-source.mjs";

try {
    await verifyPocket();
    console.log(`Verified pinned Pi Pocket fixture ${pocketPin.commit}.`);
} catch (error) {
    console.error("Pi Pocket development fixture is missing, modified or incompatible.");
    console.error(
        "Run npm ci --ignore-scripts, then npm run setup:pocket. Existing cache edits are never discarded automatically.",
    );
    if (error instanceof Error) console.error(error.message);
    process.exitCode = 1;
}
