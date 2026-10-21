// Cell type registry: maps the type written in a cell marker to the custom
// element that edits and renders it.

const types = new Map();

/** The type used for cells whose type is not registered. */
export const FALLBACK_TYPE = "text";

/**
 * Registers a cell class under its static `type`, and defines its custom
 * element as `texl-cell-<type>` unless a tag name is given.
 * @param {typeof import("./texl-cell.js").TexlCell} cellClass
 * @param {string} [tagName]
 */
export function registerCell(cellClass, tagName = `texl-cell-${cellClass.type}`) {
    if (!cellClass.type) throw new Error("A cell class needs a static type");
    if (!customElements.get(tagName)) customElements.define(tagName, cellClass);
    types.set(cellClass.type, tagName);
}

/**
 * Returns the tag name of the element for a cell type. Unknown types use the
 * fallback type, so their source is still shown and kept.
 * @param {string} type
 * @returns {string}
 */
export function cellTagName(type) {
    return types.get(type) ?? types.get(FALLBACK_TYPE);
}

/**
 * Returns the class registered for a cell type, or undefined if the type is
 * not registered.
 * @param {string} type
 * @returns {typeof import("./texl-cell.js").TexlCell | undefined}
 */
export function cellClass(type) {
    const tagName = types.get(type);
    return tagName && customElements.get(tagName);
}

/** Returns the registered cell types. */
export function cellTypes() {
    return [...types.keys()];
}
