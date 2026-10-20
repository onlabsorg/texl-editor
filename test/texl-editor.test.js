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
        expect(cells(editor).map((c) => c.localName)).to.deep.equal([
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
        expect(text.output).to.equal("Span: 6 m\n\nLoad: 12.5");
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
        expect(reopened.state.doc.toString()).to.equal(cells(editor)[0].texl);
    });

    it("shows unknown cell types as text and keeps their type", async () => {
        const source = "<!--% t | chart %-->\nsome data\n";
        const editor = await editorWith(source);
        expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        expect(editor.value).to.equal(source);
    });
});
