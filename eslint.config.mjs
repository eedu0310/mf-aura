import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/rules-of-hooks": "warn",
      "prefer-const": "warn",
      "@next/next/no-img-element": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    ".vercel/**",
    "tsconfig.tsbuildinfo",
  ]),
]);
