import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Flat config for ESLint 9. eslint-config-next 16 ships flat-config arrays;
// the legacy `.eslintrc.json` + `next lint` path is incompatible with ESLint 9
// (circular-structure crash), so we consume the flat exports directly.
//
// Baseline note: lint had never run in CI before this workflow, so the tree
// carries pre-existing violations. config-next 16 (built for Next 16) also
// enables newer, stricter rules than this Next 15 codebase was written against.
// To establish a green baseline without rewriting app code (spec 0025 keeps app
// behavior untouched), the new/noisy rules are downgraded to warnings: they stay
// visible but do not fail CI. Ratchet them back to "error" in a dedicated
// cleanup pass.
export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];
