import { TextCell } from "./text-cell.js";
import { swanExpression, TAG_OPEN as OPEN, TAG_CLOSE as CLOSE } from "../swan.js";

/**
 * A Swan expression entered without `<% %>`, like an Excel formula. Its
 * Texl source is the expression in one tag; it uses the text cell's editor,
 * with the whole input highlighted as Swan and no key to insert tags.
 *
 * Draft: how an expression binds a name and how it is displayed (e.g.
 * "name = value") are still open; see docs/design.md.
 */
export class ExpressionCell extends TextCell {
    static type = "expression";

    fromTexl(texl) {
        let source = texl.trim();
        if (source.startsWith(OPEN)) source = source.slice(OPEN.length);
        if (source.endsWith(CLOSE)) source = source.slice(0, -CLOSE.length);
        this.input = source;
    }

    toTexl() {
        return `${OPEN}${this.input ?? ""}${CLOSE}\n`;
    }

    languageExtensions() {
        return swanExpression();
    }
}
