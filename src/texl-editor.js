import { LitElement, css } from "lit";
import { html, unsafeStatic } from "lit/static-html.js";
import { parseDocument, serializeDocument } from "./document.js";
import { cellTagName } from "./registry.js";
import { createEngine } from "./engine.js";

/** What an empty line below the document shows: an empty markdown cell. */
const EMPTY_LINE = { type: "markdown", texl: "" };

/** Whether a cell looks like an empty line: an empty markdown or text cell. */
function isEmptyLine(cell) {
    return (cell.type === "markdown" || cell.type === "text") && !cell.texl;
}

/** The most changes that can be undone. */
const HISTORY_SIZE = 100;

/** Whether Ctrl, Cmd, Alt or Shift is held, apart from `allowed`. */
function hasModifier(e, ...allowed) {
    return ["ctrlKey", "metaKey", "altKey", "shiftKey"].some((key) => !allowed.includes(key) && e[key]);
}

/** Whether the command modifier is held: Ctrl, or Cmd on macOS. */
function isMod(e) {
    return e.ctrlKey || e.metaKey;
}

/**
 * The editor: a vertical stack of cells.
 *
 * Set `value` to the document text; read it back from `value` or from the
 * `change` event. Keyboard: ArrowUp/ArrowDown select a cell, Shift+ArrowUp/
 * ArrowDown (or Shift+click) several; Enter, Ctrl+Enter or F2 edits the
 * selected one; in edit mode Ctrl+Enter (Cmd+Enter on macOS) commits and
 * leaves, Escape discards the changes and leaves. Cells may handle keys
 * themselves and call `preventDefault()` to keep them from the editor.
 *
 * Outside edit mode (Mod is Ctrl, or Cmd on macOS):
 * - Alt+Enter or Insert inserts an empty cell below the selected ones,
 *   Alt+Shift+Enter above them;
 * - Alt+ArrowUp/ArrowDown moves the selected cells one line up or down;
 * - Delete or Backspace deletes the selected cells;
 * - Mod+C/X/V copy, cut and paste the selected cells: they handle the
 *   browser's clipboard events, so the clipboard holds the cells as Texl
 *   source with their markers, and pasted text replaces the selected cells;
 * - Mod+Z undoes the last change to the cells, Mod+Shift+Z or Mod+Y redoes
 *   it. While editing, these keys belong to the cell's own text editor.
 *
 * The editor looks like a sheet of lined paper: each line is a cell. The
 * sheet has `rows` lines (100 by default), or more if the document has more
 * cells. Lines below the last cell are empty and not part of the document;
 * writing in one adds it to the document, together with empty cells for the
 * lines above it. Empty markdown or text cells at the end of the document
 * are dropped, as they look the same as the empty lines. The editor scrolls
 * its own lines: give it a height and it shows a scrollbar and keeps the
 * selected line in view.
 *
 * Two vertical lines (`--texl-margin-line`) rule a margin on each side of
 * the cells, as on legal paper, both `--texl-margin` wide. The left margin
 * (part `left-margin`) is for the editor's own objects about each line; it
 * shows the line number, 1, 2, 3, ..., also on the empty lines below the
 * document, as in Excel. Cells have no name: they are known by their line
 * number. The right margin (part `right-margin`) is for comments on a line:
 * each child of the editor with `slot` set to a line number is a comment on
 * that line, and the line's right margin shows a comment icon with their
 * number. The comments themselves are not shown yet. Keys and clipboard
 * events from these children are left to them.
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
        _anchor: { state: true },
        _selected: { state: true },
        _editing: { state: true },
        _comments: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            overflow-y: auto;
            outline: none;
            background: var(--texl-paper, #fff);
            border-top: 1px solid var(--texl-line, #e4e6ea);
        }
        /* One row per line: left margin, cell, right margin */
        .sheet {
            display: grid;
            grid-template-columns:
                var(--texl-margin, 6rem)
                minmax(0, 1fr)
                var(--texl-margin, 6rem);
        }
        .margin {
            box-sizing: border-box;
            min-width: 0;
            border-bottom: 1px solid var(--texl-line, #e4e6ea);
        }
        .margin.left {
            border-right: 1px solid var(--texl-margin-line, #7aa2f0);
            padding: 0.0625rem 0.5rem 0.25rem;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 0.625rem;
            font-weight: normal;
            line-height: 1.5rem;
            /* The line number stays in the background, clearer on the
               selected lines or under the mouse */
            color: var(--texl-line-number, #c4c8cf);
            user-select: none;
        }
        .margin.left.selected,
        .margin.left:hover {
            color: var(--texl-line-number-active, #9aa0aa);
        }
        .margin.right {
            border-left: 1px solid var(--texl-margin-line, #7aa2f0);
            padding: 0.25rem 0.5rem;
        }
        /* The comments are counted, not shown */
        .comments {
            display: none;
        }
        .comment-count {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            height: 1.5rem;
            font-size: 0.8125rem;
            color: var(--texl-comment, #b7791f);
        }
        .comment-count svg {
            width: 1rem;
            height: 1rem;
        }
    `;

    constructor() {
        super();
        this.baseUrl = null;
        this.rows = 100;
        this._cells = [];
        this._outputs = [];
        this._anchor = 0;
        this._selected = 0;
        this._editing = -1;
        /** The number of comments in each line's right margin, by line. */
        this._comments = [];
        this._engine = null;
        this._generation = 0;
        /** Earlier and undone states, as `{cells, anchor, selected}`. */
        this._undoStack = [];
        this._redoStack = [];
        this.addEventListener("keydown", (e) => this._onKeyDown(e));
        for (const type of ["copy", "cut", "paste"]) this.addEventListener(type, (e) => this._onClipboard(e));
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
        this._anchor = 0;
        this._selected = 0;
        this._editing = -1;
        this._undoStack = [];
        this._redoStack = [];
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
        // Keys from the margin content (children of the editor) are theirs
        if (e.defaultPrevented || e.target !== this) return;
        if (this._editing >= 0) {
            const commit = e.key === "Enter" && (e.ctrlKey || e.metaKey);
            if (commit || e.key === "Escape") {
                e.preventDefault();
                this._cellElement(this._editing)?.exitEdit(commit);
            }
            return;
        }
        const step = { ArrowUp: -1, ArrowDown: 1 }[e.key];
        if (step && e.altKey && !hasModifier(e, "altKey")) this._moveCells(step);
        else if (step && !hasModifier(e, "shiftKey")) this._select(this._selected + step, e.shiftKey);
        else if (e.key === "Enter" && e.altKey && !hasModifier(e, "altKey", "shiftKey"))
            this._insertCell(e.shiftKey ? "above" : "below");
        else if ((e.key === "Enter" || e.key === "F2") && this._rowCount() > 0) this._edit(this._selected);
        // Ctrl+Insert, Shift+Insert and Shift+Delete are left to the browser:
        // they copy, paste and cut
        else if (e.key === "Insert" && !hasModifier(e)) this._insertCell("below");
        else if ((e.key === "Delete" || e.key === "Backspace") && !hasModifier(e)) this._deleteCells();
        else if (isMod(e) && !e.altKey && e.key.toLowerCase() === "z") this._undo(e.shiftKey ? "redo" : "undo");
        else if (isMod(e) && !hasModifier(e, "ctrlKey", "metaKey") && e.key.toLowerCase() === "y") this._undo("redo");
        else return;
        e.preventDefault();
    }

    /** The first and last selected lines: from the anchor to `_selected`. */
    _range() {
        return [Math.min(this._anchor, this._selected), Math.max(this._anchor, this._selected)];
    }

    /** Selects line `index`; with `extend`, the lines from the anchor to it. */
    _select(index, extend = false) {
        this._selected = Math.max(0, Math.min(index, this._rowCount() - 1));
        if (!extend) this._anchor = this._selected;
    }

    /** Selects line `index` alone and edits it. */
    _edit(index) {
        this._select(index);
        this._editing = index;
    }

    /** Copies, cuts or pastes the selected cells, outside edit mode. */
    _onClipboard(e) {
        // Leave text selected with the mouse to the browser
        if (this._editing >= 0 || !e.clipboardData || e.target !== this || document.getSelection()?.toString())
            return;
        e.preventDefault();
        const [first, last] = this._range();
        if (e.type === "paste") {
            const pasted = parseDocument(e.clipboardData.getData("text/plain"));
            if (pasted.length === 0) return;
            this._spliceCells(first, last - first + 1, pasted);
            this._select(first);
            this._select(first + pasted.length - 1, true);
            return;
        }
        // Lines below the document are left out, unless only they are selected
        const copied = this._cells.slice(first, last + 1);
        const cells = (copied.length > 0 ? copied : [EMPTY_LINE]).map(({ marker, ...cell }) => cell);
        e.clipboardData.setData("text/plain", serializeDocument(cells));
        if (e.type === "cut") this._deleteCells();
    }

    _deleteCells() {
        const [first, last] = this._range();
        if (first < this._cells.length) this._spliceCells(first, last - first + 1);
        this._select(first);
    }

    /** Inserts an empty cell above or below the selected ones and selects it. */
    _insertCell(where) {
        const [first, last] = this._range();
        const index = where === "below" ? last + 1 : first;
        // Below the document all lines are empty already: only move there
        if (index < this._cells.length) this._spliceCells(index, 0, [{ ...EMPTY_LINE }]);
        this._select(index);
    }

    /** Moves the selected cells one line up (`step` -1) or down (1). */
    _moveCells(step) {
        const [first, last] = this._range();
        if (first + step < 0 || last + step >= this._rowCount()) return;
        // Below the document all lines are empty: only the selection moves
        if (first < this._cells.length) {
            const cells = [...this._cells];
            while (cells.length <= last + Math.max(step, 0)) cells.push({ ...EMPTY_LINE });
            cells.splice(first + step, 0, ...cells.splice(first, last - first + 1));
            this._setCells(cells);
        }
        this._anchor += step;
        this._selected += step;
    }

    /** The number of lines on the sheet. */
    _rowCount() {
        return Math.max(this.rows, this._cells.length);
    }

    /** Undoes the last change to the cells, or redoes the last undone one. */
    _undo(direction) {
        const [from, to] = direction === "undo" ? [this._undoStack, this._redoStack] : [this._redoStack, this._undoStack];
        const state = from.pop();
        if (!state) return;
        to.push(this._state());
        this._cells = state.cells;
        this._select(state.anchor);
        this._select(state.selected, true);
        this.rendered = this._renderCells();
        this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    /** The cells and the selection, as kept for undo. */
    _state() {
        return { cells: this._cells, anchor: this._anchor, selected: this._selected };
    }

    _onCellChange(index, texl) {
        const cell = this._cells[index];
        this._spliceCells(index, cell ? 1 : 0, [{ ...(cell ?? EMPTY_LINE), texl }]);
    }

    /**
     * Changes the cells as `Array.prototype.splice`. Empty cells fill the
     * lines between the document and `index`, if it is below the document.
     */
    _spliceCells(index, count, inserted = []) {
        const cells = [...this._cells];
        while (cells.length < index) cells.push({ ...EMPTY_LINE });
        cells.splice(index, count, ...inserted);
        this._setCells(cells);
    }

    /** Replaces the cells, keeping the old ones for undo; renders and reports them. */
    _setCells(cells) {
        this._undoStack = [...this._undoStack, this._state()].slice(-HISTORY_SIZE);
        this._redoStack = [];
        // Empty cells at the end look like the empty lines below: drop them
        while (cells.length > 0 && isEmptyLine(cells.at(-1))) cells = cells.slice(0, -1);
        // Only the first cell may go without marker; the others need one
        this._cells = cells.map(({ marker, ...cell }, i) => (i === 0 && marker === false ? { ...cell, marker } : cell));
        this._anchor = Math.min(this._anchor, this._rowCount() - 1);
        this._select(this._selected, true);
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

    /** Counts the comments that `slot`, in the right margin of line `index`, gets. */
    _onSlotChange(index, slot) {
        const count = slot.assignedElements().length;
        if (this._comments[index] === count) return;
        const comments = [...this._comments];
        comments[index] = count;
        this._comments = comments;
    }

    /** A comment icon with `count`, or nothing if there are no comments. */
    _renderCommentCount(count) {
        if (!count) return "";
        const label = count === 1 ? "1 comment" : `${count} comments`;
        return html`<span class="comment-count" title=${label} aria-label=${label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>${count}
        </span>`;
    }

    _cellElement(index) {
        return this.renderRoot.querySelector(`[data-index="${index}"]`);
    }

    render() {
        const [first, last] = this._range();
        const rows = Array.from({ length: this._rowCount() }, (_, i) => {
            const cell = this._cells[i] ?? EMPTY_LINE;
            const tag = unsafeStatic(cellTagName(cell.type));
            return html`<div class="margin left ${i >= first && i <= last ? "selected" : ""}" part="left-margin" @click=${(e) => this._select(i, e.shiftKey)}>${i + 1}</div>
                <${tag}
                data-index=${i}
                .texl=${cell.texl}
                .output=${this._outputs[i] ?? ""}
                .mode=${i === this._editing ? "edit" : "render"}
                .selected=${i >= first && i <= last}
                @click=${(e) => this._select(i, e.shiftKey)}
                @dblclick=${() => this._edit(i)}
                @cell-change=${(e) => this._onCellChange(i, e.detail.texl)}
                @cell-exit=${() => this._onCellExit()}
            ></${tag}>
                <div class="margin right" part="right-margin">
                    ${this._renderCommentCount(this._comments[i])}
                    <div class="comments">
                        <slot name=${i + 1} @slotchange=${(e) => this._onSlotChange(i, e.target)}></slot>
                    </div>
                </div>`;
        });
        return html`<div class="sheet">${rows}</div>`;
    }
}
