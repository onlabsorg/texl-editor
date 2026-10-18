import { html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { TexlCell } from "../texl-cell.js";

/**
 * A Markdown Texl template, edited as source. Inline formulas are written by
 * hand as `<% ... %>` tags. Also the fallback for unknown cell types.
 */
export class TextCell extends TexlCell {
    static type = "text";

    static styles = [
        TexlCell.styles,
        css`
            textarea {
                box-sizing: border-box;
                width: 100%;
                min-height: 6rem;
                font: inherit;
                font-family: var(--texl-mono, ui-monospace, monospace);
                field-sizing: content;
            }
            .empty {
                color: #999;
            }
        `,
    ];

    renderView() {
        if (!this.output.trim()) return html`<p class="empty">Empty text</p>`;
        const markup = DOMPurify.sanitize(marked.parse(this.output));
        return html`${unsafeHTML(markup)}`;
    }
}
