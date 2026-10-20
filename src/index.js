// Entry point: registers the built-in cells and the <texl-editor> element.

import { registerCell } from "./registry.js";
import { TextCell } from "./cells/text-cell.js";
import { ExpressionCell } from "./cells/expression-cell.js";
import { TexlEditor } from "./texl-editor.js";

registerCell(TextCell);
registerCell(ExpressionCell);
if (!customElements.get("texl-editor")) customElements.define("texl-editor", TexlEditor);

export { TexlCell } from "./texl-cell.js";
export { TextCell, ExpressionCell, TexlEditor };
export { registerCell, cellTagName, cellTypes } from "./registry.js";
export { parseDocument, serializeDocument, parseMarker, formatMarker } from "./document.js";
export { createEngine } from "./engine.js";
