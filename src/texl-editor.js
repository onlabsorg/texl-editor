import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import { parseDocument, serializeDocument } from "./document.js";
import { cellTagName } from "./registry.js";
import { createEngine } from "./engine.js";

/** What an empty line below the document shows: an empty text cell. */
const EMPTY_LINE = { type: "text", name: "", texl: "" };

/**
 * The editor: a vertical stack of cells.
 *
 * Set `value` to the document text; read it back from `value` or from the
 * `change` event. Keyboard: ArrowUp/ArrowDown select a cell; Enter,
 * Ctrl+Enter or F2 edits it; in edit mode Ctrl+Enter (Cmd+Enter on macOS)
 * commits and leaves, Escape discards the changes and leaves. Cells may handle keys themselves and call
 * `preventDefault()` to keep them from the editor.
 *
 * The editor looks like a sheet of lined paper: each line is a cell. The
 * sheet has `rows` lines (100 by default), or more if the document has more
 * cells. Lines below the last cell are empty and not part of the document;
 * writing in one adds it to the document, together with empty cells for the
 * lines above it. The editor scrolls its own lines: give it a height and
 * it shows a scrollbar and keeps the selected line in view.
 *
 * After every change the whole document is rendered again, cell by cell, in
 * one Texl context, so each cell sees the names bound by the cells above.
 */
export class TexlEditor extends LitElement {
    static properties = {
        baseUrl: { type: String, attribute: "base-url" },
        rows: { type: Number },
        _cells: { state: true },
        _outputs: { state: true },
        _selected: { state: true },
        _editing: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            overflow-y: auto;
            outline: none;
            background: var(--texl-paper, #fff);
            border-top: 1px solid var(--texl-line, #e4e6ea);
        }
    `;

    constructor() {
        super();
        this.baseUrl = null;
        this.rows = 100;
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
            const commit = e.key === "Enter" && (e.ctrlKey || e.metaKey);
            if (commit || e.key === "Escape") {
                e.preventDefault();
                this._cellElement(this._editing)?.exitEdit(commit);
            }
            return;
        }
        const last = this._rowCount() - 1;
        if (e.key === "ArrowDown") this._selected = Math.min(this._selected + 1, last);
        else if (e.key === "ArrowUp") this._selected = Math.max(this._selected - 1, 0);
        else if ((e.key === "Enter" || e.key === "F2") && last >= 0) this._editing = this._selected;
        else return;
        e.preventDefault();
    }

    /** The number of lines on the sheet. */
    _rowCount() {
        return Math.max(this.rows, this._cells.length);
    }

    _onCellChange(index, texl) {
        const cells = [...this._cells];
        while (cells.length <= index) cells.push({ type: "text", name: "", texl: "" });
        this._cells = cells.map((c, i) => (i === index ? { ...c, texl } : c));
        this.rendered = this._renderCells();
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    _onCellExit() {
        this._editing = -1;
        this.focus();
    }

    updated(changed) {
        // Keep the selected line in view while moving with the keys
        if (changed.has("_selected")) this._cellElement(this._selected)?.scrollIntoView({ block: "nearest" });
    }

    _cellElement(index) {
        return this.renderRoot.querySelector(`[data-index="${index}"]`);
    }

    render() {
        return Array.from({ length: this._rowCount() }, (_, i) => {
            const cell = this._cells[i] ?? EMPTY_LINE;
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
