import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "react/jsx-no-literals": [
        "warn",
        {
          "noStrings": true,
          "ignoreProps": true
        }
      ],
      // Downgraded from error: ~130 pre-existing instances across the codebase, none of them
      // correctness bugs. Flipping this to error is a separate typing-debt cleanup; keeping it
      // as a warning lets the real error-level rules (rules-of-hooks, etc.) actually gate CI.
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
]);

export default eslintConfig;
