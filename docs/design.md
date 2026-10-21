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
  stored. Writing in one adds it to the document as a `markdown` cell,
  together with empty `markdown` cells for the empty lines above it, so it
  stays where it was written. Inserted cells are `markdown` too.

- Two vertical blue lines (`--texl-margin-line`) rule a **margin** on each
  side of the cells, as on legal paper. The cells fill the middle column.
  - The **left margin** is for the editor's own objects about each line.
    It shows the line number; **(open)** other content, such as a menu for
    the cell type. A click in it selects the line.
  - The **right margin** is for comments on a line. They belong to the page
    that embeds the editor (later the platform), not to the document: each
    child of `<texl-editor>` with `slot` set to a line number is a comment
    on that line. The line's right margin shows a comment icon with their
    number. Keys and clipboard events from these children are left to them.
    **(open)** Comments stay on their line number, so they do not follow a
    cell that is moved, or pushed down by an inserted one.
    **(open)** How to show the comments themselves.
  - Both margins are `--texl-margin` wide (6rem); they are the CSS parts
    `left-margin` and `right-margin`.
    **(open)** The layout on narrow screens.

- The user moves between cells with the keyboard (or mouse) and presses
  Enter to edit one, as in Excel.
- Each cell has a **type**, which decides how it is edited and shown.
- Cells have no name. They are known by their **line number**, shown in
  the left margin as in Excel: 1, 2, 3, …, 10, 11, …, 100, …, on every
  line of the sheet, the empty ones below the document included. People
  talk about "line 25". The number is a position: it changes when cells
  are inserted, deleted or moved above it.
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
| `text`      | Texl template shown as HTML; Swan highlighted in `<% %>` tags, Ctrl+Space inserts one | Boilerplate |
| `markdown`  | `text` with Markdown: highlighted in the editor, turned into HTML for display | Boilerplate |
| `expression` | A Swan expression without `<% %>`, as an Excel formula; uses the `text` editor, all Swan | Boilerplate |
| `table`     | A grid where each cell is edited on its own: a spreadsheet inside the document | Planned (MVP) |
| `chart`     | Shows a chart; edits as a table of values    | Planned       |
| `figure`    | A parametric figure                          | Idea          |
| `ai`        | A prompt from which AI writes the cell's Texl | Idea         |
| rich text   | WYSIWYG version of `text` (TipTap/ProseMirror), formulas as inline chips | After Markdown; Christmas if possible |

Other formats for raw templates (e.g. LaTeX) are possible later as cell
types built on `text`, as `markdown` is.

## File format

A document is still **one Texl text file**. Each cell starts with a marker
line, an HTML comment that the editor recognises:

```texl
<!--% text %-->
# Beam check
<% L = 6, q = 12.5 %>
<!--% expression %-->
<% q * L ^ 2 / 8 %>
```

- Marker: `<!--% type %-->` on its own line. The cell body is
  everything up to the next marker line.
- Text before the first marker is a `text` cell without marker, so any plain
  Texl file opens in the editor.
- Ordinary HTML comments (`<!-- ... -->`) are not markers.
- Unknown cell types are shown as `text` and their type is kept on save.
- The file renders with any Texl host (CLI, Python, `texl.import`) without
  the editor. The markers pass through rendering as HTML comments: invisible
  in Markdown/HTML output, visible in other output formats.
- Older markers with a name before the type (`<!--% name | type %-->`)
  open too: the name is ignored and dropped when the document is saved.
- **(open)** Final marker syntax: more options (e.g.
  `<!--% table | header=1 %-->`).

## Rendering

After every committed edit the editor renders the whole document: it creates
one Texl context and renders each cell's source into it, in order. Each cell
gets its own output and the names of earlier cells are in scope. Rendering a
cell by cell gives the same result as rendering the whole file, since the
markers render to themselves and contain no tags.

- Cell output is HTML, sanitised with DOMPurify (documents may come from
  other parties). `markdown` output is first turned into HTML with `marked`.
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
  renders `output` as HTML, sanitised with DOMPurify.
- `TextCell` provides the text editor, a CodeMirror 6 view that exists only
  in edit mode and keeps `input` up to date (without the line break that
  ends the cell body, which belongs to the file format and is added back).
  Its `languageExtensions()` give the editor its language: Swan
  highlighting inside `<% %>` tags and Ctrl+Space to insert a tag
  (`src/swan.js`). `MarkdownCell` extends it with Markdown highlighting
  (tags stay Swan, Markdown does not look inside them) and renders its
  output as Markdown. `ExpressionCell` extends it, highlights the whole
  input as Swan, and only wraps its input in `<% %>` (`toTexl`) and strips
  the tag again (`fromTexl`).
- Swan highlighting is a layer of decorations over the editor's language,
  as Texl finds its tags before Markdown is read: a tag is highlighted
  wherever it is, also in a code block.
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
- Cell keys, outside edit mode (Mod is Ctrl, or Cmd on macOS). They are
  chosen to exist on every keyboard (Mac and laptops have no Insert key,
  Mac's ⌫ is Backspace) and not to clash with the browser or the OS:
  - Shift+↑/↓ (or Shift+click) selects several cells, from the anchor to
    the active line. The actions below work on all selected cells; Enter
    edits only the active one.
  - Alt+↑/↓ moves the selected cells one line up or down, as in VS Code.
    A cell moved below the document leaves empty cells behind it.
  - Alt+Enter inserts an empty cell below the selection, Alt+Shift+Enter
    above it (Shift reverses the direction, as Shift+Tab). Insert also
    inserts below, for keyboards that have it.
  - Delete or Backspace deletes the selected cells; Mod+Z brings them back.
  - Mod+C/X/V copy, cut and paste the selected cells: the clipboard holds
    their marker lines and source, so pasted cells keep their type, and
    other text pastes as a `text` cell. Paste replaces the
    selected cells, as in Excel, and selects the pasted ones. The editor
    handles the browser's clipboard events rather than the keys, so the old
    Ctrl+Insert, Shift+Insert and Shift+Delete copy, paste and cut too, and
    text selected with the mouse is copied as usual.
  - Mod+Z undoes the last change to the cells (inserts, deletes, moves,
    pastes, committed edits) and restores the selection, Mod+Shift+Z or
    Mod+Y redoes it; setting `value` clears the history. While editing,
    these keys undo inside the cell.
  - Only the first cell may go without marker: a cell without one that is
    no longer first gets one. Empty `markdown` or `text` cells at the end of
    the document are dropped, as they look like the empty lines below it.
- **(open)** How to change a cell's type (key, menu or both).
- **(open)** Expression cells: does the cell bind a variable
  (`M = q * L ^ 2 / 8`), and is the result shown as "M = 56.25" (Mathcad
  style)? Units?
- **(open)** Tables: storage as Swan data plus a render call; formulas inside
  table cells (column formulas vs A1 references); which renderer functions
  the editor provides to documents, and how they stay available when the file
  is rendered without the editor (e.g. a Texl library imported by URL).
- **(open)** The cells use CodeMirror 6, with Swan highlighting. Still to
  do: autocompletion from `context.names()`, and a look that suits
  non-programmers.
- **(open)** Ctrl+Space inserts a `<%  %>` tag, but it is also the usual
  autocompletion key (CodeMirror, VS Code) and switches the input source on
  macOS. Keep it, or move one of the two (e.g. Mod+E for a tag)?
- **(open)** Undefined values: how a cell shows an error clearly.
- **(open)** Shadow DOM and rich-text editors: ProseMirror's selection
  handling inside shadow roots needs checking before choosing it.
