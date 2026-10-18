import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import { parseDocument, serializeDocument } from "./document.js";
import { cellTagName } from "./registry.js";
import { createEngine } from "./engine.js";

/**
 * The editor: a vertical stack of cells.
 *
 * Set `value` to the document text; read it back from `value` or from the
 * `change` event. Keyboard: ArrowUp/ArrowDown select a cell, Enter edits it,
 * Escape leaves edit mode and commits. Cells may handle keys themselves and
 * call `preventDefault()` to keep them from the editor.
 *
 * After every change the whole document is rendered again, cell by cell, in
 * one Texl context, so each cell sees the names bound by the cells above.
 */
export class TexlEditor extends LitElement {
    static properties = {
        baseUrl: { type: String, attribute: "base-url" },
        _cells: { state: true },
        _outputs: { state: true },
        _selected: { state: true },
        _editing: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            outline: none;
        }
    `;

    constructor() {
        super();
        this.baseUrl = null;
        this._cells = [];
        this._outputs = [];
        this._selected = 0;
        this._editing = -1;
        this._engine = null;
        this._generation = 0;
        this.addEventListener("keydown", (e) => this._onKeyDown(e));
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    }

    /** The document text. */
    get value() {
        return serializeDocument(this._cells);
    }

    set value(source) {
        this._cells = parseDocument(source ?? "");
        this._selected = 0;
        this._editing = -1;
        this.rendered = this._renderCells();
    }

    /** Resolves when the outputs of the current cells are rendered. */
    rendered = Promise.resolve();

    async _renderCells() {
        const generation = ++this._generation;
        this._engine ??= await createEngine(null, this.baseUrl);
        const context = this._engine.createContext();
        const outputs = [];
        for (const cell of this._cells) outputs.push(await context.render(cell.texl));
        context.free();
        if (generation === this._generation) this._outputs = outputs;
    }

    _onKeyDown(e) {
        if (e.defaultPrevented) return;
        if (this._editing >= 0) {
            if (e.key === "Escape") {
                e.preventDefault();
                this._cellElement(this._editing)?.exitEdit(true);
            }
            return;
        }
        const last = this._cells.length - 1;
        if (e.key === "ArrowDown") this._selected = Math.min(this._selected + 1, last);
        else if (e.key === "ArrowUp") this._selected = Math.max(this._selected - 1, 0);
        else if (e.key === "Enter" && last >= 0) this._editing = this._selected;
        else return;
        e.preventDefault();
    }

    _onCellChange(index, texl) {
        this._cells = this._cells.map((c, i) => (i === index ? { ...c, texl } : c));
        this.rendered = this._renderCells();
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    _onCellExit() {
        this._editing = -1;
        this.focus();
    }

    _cellElement(index) {
        return this.renderRoot.querySelector(`[data-index="${index}"]`);
    }

    render() {
        return this._cells.map((cell, i) => {
            const tag = unsafeStatic(cellTagName(cell.type));
            return html`<${tag}
                data-index=${i}
                .name=${cell.name}
                .texl=${cell.texl}
                .output=${this._outputs[i] ?? ""}
                .mode=${i === this._editing ? "edit" : "render"}
                .selected=${i === this._selected}
                @click=${() => (this._selected = i)}
                @dblclick=${() => (this._editing = i)}
                @cell-change=${(e) => this._onCellChange(i, e.detail.texl)}
                @cell-exit=${() => this._onCellExit()}
            ></${tag}>`;
        });
    }
}
