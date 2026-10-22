# texl-editor

A web editor for [Texl](https://github.com/onlabsorg/texl) documents, made for
people who work in Word and Excel.

A document is a vertical stack of **cells**. You move between cells and press
Enter to edit one, as in a spreadsheet. Each cell has a type: text, Markdown
text, and soon tables and charts. Formulas go inside the text between `<%`
and `%>` (Ctrl+Space inserts them). A cell turns what you type into plain
Texl, and shows the rendered result live.
Cells can use the values and functions defined by the cells above them.

The whole editor is a web component, `<texl-editor>`, so it can be embedded
in any web page or app. Each cell type is a web component too, and you can
write your own.

> **Status:** early development (0.0.x). The file format and the API will
> change.

## Try it

```sh
npm install
npm run dev        # demo page at http://localhost:5173
```

## Use it

```html
<texl-editor id="editor"></texl-editor>
<script type="module">
    import "@onlabsorg/texl-editor";

    const editor = document.getElementById("editor");
    editor.value = "<!--{ markdown }-->\n# Hello\n<!--{ markdown }-->\n6 × 7 = <% 6 * 7 %>\n";
    editor.addEventListener("change", () => console.log(editor.value));
</script>
```

Keyboard: ↑/↓ select a cell; Enter, Ctrl+Enter or F2 edits it. In edit
mode, Ctrl+Enter (Cmd+Enter on macOS) saves and leaves, Escape discards the
changes.

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

class UpperCell extends TexlCell {
    static type = "upper";                      // the type in the marker

    fromTexl(texl) { this.input = texl.match(/"(.*)"/)?.[1] ?? ""; }
    toTexl() { return `<% text.upper "${this.input}" %>\n`; }

    renderEditor() {
        return html`<input .value=${this.input}
            @input=${(e) => (this.input = e.target.value)} />`;
    }
}

registerCell(UpperCell);                        // defines <texl-cell-upper>
```

## Development

```sh
npm run dev        # Vite dev server with the demo page (index.html)
npm test           # tests in headless Chrome (@web/test-runner)
npm run build      # library bundle in dist/
```

Requires Node.js 22 or later and a local Chrome or Chromium for the tests.
See `docs/design.md` for the editing model and `docs/texl-primer.md` for the
Texl essentials.

## License

MIT — see [LICENSE](LICENSE).
