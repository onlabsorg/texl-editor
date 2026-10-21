import { expect } from "@open-wc/testing";
import { parseDocument, serializeDocument, parseMarker, formatMarker, cellComments } from "../src/document.js";

describe("parseMarker", () => {
    it("reads the type", () => {
        expect(parseMarker(" table ")).to.deep.equal({ type: "table" });
    });

    it("ignores the name of an older marker", () => {
        expect(parseMarker(" loads | table ")).to.deep.equal({ type: "table" });
    });

    it("defaults the type to text", () => {
        expect(parseMarker("  ")).to.deep.equal({ type: "text" });
    });
});

describe("formatMarker", () => {
    it("writes only the type", () => {
        expect(formatMarker({ type: "expression" })).to.equal("<!--% expression %-->");
    });
});

describe("parseDocument", () => {
    it("opens a plain Texl file as one text cell", () => {
        expect(parseDocument("Hi <% name %>\n")).to.deep.equal([
            { type: "text", marker: false, texl: "Hi <% name %>\n" },
        ]);
    });

    it("splits the document at marker lines", () => {
        const cells = parseDocument(
            "<!--% text %-->\n# Title\n<!--% expression %-->\n<% 1 + 2 %>\n",
        );
        expect(cells).to.deep.equal([
            { type: "text", texl: "# Title\n" },
            { type: "expression", texl: "<% 1 + 2 %>\n" },
        ]);
    });

    it("keeps text before the first marker", () => {
        const cells = parseDocument("preamble\n<!--% text %-->\nbody\n");
        expect(cells.map((c) => c.texl)).to.deep.equal(["preamble\n", "body\n"]);
        expect(cells[0].marker).to.equal(false);
    });

    it("ignores ordinary HTML comments", () => {
        const cells = parseDocument("<!-- note -->\ntext\n");
        expect(cells).to.have.length(1);
    });
});

describe("cellComments", () => {
    it("lists the text of every HTML comment in a cell, trimmed", () => {
        const texl = "<!-- first -->\nText <!--second--> and <% x %>\n<!--\n  third,\n  on lines\n-->\n";
        expect(cellComments(texl)).to.deep.equal(["first", "second", "third,\n  on lines"]);
    });

    it("finds none in a cell without comments", () => {
        expect(cellComments("Text <% x %>\n")).to.deep.equal([]);
    });

    it("never counts the cell's marker", () => {
        const [cell] = parseDocument("<!--% markdown %-->\nText <!-- note -->\n");
        expect(cellComments(cell.texl)).to.deep.equal(["note"]);
    });
});

describe("serializeDocument", () => {
    const sources = [
        "",
        "Hi <% name %>\n",
        "<!--% text %-->\n# Title\n<!--% expression %-->\n<% 1 + 2 %>\n",
        "preamble\n<!--% text %-->\nbody",
        "<!--% text %-->\n<!--% text %-->\nbody",
    ];
    for (const source of sources) {
        it(`round-trips ${JSON.stringify(source)}`, () => {
            expect(serializeDocument(parseDocument(source))).to.equal(source);
        });
    }

    it("ends every cell but the last with a line break", () => {
        const cells = [
            { type: "text", texl: "one" },
            { type: "text", texl: "two" },
        ];
        expect(serializeDocument(cells)).to.equal(
            "<!--% text %-->\none\n<!--% text %-->\ntwo",
        );
    });
});
