import { html, css } from "lit";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { TexlCell } from "../texl-cell.js";

// Keys the editor uses to leave edit mode (Mod-Enter commits, Escape
// discards): CodeMirror must not handle them.
const EDITOR_KEYS = new Set(["Mod-Enter", "Escape"]);
const cellKeymap = defaultKeymap.filter((binding) => !EDITOR_KEYS.has(binding.key));

/**
 * A Markdown Texl template, edited as source in a CodeMirror 6 editor.
 * Inline expressions are written by hand as `<% ... %>` tags. Also the
 * fallback for unknown cell types.
 *
 * The CodeMirror view exists only in edit mode: it is created after the
 * cell enters edit mode and destroyed when it leaves. It keeps `input` up to
 * date, so subclasses only convert between `input` and Texl source.
 */
export class TextCell extends TexlCell {
    static type = "text";

    static styles = [
        TexlCell.styles,
        css`
            .editor {
                border: 1px solid var(--texl-border, #ccc);
                background: var(--texl-editor-bg, #fff);
            }
            .editor .cm-editor {
                min-height: 1.5rem;
            }
            .editor .cm-editor.cm-focused {
                outline: 1px solid var(--texl-accent, #2563eb);
            }
            .editor .cm-scroller {
                font-family: var(--texl-mono, ui-monospace, monospace);
            }
        `,
    ];

    constructor() {
        super();
        /** @type {EditorView | null} */
        this._view = null;
    }

    /** CodeMirror extensions of the editor. Subclasses may extend them. */
    editorExtensions() {
        return [
            history(),
            drawSelection(),
            EditorView.lineWrapping,
            markdown(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            keymap.of([...cellKeymap, ...historyKeymap]),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) this.input = update.state.doc.toString();
            }),
        ];
    }

    willUpdate(changed) {
        if (changed.has("mode") && this.mode !== "edit") this._destroyView();
        super.willUpdate(changed);
    }

    updated(changed) {
        if (this.mode === "edit" && !this._view) {
            this._view = new EditorView({
                state: EditorState.create({
                    doc: this.input ?? "",
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
