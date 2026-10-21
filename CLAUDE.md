# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project

`texl-editor` is the web editor for [Texl](https://github.com/onlabsorg/texl)
documents, part of OnLabs.org. Its users are engineers, finance people and
other Word/Excel users, not programmers: every feature is judged by how
familiar it feels to them. MIT licensed and open source, so that others can
write their own cells; it is the last open-source layer, the OnLabs platform
that will embed it is private.

- **Editing model** (see `docs/design.md`): a document is a vertical stack of
  cells. Each cell has a type, an edit mode (its own widget) and a render mode
  (its rendered output). A cell turns its input into plain Texl source, which
  is the only thing stored; to edit again, it reads its input back from that
  source.
- **File format:** one Texl text file. Each cell starts with a marker line
  `<!--% type %-->`; text before the first marker is a `text` cell without
  marker. Cells have no name: the editor shows their line number (1, 2, 3,
  …) in the left margin. The file must stay a valid Texl document that
  renders without the editor.
- **Texl essentials** for this work are in `docs/texl-primer.md` (tags,
  shared top-down scope, Swan, imports, the `@onlabsorg/texl` JavaScript API).
  The full manual is <https://onlabsorg.github.io/texl/>. If the Texl repo is
  cloned next to this one (`../texl`), read it only when the primer and the
  manual are not enough.

## Stack and commands

Plain JavaScript (ES modules, JSDoc types, no TypeScript, no build step for
the source) with Lit 3 web components. Texl runs in the browser as
WebAssembly (`@onlabsorg/texl`). Cell output is sanitised with DOMPurify;
Markdown cells convert it with `marked` first. Text is edited with
CodeMirror 6 (`@codemirror/*`).

```bash
npm install
npm run dev          # Vite dev server; index.html is the demo page (examples/sample.texl)
npm test             # @web/test-runner in headless local Chrome: test/**/*.test.js
npm run test:watch
npm run build        # library bundle into dist/ (Vite library mode)
```

Requires Node.js 22 or later (Vite 8, @web/test-runner 1.0). Locally, Node
is managed by nvm (LTS as default); non-interactive shells must run
`source ~/.nvm/nvm.sh` first to get `node` and `npm` on the PATH.

## Code layout

- `src/index.js` — entry point: registers the built-in cells and
  `<texl-editor>`, re-exports the public API.
- `src/texl-editor.js` — `TexlEditor`: holds the cells, keyboard navigation,
  edit mode, and rendering (one Texl context per pass, cells rendered in
  order). Public surface: `value` (document text), `base-url`, `rows`
  (lines on the sheet, default 100), `change` event, `rendered` (promise of
  the current rendering pass).
- `src/texl-cell.js` — `TexlCell`, the base class of all cells: modes,
  layout, and the commit protocol (`cell-change` with `{texl}`, then
  `cell-exit`). Subclasses override `fromTexl`, `toTexl`, `renderEditor`;
  the base `renderView` (output as sanitised HTML) rarely needs it.
  Text-based cells override `languageExtensions()` of `TextCell`. Static
  `type`, `label` and `icon` name the type in the margin's type menu.
- `src/cells/` — built-in cell types (`text`, `markdown`). Formulas are
  `<% %>` tags inside them; there is no formula cell (parent D11).
- `src/swan.js` — Swan highlighting for the cell editors (tags or whole
  input) and the command that inserts a `<%  %>` tag.
- `src/registry.js` — `registerCell(CellClass)` maps a cell type to its
  custom element `texl-cell-<type>`; unknown types fall back to `text`.
  `cellClass(type)` and `cellTypes()` list them (for the type menu).
- `src/document.js` — parse a file into cells and serialise them back
  (round-trip exact).
- `src/engine.js` — loads the wasm module once, creates engines.
- `docs/` — `design.md` (editing model, open points), `texl-primer.md`.

## Conventions

- The editor owns the document; cells are views of their Texl source and
  report changes by events. Don't keep cell data outside the Texl source.
- Lit in plain JS: declare reactive properties in `static properties` and
  initialise them in the constructor, never as class fields (they would
  shadow Lit's accessors).
- A cell that handles a key itself calls `preventDefault()`; the editor
  ignores keydown events that are already default-prevented.
- Rendered HTML from documents is untrusted: always sanitise it.
- Tests run in a real browser (custom elements, wasm). Synthetic key events
  in tests need `cancelable: true` for `preventDefault()` to work.
- `vite.config.js` excludes `@onlabsorg/texl` from `optimizeDeps`; the wasm
  file is loaded relative to `texl_wasm.js`.
- Keep `docs/design.md` up to date when the editing model or file format
  changes; mark undecided items **(open)**.
- Strategic decisions (scope, timeline, licensing) are made in the parent
  OnLabs.org folder, not here.
- `local/`, `*.todo.md`, `*.repomix.md` and `helper.sh` are git-ignored local
  files.
- Language: English. Markdown lines wrapped at about 80 characters.
