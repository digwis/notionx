import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    languageOptions: {
      globals: {
        ...globals.worker,
        ...globals.node,
        ...globals.browser,
      },
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Tier 3 notion may not reach into higher tiers
            {
              target: "./src/notion/**",
              from: ["./src/content/**", "./src/auth/**", "./src/admin/**", "./src/worker/**"],
            },
            // Tier 4 content may not reach into higher tiers
            {
              target: "./src/content/**",
              from: ["./src/auth/**", "./src/admin/**", "./src/worker/**"],
            },
            // Tier 5 auth may not reach into admin or worker
            {
              target: "./src/auth/**",
              from: ["./src/admin/**", "./src/worker/**"],
            },
            // Tier 6 admin may not reach into worker
            {
              target: "./src/admin/**",
              from: ["./src/worker/**"],
            },
            // The starter must never be reached from the package
            {
              target: "./src/**",
              from: ["../../apps/**", "./apps/**"],
            },
          ],
        },
      ],
    },
  },
];
