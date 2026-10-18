# Texl primer for editor work

*What you need to know about Texl to work on the editor, as of Texl 0.2
(`@onlabsorg/texl` on npm), 2026-10-18. The full manual is at
<https://onlabsorg.github.io/texl/>; the source is
<https://github.com/onlabsorg/texl>. The results shown below were checked
against the real engine.*

## Templates and tags

A Texl template is ordinary text (here: Markdown) with *tags*. A tag starts
at `<%` and ends at the first `%>`, and holds one expression in the **Swan**
language. Rendering replaces each tag with its value as text, and keeps the
rest of the text unchanged.

```texl
<% name = "Ada", items = 3 %>Dear <% name %>,
your order of <% items %> items has shipped.
```

```text
Dear Ada,
your order of 3 items has shipped.
```

- Tags are evaluated **in order, top to bottom, in one shared scope**: a name
  bound in one tag is visible in all later tags, never in earlier ones.
- A tag can span several lines. `#` starts a comment to the end of the line.
- Several steps in one tag are separated by commas.

### From values to text

| Value              | Output                          |
|--------------------|---------------------------------|
| text               | the text itself, without quotes |
| number             | `42`, `3.5`, `-0.25`            |
| boolean            | `TRUE` or `FALSE`               |
| `Nothing`          | nothing at all                  |
| tuple              | items separated by `, `         |
| list               | `[[List of N]]`                 |
| namespace          | `[[Namespace of N]]`            |
| function           | `[[Func]]`                      |
| undefined value    | `[[Undefined]]`                 |
| promise            | its value, once it resolves     |

An assignment such as `<% x = 2 %>` and a comment-only tag `<%# note %>`
render as nothing. A line break right after a tag stays in the output.

## Swan in brief

Swan is small, dynamically typed and expression-only (no statements).

- **Values:** numbers, text (`"..."`, no escape sequences), booleans, lists
  `[1, 2, 3]`, namespaces `{name: "Ada", age: 36}`, functions
  `x -> x * 2` or `(a, b) -> a + b`, tuples `(1, 2)`, `Nothing` (the empty
  tuple), promises, and undefined values.
- **Binding:** `x = 10` binds a name in the current scope. `bind "name" value`
  binds an engine-wide name (used to keep data loaded by an import).
- **Calls:** by juxtaposition: `f x`, `f (a, b)`, `text.from 3`.
- **Access:** `ns.member`; lists are indexed by calling them: `items 0`.
- **Conditions:** `cond ? then ; else`. `a ; b` gives `b` when `a` is
  `Nothing` (a fallback).
- **Mapping:** `list.enum items => f` applies `f` to each item.
- **Promises:** `p ~> (v -> ...)` applies a function once `p` resolves.
- **Tuples** are flat, and operators apply item by item:
  `(10, 20) + (1, 2)` is `(11, 22)`. A single value pairs with the first
  item only: `(1, 2) * 10` is `(10, Undefined)`.
- **Built-in namespaces:** `bool`, `numb`, `text`, `list`, `nspace`, `math`,
  `time`, `promise`, `undef`, and `texl` (for `texl.import`).

### Errors never stop rendering

Every error, including a syntax error, produces an **undefined value**,
which flows on like any other value and renders as `[[Undefined]]`. A broken
cell therefore never breaks the document; the editor should show such values
clearly (`undef.inspect` gives details). Promises never reject: a failure
resolves to `Nothing`.

## Documents and imports

A *document* is a template loaded by URL. `texl.import(uri)` loads, renders
and returns a promise of `{uri, source, data, rendering}`: its source text,
the names its tags bound, and its rendered text. Documents act as partials,
libraries or data sources:

```texl
<% texl.import("lib/format.texl") ~> (lib -> bind "fmt" lib.data) %>
You ordered <% fmt.plural (3, "book") %>.
```

- Rendering waits at a tag whose value is a promise, so names bound in its
  callback are available to the following tags.
- Relative URIs resolve against the importing document's URL. Templates
  rendered from a string (as the editor does) resolve them against the root
  of the engine's base URL.
- Each document is loaded and rendered **once per engine** and cached; create
  a new engine to see changes to imported documents.
- An imported document sees the importer's names *as they are at the time of
  the import*.

This is the mechanism the OnLabs platform builds on: links between documents
are imports through a platform URL scheme.

## The JavaScript API (`@onlabsorg/texl`)

```js
import init, { TexlEngine } from "@onlabsorg/texl";

await init();                                   // load the wasm module, once
const engine = new TexlEngine(globals, baseUrl); // both optional
await engine.render("2 + 2 = <% 2 + 2 %>");     // fresh scope: "2 + 2 = 4"
const doc = await engine.load("report.texl");   // {uri, source, data, rendering} or null
engine.set("today", "2026-10-18");              // global for all templates
```

A **context** is a scope that keeps its names across renders. The editor
uses one context per rendering pass and renders the cells in order into it:

```js
const context = engine.createContext({ price: 12.5 });
await context.render("<% total = price * 4 %>");
context.get("total");                          // 50
await context.render("Total: <% total %>");    // "Total: 50"
context.names();                               // ["price", "texl", "total"]
context.free();
```

`context.names()` after each cell gives the names visible to the next cells:
the basis for autocompletion ("intellisense").

### Values between JavaScript and Swan

| JavaScript → Swan                         | Swan → JavaScript               |
|-------------------------------------------|---------------------------------|
| `null`, `undefined` → `Nothing`           | `Nothing` → `null`              |
| boolean, number, string → same            | `Bool`, `Numb`, `Text` → same   |
| array → `List`                            | `List`, `Tuple` → array         |
| Promise / thenable → `Promise`            | `Promise` → Promise             |
| function → `Func`                         | `Namespace` → plain object      |
| other object → `Namespace`                | `Func`, `Undefined` → `undefined` |

A JavaScript function becomes a Swan function of **one** argument; a Swan
call with several arguments passes them as one array (`add: ([a, b]) => a +
b`). If it throws, the result is `Nothing`; an `async` function gives a
promise, and the tag waits for it. Host functions are how the editor (and
later the platform) can offer cell helpers, such as a table renderer, to
documents.

### Loading the module with a bundler

`texl_wasm.js` loads `texl_wasm_bg.wasm` by a URL relative to itself. Vite's
dependency pre-bundling breaks that, so `vite.config.js` excludes
`@onlabsorg/texl` from `optimizeDeps`. Pages must be served over HTTP.
