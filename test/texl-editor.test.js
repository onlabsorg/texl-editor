import { expect, fixture, html } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import "../src/index.js";

const SOURCE = `<!--{ txt2 : text }-->
<% L = 6, q = 12.5 %>Span: <% L %> m
<!--{ mdn3 : markdown }-->
<% q * L ^ 2 / 8 %>
`;

/** A document without its cell names, which the editor may generate. */
const anon = (source) => source.replace(/<!--\{ [^:]*? : /g, "<!--{ ");

async function editorWith(source) {
    const editor = await fixture(html`<texl-editor></texl-editor>`);
    editor.value = source;
    await editor.rendered;
    await editor.updateComplete;
    return editor;
}

function cells(editor) {
    return [...editor.shadowRoot.querySelectorAll("[data-index]")];
}

describe("texl-editor", () => {
    it("renders one element per cell, by type", async () => {
        const editor = await editorWith(SOURCE);
        expect(cells(editor).slice(0, 2).map((c) => c.localName)).to.deep.equal([
            "texl-cell-text",
            "texl-cell-markdown",
        ]);
    });

    it("renders cells in one shared scope", async () => {
        const editor = await editorWith(SOURCE);
        const [text, formula] = cells(editor);
        await formula.updateComplete;
        expect(text.output).to.equal("Span: 6 m\n");
        expect(formula.shadowRoot.textContent.trim()).to.equal("56.25");
    });

    it("returns the document unchanged", async () => {
        const editor = await editorWith(SOURCE);
        expect(anon(editor.value)).to.equal(anon(SOURCE));
    });

    it("edits a cell and updates the document", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const formula = cells(editor)[1];
        await formula.updateComplete;
        const view = EditorView.findFromDOM(formula.shadowRoot.querySelector(".cm-editor"));
        expect(view.state.doc.toString()).to.equal("<% q * L ^ 2 / 8 %>");

        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "<% q * L %>" } });
        view.contentDOM.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, keyCode: 13, bubbles: true, composed: true, cancelable: true }),
        );
        await editor.rendered;
        await editor.updateComplete;
        expect(editor.value).to.contain("<% q * L %>\n");
        expect(cells(editor)[1].mode).to.equal("render");
        expect(cells(editor)[1].output.trim()).to.equal("75");
    });

    it("leaves the document unchanged when an edit changes nothing", async () => {
        const editor = await editorWith(SOURCE);
        let changes = 0;
        editor.addEventListener("change", () => changes++);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, cancelable: true }));
        await editor.updateComplete;
        expect(changes).to.equal(0);
        expect(anon(editor.value)).to.equal(anon(SOURCE));
    });

    it("edits a text cell in a CodeMirror editor: Enter adds a line, Ctrl+Enter commits", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(view.hasFocus).to.be.true;

        view.dispatch({ selection: { anchor: view.state.doc.length } });
        const enter = new KeyboardEvent("keydown", {
            key: "Enter", keyCode: 13, bubbles: true, composed: true, cancelable: true,
        });
        view.contentDOM.dispatchEvent(enter);
        expect(enter.defaultPrevented).to.be.true;
        expect(text.mode).to.equal("edit");

        view.dispatch({ changes: { from: view.state.doc.length, insert: "Load: <% q %>" } });
        view.contentDOM.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, keyCode: 13, bubbles: true, composed: true, cancelable: true }),
        );
        await editor.rendered;
        await editor.updateComplete;
        expect(text.mode).to.equal("render");
        expect(text.shadowRoot.querySelector(".cm-editor")).to.be.null;
        expect(text.texl).to.equal("<% L = 6, q = 12.5 %>Span: <% L %> m\nLoad: <% q %>\n");
        expect(text.output).to.equal("Span: 6 m\nLoad: 12.5\n");
    });

    it("hides the line break that ends the source while editing", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(text.texl.endsWith("\n")).to.be.true;
        expect(view.state.doc.toString().endsWith("\n")).to.be.false;
    });

    it("starts editing with the cursor at the end of the text", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(view.state.selection.main.head).to.equal(view.state.doc.length);
    });

    it("shows the cursor before the first character", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        view.dispatch({ selection: { anchor: 0 } });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const cursor = text.shadowRoot.querySelector(".cm-cursor").getBoundingClientRect();
        const scroller = text.shadowRoot.querySelector(".cm-scroller").getBoundingClientRect();
        expect(cursor.left).to.be.at.least(scroller.left);
    });

    it("discards the changes on Escape", async () => {
        const editor = await editorWith(SOURCE);
        let changes = 0;
        editor.addEventListener("change", () => changes++);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const text = cells(editor)[0];
        await text.updateComplete;
        const view = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        view.dispatch({ changes: { from: 0, insert: "Changed " }, selection: { anchor: 0, head: 7 } });

        const escape = new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, composed: true, cancelable: true });
        view.contentDOM.dispatchEvent(escape);
        await editor.updateComplete;
        expect(escape.defaultPrevented).to.be.true;
        expect(text.mode).to.equal("render");
        expect(changes).to.equal(0);
        expect(anon(editor.value)).to.equal(anon(SOURCE));

        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        await text.updateComplete;
        const reopened = EditorView.findFromDOM(text.shadowRoot.querySelector(".cm-editor"));
        expect(reopened.state.doc.toString()).to.equal("<% L = 6, q = 12.5 %>Span: <% L %> m");
    });

    for (const init of [{ key: "Enter" }, { key: "Enter", ctrlKey: true }, { key: "F2" }]) {
        it(`starts editing with ${init.ctrlKey ? "Ctrl+" : ""}${init.key}`, async () => {
            const editor = await editorWith(SOURCE);
            const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
            editor.dispatchEvent(event);
            await editor.updateComplete;
            expect(event.defaultPrevented).to.be.true;
            expect(cells(editor)[0].mode).to.equal("edit");
        });
    }

    it("shows a sheet of 100 lines, or `rows` lines", async () => {
        const editor = await editorWith(SOURCE);
        expect(cells(editor)).to.have.length(100);
        editor.rows = 5;
        await editor.updateComplete;
        expect(cells(editor)).to.have.length(5);
        editor.rows = 1;
        await editor.updateComplete;
        expect(cells(editor)).to.have.length(2);
    });

    it("scrolls to keep the selected line in view", async () => {
        const editor = await editorWith(SOURCE);
        editor.style.height = "200px";
        for (let i = 0; i < 30; i++) editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        await editor.updateComplete;
        const box = editor.getBoundingClientRect();
        const line = cells(editor)[30].getBoundingClientRect();
        expect(editor.scrollTop).to.be.greaterThan(0);
        expect(line.top).to.be.at.least(box.top);
        expect(line.bottom).to.be.at.most(box.bottom);
    });

    it("adds an empty line to the document when written in", async () => {
        const editor = await editorWith(SOURCE);
        const key = (init) => editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));
        for (let i = 0; i < 3; i++) key({ key: "ArrowDown" });
        key({ key: "Enter", ctrlKey: true });
        await editor.updateComplete;
        const line = cells(editor)[3];
        await line.updateComplete;
        const view = EditorView.findFromDOM(line.shadowRoot.querySelector(".cm-editor"));
        view.dispatch({ changes: { from: 0, insert: "Load: <% q %>" } });
        key({ key: "Enter", ctrlKey: true });
        await editor.rendered;
        await editor.updateComplete;
        expect(anon(editor.value)).to.equal(anon(`${SOURCE}<!--{ mdn3 : markdown }-->\n<!--{ mdn3 : markdown }-->\nLoad: <% q %>`));
        expect(cells(editor)[3].output).to.equal("Load: 12.5");
        expect(cells(editor)).to.have.length(100);
    });

    describe("cell actions", () => {
        const key = (editor, init) => {
            const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
            editor.dispatchEvent(event);
            return event;
        };
        const clipboard = (editor, type, text) => {
            const clipboardData = new DataTransfer();
            if (text !== undefined) clipboardData.setData("text/plain", text);
            const event = new ClipboardEvent(type, { clipboardData, cancelable: true });
            editor.dispatchEvent(event);
            return event;
        };
        const settle = async (editor) => {
            await editor.rendered;
            await editor.updateComplete;
        };
        const FORMULA = "<!--{ mdn3 : markdown }-->\n<% q * L ^ 2 / 8 %>\n";

        for (const name of ["Delete", "Backspace"]) {
            it(`deletes the selected cell with ${name}`, async () => {
                const editor = await editorWith(SOURCE);
                let changes = 0;
                editor.addEventListener("change", () => changes++);
                expect(key(editor, { key: name }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(FORMULA));
                expect(changes).to.equal(1);
                expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
            });
        }

        it("does nothing on Delete below the document", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            for (let i = 0; i < 5; i++) key(editor, { key: "ArrowDown" });
            key(editor, { key: "Delete" });
            await settle(editor);
            expect(changes).to.equal(0);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        for (const init of [{ key: "Insert" }, { key: "Enter", altKey: true }]) {
            it(`inserts an empty cell below with ${init.altKey ? "Alt+" : ""}${init.key} and selects it`, async () => {
                const editor = await editorWith(SOURCE);
                expect(key(editor, init).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ mdn3 : markdown", "<!--{ mdn3 : markdown }-->\n<!--{ mdn3 : markdown")));
                expect(cells(editor)[1].selected).to.be.true;
                expect(cells(editor)[1].mode).to.equal("render");
                expect(cells(editor)[2].output.trim()).to.equal("56.25");
            });
        }

        it("inserts an empty cell above with Alt+Shift+Enter and selects it", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ mdn3 : markdown", "<!--{ mdn3 : markdown }-->\n<!--{ mdn3 : markdown")));
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("leaves Shift+Insert, Ctrl+Insert and Shift+Delete to the browser", async () => {
            const editor = await editorWith(SOURCE);
            for (const init of [
                { key: "Insert", shiftKey: true },
                { key: "Insert", ctrlKey: true },
                { key: "Delete", shiftKey: true },
            ]) {
                expect(key(editor, init).defaultPrevented).to.be.false;
            }
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("only moves down on Insert below the last cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Insert" });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[2].selected).to.be.true;
        });

        it("drops empty cells at the end of the document", async () => {
            const editor = await editorWith(SOURCE + "<!--{ txt2 : text }-->\n");
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Delete" });
            expect(anon(editor.value)).to.equal(anon(SOURCE.slice(0, -FORMULA.length)));
        });

        it("gives a marker to a cell without one that is no longer first", async () => {
            const editor = await editorWith("Intro\n");
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon("<!--{ mdn3 : markdown }-->\n<!--{ txt2 : text }-->\nIntro\n"));
        });

        it("copies the selected cell with its marker", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "copy");
            expect(event.defaultPrevented).to.be.true;
            expect(anon(event.clipboardData.getData("text/plain"))).to.equal(anon(FORMULA));
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("cuts the selected cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "cut");
            await settle(editor);
            expect(anon(event.clipboardData.getData("text/plain"))).to.equal(anon(FORMULA));
            expect(anon(editor.value)).to.equal(anon(SOURCE.slice(0, -FORMULA.length)));
        });

        it("pastes a copied cell in place of the selected one", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const copied = clipboard(editor, "copy").clipboardData.getData("text/plain");
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", copied);
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE + FORMULA));
            expect(cells(editor)[2].output.trim()).to.equal("56.25");
        });

        it("pastes plain text as a text cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace(FORMULA, "<!--{ txt2 : text }-->\nLoad: <% q %>")));
            expect(cells(editor)[1].output).to.equal("Load: 12.5");
        });

        it("undoes and redoes cell actions", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            key(editor, { key: "Delete" });
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            const changed = editor.value;
            expect(anon(changed)).to.equal(anon("<!--{ mdn3 : markdown }-->\n" + FORMULA));
            expect(key(editor, { key: "z", ctrlKey: true }).defaultPrevented).to.be.true;
            expect(anon(editor.value)).to.equal(anon(FORMULA));
            key(editor, { key: "z", metaKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[0].output).to.equal("Span: 6 m\n");
            key(editor, { key: "z", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(SOURCE));

            key(editor, { key: "Z", ctrlKey: true, shiftKey: true });
            expect(anon(editor.value)).to.equal(anon(FORMULA));
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));
            expect(changes).to.equal(6);
        });

        it("undoes an edit and selects the edited cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            key(editor, { key: "ArrowUp" });
            key(editor, { key: "z", ctrlKey: true });
            await settle(editor);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("forgets the changes to undo when a new change is made or the value is set", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Delete" });
            key(editor, { key: "z", ctrlKey: true });
            key(editor, { key: "Insert" });
            const changed = editor.value;
            key(editor, { key: "y", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(changed));

            editor.value = SOURCE;
            key(editor, { key: "z", ctrlKey: true });
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        describe("on several cells", () => {
            const A = "<!--{ alf2 : text }-->\nA\n";
            const B = "<!--{ brv3 : text }-->\nB\n";
            const C = "<!--{ chl4 : text }-->\nC\n";
            const selected = (editor) => cells(editor).flatMap((c, i) => (c.selected ? [i] : []));

            it("selects several cells with Shift+ArrowDown/ArrowUp and Shift+click", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", shiftKey: true });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
                key(editor, { key: "ArrowUp", shiftKey: true });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1]);
                key(editor, { key: "ArrowDown" });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([2]);

                cells(editor)[0].dispatchEvent(new MouseEvent("click", { shiftKey: true }));
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
                cells(editor)[1].click();
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);
            });

            it("edits only the last selected cell", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "Enter" });
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);
                expect(cells(editor)[1].mode).to.equal("edit");
            });

            it("deletes, copies and cuts the selected cells", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", shiftKey: true });
                expect(anon(clipboard(editor, "copy").clipboardData.getData("text/plain"))).to.equal(anon(B + C));
                key(editor, { key: "Delete" });
                expect(anon(editor.value)).to.equal(anon(A));
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);

                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                expect(selected(editor)).to.deep.equal([1, 2]);
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", shiftKey: true });
                expect(anon(clipboard(editor, "cut").clipboardData.getData("text/plain"))).to.equal(anon(A + B + C));
                expect(anon(editor.value)).to.equal(anon(""));
            });

            it("pastes over the selected cells and selects the pasted ones", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                clipboard(editor, "paste", C + C + C);
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(C + C + C + C));
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
            });

            it("inserts below and above the selected cells", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "Insert" });
                expect(anon(editor.value)).to.equal(anon(A + B + "<!--{ mdn3 : markdown }-->\n" + C));
                key(editor, { key: "ArrowUp", shiftKey: true });
                key(editor, { key: "Enter", altKey: true, shiftKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + "<!--{ mdn3 : markdown }-->\n" + B + "<!--{ mdn3 : markdown }-->\n" + C));
                expect(selected(editor)).to.deep.equal([1]);
            });
        });

        describe("moving cells", () => {
            const A = "<!--{ alf2 : text }-->\nA\n";
            const B = "<!--{ brv3 : text }-->\nB\n";
            const C = "<!--{ chl4 : text }-->\nC\n";
            const selected = (editor) => cells(editor).flatMap((c, i) => (c.selected ? [i] : []));

            it("moves the selected cell with Alt+ArrowDown/ArrowUp", async () => {
                const editor = await editorWith(A + B + C);
                expect(key(editor, { key: "ArrowDown", altKey: true }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(anon(editor.value)).to.equal(anon(B + A + C));
                expect(selected(editor)).to.deep.equal([1]);
                expect(cells(editor)[1].output).to.equal("A\n");
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B + C));
            });

            it("moves several selected cells together", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(C + A + B));
                expect(selected(editor)).to.deep.equal([1, 2]);
            });

            it("moves the last cell down onto the empty lines and back", async () => {
                const editor = await editorWith(A + B);
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + "<!--{ mdn3 : markdown }-->\n<!--{ mdn3 : markdown }-->\n" + B));
                key(editor, { key: "ArrowUp", altKey: true });
                key(editor, { key: "ArrowUp", altKey: true });
                expect(anon(editor.value)).to.equal(anon(A + B));
            });

            it("only moves the selection below the document and stops at the last line", async () => {
                const editor = await editorWith(A);
                editor.rows = 3;
                await editor.updateComplete;
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A));
                expect(selected(editor)).to.deep.equal([2]);
            });

            it("undoes a move", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(anon(editor.value)).to.equal(anon(A + B + C));
                expect(selected(editor)).to.deep.equal([0]);
            });
        });

        it("leaves the clipboard to the cell while editing", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Enter" });
            await editor.updateComplete;
            expect(clipboard(editor, "copy").defaultPrevented).to.be.false;
            expect(clipboard(editor, "paste", "x").defaultPrevented).to.be.false;
        });

        it("leaves text selected in the output to the browser", async () => {
            const editor = await editorWith(SOURCE);
            const view = cells(editor)[0].shadowRoot.querySelector(".view");
            document.getSelection().selectAllChildren(view);
            const event = clipboard(editor, "copy");
            document.getSelection().removeAllRanges();
            expect(event.defaultPrevented).to.be.false;
        });
    });

    describe("margins", () => {
        const NOTES = `<!--{ mdn3 : markdown }-->
First line
<!--{ mdn3 : markdown }-->
Second line <!--[ On line 2 ]-->
<!--[ Also on line 2 ]-->
<!--{ txt2 : text }-->
Third line
`;
        // The comment count shown in the right margin of each of the first lines
        const counts = (editor) =>
            [...editor.shadowRoot.querySelectorAll(".margin.right")]
                .slice(0, 3)
                .map((margin) => margin.querySelector(".comment-count")?.textContent.trim() ?? "");
        const countButton = (editor, index) =>
            editor.shadowRoot.querySelectorAll(".margin.right")[index].querySelector(".comment-count");

        it("rules a left and a right margin on every line", async () => {
            const editor = await editorWith(SOURCE);
            const lines = editor.rows;
            expect(editor.shadowRoot.querySelectorAll(".margin.left")).to.have.length(lines);
            expect(editor.shadowRoot.querySelectorAll(".margin.right")).to.have.length(lines);
        });

        it("shows the number of comments in each cell's source", async () => {
            const editor = await editorWith(NOTES);
            expect(counts(editor)).to.deep.equal(["", "2", ""]);
        });

        it("keeps the comments with their cell when it moves", async () => {
            const editor = await editorWith(NOTES);
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true }));
            await editor.updateComplete;
            expect(counts(editor)).to.deep.equal(["2", "", ""]);
        });

        it("reports a line's comments on a click on their icon", async () => {
            const editor = await editorWith(NOTES);
            let detail = null;
            editor.addEventListener("comments-click", (e) => (detail = e.detail));
            countButton(editor, 1).click();
            await editor.updateComplete;
            expect(detail).to.deep.equal({ line: 2, comments: ["On line 2", "Also on line 2"] });
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("reports the selected line's comments on Shift+F2", async () => {
            const editor = await editorWith(NOTES);
            const details = [];
            editor.addEventListener("comments-click", (e) => details.push(e.detail));
            const key = (options) =>
                editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...options }));
            key({ key: "ArrowDown" });
            key({ key: "F2", shiftKey: true });
            key({ key: "ArrowDown" });
            key({ key: "F2", shiftKey: true });
            await editor.updateComplete;
            expect(details).to.deep.equal([
                { line: 2, comments: ["On line 2", "Also on line 2"] },
                { line: 3, comments: [] },
            ]);
            expect(cells(editor).some((cell) => cell.mode === "edit")).to.be.false;
        });

        it("reports the selected line when another one is selected", async () => {
            const editor = await editorWith(NOTES);
            const lines = [];
            editor.addEventListener("selection-change", (e) => lines.push(e.detail.line));
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
            await editor.updateComplete;
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }));
            await editor.updateComplete;
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", shiftKey: true }));
            await editor.updateComplete;
            expect(lines).to.deep.equal([2, 3]);
        });

        it("numbers every line in the left margin, also the empty ones", async () => {
            const editor = await editorWith(SOURCE);
            const numbers = [...editor.shadowRoot.querySelectorAll(".margin.left .line-number")].map((m) => m.textContent);
            expect(numbers).to.have.length(100);
            expect(numbers.slice(0, 3)).to.deep.equal(["1", "2", "3"]);
            expect(numbers.slice(8, 11)).to.deep.equal(["9", "10", "11"]);
            expect(numbers.at(-1)).to.equal("100");
        });

        it("selects a line on a click in its left margin", async () => {
            const editor = await editorWith(SOURCE);
            editor.shadowRoot.querySelectorAll(".margin.left")[1].click();
            await editor.updateComplete;
            expect(cells(editor)[1].selected).to.be.true;
            expect(cells(editor)[0].selected).to.be.false;
        });
    });

    describe("cell types", () => {
        const key = (editor, key, options = {}) =>
            editor.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...options }));
        const typeButton = (editor, index) => editor.shadowRoot.querySelectorAll(".type-button")[index];
        const menu = (editor) => editor.shadowRoot.querySelector(".type-menu");
        const items = (editor) => [...menu(editor).querySelectorAll("li")];

        it("shows the type of each cell in its left margin", async () => {
            const editor = await editorWith(SOURCE + "<!--{ crt4 : chart }-->\ndata\n");
            const titles = [0, 1, 2, 3].map((i) => typeButton(editor, i).title);
            expect(titles).to.deep.equal(["Text", "Markdown", "chart (unknown type)", "Markdown"]);
        });

        it("opens the menu of types on a click on the icon, with the type checked", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 1).click();
            await editor.updateComplete;
            expect(cells(editor)[1].selected).to.be.true;
            expect(items(editor).map((li) => li.textContent.trim())).to.deep.equal(["Text", "Markdown"]);
            expect(items(editor).map((li) => li.getAttribute("aria-checked"))).to.deep.equal(["false", "true"]);

            typeButton(editor, 1).click();
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
        });

        it("changes the type on a click in the menu, keeping the source", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 0).click();
            await editor.updateComplete;
            items(editor)[1].click();
            await editor.rendered;
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
            expect(anon(editor.value)).to.equal(anon(SOURCE.replace("<!--{ txt2 : text }-->", "<!--{ mdn3 : markdown }-->")));
        });

        it("opens the menu with Mod+/ and picks a type with the arrows and Enter", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "/", { ctrlKey: true });
            await editor.updateComplete;
            expect(menu(editor)).to.exist;
            key(editor, "ArrowDown");
            await editor.updateComplete;
            expect(items(editor)[1].classList.contains("active")).to.be.true;
            key(editor, "ArrowDown");
            await editor.updateComplete;
            expect(items(editor)[0].classList.contains("active")).to.be.true;
            key(editor, "ArrowUp");
            key(editor, "Enter");
            await editor.rendered;
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(cells(editor)[0].localName).to.equal("texl-cell-markdown");
        });

        it("picks a type by its first letter, and closes with Escape without a change", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "/", { metaKey: true });
            key(editor, "m");
            await editor.updateComplete;
            expect(items(editor)[1].classList.contains("active")).to.be.true;
            key(editor, "Delete");
            key(editor, "Escape");
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("closes the menu on a press outside it", async () => {
            const editor = await editorWith(SOURCE);
            typeButton(editor, 0).click();
            await editor.updateComplete;
            document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
            await editor.updateComplete;
            expect(menu(editor)).to.be.null;
        });

        it("changes all the selected cells, and undoes the change", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, "ArrowDown", { shiftKey: true });
            key(editor, "/", { ctrlKey: true });
            key(editor, "Home");
            key(editor, "Enter");
            await editor.rendered;
            await editor.updateComplete;
            expect(cells(editor).slice(0, 2).map((c) => c.localName)).to.deep.equal(["texl-cell-text", "texl-cell-text"]);
            key(editor, "z", { ctrlKey: true });
            await editor.updateComplete;
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });

        it("gives the first cell a marker when its type changes", async () => {
            const editor = await editorWith("Hello\n");
            key(editor, "/", { ctrlKey: true });
            key(editor, "End");
            key(editor, "Enter");
            await editor.updateComplete;
            expect(anon(editor.value)).to.equal(anon("<!--{ mdn3 : markdown }-->\nHello\n"));
        });

        it("leaves an empty line below the document empty when its type changes", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            typeButton(editor, 3).click();
            await editor.updateComplete;
            items(editor)[0].click();
            await editor.updateComplete;
            expect(changes).to.equal(0);
            expect(anon(editor.value)).to.equal(anon(SOURCE));
        });
    });

    describe("cell names", () => {
        const names = (editor) => [...editor.value.matchAll(/<!--\{ (\S+) : /g)].map((match) => match[1]);
        const key = (editor, init) => editor.dispatchEvent(new KeyboardEvent("keydown", { cancelable: true, ...init }));
        const paste = (editor, text) => {
            const clipboardData = new DataTransfer();
            clipboardData.setData("text/plain", text);
            editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData, cancelable: true }));
        };

        it("names the cells read without a name", async () => {
            const editor = await editorWith("<!--{ markdown }-->\nA\n<!--% text %-->\nB\n");
            const [first, second] = names(editor);
            expect(first).to.match(/^[a-z0-9]{4}$/);
            expect(second).to.match(/^[a-z0-9]{4}$/);
            expect(first).to.not.equal(second);
        });

        it("names new cells, unlike the others", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Insert" });
            key(editor, { key: "Insert" });
            expect(new Set(names(editor)).size).to.equal(4);
        });

        it("gives new names to pasted copies, and keeps them on a cut and paste", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "ArrowDown" });
            paste(editor, SOURCE);
            const [a, b, c, d] = names(editor);
            expect([a, b]).to.deep.equal(["txt2", "mdn3"]);
            expect(new Set([a, b, c, d]).size).to.equal(4);

            const moved = await editorWith(SOURCE);
            key(moved, { key: "ArrowDown" });
            key(moved, { key: "ArrowDown" });
            paste(moved, "<!--{ mdn3 : markdown }-->\nA\n");
            expect(new Set(names(moved)).size).to.equal(3);
            paste(moved, "<!--{ new5 : markdown }-->\nA\n<!--{ NEW5 : markdown }-->\nB\n");
            expect(names(moved)[2]).to.equal("new5");
            expect(new Set(names(moved).map((name) => name.toLowerCase())).size).to.equal(4);
        });

        it("keeps clashing names and reports them with name-conflict", async () => {
            const editor = await fixture(html`<texl-editor></texl-editor>`);
            const reported = [];
            editor.addEventListener("name-conflict", (e) => reported.push(e.detail.conflicts));
            const source = "<!--{ abc2 : text }-->\nA\n<!--{ xyz3 : text }-->\nB\n<!--{ ABC2 : text }-->\nC\n";
            editor.value = source;
            expect(editor.value).to.equal(source);
            expect(reported).to.deep.equal([[{ name: "abc2", lines: [1, 3] }]]);
            // The same clash is not reported again
            key(editor, { key: "Insert" });
            expect(reported).to.have.length(1);
            editor.value = source;
            expect(reported).to.have.length(2);
        });

        it("reports nothing for a document with unique names", async () => {
            const editor = await fixture(html`<texl-editor></texl-editor>`);
            let reported = false;
            editor.addEventListener("name-conflict", () => (reported = true));
            editor.value = SOURCE;
            expect(reported).to.be.false;
        });
    });

    it("shows unknown cell types as text and keeps their type", async () => {
        const source = "<!--{ crt4 : chart }-->\nsome data\n";
        const editor = await editorWith(source);
        expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        expect(anon(editor.value)).to.equal(anon(source));
    });
});
