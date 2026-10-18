import { expect } from "@open-wc/testing";
import { parseDocument, serializeDocument, parseMarker } from "../src/document.js";

describe("parseMarker", () => {
    it("reads name and type", () => {
        expect(parseMarker(" loads | table ")).to.deep.equal({ name: "loads", type: "table" });
    });

    it("defaults the type to text", () => {
        expect(parseMarker(" intro ")).to.deep.equal({ name: "intro", type: "text" });
    });
});

describe("parseDocument", () => {
    it("opens a plain Texl file as one text cell", () => {
        expect(parseDocument("Hi <% name %>\n")).to.deep.equal([
            { type: "text", name: "", marker: false, texl: "Hi <% name %>\n" },
        ]);
    });

    it("splits the document at marker lines", () => {
        const cells = parseDocument(
            "<!--% intro | text %-->\n# Title\n<!--% x | formula %-->\n<% 1 + 2 %>\n",
        );
        expect(cells).to.deep.equal([
            { name: "intro", type: "text", texl: "# Title\n" },
            { name: "x", type: "formula", texl: "<% 1 + 2 %>\n" },
        ]);
    });

    it("keeps text before the first marker", () => {
        const cells = parseDocument("preamble\n<!--% a | text %-->\nbody\n");
        expect(cells.map((c) => c.texl)).to.deep.equal(["preamble\n", "body\n"]);
        expect(cells[0].marker).to.equal(false);
    });

    it("ignores ordinary HTML comments", () => {
        const cells = parseDocument("<!-- note -->\ntext\n");
        expect(cells).to.have.length(1);
    });
});

describe("serializeDocument", () => {
    const sources = [
        "",
        "Hi <% name %>\n",
        "<!--% intro | text %-->\n# Title\n<!--% x | formula %-->\n<% 1 + 2 %>\n",
        "preamble\n<!--% a | text %-->\nbody",
    ];
    for (const source of sources) {
        it(`round-trips ${JSON.stringify(source)}`, () => {
            expect(serializeDocument(parseDocument(source))).to.equal(source);
        });
    }

    it("ends every cell but the last with a line break", () => {
        const cells = [
            { name: "a", type: "text", texl: "one" },
            { name: "b", type: "text", texl: "two" },
        ];
        expect(serializeDocument(cells)).to.equal(
            "<!--% a | text %-->\none\n<!--% b | text %-->\ntwo",
        );
    });
});
