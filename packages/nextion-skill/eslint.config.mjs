import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.mjs"],
  },
  {
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
