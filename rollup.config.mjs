import streamDeck from "@elgato/rollup-plugin-streamdeck";

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/plugin.ts",
  output: {
    file: "com.kanai.ciscovpn.sdPlugin/bin/plugin.js",
    format: "esm",
    sourcemap: true,
  },
  plugins: [streamDeck()],
};
