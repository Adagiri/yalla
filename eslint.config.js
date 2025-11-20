module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
    },
    rules: {
      "quotes": ["error", "single"]
    }
  },
  {
    ignores: ["node_modules/", "dist/", "build/"]
  }
];