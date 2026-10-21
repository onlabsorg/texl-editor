import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import DOMPurify from "dompurify";

/**
 * Base class of all cells.
 *
 * A cell has two modes:
 * - render mode shows `output`, the text that Texl rendered from the cell's
 *   source, set by the editor;
 * - edit mode shows the cell's own editing widget.
 *
 * The editor owns the document; a cell only receives its Texl source
 * (`texl`) and reports a new one with a `cell-change` event when an edit is
 * committed. Subclasses override:
 * - `fromTexl(texl)`: reads the cell's input from its Texl source;
 * - `toTexl()`: produces the Texl source from the current input;
 * - `renderEditor()`: the editing widget (the base only shows a notice);
 * - `renderView()`, rarely: the base shows `output` as sanitised HTML.
 * They also set the static `type`, and `label` and `icon`, which the
 * editor shows in the left margin and in the menu of cell types.
 *
 * Reactive properties are declared in `static properties` and initialised in
 * the constructor (not as class fields, which would shadow Lit's accessors).
 */
export class TexlCell extends LitElement {
    /** The cell type written in the marker. Subclasses set it. */
    static type = "";

    /** The name of the type shown to the user; the type if empty. */
    static label = "";

    /** The type's icon: a Lit template of a 24×24 SVG drawn with strokes. */
    static icon = html`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>`;

    static properties = {
        texl: { type: String },
        output: { type: String },
        mode: { type: String, reflect: true },
        selected: { type: Boolean, reflect: true },
    };

    // Lined paper: every cell is at least one line high and ruled below.
    static styles = css`
        :host {
            display: block;
            box-sizing: border-box;
            min-height: var(--texl-line-height, 2rem);
            border-left: 3px solid transparent;
            border-bottom: 1px solid var(--texl-line, #e4e6ea);
            padding: 0.25rem 0.75rem;
            line-height: 1.5rem;
        }
        /* Selected: a light wash and a faint rounded ring */
        :host([selected]) {
            border-radius: 4px;
            background: var(--texl-selected-bg, rgb(37 99 235 / 0.05));
            box-shadow: inset 0 0 0 1px var(--texl-selected-ring, rgb(37 99 235 / 0.35));
        }
        /* Editing: the source takes the place of the output on the line, on a
           faint gray tint with the accent bar */
        :host([mode="edit"]) {
            border-radius: 0;
            border-left-color: var(--texl-accent, #2563eb);
            background: var(--texl-edit-bg, #f8f9fb);
            box-shadow: none;
        }
        .view > :first-child {
            margin-top: 0;
        }
        .view > :last-child {
            margin-bottom: 0;
        }
        .no-editor {
            color: #999;
        }
    `;

    constructor() {
        super();
        this.texl = "";
        this.output = "";
        this.mode = "render";
        this.selected = false;
    }

    willUpdate(changed) {
        if (changed.has("mode") && this.mode === "edit") this.fromTexl(this.texl);
    }

    updated(changed) {
        if (changed.has("mode") && this.mode === "edit") this.focusEditor();
    }

    /** Reads the cell's input from its Texl source. */
    fromTexl(texl) {
        this.input = texl;
    }

    /** Returns the Texl source for the current input. */
    toTexl() {
        return this.input ?? "";
    }

    /** Leaves edit mode; reports the new source if `commit` and it changed. */
    exitEdit(commit = true) {
        if (this.mode !== "edit") return;
        if (commit) {
            const texl = this.toTexl();
            if (texl !== this.texl) {
                this.dispatchEvent(
                    new CustomEvent("cell-change", {
                        detail: { texl },
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        }
        this.dispatchEvent(new CustomEvent("cell-exit", { bubbles: true, composed: true }));
    }

    /** Moves the keyboard focus into the editing widget. */
    focusEditor() {
        this.renderRoot.querySelector("textarea, input")?.focus();
    }

    render() {
        return this.mode === "edit" ? this.renderEditor() : this.renderView();
    }

    /** The editing widget. Subclasses override it. */
    renderEditor() {
        return html`<p class="no-editor">No editor is defined for this cell type.</p>`;
    }

    /** Shows `output` as HTML, sanitised: documents are untrusted. */
    renderView() {
        const content = DOMPurify.sanitize(this.output);
        return html`<div class="view">${unsafeHTML(content)}</div>`;
    }
}
