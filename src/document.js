// Parsing and serialization of a Texl document as a stack of cells.
//
// A document is one Texl text file. Each cell starts with a marker line:
//
//     <!--% type %-->
//
// followed by the cell body: the Texl source the cell produced, up to the
// next marker line. Text before the first marker is a cell without marker
// (type "text"), so a plain Texl file opens as a single text cell. Cells
// have no name: they are known by their line number in the editor.
//
// The marker syntax is a draft: see docs/design.md.

const MARKER = /^<!--%(.*?)%-->[ \t]*$/;

/**
 * A cell of a document.
 * @typedef {object} CellData
 * @property {string} type - The cell type, e.g. "text" or "markdown".
 * @property {string} texl - The Texl source of the cell body.
 * @property {boolean} [marker] - False for the leading cell without marker.
 */

/**
 * Parses the text of a marker (between `<!--%` and `%-->`). Older markers
 * had a name before the type (`name | type`): the name is ignored.
 * @param {string} inner
 * @returns {{type: string}}
 */
export function parseMarker(inner) {
    const type = inner.split("|").at(-1).trim();
    return { type: type || "text" };
}

/**
 * Formats a cell marker line.
 * @param {{type: string}} cell
 * @returns {string}
 */
export function formatMarker({ type }) {
    return `<!--% ${type} %-->`;
}

/**
 * Splits a document into cells.
 * @param {string} source - The document text.
 * @returns {CellData[]}
 */
export function parseDocument(source) {
    const cells = [];
    let current = null;
    let body = [];
    const flush = () => {
        if (current) cells.push({ ...current, texl: body.join("") });
        body = [];
    };
    for (const line of source.split(/(?<=\n)/)) {
        const match = MARKER.exec(line.replace(/\r?\n$/, ""));
        if (match) {
            if (current || body.length > 0) {
                current ??= { type: "text", marker: false };
                flush();
            }
            current = parseMarker(match[1]);
        } else {
            body.push(line);
        }
    }
    if (current || body.length > 0) {
        current ??= { type: "text", marker: false };
        flush();
    }
    return cells;
}

/**
 * Joins cells into a document.
 * @param {CellData[]} cells
 * @returns {string}
 */
export function serializeDocument(cells) {
    return cells
        .map((cell, i) => {
            let texl = cell.texl;
            if (texl && i < cells.length - 1 && !texl.endsWith("\n")) texl += "\n";
            return cell.marker === false ? texl : formatMarker(cell) + "\n" + texl;
        })
        .join("");
}
