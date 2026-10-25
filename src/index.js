// Entry point: registers the built-in cells and the <texl-editor> element.

import { registerCell } from "./registry.js";
import { TextCell } from "./cells/text-cell.js";
import { MarkdownCell } from "./cells/markdown-cell.js";
import { TexlEditor } from "./texl-editor.js";

registerCell(TextCell);
registerCell(MarkdownCell);
if (!customElements.get("texl-editor")) customElements.define("texl-editor", TexlEditor);

export { TexlCell } from "./texl-cell.js";
export { TextCell, MarkdownCell, TexlEditor };
export { registerCell, cellTagName, cellClass, cellTypes } from "./registry.js";
export { parseDocument, serializeDocument, parseMarker, formatMarker, cellComments, cellName, nameCells, nameConflicts, splitRendering } from "./document.js";
export { createEngine } from "./engine.js";
export { swanTags, insertTag, insertComment } from "./swan.js";
