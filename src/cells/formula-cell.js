import { html, css } from "lit";
import { TexlCell } from "../texl-cell.js";

const TAG = /^<%([\s\S]*)%>\s*$/;

/**
 * A Swan expression entered without `<% %>`, like an Excel formula. Its
 * Texl source is the expression in one tag.
 *
 * Draft: how a formula binds a name and how it is displayed (e.g.
 * "name = value") are still open; see docs/design.md.
 */
export class FormulaCell extends TexlCell {
    static type = "formula";

    static styles = [
        TexlCell.styles,
        css`
            input {
                box-sizing: border-box;
                width: 100%;
                font-family: var(--texl-mono, ui-monospace, monospace);
            }
            .value {
                font-family: var(--texl-mono, ui-monospace, monospace);
            }
        `,
    ];

    fromTexl(texl) {
        const match = TAG.exec(texl.trim());
        this.input = match ? match[1].trim() : texl.trim();
    }

    toTexl() {
        return `<% ${this.input ?? ""} %>\n`;
    }

    _onKeyDown(e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        this.exitEdit(true);
    }

    renderEditor() {
        return html`= <input
                .value=${this.input ?? ""}
                @input=${(e) => (this.input = e.target.value)}
                @keydown=${this._onKeyDown}
            />`;
    }

    renderView() {
        return html`<div class="value">${this.output.trim()}</div>`;
    }
}
