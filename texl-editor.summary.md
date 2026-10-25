# texl-editor — summary

*What this repository is, how it is built and where it stands, in plain
words. The OnLabs.org coordination folder reads this file instead of the
code; keep it current as described in `CLAUDE.md`.*

Details: design notes in `docs/design.md`; user documentation (guide, API
reference, architecture) in `docs/`.

## In one sentence

texl-editor is the web editor in which Word and Excel users write living Texl
documents, as a stack of cells that each turn the user's input into plain
Texl and show the result live.

## Editing model

- A document is a **vertical stack of cells**, like lined paper; Excel is a
  grid of cells. The user moves between cells and presses Enter to edit one.
- Each cell has a **type** that decides how it is edited and shown. Each cell
  has an edit mode (its own widget) and a render mode (the rendered output).
- A cell turns the user's input into **plain Texl**. That Texl is the only
  thing stored: the file stays a normal Texl document that renders without the
  editor (CLI, Python, `texl.import`), which hosts and services rely on.
- Cells see names defined by the cells above them (Texl's top-down scope);
  edit mode helps reference them (autocompletion).
- One document = one Texl text file; each cell starts with a marker line, an
  HTML comment such as `<!--{ bek4 : table }-->`: a name the editor
  generates (unique, not shown, usable as a link fragment) and the type.
  Comments on a cell are `<!--[ ... ]-->`.
- Raw Texl with `<% %>` stays available for power users.
- Revisions, release and accept are not part of the editor; the host app
  (the OnLabs platform) provides them.

### Cell types

| Cell           | What the user does                                 | Status    |
|----------------|----------------------------------------------------|-----------|
| Text, Markdown | Writes plain or Markdown text; formulas as `<% %>` tags (Ctrl+Space) | Done (0.1) |
| Table          | Edits a spreadsheet-like grid inside the document  | Next      |
| Rich text      | Word-like (WYSIWYG) text, formulas as inline chips | Planned   |
| Chart          | Sees a chart; edits it as a table of values        | Planned   |
| Figure, AI cell | Parametric figure; prompt → Texl content          | Ideas     |

There is no separate formula cell: formulas are tags inside text. An
Excel-like `=` entry may come later on top of it.

## Architecture

- **Web components** in plain JavaScript with Lit. A base cell component
  (modes, layout, commit protocol); each cell type extends it; the editor
  itself is a web component, `<texl-editor>`, embeddable in any app.
- Texl runs in the browser as WebAssembly (`@onlabsorg/texl`). Cells are
  edited with CodeMirror 6, with Swan syntax highlighting.
- The editor renders the whole document at once, exactly as any other Texl
  host would, then splits the result into the cells' outputs at their
  marker lines. Imports are fetched again on every rendering, so a changed
  imported document shows without reloading the page.
- A host app sets and reads the document text (`value`, `change` event) and
  gives the document's own URL (`url`), against which its imports
  resolve; loading and saving files is the host's job.
- **Open source, MIT.** Developers can write their own cell types through
  the public cell API.

## Status

- 2026-10-18: repository set up (package `@onlabsorg/texl-editor`, 0.0.1, not
  yet published). Working boilerplate: file format parser, base cell, text
  and formula cells, `<texl-editor>` with keyboard navigation and live
  rendering, demo page, browser tests.
- 2026-10-21: cell type menu in the left margin (icon, Ctrl+/). Formula
  cell dropped: formulas are `<% %>` tags in text and Markdown cells.
- 2026-10-22: **basic editor complete, 0.1.1 published on npm**
  (`@onlabsorg/texl-editor`, CI and publish workflow on GitHub). It has
  all the foundation features:
  - `text` and `markdown` cells with live rendering, cells see the names
    defined above them, `texl.import` of other documents (demo: a steel
    beam check importing a library of sections);
  - lined-paper sheet with line numbers; keyboard navigation, multi-cell
    selection, insert/move/delete, copy/cut/paste of cells, undo/redo;
  - cell type menu (Ctrl+/), lossless type change;
  - cell names in markers (`<!--{ name : type }-->`), usable as link
    fragments, with a name-conflict event; cell comments stored in the
    document (`<!--[ ... ]-->`, Shift+F2);
  - embeddable `<texl-editor>` component, public API for custom cell types,
    user documentation and browser tests.
- 2026-10-25: moved to Texl 0.4 (`@onlabsorg/texl` 0.4.0): whole-document
  rendering split into cells (needed for imports to keep working), a
  document `url` replaces `base-url` (breaking change for hosts), the engine
  is released when the editor leaves the page. Version bumped to 0.2.0, not
  yet published.
- Next: the table cell (decide table storage and formulas first), then
  autocompletion of names, error display and the remaining open points in
  `docs/design.md`.

## Known limitations

- If an imported document's rendering contains a marker with the same name
  as a later cell, the split into cells goes wrong (rare: names are random).
- A formula tag that spans two cells hides the later cell's output.
- Links in rendered text resolve against the page, not the document.
- Autocompletion of names must be redesigned: one rendering gives only the
  names at the end of the document, not those visible to each cell.
