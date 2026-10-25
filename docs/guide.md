# Guide: embedding texl-editor in a web app

*A step-by-step tutorial, from an empty folder to an app that loads, edits
and saves Texl documents, shows comments, and has a cell type of its own.
For every detail, see the [API reference](api.md); for how the parts work
inside, see the [architecture](architecture.md).*

1. [Install](#1-install)
2. [Configure Vite](#2-configure-vite)
3. [Show a document](#3-show-a-document)
4. [Load and save](#4-load-and-save)
5. [Imports and the document URL](#5-imports-and-the-document-url)
6. [Comments and cell names](#6-comments-and-cell-names)
7. [Write your own cell type](#7-write-your-own-cell-type)
8. [Style the editor](#8-style-the-editor)
9. [Work with documents without the editor](#9-work-with-documents-without-the-editor)
10. [Use it from a framework](#10-use-it-from-a-framework)

## What you will build

The editor is one web component, `<texl-editor>`. You give it the text of a
Texl document; it shows the document as a stack of cells on lined paper,
lets the user edit them, renders the Texl live, and gives the text back.
Your app decides where documents come from and where they go.

A document is plain text. Each cell starts with a marker line:

```texl
<!--{ bek4 : markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
<!--{ mom3 : markdown }-->
Midspan moment: <% q * L ^ 2 / 8 %> kNm
<!--[ Anna: check the load combination. ]-->
```

`<% ... %>` tags are formulas, written in the Swan language; a name bound in
one cell (`L`, `q`) is visible in every cell below it. `<!--[ ... ]-->` is a
comment on the cell. The [Texl primer](texl-primer.md) explains the
language.

## 1. Install

The package is not on npm yet. Install it from GitHub, together with Vite as
dev server and bundler:

```sh
mkdir my-app && cd my-app
npm init -y
npm pkg set type=module
npm install github:onlabsorg/texl-editor
npm install --save-dev vite
```

You need Node.js 22 or later. Any bundler that resolves bare module imports
and serves `.wasm` files works; this guide uses Vite.

## 2. Configure Vite

Texl runs as WebAssembly: its JavaScript glue loads the `.wasm` file by a
URL relative to itself. Vite's dependency pre-bundling would move the glue
away from the file, so exclude Texl from it. Create `vite.config.js`:

```js
import { defineConfig } from "vite";

export default defineConfig({
    optimizeDeps: {
        exclude: ["@onlabsorg/texl"],
    },
});
```

Without this, rendering fails with an error about loading the wasm module.
Pages must be served over HTTP (not opened as `file://`).

## 3. Show a document

Create `index.html`:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>My Texl app</title>
        <style>
            body {
                display: flex;
                flex-direction: column;
                height: 100vh;
                max-width: 52rem;
                margin: 0 auto;
                font-family: system-ui, sans-serif;
            }
            texl-editor {
                flex: 1;
                min-height: 0;
            }
        </style>
    </head>
    <body>
        <texl-editor id="editor"></texl-editor>
        <script type="module" src="./main.js"></script>
    </body>
</html>
```

and `main.js`:

```js
import "@onlabsorg/texl-editor";

const editor = document.getElementById("editor");

editor.value = `<!--{ markdown }-->
# Beam check
<% L = 6, q = 12.5 %>
<!--{ markdown }-->
Midspan moment: **<% q * L ^ 2 / 8 %> kNm**
`;

editor.addEventListener("change", () => console.log(editor.value));
editor.focus();
```

Run `npx vite` and open the address it prints. You see two cells, rendered
as Markdown, and empty numbered lines below them. Try it:

- ↑/↓ select a line; Enter (or F2, or a double click) edits it.
- While editing, Ctrl+Space inserts a `<%  %>` tag; Ctrl+Enter saves,
  Escape discards.
- Write on an empty line below the document: it becomes part of it.
- The icon left of the line number (or Ctrl+/) changes the cell type.

Things to notice:

- Importing the package defines `<texl-editor>` and the built-in cells
  (`text`, `markdown`). You only need the import once per page.
- `value` is a **property**, not an attribute. Set it from JavaScript.
- The markers above have no names. The editor gives every cell a name when
  it reads the document (`<!--{ kem5 : markdown }-->`): the `change` log
  shows them. Names are stable identifiers; users never see them, they see
  line numbers.
- The editor scrolls its own lines. Give it a height (here with flexbox) or
  it grows with its 100 lines; set `rows` to change the number of lines.

## 4. Load and save

The editor has no storage of its own: your app loads the text, sets
`value`, and saves the text when `change` fires. Here is a version that
loads a document from a URL and saves it back with a delay, so that a burst
of changes makes one request:

```js
import "@onlabsorg/texl-editor";

const editor = document.getElementById("editor");
const url = "/api/documents/beam.texl";

async function load() {
    const response = await fetch(url);
    editor.value = response.ok ? await response.text() : "";
    await editor.rendered;              // the cells show their output now
    editor.focus();
}

let timer;
editor.addEventListener("change", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        fetch(url, { method: "PUT", body: editor.value });
    }, 1000);
});

load();
```

Without a server, `localStorage` works the same way:

```js
editor.value = localStorage.getItem("doc") ?? "";
editor.addEventListener("change", () => localStorage.setItem("doc", editor.value));
```

Points to keep in mind:

- Set `value` to **open** a document. Setting it resets the selection and
  the undo history, so do not write the text back into `value` after each
  `change`: the editor already has it.
- `change` fires on user actions only (edits, inserts, deletes, moves,
  pastes, type changes, undo and redo), not when you set `value`.
- `editor.rendered` is a promise of the current rendering pass. Await it
  when you need the outputs, e.g. in tests or before a print.
- The saved file is a normal Texl document. It renders with any Texl tool,
  without the editor; the markers render as HTML comments.

## 5. Imports and the document URL

A document can import other documents by URL with `texl.import`, e.g. a
library of steel sections:

```texl
<!--{ markdown }-->
<% texl.import("lib/steel.texl") ~> (lib -> bind "steel" lib.data) %>
Section <% steel.IPE.IPE300.name %>
```

The editor renders the document as the document at its **URL**, set with
the `url` attribute; relative imports resolve against the document's
folder. A relative `url` resolves against the page. The default,
`untitled.texl`, puts an unsaved document in the page's folder.

```html
<texl-editor id="editor" url="https://example.com/docs/report.texl"></texl-editor>
```

or from JavaScript, at any time (the editor renders again):

```js
editor.url = new URL("/api/documents/report.texl", location.href).href;
editor.value = text;
```

Nothing is cached between renderings: every rendering fetches the imported
documents again, so a changed library shows on the next one (the browser's
HTTP cache still applies). Imports are loaded by the browser, so the usual
CORS rules apply. Links in the rendered output, e.g. `[steel](steel.texl)`
in Markdown, are resolved by the browser against the page, not the
document.

## 6. Comments and cell names

Comments live in the document, as `<!--[ ... ]-->` inside a cell, so they
move with the cell. The editor counts them in the right margin; showing them
is up to your app. When the user clicks a comment count, or presses
Shift+F2 on a line, the editor fires `comments-click` with the line number
and the comments as strings.

A comments panel beside the editor:

```html
<aside id="comments" hidden>
    <h2></h2>
    <ul></ul>
</aside>
```

```js
const panel = document.getElementById("comments");
let shownLine = 0;

editor.addEventListener("comments-click", (e) => {
    const { line, comments } = e.detail;
    shownLine = line;
    panel.querySelector("h2").textContent = `Comments on line ${line}`;
    panel.querySelector("ul").replaceChildren(
        ...comments.map((text) => Object.assign(document.createElement("li"), { textContent: text })),
    );
    panel.hidden = false;
});

// Hide the panel when the user moves to another line
editor.addEventListener("selection-change", (e) => {
    if (e.detail.line !== shownLine) panel.hidden = true;
});
```

To the editor a comment is just a string. Give it a structure of your own if
you need one, e.g. `<!--[ Anna 2026-10-21: check the load ]-->`, and parse it
in your handler. Users add comments while editing a cell with Shift+F2.

Cell names must be unique in a document. The editor guarantees that for the
names it gives, but names edited by hand (in the source file) can clash. The
editor leaves them as they are and tells you:

```js
editor.addEventListener("name-conflict", (e) => {
    for (const { name, lines } of e.detail.conflicts)
        console.warn(`Cell name "${name}" is used on lines ${lines.join(", ")}`);
});
```

## 7. Write your own cell type

A cell type turns a widget's input into Texl source, and reads it back. The
source is all that is stored. Here is a `quantity` cell: the user fills in a
name, a value and a unit; the cell writes one line of Texl that binds the
name, so the cells below can use it, and shows `L = 6 m`.

The Texl it produces:

```texl
<!--{ ruv4 : quantity }-->
<% L = 6 %>L = <% L %> m
```

Create `quantity-cell.js`:

```js
import { html, css } from "lit";
import { TexlCell } from "@onlabsorg/texl-editor";

// `<% L = 6 %>L = <% L %> m`: the name, the value and the unit
const QUANTITY = /^<% (\w+) = (.*?) %>\1 = <% \1 %> ?(.*?)\r?\n?$/;

export class QuantityCell extends TexlCell {
    // The type in the marker, its name in the type menu, and its icon
    static type = "quantity";
    static label = "Quantity";
    static icon = html`<svg viewBox="0 0 24 24">
        <path d="M3 8h18v8H3z" />
        <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
    </svg>`;

    static styles = [
        TexlCell.styles,
        css`
            .fields {
                display: flex;
                gap: 0.75rem;
            }
            input {
                font: inherit;
            }
        `,
    ];

    /** Reads the fields back from the source; a new cell gets defaults. */
    fromTexl(texl) {
        const [, name = "x", value = "0", unit = ""] = QUANTITY.exec(texl) ?? [];
        this.input = { name, value, unit };
    }

    /** Writes the fields as Texl: bind the name, then show it. */
    toTexl() {
        const { name, value, unit } = this.input;
        return `<% ${name} = ${value} %>${name} = <% ${name} %> ${unit}`.trimEnd() + "\n";
    }

    renderEditor() {
        const field = (key, label, size) => html`<label>
            ${label}
            <input
                size=${size}
                .value=${this.input[key]}
                @input=${(e) => (this.input = { ...this.input, [key]: e.target.value })}
            />
        </label>`;
        return html`<div class="fields">
            ${field("name", "Name", 6)} ${field("value", "Value", 10)} ${field("unit", "Unit", 6)}
        </div>`;
    }
}
```

Register it in `main.js`, before setting `value`:

```js
import { registerCell } from "@onlabsorg/texl-editor";
import { QuantityCell } from "./quantity-cell.js";

registerCell(QuantityCell);         // defines <texl-cell-quantity>

editor.value = `<!--{ quantity }-->
<% L = 6 %>L = <% L %> m
<!--{ quantity }-->
<% q = 12.5 %>q = <% q %> kN/m
<!--{ markdown }-->
Midspan moment: **<% q * L ^ 2 / 8 %> kNm**
`;
```

"Quantity" now appears in the type menu. Edit line 1, change the value to 8
and press Ctrl+Enter: line 3 is rendered again with the new span.

How it works:

- When the user starts editing, the base class calls `fromTexl(texl)` with
  the cell's source, then renders `renderEditor()` and focuses the first
  `input`. `this.input` holds whatever your widget needs.
- On Ctrl+Enter the editor calls `exitEdit(true)`: the base class calls
  `toTexl()` and, if the source changed, reports it to the editor, which
  stores it, renders the document and fires `change`. Escape calls
  `exitEdit(false)`: nothing is stored.
- In render mode, the base `renderView()` shows the rendered output as
  sanitised HTML; you rarely need to override it.
- `fromTexl` must accept any source, including one written by hand or by
  another cell type (the type menu keeps the source when it changes the
  type). Fall back to sensible defaults, as above, rather than throwing.
- Keep the source a valid Texl document on its own: someone may render it
  without the editor.

More rules for cells:

- Declare reactive properties in `static properties` and initialise them in
  the constructor, never as class fields: in plain JavaScript, class fields
  shadow Lit's accessors.
- If your widget handles a key the editor also uses (e.g. Escape in a
  dropdown), call `e.preventDefault()`: the editor ignores keys that are
  already default-prevented.
- If your widget is not an `input` or `textarea`, override `focusEditor()`.
- If your `renderView()` shows HTML from the document, sanitise it (e.g.
  with DOMPurify): documents may come from other people.
- For a text-based cell (a template in another language, e.g. LaTeX or
  HTML), extend `TextCell` and override `languageExtensions()` instead: you
  get the CodeMirror editor, Swan highlighting and the tag key for free. See
  `src/cells/markdown-cell.js` for an example.

## 8. Style the editor

The editor and cells use shadow DOM, so page CSS does not reach inside.
Style them with custom properties, set on the editor or an ancestor, and
with the parts `left-margin` and `right-margin`:

```css
texl-editor {
    --texl-paper: #fffef8;          /* sheet background */
    --texl-line: #ece8dc;           /* rules between lines */
    --texl-margin: 4rem;            /* width of each margin */
    --texl-margin-line: #e3a6a6;    /* the vertical margin lines */
    --texl-accent: #0f766e;         /* edit bar and menu highlights */
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
}

texl-editor::part(right-margin) {
    background: #faf8f0;
}
```

The [API reference](api.md#styling) lists all of them.

## 9. Work with documents without the editor

The functions the editor uses on the file format are exported too. Use them
to list comments, render a read-only preview or check a document, without
showing an editor:

```js
import { parseDocument, cellComments, splitRendering, createEngine } from "@onlabsorg/texl-editor";

const cells = parseDocument(text);

// Every comment, with its line
const comments = cells.flatMap((cell, i) =>
    cellComments(cell.texl).map((comment) => ({ line: i + 1, comment })),
);

// The rendered output of every cell, as the editor renders it
const engine = await createEngine();
const doc = await engine.render("docs/report.texl", text);   // the document's URL
const outputs = splitRendering(doc.rendering, cells);
```

`serializeDocument(cells)` turns cells back into text, so you can also
change a document programmatically, e.g. append a cell:

```js
import { parseDocument, serializeDocument, nameCells } from "@onlabsorg/texl-editor";

const cells = parseDocument(text);
cells.push({ type: "markdown", texl: "Checked by Anna.\n" });
text = serializeDocument(nameCells(cells));
```

## 10. Use it from a framework

`<texl-editor>` is a standard custom element, so it works in any framework.
Two rules: set `value` as a property, and listen to `change` as a DOM event.
Set `value` only when a different document is opened, not after each
change.

React 19:

```jsx
import { useEffect, useRef } from "react";
import "@onlabsorg/texl-editor";

export function TexlEditor({ documentText, onChange }) {
    const ref = useRef(null);

    // Open the document when it changes (not on every edit)
    useEffect(() => {
        ref.current.value = documentText;
    }, [documentText]);

    useEffect(() => {
        const editor = ref.current;
        const handler = () => onChange(editor.value);
        editor.addEventListener("change", handler);
        return () => editor.removeEventListener("change", handler);
    }, [onChange]);

    return <texl-editor ref={ref} style={{ height: "80vh" }} />;
}
```

Lit:

```js
html`<texl-editor
    .value=${this.documentText}
    url=${this.documentUrl}
    @change=${(e) => this.save(e.target.value)}
></texl-editor>`;
```

With Lit, keep `documentText` unchanged while the user edits (store the
saved text elsewhere): the `.value` binding sets the property again whenever
the bound value changes.

## Next steps

- [API reference](api.md): every property, event, class and function.
- [Architecture](architecture.md): the modules and how they interact.
- [Design](design.md): the editing model and the open points.
- [Texl primer](texl-primer.md) and the
  [Texl manual](https://onlabsorg.github.io/texl/): the language.
