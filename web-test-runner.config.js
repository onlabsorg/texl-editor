import { chromeLauncher } from "@web/test-runner-chrome";

// Tests run in a real browser (the locally installed Chrome), because cells
// are custom elements and Texl runs as WebAssembly.
export default {
    files: "test/**/*.test.js",
    nodeResolve: true,
    browsers: [chromeLauncher({ launchOptions: { headless: true } })],
};
