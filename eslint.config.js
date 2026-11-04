// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'supabase/functions/read-summary/*', 'supabase/functions/**/*.test.ts', 'scripts/*'] },
  // React Native <Text> renders quotes and apostrophes literally; this rule is for HTML.
  { rules: { 'react/no-unescaped-entities': 'off' } },
]);
