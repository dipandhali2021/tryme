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
    // Vendored Cojeev motion layer, installed as-is. Its morph/flow internals
    // trip the new React Compiler lint rules; we do not own that code.
    "src/lib/cojeev-motion/**",
  ]),
]);

export default eslintConfig;
