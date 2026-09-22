import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: [
      "src/features/anime-collection/components/CharacterVirtualGrid.tsx",
      "src/features/collection/components/CollectionCompactView.tsx",
      "src/features/collection/components/CollectionGridView.tsx",
      "src/features/collection/components/CollectionTable.tsx",
    ],
    rules: {
      // TanStack Virtual exposes imperative functions that React Compiler intentionally skips.
      "react-hooks/incompatible-library": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "release/**", "release-*/**", "releases/**"]),
];

export default eslintConfig;
