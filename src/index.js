// Entry point: registers the built-in cells and the <texl-editor> element.

import { registerCell } from "./registry.js";
import { TextCell } from "./cells/text-cell.js";
import { FormulaCell } from "./cells/formula-cell.js";
import { TexlEditor } from "./texl-editor.js";

registerCell(TextCell);
registerCell(FormulaCell);
if (!customElements.get("texl-editor")) customElements.define("texl-editor", TexlEditor);

export { TexlCell } from "./texl-cell.js";
export { TextCell, FormulaCell, TexlEditor };
export { registerCell, cellTagName, cellTypes } from "./registry.js";
export { parseDocument, serializeDocument, parseMarker, formatMarker } from "./document.js";
export { createEngine } from "./engine.js";
