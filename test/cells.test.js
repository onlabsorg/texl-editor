import { expect, fixture, html, unsafeStatic } from "@open-wc/testing";
import { EditorView } from "@codemirror/view";
import { swanTokens, findTags } from "../src/swan.js";
import "../src/index.js";

async function cellInEditMode(tag, texl) {
    const element = await fixture(html`<${unsafeStatic(tag)} .texl=${texl}></${unsafeStatic(tag)}>`);
    element.mode = "edit";
    await element.updateComplete;
    return [element, EditorView.findFromDOM(element.shadowRoot.querySelector(".cm-editor"))];
}

function ctrlSpace(view) {
    const event = new KeyboardEvent("keydown", {
        key: " ", code: "Space", keyCode: 32, ctrlKey: true, bubbles: true, cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);
    return event;
}

describe("cell rendering", () => {
    it("shows the output of a text cell as HTML, not Markdown", async () => {
        const cell = await fixture(html`<texl-cell-text .output=${"**a** <em>b</em>"}></texl-cell-text>`);
        const view = cell.shadowRoot.querySelector(".view");
        expect(view.textContent).to.equal("**a** b");
        expect(view.querySelector("em")).to.exist;
        expect(view.querySelector("strong")).to.be.null;
    });

    it("shows the output of a markdown cell as Markdown", async () => {
        const cell = await fixture(html`<texl-cell-markdown .output=${"**a**"}></texl-cell-markdown>`);
        expect(cell.shadowRoot.querySelector(".view strong").textContent).to.equal("a");
    });

    it("sanitises the output", async () => {
        const cell = await fixture(html`<texl-cell-text .output=${'<img src="x" onerror="alert(1)">'}></texl-cell-text>`);
        expect(cell.shadowRoot.querySelector("img").hasAttribute("onerror")).to.be.false;
    });
});

describe("Swan highlighting", () => {
    it("finds tags up to the first %>, and unclosed tags to the end", () => {
        expect(findTags("a <% x %> b <% y")).to.deep.equal([
            { from: 2, to: 9, closed: true },
            { from: 12, to: 16, closed: false },
        ]);
    });

    it("splits Swan into tokens", () => {
        const source = 'x = "a", n.f 1.5e3 ? TRUE ; {k: 2} # note';
        const types = swanTokens(source).map(({ from, to, type }) => [source.slice(from, to), type]);
        expect(types).to.deep.equal([
            ["x", "definition"], ["=", "operator"], ['"a"', "string"], [",", "operator"],
            [".", "operator"], ["f", "property"], ["1.5e3", "number"], ["?", "operator"],
            ["TRUE", "atom"], [";", "operator"], ["{", "bracket"], ["k", "property"],
            [":", "operator"], ["2", "number"], ["}", "bracket"], ["# note", "comment"],
        ]);
    });

    for (const tag of ["texl-cell-text", "texl-cell-markdown"]) {
        it(`highlights the tags in a ${tag}`, async () => {
            const [cell] = await cellInEditMode(tag, "# Title\nSpan <% L = 6 %> m\n");
            const root = cell.shadowRoot;
            expect(root.querySelector(".cm-texl-tag").textContent).to.equal("<% L = 6 %>");
            expect(root.querySelector(".cm-swan-definition").textContent).to.equal("L");
            expect(root.querySelector(".cm-swan-number").textContent).to.equal("6");
        });
    }

    it("highlights a whole expression cell as Swan", async () => {
        const [cell] = await cellInEditMode("texl-cell-expression", "<% q * 2 %>\n");
        expect(cell.shadowRoot.querySelector(".cm-swan-number").textContent).to.equal("2");
        expect(cell.shadowRoot.querySelector(".cm-texl-tag")).to.be.null;
    });
});

describe("Ctrl+Space", () => {
    it("inserts a tag with the cursor between the delimiters", async () => {
        const [, view] = await cellInEditMode("texl-cell-text", "Span: \n");
        expect(ctrlSpace(view).defaultPrevented).to.be.true;
        expect(view.state.doc.toString()).to.equal("Span: <%  %>");
        expect(view.state.selection.main.head).to.equal("Span: <% ".length);
    });

    it("puts the selected text in a tag", async () => {
        const [, view] = await cellInEditMode("texl-cell-markdown", "Span: L\n");
        view.dispatch({ selection: { anchor: 6, head: 7 } });
        ctrlSpace(view);
        expect(view.state.doc.toString()).to.equal("Span: <% L %>");
        expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).to.equal("L");
    });

    it("does nothing in an expression cell", async () => {
        const [, view] = await cellInEditMode("texl-cell-expression", "<% q %>\n");
        ctrlSpace(view);
        expect(view.state.doc.toString()).to.equal(" q ");
    });
});
