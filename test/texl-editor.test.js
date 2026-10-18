import { expect, fixture, html } from "@open-wc/testing";
import "../src/index.js";

const SOURCE = `<!--% data | text %-->
<% L = 6, q = 12.5 %>Span: <% L %> m
<!--% M | formula %-->
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
            "texl-cell-formula",
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
        expect(editor.value).to.equal(SOURCE);
    });

    it("edits a formula without <% %> and updates the document", async () => {
        const editor = await editorWith(SOURCE);
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await editor.updateComplete;
        const formula = cells(editor)[1];
        await formula.updateComplete;
        const input = formula.shadowRoot.querySelector("input");
        expect(input.value).to.equal("q * L ^ 2 / 8");

        input.value = "q * L";
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true, cancelable: true }),
        );
        await editor.rendered;
        await editor.updateComplete;
        expect(editor.value).to.contain("<% q * L %>");
        expect(cells(editor)[1].mode).to.equal("render");
        expect(cells(editor)[1].output.trim()).to.equal("75");
    });

    it("shows unknown cell types as text and keeps their type", async () => {
        const source = "<!--% t | chart %-->\nsome data\n";
        const editor = await editorWith(source);
        expect(cells(editor)[0].localName).to.equal("texl-cell-text");
        expect(editor.value).to.equal(source);
    });
});
