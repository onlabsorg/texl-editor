// Loads the Texl WebAssembly module once and creates engines.

import init, { TexlEngine } from "@onlabsorg/texl";

let ready = null;

/**
 * Returns a new Texl engine, loading the WebAssembly module on first use.
 * The engine holds configuration only: every `render` and `load` starts
 * from a new scope and fetches its imports again.
 * @param {object} [globals] - Names visible to every document.
 * @param {string} [baseUrl] - URL that relative document URLs resolve
 *   against; the page URL by default.
 * @returns {Promise<TexlEngine>}
 */
export async function createEngine(globals = null, baseUrl = null) {
    ready ??= init();
    await ready;
    return new TexlEngine(globals, baseUrl);
}
