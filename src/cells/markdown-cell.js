import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { TextCell } from "./text-cell.js";
import { TAG_OPEN, TAG_CLOSE } from "../swan.js";

// Markdown does not look inside a tag: its Swan code is not emphasis, links
// and the like. Tags are found within a paragraph or other inline text.
const texlTags = {
    defineNodes: ["TexlTag"],
    parseInline: [
        {
            name: "TexlTag",
            before: "Escape",
            parse(cx, next, pos) {
                if (cx.slice(pos, pos + TAG_OPEN.length) !== TAG_OPEN) return -1;
                const close = cx.slice(pos, cx.end).indexOf(TAG_CLOSE, TAG_OPEN.length);
                const end = close < 0 ? cx.end : pos + close + TAG_CLOSE.length;
                return cx.addElement(cx.elt("TexlTag", pos, end));
            },
        },
    ],
};

/**
 * A Markdown Texl template: the text cell, with Markdown highlighting in
 * the editor (the Swan highlighting of tags stays) and the output turned
 * from Markdown into HTML before it is shown.
 */
export class MarkdownCell extends TextCell {
    static type = "markdown";

    static label = "Markdown";

    static icon = html`<svg viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M6 15V9l3 3 3-3v6" />
        <path d="M17 9v6" />
        <path d="m15 13 2 2 2-2" />
    </svg>`;

    languageExtensions() {
        return [
            markdown({ extensions: [texlTags] }),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            super.languageExtensions(),
        ];
    }

    /** Shows `output` as Markdown, sanitised: documents are untrusted. */
    renderView() {
        const content = DOMPurify.sanitize(marked.parse(this.output));
        return html`<div class="view">${unsafeHTML(content)}</div>`;
    }
}
