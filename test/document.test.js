import { expect } from "@open-wc/testing";
import {
    parseDocument,
    serializeDocument,
    splitRendering,
    parseMarker,
    formatMarker,
    cellComments,
    cellName,
    nameCells,
    nameConflicts,
} from "../src/document.js";

describe("parseMarker", () => {
    it("reads the name and the type", () => {
        expect(parseMarker(" dkl6 : table ")).to.deep.equal({ name: "dkl6", type: "table" });
    });

    it("reads a marker without name", () => {
        expect(parseMarker(" table ")).to.deep.equal({ type: "table" });
    });

    it("defaults the type to text", () => {
        expect(parseMarker(" dkl6 : ")).to.deep.equal({ name: "dkl6", type: "text" });
        expect(parseMarker("  ")).to.deep.equal({ type: "text" });
    });
});

describe("formatMarker", () => {
    it("writes the name and the type", () => {
        expect(formatMarker({ name: "dkl6", type: "markdown" })).to.equal("<!--{ dkl6 : markdown }-->");
    });

    it("writes only the type of a cell without name", () => {
        expect(formatMarker({ type: "markdown" })).to.equal("<!--{ markdown }-->");
    });
});

describe("cellName", () => {
    it("is four lowercase letters and digits", () => {
        for (let i = 0; i < 100; i++) expect(cellName()).to.match(/^[a-z][a-z][a-z][2-9]$/);
    });
});

describe("nameCells", () => {
    it("names every cell with a marker, uniquely", () => {
        const cells = nameCells(Array.from({ length: 50 }, () => ({ type: "text", texl: "" })));
        const names = cells.map((cell) => cell.name);
        expect(new Set(names).size).to.equal(50);
    });

    it("keeps existing names, even when they clash", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "" },
            { name: "ABC2", type: "text", texl: "" },
        ];
        expect(nameCells(cells)).to.equal(cells);
    });

    it("leaves the leading cell without marker unnamed", () => {
        const [first, second] = nameCells([
            { type: "text", marker: false, texl: "Intro\n" },
            { type: "text", texl: "" },
        ]);
        expect(first.name).to.be.undefined;
        expect(second.name).to.match(/^[a-z0-9]{4}$/);
    });
});

describe("nameConflicts", () => {
    it("lists the names of more than one cell, without case, with their lines", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "" },
            { name: "xyz3", type: "text", texl: "" },
            { name: "ABC2", type: "text", texl: "" },
        ];
        expect(nameConflicts(cells)).to.deep.equal([{ name: "abc2", lines: [1, 3] }]);
    });

    it("finds none in a document with unique names", () => {
        expect(nameConflicts(nameCells([{ type: "text", texl: "" }, { type: "text", texl: "" }]))).to.deep.equal([]);
    });
});

describe("parseDocument", () => {
    it("opens a plain Texl file as one text cell", () => {
        expect(parseDocument("Hi <% name %>\n")).to.deep.equal([
            { type: "text", marker: false, texl: "Hi <% name %>\n" },
        ]);
    });

    it("splits the document at marker lines", () => {
        const cells = parseDocument("<!--{ abc2 : text }-->\n# Title\n<!--{ xyz3 : markdown }-->\n<% 1 + 2 %>\n");
        expect(cells).to.deep.equal([
            { name: "abc2", type: "text", texl: "# Title\n" },
            { name: "xyz3", type: "markdown", texl: "<% 1 + 2 %>\n" },
        ]);
    });

    it("keeps text before the first marker", () => {
        const cells = parseDocument("preamble\n<!--{ abc2 : text }-->\nbody\n");
        expect(cells.map((c) => c.texl)).to.deep.equal(["preamble\n", "body\n"]);
        expect(cells[0].marker).to.equal(false);
    });

    it("ignores other HTML comments", () => {
        const cells = parseDocument("<!-- note -->\n<!--[ comment ]-->\ntext\n");
        expect(cells).to.have.length(1);
    });

    it("reads older markers, without their name", () => {
        const cells = parseDocument("<!--% markdown %-->\nA\n<!--% loads | table %-->\nB\n");
        expect(cells).to.deep.equal([
            { type: "markdown", texl: "A\n" },
            { type: "table", texl: "B\n" },
        ]);
    });
});

describe("cellComments", () => {
    it("lists the text of every cell comment in a cell, trimmed", () => {
        const texl = "<!--[ first ]-->\nText <!--[second]--> and <% x %>\n<!--[\n  third,\n  on lines\n]-->\n";
        expect(cellComments(texl)).to.deep.equal(["first", "second", "third,\n  on lines"]);
    });

    it("ignores other HTML comments", () => {
        expect(cellComments("Text <!-- note --> <!--{ abc2 : text }--> <!--[ comment ]-->\n")).to.deep.equal([
            "comment",
        ]);
    });

    it("finds none in a cell without comments", () => {
        expect(cellComments("Text <% x %>\n")).to.deep.equal([]);
    });
});

