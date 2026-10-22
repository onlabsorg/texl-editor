# texl-editor

A web editor for [Texl](https://github.com/onlabsorg/texl) documents, made for
people who work in Word and Excel.

A document is a vertical stack of **cells** on a sheet of lined paper. You
move between cells and press Enter to edit one, as in a spreadsheet. Each
cell has a type: text, Markdown text, and soon tables and charts. Formulas
go inside the text between `<%` and `%>` (Ctrl+Space inserts them), and a
cell can use the values and functions defined by the cells above it. A cell
turns what you type into plain Texl and shows the rendered result live.

The whole editor is a web component, `<texl-editor>`, so it can be embedded
in any web page or app. Each cell type is a web component too, and you can
write your own.

> **Status:** early development (0.0.x). The file format and the API will
> change. The package is not published on npm yet.

## Documentation

| Page | For |
|------|-----|
| [Guide](docs/guide.md) | A tutorial: embed the editor in a web app, load and save documents, show comments, write a cell type |
| [API reference](docs/api.md) | Every element, property, event, class and function |
| [Architecture](docs/architecture.md) | The modules, the classes and how they interact |
| [Design](docs/design.md) | The editing model, the file format and the open points |
| [Texl primer](docs/texl-primer.md) | The Texl essentials for working on the editor |

## Try it

```sh
git clone https://github.com/onlabsorg/texl-editor.git
cd texl-editor
npm install
npm run dev        # demo page at http://localhost:5173
```

The demo opens `examples/sample.texl`, a steel beam check that imports a
library of sections (`examples/steel.texl`).

## Use it

Install it from GitHub:

```sh
npm install github:onlabsorg/texl-editor
```

With Vite, exclude Texl from dependency pre-bundling, so that it finds its
WebAssembly file (`vite.config.js`):

```js
export default { optimizeDeps: { exclude: ["@onlabsorg/texl"] } };
```

Then:

```html
<texl-editor id="editor" style="height: 80vh"></texl-editor>
<script type="module">
    import "@onlabsorg/texl-editor";

    const editor = document.getElementById("editor");
    editor.value = "<!--{ markdown }-->\n# Hello\n<!--{ markdown }-->\n6 × 7 = <% 6 * 7 %>\n";
    editor.addEventListener("change", () => console.log(editor.value));
</script>
```

| Property / attribute | Description |
|----------------------|-------------|
| `value`              | The document text (property) |
| `base-url`           | URL that relative `texl.import`s resolve against |
| `rows`               | Lines on the sheet (default 100) |
| `rendered`           | Promise of the current rendering pass |

| Event              | `detail` |
|--------------------|----------|
| `change`           | — (read `value`) |
| `selection-change` | `{line}` |
| `comments-click`   | `{line, comments}` |
| `name-conflict`    | `{conflicts}`, each `{name, lines}` |

See the [guide](docs/guide.md) for a complete walk-through and the
[API reference](docs/api.md) for the details.

## Keys

| Keys | Action |
|------|--------|
| ↑ / ↓, Shift+↑ / ↓ | Select a line, extend the selection |
| Enter, F2, double click | Edit the selected cell |
| Ctrl+Enter (⌘+Enter) / Escape | While editing: save / discard |
| Ctrl+Space | While editing: insert a formula `<%  %>` |
| Alt+Enter, Insert / Alt+Shift+Enter | Insert a cell below / above |
| Alt+↑ / ↓ | Move the selected cells |
| Delete, Backspace | Delete the selected cells |
| Ctrl+C / X / V | Copy, cut, paste cells |
| Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y | Undo, redo |
| Ctrl+/ | Change the cell type |
| Shift+F2 | Show comments; while editing, insert a comment |

## The file format

A document is a single Texl text file. Each cell starts with a marker line,
`<!--{ name : type }-->`, followed by the Texl source the cell produced.
The editor numbers its lines 1, 2, 3, … in the left margin; the name, four
lowercase letters and digits, is given by the editor and not shown: it
identifies the cell, e.g. in a link. Comments on a cell are written
`<!--[ ... ]-->`; other HTML comments are left alone.

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
<!--{ mom3 : markdown }-->
Midspan moment: <% q * L ^ 2 / 8 %> kNm
<!--[ Anna: check the load combination. ]-->
```

The file is a normal Texl document: it renders with any Texl tool, without
the editor. A file without markers opens as a single text cell.

## Writing a cell type

Extend `TexlCell`, convert between your widget's input and Texl source, and
register the class:

```js
import { html } from "lit";
import { TexlCell, registerCell } from "@onlabsorg/texl-editor";

class MyCell extends TexlCell {
    static type = "mine";                   // the type in the marker
    static label = "My cell";               // its name in the type menu

    fromTexl(texl) { this.input = /* read the input from the source */; }
    toTexl() { return /* the Texl source for this.input */; }
    renderEditor() { return html`<!-- the editing widget -->`; }
}

registerCell(MyCell);                       // defines <texl-cell-mine>
```

The guide builds a working example, a `quantity` cell:
[Write your own cell type](docs/guide.md#7-write-your-own-cell-type).

## Development

```sh
npm run dev        # Vite dev server with the demo page (index.html)
npm test           # tests in headless Chrome (@web/test-runner)
npm run build      # library bundle in dist/
```

Requires Node.js 22 or later and a local Chrome or Chromium for the tests.
Read [the architecture](docs/architecture.md) before changing the code and
[the design](docs/design.md) for the editing model.

## License

MIT — see [LICENSE](LICENSE).
