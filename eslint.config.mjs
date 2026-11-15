import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

export default tseslint.config(
    { ignores: ["node_modules/**", ".cache/**", "coverage/**"] },
    ...tseslint.configs.recommended,
    prettier,
    {
        files: ["**/*.{ts,mjs}"],
        rules: {
            eqeqeq: ["error", "always"],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-unreachable": "error",
            "no-duplicate-case": "error",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
            ],
        },
    },
    {
        files: ["*.test.ts"],
        // Structural fakes deliberately implement only the contract exercised by a test.
        // Runtime code and development scripts still receive strict TypeScript checks.
        rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
);
