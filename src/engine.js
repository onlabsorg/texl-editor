// Loads the Texl WebAssembly module once and creates engines.

import init, { TexlEngine } from "@onlabsorg/texl";

let ready = null;

/**
 * Returns a new Texl engine, loading the WebAssembly module on first use.
 * @param {object} [globals] - Names visible to every cell.
 * @param {string} [baseUrl] - URL that relative imports resolve against.
 * @returns {Promise<TexlEngine>}
 */
export async function createEngine(globals = null, baseUrl = null) {
    ready ??= init();
    await ready;
    return new TexlEngine(globals, baseUrl);
}
