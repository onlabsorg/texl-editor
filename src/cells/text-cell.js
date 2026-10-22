import { html, css } from "lit";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { TexlCell } from "../texl-cell.js";
import { swanTags, insertTag, insertComment } from "../swan.js";

// Keys the editor uses to leave edit mode (Mod-Enter commits, Escape
// discards): CodeMirror must not handle them.
const EDITOR_KEYS = new Set(["Mod-Enter", "Escape"]);
const cellKeymap = defaultKeymap.filter((binding) => !EDITOR_KEYS.has(binding.key));

/**
 * Ctrl+Space inserts a tag, `<%  %>`, and Shift+F2 a comment, `<!--[  ]-->`
 * (the Excel key for a comment), with the cursor inside it.
 */
const templateKeymap = [
    { key: "Ctrl-Space", run: insertTag },
    { key: "Shift-F2", run: insertComment },
];

/**
 * A Texl template, edited as source in a CodeMirror 6 editor and shown as
 * HTML, like the base cell. Inline expressions are written as `<% ... %>`
 * tags, highlighted as Swan; Ctrl+Space inserts one, Shift+F2 a comment.
 * Also the fallback for unknown cell types.
 *
 * The CodeMirror view exists only in edit mode: it is created after the
 * cell enters edit mode and destroyed when it leaves. It keeps `input` up to
 * date, so subclasses only convert between `input` and Texl source. The
 * cursor starts at the end of the text, as with F2 in Excel.
 *
 * The line break that ends most cell bodies belongs to the file format (it
 * separates the cell from the next marker): it is left out of `input` while
 * editing and added back to the Texl source.
 */
export class TextCell extends TexlCell {
    static type = "text";

    static label = "Text";

    static icon = html`<svg viewBox="0 0 24 24">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
    </svg>`;

    static styles = [
        TexlCell.styles,
        css`
            /* No box: the source sits on the line where the output was */
            .editor .cm-editor {
                min-height: 1.5rem;
            }
            .editor .cm-editor.cm-focused {
                outline: none;
            }
            .editor .cm-scroller {
                font-family: var(--texl-mono, ui-monospace, monospace);
                line-height: inherit;
            }
            /* Room for the cursor before the first character, which would
               otherwise be clipped; the margin keeps the text in place */
            .editor {
                margin-left: -2px;
            }
            .editor .cm-content {
                padding: 0 0 0 2px;
            }
            .editor .cm-line {
                padding: 0;
            }
        `,
    ];

    constructor() {
        super();
        /** @type {EditorView | null} */
        this._view = null;
        /** The line break after the edited text, kept out of `input`. */
        this._lineBreak = "";
    }

    fromTexl(texl) {
        this._lineBreak = /\r?\n$/.exec(texl)?.[0] ?? "";
        this.input = texl.slice(0, texl.length - this._lineBreak.length);
    }

    toTexl() {
        return (this.input ?? "") + (this._lineBreak ?? "");
    }

    /** CodeMirror extensions of the editor. */
    editorExtensions() {
        return [
            history(),
            drawSelection(),
            EditorView.lineWrapping,
            this.languageExtensions(),
            keymap.of([...cellKeymap, ...historyKeymap]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) this.input = update.state.doc.toString();
            }),
        ];
    }

    /**
     * CodeMirror extensions for the language of the input: here a template
     * with Swan tags and the keys that insert a tag or a comment. Subclasses override or
     * extend them.
     */
    languageExtensions() {
        return [swanTags(), keymap.of(templateKeymap)];
    }

    willUpdate(changed) {
        if (changed.has("mode") && this.mode !== "edit") this._destroyView();
        super.willUpdate(changed);
    }

    updated(changed) {
        if (this.mode === "edit" && !this._view) {
            const doc = this.input ?? "";
            this._view = new EditorView({
                state: EditorState.create({
                    doc,
                    selection: { anchor: doc.length },
                    extensions: this.editorExtensions(),
                }),
                parent: this.renderRoot.querySelector(".editor"),
                root: this.renderRoot,
            });
        }
        super.updated(changed);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._destroyView();
    }

    _destroyView() {
        this._view?.destroy();
        this._view = null;
    }

    focusEditor() {
        this._view?.focus();
    }

    renderEditor() {
        return html`<div class="editor"></div>`;
    }
}