describe("serializeDocument", () => {
    const sources = [
        "",
        "Hi <% name %>\n",
        "<!--{ abc2 : text }-->\n# Title\n<!--{ xyz3 : markdown }-->\n<% 1 + 2 %>\n",
        "preamble\n<!--{ abc2 : text }-->\nbody",
        "<!--{ abc2 : text }-->\n<!--{ abc2 : text }-->\nbody",
        "<!--{ text }-->\nbody",
    ];
    for (const source of sources) {
        it(`round-trips ${JSON.stringify(source)}`, () => {
            expect(serializeDocument(parseDocument(source))).to.equal(source);
        });
    }

    it("ends every cell but the last with a line break", () => {
        const cells = [
            { name: "abc2", type: "text", texl: "one" },
            { name: "xyz3", type: "text", texl: "two" },
        ];
        expect(serializeDocument(cells)).to.equal("<!--{ abc2 : text }-->\none\n<!--{ xyz3 : text }-->\ntwo");
    });

    it("writes older markers in the new form", () => {
        expect(serializeDocument(parseDocument("<!--% markdown %-->\nA\n"))).to.equal("<!--{ markdown }-->\nA\n");
    });
});

describe("splitRendering", () => {
    const a = { name: "abc2", type: "text", texl: "A\n" };
    const b = { name: "xyz3", type: "markdown", texl: "B\n" };

    it("splits at the cells' marker lines", () => {
        const rendering = "<!--{ abc2 : text }-->\nA out\n<!--{ xyz3 : markdown }-->\nB out\n";
        expect(splitRendering(rendering, [a, b])).to.deep.equal(["A out\n", "B out\n"]);
    });

    it("gives the text before the first marker to the leading cell", () => {
        const lead = { type: "text", texl: "pre\n", marker: false };
        expect(splitRendering("pre out\n<!--{ abc2 : text }-->\nA out", [lead, a])).to.deep.equal([
            "pre out\n",
            "A out",
        ]);
    });

    it("reads other markers as content", () => {
        // An imported editor document brings its own markers in
        const rendering =
            "<!--{ abc2 : text }-->\n<!--{ lib5 : text }-->\nlib\n<!--{ xyz3 : markdown }-->\nB out";
        expect(splitRendering(rendering, [a, b])).to.deep.equal(["<!--{ lib5 : text }-->\nlib\n", "B out"]);
    });

    it("matches the markers in order", () => {
        // The second marker of the import is the same as the first cell's
        const rendering = "<!--{ abc2 : text }-->\nx\n<!--{ abc2 : text }-->\ny\n<!--{ xyz3 : markdown }-->\nB";
        expect(splitRendering(rendering, [a, b])).to.deep.equal(["x\n<!--{ abc2 : text }-->\ny\n", "B"]);
    });

    it("matches markers at the start of a line only", () => {
        const rendering = "<!--{ abc2 : text }-->\nsee <!--{ xyz3 : markdown }-->\n<!--{ xyz3 : markdown }-->\nB";
        expect(splitRendering(rendering, [a, b])).to.deep.equal(["see <!--{ xyz3 : markdown }-->\n", "B"]);
    });

    it("gives the text of a missing marker to the last cell found", () => {
        const c = { name: "pim4", type: "text", texl: "C\n" };
        // A tag from the first cell to the second swallowed the second marker
        const rendering = "<!--{ abc2 : text }-->\nA and B\n<!--{ pim4 : text }-->\nC out\n";
        expect(splitRendering(rendering, [a, b, c])).to.deep.equal(["A and B\n", "", "C out\n"]);
    });

    it("gives no output to cells before the first marker found", () => {
        expect(splitRendering("broken", [a, b])).to.deep.equal(["", ""]);
    });

    it("drops the line break that serializeDocument adds", () => {
        const one = { name: "abc2", type: "text", texl: "one" };
        const two = { name: "xyz3", type: "text", texl: "two" };
        const rendering = serializeDocument([one, two, b]);
        expect(splitRendering(rendering, [one, two, b])).to.deep.equal(["one", "two", "B\n"]);
    });

    it("keeps the line breaks of the cells", () => {
        const cells = [a, { ...b, texl: "B\n\n" }, { name: "pim4", type: "text", texl: "" }, a];
        expect(splitRendering(serializeDocument(cells), cells)).to.deep.equal(["A\n", "B\n\n", "", "A\n"]);
    });

    it("reads cells without name", () => {
        const cells = [{ type: "text", texl: "x" }, { type: "text", texl: "y" }];
        expect(splitRendering(serializeDocument(cells), cells)).to.deep.equal(["x", "y"]);
    });
});
