// Swan syntax highlighting for the CodeMirror cell editors, and the
// commands that insert a tag or a comment.
//
// Highlighting is a layer of mark decorations over the editor's own
// language: Texl finds its tags before anything else reads the text, so a
// tag is highlighted wherever it is, also inside Markdown code blocks.

import { EditorSelection, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

/** The delimiters of a Texl tag. */
export const TAG_OPEN = "<%";
export const TAG_CLOSE = "%>";

// One token per match, tried in order. Two-character operators come before
// their one-character prefixes, as in the Swan lexer.
const TOKEN = new RegExp(
    [
        /(?<comment>#[^\n]*)/,
        /(?<string>"[^"]*"?)/,
        /(?<number>\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
        /(?<name>[\p{L}_][\p{L}\p{N}_]*)/,
        /(?<operator>==|!=|<=|>=|->|<<|>>|=>|~>|[\^*/%+\-<>&|?;=:,!$.])/,
        /(?<bracket>[()[\]{}])/,
    ]
        .map((re) => re.source)
        .join("|"),
    "gu",
);

const mark = (name) => Decoration.mark({ class: `cm-swan-${name}` });
const MARKS = {
    comment: mark("comment"),
    string: mark("string"),
    number: mark("number"),
    atom: mark("atom"),
    definition: mark("definition"),
    property: mark("property"),
    operator: mark("operator"),
    bracket: mark("bracket"),
};
const TAG = Decoration.mark({ class: "cm-texl-tag" });
const DELIMITER = Decoration.mark({ class: "cm-texl-delimiter" });

/**
 * Splits Swan source into highlighted tokens.
 * @param {string} source
 * @returns {{from: number, to: number, type: string}[]} token offsets in
 *   `source` and their type (a key of `MARKS`)
 */
export function swanTokens(source) {
    const tokens = [];
    for (const match of source.matchAll(TOKEN)) {
        const from = match.index;
        const to = from + match[0].length;
        let type = Object.keys(match.groups).find((group) => match.groups[group] !== undefined);
        if (type === "name") type = nameType(source, from, to);
        if (type) tokens.push({ from, to, type });
    }
    return tokens;
}

// A name is a constant (TRUE, FALSE), a member (`ns.name`), a label
// (`{name: ...}`) or a name being bound (`name = ...`); other names keep the
// text color.
function nameType(source, from, to) {
    const name = source.slice(from, to);
    if (name === "TRUE" || name === "FALSE") return "atom";
    if (/\.\s*$/.test(source.slice(0, from))) return "property";
    const after = source.slice(to);
    if (/^\s*:/.test(after)) return "property";
    if (/^\s*=(?![=>])/.test(after)) return "definition";
    return null;
}

/**
 * Finds the Texl tags in a template: each starts at `<%` and ends at the
 * first `%>` after it, or at the end of the text if it is not closed.
 * @param {string} text
 * @returns {{from: number, to: number, closed: boolean}[]}
 */
export function findTags(text) {
    const tags = [];
    let from = text.indexOf(TAG_OPEN);
    while (from >= 0) {
        const close = text.indexOf(TAG_CLOSE, from + TAG_OPEN.length);
        const closed = close >= 0;
        const to = closed ? close + TAG_CLOSE.length : text.length;
        tags.push({ from, to, closed });
        from = text.indexOf(TAG_OPEN, to);
    }
    return tags;
}

function addTokens(builder, source, offset) {
    for (const { from, to, type } of swanTokens(source)) {
        builder.add(offset + from, offset + to, MARKS[type]);
    }
}

function tagDecorations(doc) {
    const text = doc.toString();
    const builder = new RangeSetBuilder();
    for (const { from, to, closed } of findTags(text)) {
        const bodyFrom = from + TAG_OPEN.length;
        const bodyTo = closed ? to - TAG_CLOSE.length : to;
        builder.add(from, to, TAG);
        builder.add(from, bodyFrom, DELIMITER);
        addTokens(builder, text.slice(bodyFrom, bodyTo), bodyFrom);
        if (closed) builder.add(bodyTo, to, DELIMITER);
    }
    return builder.finish();
}

function highlighter(decorate) {
    return ViewPlugin.fromClass(
        class {
            constructor(view) {
                this.decorations = decorate(view.state.doc);
            }
            update(update) {
                if (update.docChanged) this.decorations = decorate(update.state.doc);
            }
        },
        { decorations: (plugin) => plugin.decorations },
    );
}

const theme = EditorView.baseTheme({
    ".cm-texl-tag": { backgroundColor: "rgb(124 58 237 / 0.07)" },
    ".cm-texl-delimiter": { color: "#7c3aed", fontWeight: "bold" },
    ".cm-swan-comment": { color: "#6b7280", fontStyle: "italic" },
    ".cm-swan-string": { color: "#a31515" },
    ".cm-swan-number": { color: "#116644" },
    ".cm-swan-atom": { color: "#221199" },
    ".cm-swan-definition": { color: "#0000ff" },
    ".cm-swan-property": { color: "#00509e" },
    ".cm-swan-operator": { color: "#7c3aed" },
    ".cm-swan-bracket": { color: "#555" },
});

/** Highlights the Swan expressions in the `<% %>` tags of a template. */
export function swanTags() {
    return [highlighter(tagDecorations), theme];
}

/**
 * Command: puts `<%  %>` around each selection, or at the cursor, and
 * leaves the cursor (or the selected text) between the delimiters.
 * @param {EditorView} view
 */
export function insertTag(view) {
    return wrapSelections(view, `${TAG_OPEN} `, ` ${TAG_CLOSE}`);
}

/**
 * Command: puts a cell comment, `<!--[  ]-->`, around each selection, or at
 * the cursor, and leaves the cursor (or the selected text) inside it.
 * @param {EditorView} view
 */
export function insertComment(view) {
    return wrapSelections(view, "<!--[ ", " ]-->");
}

function wrapSelections(view, open, close) {
    view.dispatch(
        view.state.changeByRange((range) => {
            const text = view.state.sliceDoc(range.from, range.to);
            const from = range.from + open.length;
            return {
                changes: { from: range.from, to: range.to, insert: open + text + close },
                range: EditorSelection.range(from, from + text.length),
            };
        }),
        { scrollIntoView: true, userEvent: "input" },
    );
    return true;
}
