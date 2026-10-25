# API reference

*The public API of `@onlabsorg/texl-editor` 0.0.x, for developers who embed
the editor in a page or app, or write their own cell types. Everything below
is exported by the package entry point (`src/index.js`) unless noted. The
API is young and will change before 1.0.*

- [Importing](#importing)
- [`<texl-editor>`](#texl-editor) — the editor element
- [`TexlCell`](#texlcell) — base class of all cells
- [`TextCell`](#textcell) and [`MarkdownCell`](#markdowncell) — built-in cells
- [Cell registry](#cell-registry) — `registerCell`, `cellTagName`,
  `cellClass`, `cellTypes`
- [Document functions](#document-functions) — parse, serialise, names,
  comments, split a rendering
- [Engine](#engine) — `createEngine`
- [Swan helpers](#swan-helpers) — CodeMirror extensions and commands
- [Styling](#styling) — CSS custom properties and parts
- [Keyboard](#keyboard)

See also: [the guide](guide.md) for a step-by-step introduction and
[the architecture](architecture.md) for how the parts fit together.

## Importing

```js
import "@onlabsorg/texl-editor";            // defines <texl-editor> and the built-in cells
import { TexlCell, registerCell } from "@onlabsorg/texl-editor";
```

Importing the entry point has side effects: it registers `TextCell` and
`MarkdownCell` and defines the custom element `texl-editor` (unless already
defined). The cell modules are also exported on their own, without side
effects:

```js
import { TextCell } from "@onlabsorg/texl-editor/cells/text-cell.js";
import { MarkdownCell } from "@onlabsorg/texl-editor/cells/markdown-cell.js";
```

The package is plain ES modules. Use it with a bundler or dev server that
resolves bare imports (e.g. Vite) and serve the page over HTTP: Texl loads a
WebAssembly file. With Vite, exclude Texl from dependency pre-bundling (see
[the guide](guide.md#2-configure-vite)).

## `<texl-editor>`

Class: `TexlEditor` (extends `LitElement`). Tag: `texl-editor`.

```html
<texl-editor url="https://example.com/docs/report.texl" rows="50"></texl-editor>
```

The editor shows a document as a sheet of lined paper: one cell per line,
with a left margin (line number and type icon) and a right margin (comment
count). It owns the document: set it with `value`, read it back from `value`.

### Properties and attributes

| Property  | Attribute  | Type             | Default | Description |
|-----------|------------|------------------|---------|-------------|
| `value`   | —          | `string`         | `""`    | The document text. Setting it parses the document, names unnamed cells, resets selection and undo history, and starts a rendering pass. Reading it serialises the current cells. |
| `url`     | `url`      | `string`         | `"untitled.texl"` | The URL of the document, resolved against the page URL. The document renders as the document at this URL: relative `texl.import` URIs resolve against its folder. It may change at any time: the editor renders again. The default puts an unsaved document in the page's folder. |
| `rows`    | `rows`     | `number`         | `100`   | Lines on the sheet. The sheet shows more if the document has more cells. |
| `rendered`| —          | `Promise<void>`  | resolved | The current rendering pass. Await it after setting `value` (or after a change) to read the rendered outputs. Read-only by convention. |

The element sets `tabindex="0"` on itself if it has none, so it can take
focus; call `editor.focus()` to give it the keyboard.

The editor scrolls its own lines (`overflow-y: auto`): give it a height
(e.g. with flexbox or `height: 80vh`) to get a scrollbar that keeps the
selected line in view.

### Events

All events bubble and are composed.

| Event              | `detail`                                   | Fired when |
|--------------------|--------------------------------------------|------------|
| `change`           | none (`Event`)                             | The cells changed by a user action: committed edit, insert, delete, move, paste, cut, type change, undo, redo. Not fired when `value` is set. Read `editor.value` for the new text. |
| `selection-change` | `{line}`                                   | The selected line changed. `line` counts from 1. Also fired on the first render (line 1). |
| `comments-click`   | `{line, comments}`                         | The user clicked a line's comment icon, or pressed Shift+F2 on the selected line (also when it has no comments). `comments` is an array of strings: the trimmed text of each cell comment `<!--[ ... ]-->`. |
| `name-conflict`    | `{conflicts}`                              | Several cells share a name (compared without case). Each conflict is `{name, lines}`, with `lines` counted from 1. Fired again only when the set of clashing names changes. The editor does not rename them. |

```js
editor.addEventListener("change", () => save(editor.value));
editor.addEventListener("comments-click", (e) => {
    showComments(e.detail.line, e.detail.comments);
});
editor.addEventListener("name-conflict", (e) => {
    for (const { name, lines } of e.detail.conflicts)
        console.warn(`"${name}" is used on lines ${lines.join(", ")}`);
});
```

### Rendering

After `value` is set and after every change, the editor renders the whole
document as the document at `url`, exactly as any other Texl host renders
it, and splits the rendering into the cells' outputs at their marker lines
(see [`splitRendering`](#splitrenderingrendering-cells--string)). Each cell
sees the names bound by the cells above it. Only the latest pass updates the
cells; `rendered` is its promise, and it never rejects: if `url` cannot be
resolved, the cells show no output. Errors in a cell never stop rendering:
they show as `[[Undefined]]`.

The editor creates its Texl engine on the first render, with no globals,
and frees it when it leaves the page. The engine caches nothing: every pass
fetches and renders the imported documents again (the browser's HTTP cache
still applies), so a changed imported document shows on the next pass.

## `TexlCell`

Base class of all cells (extends `LitElement`). A cell is a view of its Texl
source: the editor gives it `texl` and `output`, and the cell reports a new
source with an event when an edit is committed. Subclass it to write a cell
type; see [Writing a cell type](guide.md#7-write-your-own-cell-type).

### Static fields

| Field    | Type            | Description |
|----------|-----------------|-------------|
| `type`   | `string`        | The type written in the marker (`<!--{ name : type }-->`). Required by `registerCell`. |
| `label`  | `string`        | The type's name shown in the type menu and tooltips; the type if empty. |
| `icon`   | Lit `html` template | A 24×24 SVG drawn with strokes (`fill: none; stroke: currentColor` are set by the editor). Shown in the left margin and the type menu. |
| `styles` | Lit `css`       | The cell's styles: lined-paper layout, selected and edit looks. Extend it as `[TexlCell.styles, css`...`]`. |

### Properties

Set by the editor; a cell reads them and does not change them.

| Property   | Type      | Reflected | Description |
|------------|-----------|-----------|-------------|
| `texl`     | `string`  | no        | The cell's Texl source (the body after its marker). |
| `output`   | `string`  | no        | The text Texl rendered from `texl`. |
| `mode`     | `"render" \| "edit"` | yes (`mode` attribute) | Which of `renderView()` and `renderEditor()` is shown. |
| `selected` | `boolean` | yes (`selected` attribute) | Whether the line is selected. |
| `input`    | any       | no        | The widget's input while editing; not reactive. Set by `fromTexl`, read by `toTexl`. Its shape is up to the subclass. |

### Methods to override

| Method              | Default | Override to |
|---------------------|---------|-------------|
| `fromTexl(texl)`    | `this.input = texl` | Read the widget's input back from the Texl source. Called when the cell enters edit mode, before rendering. |
| `toTexl()`          | `this.input ?? ""` | Produce the Texl source for the current input. Called on commit. |
| `renderEditor()`    | a "no editor" notice | Return the editing widget (a Lit template). |
| `renderView()`      | `output` as HTML, sanitised with DOMPurify | Show the output differently (as `MarkdownCell` does). Always sanitise: documents are untrusted. |
| `focusEditor()`     | focuses the first `textarea` or `input` | Focus your widget when it is not one of those. Called after entering edit mode. |

### Methods to call

| Method                   | Description |
|--------------------------|-------------|
| `exitEdit(commit = true)` | Leaves edit mode. With `commit`, calls `toTexl()` and fires `cell-change` if the source changed; then fires `cell-exit`. The editor calls it on Ctrl+Enter (commit) and Escape (discard); a cell may call it itself, e.g. from a "Done" button. |

### Events fired

These are the commit protocol between a cell and the editor. Pages do not
normally listen to them; they listen to the editor's `change`.

| Event         | `detail` | Meaning |
|---------------|----------|---------|
| `cell-change` | `{texl}` | The committed edit produced a new Texl source. |
| `cell-exit`   | none     | The cell left edit mode; the editor takes the focus back. |

### Keys

The editor handles Ctrl+Enter (Cmd+Enter on macOS) and Escape in edit mode,
and the navigation keys outside it. A cell that handles a key itself must
call `preventDefault()` on the `keydown` event: the editor ignores events
that are already default-prevented.

## `TextCell`

Type `text`, label "Text". Extends `TexlCell`. A Texl template edited as
source in a CodeMirror 6 editor and shown as HTML. Also the fallback for
unregistered types: their source is shown and edited as text, and their type
is kept on save.

- The CodeMirror view exists only in edit mode. It keeps `input` up to date
  as the user types; the cursor starts at the end of the text.
- The line break that ends the cell body is kept out of `input` and added
  back by `toTexl()`.
- Keys: Ctrl+Space inserts a `<%  %>` tag, Shift+F2 a cell comment
  `<!--[  ]-->`, around the selection or at the cursor. Enter adds a line;
  Mod+Z / Mod+Shift+Z undo and redo inside the cell.

### Extension points

| Method                 | Description |
|------------------------|-------------|
| `languageExtensions()` | CodeMirror extensions for the input's language. The default is Swan highlighting of tags (`swanTags()`) and the keymap for Ctrl+Space and Shift+F2. Override to add a language, and include `super.languageExtensions()` to keep them. |
| `editorExtensions()`   | All CodeMirror extensions of the view: history, selection drawing, line wrapping, `languageExtensions()`, the default keymap (without Mod+Enter and Escape) and the listener that updates `input`. Override rarely. |

```js
import { TextCell, registerCell } from "@onlabsorg/texl-editor";
import { html as htmlLanguage } from "@codemirror/lang-html";  // npm install @codemirror/lang-html

class HtmlCell extends TextCell {
    static type = "html";
    static label = "HTML";
    languageExtensions() {
        return [htmlLanguage(), super.languageExtensions()];
    }
}
registerCell(HtmlCell);
```

## `MarkdownCell`

Type `markdown`, label "Markdown". Extends `TextCell`. Adds Markdown
highlighting in the editor (tags stay highlighted as Swan; Markdown does not
look inside them) and shows its output as Markdown, converted with `marked`
and sanitised with DOMPurify. New cells and empty lines are `markdown`.

## Cell registry

From `src/registry.js`.

### `registerCell(cellClass, tagName?)`

Registers a cell class under its static `type` and defines its custom
element, `texl-cell-<type>` by default. Throws if the class has no `type`.
Registering a type again maps it to the new tag; an already defined tag name
is not redefined. Register cells before setting the editor's `value`, or set
it again afterwards: the editor picks the element for each cell when it
renders.

```js
registerCell(QuantityCell);                       // <texl-cell-quantity>
registerCell(QuantityCell, "my-quantity-cell");   // custom tag name
```

### `cellTagName(type)`

Returns the tag name for a cell type, or the tag of the fallback type
(`text`) if the type is not registered.

### `cellClass(type)`

Returns the class registered for a type, or `undefined`.

### `cellTypes()`

Returns the registered types, in registration order. This is the order of
the type menu.

## Document functions

From `src/document.js`. Pure functions on the file format; the editor uses
them, and hosts can use them to work on documents without an editor (e.g.
on a server, in a preview, or to list comments).

### `CellData`

```ts
{
    type: string;      // "text", "markdown", ...
    texl: string;      // the cell body: Texl source after the marker line
    name?: string;     // e.g. "bak7"
    marker?: boolean;  // false only for a leading cell without marker
}
```

### `parseDocument(source) → CellData[]`

Splits a document into cells at marker lines `<!--{ name : type }-->`.
Text before the first marker is a `text` cell with `marker: false`. Older
markers `<!--% type %-->` are read too (without name).

```js
parseDocument("Intro\n<!--{ bek4 : markdown }-->\n# Title\n");
// [ { type: "text", marker: false, texl: "Intro\n" },
//   { type: "markdown", name: "bek4", texl: "# Title\n" } ]
```

### `serializeDocument(cells) → string`

Joins cells into a document; the inverse of `parseDocument`. The round trip
is exact for documents in the current format. Every cell but the last ends
with a line break.

### `parseMarker(inner) → {type, name?}`

Parses the text between `<!--{` and `}-->`. Without a colon, only the type;
an empty type is `text`.

### `formatMarker({type, name?}) → string`

Formats a marker line: `<!--{ bek4 : markdown }-->`, or
`<!--{ markdown }-->` without name.

### `cellName() → string`

A new random name: consonant, vowel, consonant, digit (`bak7`), without the
look-alikes `l`, `0` and `1`.

### `nameCells(cells, taken?) → CellData[]`

Gives a unique new name to every cell that has a marker but no name.
`taken` lists names in use elsewhere. Existing names are kept, even when
they clash. Returns `cells` itself when nothing needs a name.

### `nameConflicts(cells) → {name, lines}[]`

The names used by more than one cell (compared without case) and the lines
(from 1) of those cells.

### `cellComments(texl) → string[]`

The trimmed text of each cell comment `<!--[ ... ]-->` in a cell body.
Other HTML comments are not cell comments.

```js
for (const [i, cell] of parseDocument(source).entries())
    for (const comment of cellComments(cell.texl))
        console.log(`line ${i + 1}: ${comment}`);
```

### `splitRendering(rendering, cells) → string[]`

Splits the rendering of a whole document, `serializeDocument(cells)`, into
the outputs of its cells, at the cells' own marker lines, which rendering
leaves as they are. Marker *i* is searched after marker *i − 1*, at the
start of a line, so other marker lines (e.g. in the rendering of an
imported document) are content. The leading cell without marker gets the
text before the first marker. If a marker is missing (a tag that spans
cells swallowed it), the text goes to the last cell whose marker was found
and the cell gets `""`. The line break that `serializeDocument` adds to a
cell is not part of its output.

```js
const doc = await engine.render("report.texl", serializeDocument(cells));
const outputs = splitRendering(doc.rendering, cells);
```

## Engine

### `createEngine(globals?, baseUrl?) → Promise<TexlEngine>`

From `src/engine.js`. Loads the Texl WebAssembly module on first use and
returns a new `TexlEngine` from `@onlabsorg/texl`. `globals` is an object of
names visible to every template; `baseUrl` is the absolute URL that
relative document URLs resolve against (default: the page URL). The engine
holds configuration only: each rendering starts from a new scope and fetches
its imports again. Use it to render documents outside the editor with the
same module the editor loaded:

```js
import { createEngine, parseDocument, splitRendering } from "@onlabsorg/texl-editor";

const engine = await createEngine();
const doc = await engine.render("docs/report.texl", source);   // imports resolve in docs/
const outputs = splitRendering(doc.rendering, parseDocument(source));
```

See the [Texl primer](texl-primer.md#the-javascript-api-onlabsorgtexl) for
the engine API.

## Swan helpers

From `src/swan.js`, for cells that use CodeMirror.

| Export            | Description |
|-------------------|-------------|
| `swanTags()`      | CodeMirror extension: highlights the Swan code in every `<% %>` tag, wherever it is (also in Markdown code blocks). Classes `cm-texl-tag`, `cm-texl-delimiter`, `cm-swan-*`. |
| `insertTag(view)` | CodeMirror command: wraps each selection (or the cursor) in `<%  %>`. |
| `insertComment(view)` | CodeMirror command: wraps each selection (or the cursor) in `<!--[  ]-->`. |

`swanTokens`, `findTags`, `TAG_OPEN` and `TAG_CLOSE` are exported by
`src/swan.js` but not by the package entry point.

## Styling

The editor and cells use shadow DOM; style them with CSS custom properties
(set on `texl-editor` or an ancestor) and parts.

| Custom property             | Default                   | Used for |
|-----------------------------|---------------------------|----------|
| `--texl-paper`              | `#fff`                    | Sheet background |
| `--texl-line`               | `#e4e6ea`                 | Rules between lines |
| `--texl-line-height`        | `2rem`                    | Minimum height of a cell |
| `--texl-margin`             | `6rem`                    | Width of each margin |
| `--texl-margin-line`        | `#7aa2f0`                 | The vertical margin lines |
| `--texl-line-number`        | `#c4c8cf`                 | Line numbers |
| `--texl-line-number-active` | `#9aa0aa`                 | Line numbers, selected or hovered |
| `--texl-accent`             | `#2563eb`                 | Edit bar, active menu icon, check mark |
| `--texl-selected-bg`        | `rgb(37 99 235 / 0.05)`   | Selected cell background |
| `--texl-selected-ring`      | `rgb(37 99 235 / 0.35)`   | Selected cell ring |
| `--texl-edit-bg`            | `#f8f9fb`                 | Cell in edit mode |
| `--texl-mono`               | `ui-monospace, monospace` | Font of the text editors |
| `--texl-comment`            | `#b7791f`                 | Comment icon and count |
| `--texl-hover-bg`           | `rgb(15 23 42 / 0.06)`    | Hovered buttons in the margins |
| `--texl-icon-active`        | `#4b5563`                 | Hovered type icon |
| `--texl-menu-bg`, `--texl-menu-border`, `--texl-menu-text`, `--texl-menu-icon`, `--texl-menu-active-bg` | light card | Type menu |

| Part           | Element |
|----------------|---------|
| `left-margin`  | The left margin of each line |
| `right-margin` | The right margin of each line |

```css
texl-editor {
    height: 80vh;
    --texl-margin: 4rem;
    --texl-accent: #0f766e;
}
texl-editor::part(right-margin) {
    background: #fafafa;
}
```

## Keyboard

Mod is Ctrl, or Cmd on macOS.

| Keys | Outside edit mode |
|------|-------------------|
| ↑ / ↓ | Select the line above or below |
| Shift+↑ / ↓, Shift+click | Extend the selection |
| Enter, Ctrl+Enter, F2, double click | Edit the selected cell |
| Alt+Enter, Insert | Insert an empty cell below the selection |
| Alt+Shift+Enter | Insert an empty cell above the selection |
| Alt+↑ / ↓ | Move the selected cells |
| Delete, Backspace | Delete the selected cells |
| Mod+C / X / V | Copy, cut, paste cells (as Texl with markers) |
| Mod+Z; Mod+Shift+Z, Mod+Y | Undo; redo |
| Mod+/ | Open the type menu |
| Shift+F2 | Fire `comments-click` for the selected line |

| Keys | In edit mode (text cells) |
|------|---------------------------|
| Mod+Enter | Commit and leave |
| Escape | Discard and leave |
| Ctrl+Space | Insert a `<%  %>` tag |
| Shift+F2 | Insert a cell comment |

In the type menu: ↑ / ↓ or a type's first letter pick, Enter or Space
apply, Escape or Tab close.
