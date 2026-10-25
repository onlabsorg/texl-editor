// Parsing and serialization of a Texl document as a stack of cells.
//
// A document is one Texl text file. Each cell starts with a marker line:
//
//     <!--{ name : type }-->
//
// followed by the cell body: the Texl source the cell produced, up to the
// next marker line. Text before the first marker is a cell without marker
// (type "text"), so a plain Texl file opens as a single text cell.
//
// The name identifies the cell, e.g. as a fragment identifier: four
// lowercase letters and digits, compared without case. The editor gives one
// to every cell with a marker (`nameCells`). Names edited by hand may clash:
// `nameConflicts` finds them, and the editor only reports them.
//
// Older markers, `<!--% type %-->`, are read too and written in the new form.

const MARKER = /^<!--\{(.*?)\}-->[ \t]*$/;
const OLD_MARKER = /^<!--%(.*?)%-->[ \t]*$/;

/**
 * A cell of a document.
 * @typedef {object} CellData
 * @property {string} type - The cell type, e.g. "text" or "markdown".
 * @property {string} texl - The Texl source of the cell body.
 * @property {string} [name] - The cell name, e.g. "bak7".
 * @property {boolean} [marker] - False for the leading cell without marker.
 */

/**
 * Parses the text of a marker (between `<!--{` and `}-->`): a name and a
 * type, separated by a colon. A marker without colon has only the type.
 * @param {string} inner
 * @returns {{type: string, name?: string}}
 */
export function parseMarker(inner) {
    const colon = inner.indexOf(":");
    const type = inner.slice(colon + 1).trim() || "text";
    const name = colon >= 0 ? inner.slice(0, colon).trim() : "";
    return name ? { name, type } : { type };
}

/**
 * Formats a cell marker line.
 * @param {{type: string, name?: string}} cell
 * @returns {string}
 */
export function formatMarker({ name, type }) {
    return name ? `<!--{ ${name} : ${type} }-->` : `<!--{ ${type} }-->`;
}

/** The letters of a name: consonants and vowels, without the l (like a 1). */
const CONSONANTS = "bcdfghjkmnprstvz";
const VOWELS = "aeiou";
/** The digit at the end of a name: 0 and 1 look like o and l. */
const DIGITS = "23456789";

/**
 * A new random cell name: a syllable and a digit, e.g. "bak7", easy to
 * read out and to remember.
 * @returns {string}
 */
export function cellName() {
    const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
    return pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS) + pick(DIGITS);
}

/**
 * Gives a new name to every cell with a marker but no name, unique in the
 * document (without case); `taken` are names in use elsewhere. Cells that
 * have a name keep it, also when it clashes. Returns `cells` itself if no
 * cell needs a name.
 * @param {CellData[]} cells
 * @param {Iterable<string>} [taken]
 * @returns {CellData[]}
 */
export function nameCells(cells, taken = []) {
    if (cells.every((cell) => cell.name || cell.marker === false)) return cells;
    const names = new Set([...taken, ...cells.map((cell) => cell.name)].filter(Boolean).map((name) => name.toLowerCase()));
    return cells.map((cell) => {
        if (cell.name || cell.marker === false) return cell;
        let name;
        do name = cellName();
        while (names.has(name));
        names.add(name);
        return { ...cell, name };
    });
}

/**
 * The names given to more than one cell, compared without case, with the
 * lines (from 1) of the cells that have them.
 * @param {CellData[]} cells
 * @returns {{name: string, lines: number[]}[]}
 */
export function nameConflicts(cells) {
    const lines = new Map();
    cells.forEach((cell, i) => {
        if (!cell.name) return;
        const key = cell.name.toLowerCase();
        if (!lines.has(key)) lines.set(key, { name: cell.name, lines: [] });
        lines.get(key).lines.push(i + 1);
    });
    return [...lines.values()].filter((conflict) => conflict.lines.length > 1);
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
        const text = line.replace(/\r?\n$/, "");
        const match = MARKER.exec(text);
        const old = !match && OLD_MARKER.exec(text);
        if (match || old) {
            if (current || body.length > 0) {
                current ??= { type: "text", marker: false };
                flush();
            }
            // An older marker may have a name before the type, `name | type`: it is dropped
            current = match ? parseMarker(match[1]) : { type: old[1].split("|").at(-1).trim() || "text" };
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
 * The comments of a cell: the text of every cell comment (`<!--[ ... ]-->`)
 * in its body, trimmed. Other HTML comments are not cell comments. A
 * comment has no structure: hosts may give it one with their own syntax.
 * @param {string} texl - The Texl source of the cell body.
 * @returns {string[]}
 */
export function cellComments(texl) {
    return [...texl.matchAll(/<!--\[([\s\S]*?)\]-->/g)].map((match) => match[1].trim());
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

/**
 * The position of a marker line in a rendering, searching from `from`: the
 * marker at the start of a line and alone on it. Returns the start of the
 * line and the end of the line with its line break, or null.
 * @param {string} rendering
 * @param {string} marker
 * @param {number} from
 * @returns {{start: number, end: number} | null}
 */
function findMarkerLine(rendering, marker, from) {
    for (let start = rendering.indexOf(marker, from); start >= 0; start = rendering.indexOf(marker, start + 1)) {
        if (start > 0 && rendering[start - 1] !== "\n") continue;
        const rest = /^[ \t]*(\r?\n|$)/.exec(rendering.slice(start + marker.length));
        if (rest) return { start, end: start + marker.length + rest[0].length };
    }
    return null;
}

/**
 * Splits the rendering of a whole document (`serializeDocument(cells)`)
 * into the outputs of its cells, at the cells' own marker lines, which
 * rendering leaves as they are.
 *
 * Only the expected markers count, in order: marker i is searched after
 * marker i - 1, so other marker lines in the rendering (e.g. of an imported
 * document) are content. A marker can go missing when a tag opens in one
 * cell and closes in a later one: the text up to the next marker found then
 * goes to the last cell whose marker was found, and the cells whose marker
 * is missing get an empty output. The line break that `serializeDocument`
 * adds to a cell is not part of its output.
 * @param {string} rendering
 * @param {CellData[]} cells
 * @returns {string[]}
 */
export function splitRendering(rendering, cells) {
    const outputs = cells.map(() => "");
    // The cell that gets the text from `pos` on; text before the first marker has none unless the first cell has no marker
    let owner = cells[0]?.marker === false ? 0 : -1;
    let pos = 0;
    cells.forEach((cell, i) => {
        if (cell.marker === false) return;
        const line = findMarkerLine(rendering, formatMarker(cell), pos);
        if (!line) return;
        if (owner >= 0) outputs[owner] += rendering.slice(pos, line.start);
        owner = i;
        pos = line.end;
    });
    if (owner >= 0) outputs[owner] += rendering.slice(pos);
    return outputs.map((output, i) => {
        const texl = cells[i].texl;
        const added = texl && i < cells.length - 1 && !texl.endsWith("\n");
        return added && output.endsWith("\n") ? output.slice(0, -1) : output;
    });
}
