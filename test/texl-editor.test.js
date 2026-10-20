import { expect, fixture, html } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import "../src/index.js";

const SOURCE = `<!--% data | text %-->
<% L = 6, q = 12.5 %>Span: <% L %> m
<!--% M | expression %-->
<% q * L ^ 2 / 8 %>
`;

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
            "texl-cell-expression",
        ]);
    });

    it("renders cells in one shared scope", async () => {
        const editor = await editorWith(SOURCE);
        const [text, expression] = cells(editor);
        await expression.updateComplete;
        expect(text.output).to.equal("Span: 6 m\n");
        expect(expression.shadowRoot.textContent.trim()).to.equal("56.25");
    });

    it("returns the document unchanged", async () => {
        const editor = await editorWith(SOURCE);
        expect(editor.value).to.equal(SOURCE);
    });

    it("edits an expression without <% %> and updates the document", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const expression = cells(editor)[1];
        await expression.updateComplete;
        const view = EditorView.findFromDOM(expression.shadowRoot.querySelector(".cm-editor"));
        expect(view.state.doc.toString()).to.equal(" q * L ^ 2 / 8 ");

        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: " q * L " } });
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
        expect(editor.value).to.equal(SOURCE);
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
        expect(editor.value).to.equal(SOURCE);

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
        expect(editor.value).to.equal(`${SOURCE}<!--%  | text %-->\n<!--%  | text %-->\nLoad: <% q %>`);
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
        const EXPRESSION = "<!--% M | expression %-->\n<% q * L ^ 2 / 8 %>\n";

        for (const name of ["Delete", "Backspace"]) {
            it(`deletes the selected cell with ${name}`, async () => {
                const editor = await editorWith(SOURCE);
                let changes = 0;
                editor.addEventListener("change", () => changes++);
                expect(key(editor, { key: name }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(editor.value).to.equal(EXPRESSION);
                expect(changes).to.equal(1);
                expect(cells(editor)[0].localName).to.equal("texl-cell-expression");
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
            expect(editor.value).to.equal(SOURCE);
        });

        for (const init of [{ key: "Insert" }, { key: "Enter", altKey: true }]) {
            it(`inserts an empty cell below with ${init.altKey ? "Alt+" : ""}${init.key} and selects it`, async () => {
                const editor = await editorWith(SOURCE);
                expect(key(editor, init).defaultPrevented).to.be.true;
                await settle(editor);
                expect(editor.value).to.equal(SOURCE.replace("<!--% M", "<!--%  | text %-->\n<!--% M"));
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
            expect(editor.value).to.equal(SOURCE.replace("<!--% M", "<!--%  | text %-->\n<!--% M"));
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
            expect(editor.value).to.equal(SOURCE);
        });

        it("only moves down on Insert below the last cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Insert" });
            await settle(editor);
            expect(editor.value).to.equal(SOURCE);
            expect(cells(editor)[2].selected).to.be.true;
        });

        it("drops empty cells at the end of the document", async () => {
            const editor = await editorWith(SOURCE + "<!--%  | text %-->\n");
            key(editor, { key: "ArrowDown" });
            key(editor, { key: "Delete" });
            expect(editor.value).to.equal(SOURCE.slice(0, -EXPRESSION.length));
        });

        it("gives a marker to a cell without one that is no longer first", async () => {
            const editor = await editorWith("Intro\n");
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            await settle(editor);
            expect(editor.value).to.equal("<!--%  | text %-->\n<!--%  | text %-->\nIntro\n");
        });

        it("copies the selected cell with its marker", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "copy");
            expect(event.defaultPrevented).to.be.true;
            expect(event.clipboardData.getData("text/plain")).to.equal(EXPRESSION);
            expect(editor.value).to.equal(SOURCE);
        });

        it("cuts the selected cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const event = clipboard(editor, "cut");
            await settle(editor);
            expect(event.clipboardData.getData("text/plain")).to.equal(EXPRESSION);
            expect(editor.value).to.equal(SOURCE.slice(0, -EXPRESSION.length));
        });

        it("pastes a copied cell in place of the selected one", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            const copied = clipboard(editor, "copy").clipboardData.getData("text/plain");
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", copied);
            await settle(editor);
            expect(editor.value).to.equal(SOURCE + EXPRESSION);
            expect(cells(editor)[2].output.trim()).to.equal("56.25");
        });

        it("pastes plain text as a text cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            await settle(editor);
            expect(editor.value).to.equal(SOURCE.replace(EXPRESSION, "<!--%  | text %-->\nLoad: <% q %>"));
            expect(cells(editor)[1].output).to.equal("Load: 12.5");
        });

        it("undoes and redoes cell actions", async () => {
            const editor = await editorWith(SOURCE);
            let changes = 0;
            editor.addEventListener("change", () => changes++);
            key(editor, { key: "Delete" });
            key(editor, { key: "Enter", altKey: true, shiftKey: true });
            const changed = editor.value;
            expect(changed).to.equal("<!--%  | text %-->\n" + EXPRESSION);
            expect(key(editor, { key: "z", ctrlKey: true }).defaultPrevented).to.be.true;
            expect(editor.value).to.equal(EXPRESSION);
            key(editor, { key: "z", metaKey: true });
            await settle(editor);
            expect(editor.value).to.equal(SOURCE);
            expect(cells(editor)[0].output).to.equal("Span: 6 m\n");
            key(editor, { key: "z", ctrlKey: true });
            expect(editor.value).to.equal(SOURCE);

            key(editor, { key: "Z", ctrlKey: true, shiftKey: true });
            expect(editor.value).to.equal(EXPRESSION);
            key(editor, { key: "y", ctrlKey: true });
            expect(editor.value).to.equal(changed);
            key(editor, { key: "y", ctrlKey: true });
            expect(editor.value).to.equal(changed);
            expect(changes).to.equal(6);
        });

        it("undoes an edit and selects the edited cell", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "ArrowDown" });
            clipboard(editor, "paste", "Load: <% q %>");
            key(editor, { key: "ArrowUp" });
            key(editor, { key: "z", ctrlKey: true });
            await settle(editor);
            expect(editor.value).to.equal(SOURCE);
            expect(cells(editor)[1].selected).to.be.true;
        });

        it("forgets the changes to undo when a new change is made or the value is set", async () => {
            const editor = await editorWith(SOURCE);
            key(editor, { key: "Delete" });
            key(editor, { key: "z", ctrlKey: true });
            key(editor, { key: "Insert" });
            const changed = editor.value;
            key(editor, { key: "y", ctrlKey: true });
            expect(editor.value).to.equal(changed);

            editor.value = SOURCE;
            key(editor, { key: "z", ctrlKey: true });
            expect(editor.value).to.equal(SOURCE);
        });

        describe("on several cells", () => {
            const A = "<!--% a | text %-->\nA\n";
            const B = "<!--% b | text %-->\nB\n";
            const C = "<!--% c | text %-->\nC\n";
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
                expect(clipboard(editor, "copy").clipboardData.getData("text/plain")).to.equal(B + C);
                key(editor, { key: "Delete" });
                expect(editor.value).to.equal(A);
                await editor.updateComplete;
                expect(selected(editor)).to.deep.equal([1]);

                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(editor.value).to.equal(A + B + C);
                expect(selected(editor)).to.deep.equal([1, 2]);
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowUp" });
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", shiftKey: true });
                expect(clipboard(editor, "cut").clipboardData.getData("text/plain")).to.equal(A + B + C);
                expect(editor.value).to.equal("");
            });

            it("pastes over the selected cells and selects the pasted ones", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                clipboard(editor, "paste", C + C + C);
                await editor.updateComplete;
                expect(editor.value).to.equal(C + C + C + C);
                expect(selected(editor)).to.deep.equal([0, 1, 2]);
            });

            it("inserts below and above the selected cells", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "Insert" });
                expect(editor.value).to.equal(A + B + "<!--%  | text %-->\n" + C);
                key(editor, { key: "ArrowUp", shiftKey: true });
                key(editor, { key: "Enter", altKey: true, shiftKey: true });
                await editor.updateComplete;
                expect(editor.value).to.equal(A + "<!--%  | text %-->\n" + B + "<!--%  | text %-->\n" + C);
                expect(selected(editor)).to.deep.equal([1]);
            });
        });

        describe("moving cells", () => {
            const A = "<!--% a | text %-->\nA\n";
            const B = "<!--% b | text %-->\nB\n";
            const C = "<!--% c | text %-->\nC\n";
            const selected = (editor) => cells(editor).flatMap((c, i) => (c.selected ? [i] : []));

            it("moves the selected cell with Alt+ArrowDown/ArrowUp", async () => {
                const editor = await editorWith(A + B + C);
                expect(key(editor, { key: "ArrowDown", altKey: true }).defaultPrevented).to.be.true;
                await settle(editor);
                expect(editor.value).to.equal(B + A + C);
                expect(selected(editor)).to.deep.equal([1]);
                expect(cells(editor)[1].output).to.equal("A\n");
                key(editor, { key: "ArrowUp", altKey: true });
                expect(editor.value).to.equal(A + B + C);
                key(editor, { key: "ArrowUp", altKey: true });
                expect(editor.value).to.equal(A + B + C);
            });

            it("moves several selected cells together", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", shiftKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(editor.value).to.equal(C + A + B);
                expect(selected(editor)).to.deep.equal([1, 2]);
            });

            it("moves the last cell down onto the empty lines and back", async () => {
                const editor = await editorWith(A + B);
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                expect(editor.value).to.equal(A + "<!--%  | text %-->\n<!--%  | text %-->\n" + B);
                key(editor, { key: "ArrowUp", altKey: true });
                key(editor, { key: "ArrowUp", altKey: true });
                expect(editor.value).to.equal(A + B);
            });

            it("only moves the selection below the document and stops at the last line", async () => {
                const editor = await editorWith(A);
                editor.rows = 3;
                await editor.updateComplete;
                key(editor, { key: "ArrowDown" });
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "ArrowDown", altKey: true });
                await editor.updateComplete;
                expect(editor.value).to.equal(A);
                expect(selected(editor)).to.deep.equal([2]);
            });

            it("undoes a move", async () => {
                const editor = await editorWith(A + B + C);
                key(editor, { key: "ArrowDown", altKey: true });
                key(editor, { key: "z", ctrlKey: true });
                await editor.updateComplete;
                expect(editor.value).to.equal(A + B + C);
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

    it("shows unknown cell types as text and keeps their type", async () => {
        const source = "<!--% t | chart %-->\nsome data\n";
        const editor = await editorWith(source);
        expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        expect(editor.value).to.equal(source);
    });
});
