import { chromeLauncher } from "@web/test-runner-chrome";

// Tests run in a real browser (the locally installed Chrome), because cells
// are custom elements and Texl runs as WebAssembly.
export default {
    files: "test/**/*.test.js",
    nodeResolve: true,
    // Chrome's first launch on a fresh CI runner can take over 30 s, the
    // default of both Puppeteer's launch timeout and the runner's timeout for
    // the first test pages, which wait for the launch
    browsers: [
        chromeLauncher({ launchOptions: { headless: true, timeout: 120000 } }),
    ],
    browserStartTimeout: 180000,
};
