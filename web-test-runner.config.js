import { chromeLauncher } from "@web/test-runner-chrome";

// Tests run in a real browser (the locally installed Chrome), because cells
// are custom elements and Texl runs as WebAssembly.
export default {
    files: "test/**/*.test.js",
    nodeResolve: true,
    browsers: [chromeLauncher({ launchOptions: { headless: true } })],
    // The first test pages wait for Chrome to launch, which is slow on a
    // fresh CI runner (over the default 30 s on GitHub Actions)
    browserStartTimeout: 120000,
};
