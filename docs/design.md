# texl-editor design

*The editing model and architecture of the editor. Status: draft,
2026-10-18. Items marked **(open)** are still to be decided here.*

## Who it is for

Engineers, finance people and other knowledge workers who do their work in
Word and Excel, not programmers. The editor must be as approachable as Word
and Excel. Writing raw Texl with `<% %>` tags stays possible for power users,
but nobody has to.

## Editing model: a stack of cells

A document is a **vertical stack of cells**, the way an Excel sheet is a grid
of cells. It looks like lined paper: each line is a cell, ruled below by a
soft gray line (`--texl-line`), at least one line high and taller when its
content needs it.

- The sheet has a fixed number of lines (`rows`, 100 by default), or more if
  the document has more cells. Lines below the last cell are empty and not
  stored. Writing in one adds it to the document as a `text` cell, together
  with empty cells for the empty lines above it, so it stays where it was
  written.

- The user moves between cells with the keyboard (or mouse) and presses
  Enter to edit one, as in Excel.
- Each cell has a **type**, which decides how it is edited and shown.
- Each cell has two modes:
  - **edit mode**: the cell's own widget takes the user's input;
  - **render mode**: the cell shows its rendered output.
- A cell turns its input into **plain Texl source**. That source is what is
  stored, and it is the single source of truth: there is no separate widget
  data. To edit again, the cell reads its input back from its source.
- Cells see the names (variables, functions) defined by the cells **above**
  them, because Texl evaluates a document top to bottom in one scope. Edit
  mode should help the user reference those names (autocompletion).

Revisions, comments, releases and permissions belong to the platform, not to
the editor.

### Cell types

| Type        | Edit mode                                    | Status        |
|-------------|----------------------------------------------|---------------|
| `text`      | Markdown Texl template, inline `<% %>` by hand | Boilerplate |
| `expression` | A Swan expression without `<% %>`, as an Excel formula; uses the `text` editor | Boilerplate |
| `table`     | A grid where each cell is edited on its own: a spreadsheet inside the document | Planned (MVP) |
| `chart`     | Shows a chart; edits as a table of values    | Planned       |
| `figure`    | A parametric figure                          | Idea          |
| `ai`        | A prompt from which AI writes the cell's Texl | Idea         |
| rich text   | WYSIWYG version of `text` (TipTap/ProseMirror), formulas as inline chips | After Markdown; Christmas if possible |

Other formats for raw templates (LaTeX, plain text) are possible later; for
now the document format is Markdown.

## File format

A document is still **one Texl text file**. Each cell starts with a marker
line, an HTML comment that the editor recognises:

```texl
<!--% intro | text %-->
# Beam check
<% L = 6, q = 12.5 %>
<!--% M | expression %-->
<% q * L ^ 2 / 8 %>
```

- Marker: `<!--% name | type %-->` on its own line. The cell body is
  everything up to the next marker line.
- Text before the first marker is a `text` cell without marker, so any plain
  Texl file opens in the editor.
- Ordinary HTML comments (`<!-- ... -->`) are not markers.
- Unknown cell types are shown as `text` and their type is kept on save.
- The file renders with any Texl host (CLI, Python, `texl.import`) without
  the editor. The markers pass through rendering as HTML comments: invisible
  in Markdown/HTML output, visible in other output formats.
- **(open)** Final marker syntax: name/type order, more options (e.g.
  `<!--% loads | table | header=1 %-->`), whether the name is required.

## Rendering

After every committed edit the editor renders the whole document: it creates
one Texl context and renders each cell's source into it, in order. Each cell
gets its own output and the names of earlier cells are in scope. Rendering a
cell by cell gives the same result as rendering the whole file, since the
markers render to themselves and contain no tags.

- `text` output is Markdown, turned into HTML with `marked` and sanitised with
  DOMPurify (documents may come from other parties).
- `context.names()` after each cell gives the names visible to the next one,
  for autocompletion.
- **(open)** Incremental rendering (only the edited cell and those below), if
  full re-rendering gets slow.

## Architecture

Plain JavaScript (ES modules, JSDoc types) and [Lit](https://lit.dev) web
components.

```
<texl-editor>                     the app: document, navigation, rendering
  ├─ <texl-cell-text>             one element per cell, by type
  ├─ <texl-cell-expression>
  └─ <texl-cell-…>                custom cells from third parties
        all extend TexlCell       base: modes, layout, commit protocol
```

- `TexlCell` (`src/texl-cell.js`): base class. Switches between edit and
  render mode, provides the common layout, and reports a committed edit with
  a `cell-change` event carrying the new Texl source. Subclasses implement
  `fromTexl()`, `toTexl()` and `renderEditor()` (the base only shows a
  "no editor" notice). `renderView()` rarely needs overriding: the base
  renders `output` as Markdown, sanitised with DOMPurify.
- `TextCell` provides the text editor, a CodeMirror 6 view that exists only
  in edit mode and keeps `input` up to date; `ExpressionCell` extends it and only
  wraps its input in `<% %>` (`toTexl`) and strips the tag again
  (`fromTexl`).
- Registry (`src/registry.js`): `registerCell(CellClass)` maps the type in the
  marker to a custom element (`texl-cell-<type>`). This is the extension
  point for developers' own cells.
- `<texl-editor>` (`src/texl-editor.js`): parses the file into cells
  (`src/document.js`), renders them in one context, handles navigation and
  edit mode, and serialises the cells back. It is a web component itself, so
  it can be embedded in other apps and later in the OnLabs platform.
- The editor owns the document; cells are stateless views of their source.

## Open points

- Key map: ↑/↓ select a cell; Enter, Ctrl+Enter or F2 edits it, as does a
  double click. Enter is the familiar key; Ctrl+Enter works too because it is
  the key that commits, so it opens and closes a cell; F2 is Excel's edit
  key. In edit mode, Ctrl+Enter (Cmd+Enter on macOS) commits and leaves,
  Escape discards the changes and leaves, as in Excel. Enter stays inside the
  cell (a new line in text). Cells must leave these keys to the editor.
- Typing on a selected cell does not start editing it, unlike Excel, until
  it is clear how that would work for other cell types (e.g. tables).
- **(open)** Keys to add, delete, move and change the type of cells.
- **(open)** Expression cells: does the cell name bind a variable
  (`M = q * L ^ 2 / 8`), and is the result shown as "M = 56.25" (Mathcad
  style)? Units?
- **(open)** Tables: storage as Swan data plus a render call; formulas inside
  table cells (column formulas vs A1 references); which renderer functions
  the editor provides to documents, and how they stay available when the file
  is rendered without the editor (e.g. a Texl library imported by URL).
- **(open)** The `text` and `expression` cells use CodeMirror 6 (Markdown
  mode). Still to do: Swan highlighting inside `<% %>`, autocompletion from
  `context.names()`, and a look that suits non-programmers.
- **(open)** Undefined values: how a cell shows an error clearly.
- **(open)** Shadow DOM and rich-text editors: ProseMirror's selection
  handling inside shadow roots needs checking before choosing it.
