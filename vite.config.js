import { defineConfig } from "vite";

// `npm run dev` serves index.html (the demo page); `npm run build` bundles the
// library from src/index.js into dist/.
export default defineConfig({
    // Pre-bundling would move texl_wasm.js away from its .wasm file, which it
    // loads by a URL relative to itself.
    optimizeDeps: {
        exclude: ["@onlabsorg/texl"],
    },
    build: {
        lib: {
            entry: "src/index.js",
            formats: ["es"],
            fileName: "texl-editor",
        },
    },
});
