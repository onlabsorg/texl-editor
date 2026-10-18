import { LitElement, html, css } from "lit";

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
 * - `renderEditor()` and `renderView()`: the two modes.
 *
 * Reactive properties are declared in `static properties` and initialised in
 * the constructor (not as class fields, which would shadow Lit's accessors).
 */
export class TexlCell extends LitElement {
    /** The cell type written in the marker. Subclasses set it. */
    static type = "";

    static properties = {
        name: { type: String, reflect: true },
        texl: { type: String },
        output: { type: String },
        mode: { type: String, reflect: true },
        selected: { type: Boolean, reflect: true },
    };

    static styles = css`
        :host {
            display: block;
            border-left: 3px solid transparent;
            padding: 0.25rem 0.75rem;
        }
        :host([selected]) {
            border-left-color: var(--texl-accent, #2563eb);
            background: var(--texl-selected-bg, #f5f8ff);
        }
        :host([mode="edit"]) {
            background: var(--texl-edit-bg, #fffdf5);
        }
    `;

    constructor() {
        super();
        this.name = "";
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

    renderEditor() {
        return html`<textarea
            .value=${this.input ?? ""}
            @input=${(e) => (this.input = e.target.value)}
        ></textarea>`;
    }

    renderView() {
        return html`<pre>${this.output}</pre>`;
    }
}
