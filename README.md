# bun-web-wasm

Plugin that enables loading `wasm-pack` packages in Bun. Check out the
[demo](demo) to see it in action.

## Getting Started

Add the package to your project:

```sh
bun add -d @grampelberg/bun-web-wasm
```

Then, for the dev server, edit `bunfig.toml` to include:

```toml
[serve.static]
plugins = ["@grampelberg/bun-web-wasm"]
```

For builds:

```ts
Bun.build({
  ...
  plugins: ["@grampelberg/bun-web-wasm"],
})
```

To use `bun run`, edit `bunfig.toml` to include:

```toml
preload = ["@grampelberg/bun-web-wasm"]
```

## How does it work?

During compilation, the plugin looks for any file that imports something ending
in `.wasm` and rewrites its source so that it can be correctly loaded. This is
because bun treats `.wasm` files as assets and does not try to bundle them. See
[the proposal](https://babeljs.io/docs/babel-plugin-proposal-import-wasm-source)
for how this might end up looking in the future.

In this instance, the file is rewritten like:

```diff
Index: rust/pkg/bun_wasm_demo.js
===================================================================
--- rust/pkg/bun_wasm_demo.js
+++ rust/pkg/bun_wasm_demo.js
@@ -1,5 +1,7 @@
-import * as wasm from "./bun_wasm_demo_bg.wasm";
+import * as __bun_wasm_import_0 from "./bun_wasm_demo_bg.js";
+import * as __bun_import_wasm_wasm from "./bun_wasm_demo_bg.wasm";
+const wasm = (await WebAssembly.instantiateStreaming(fetch(__bun_import_wasm_wasm.default || __bun_import_wasm_wasm), { "./bun_wasm_demo_bg.js": __bun_wasm_import_0 })).instance.exports;
export * from "./bun_wasm_demo_bg.js";
import { __wbg_set_wasm } from "./bun_wasm_demo_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
```

The long `WebAssembly.instantiateStreaming` line is the most important here. It
is:

- Relying on the `__bun_import_wasm_wasm` value to be the path `.wasm` can be
  loaded from the server.
- Fetches, compiles and then instantiates the module.
- Sets the original `wasm` variable to the exports of the instantiated module.

There are handlers to allow for loading WASM in
[webpack](https://github.com/WebAssembly/esm-integration) and
[vite](https://github.com/Menci/vite-plugin-wasm).

## Development

There are some extra things that need to be done. To get this working, first
install [mise](https://mise.jdx.dev) and run:

```bash
mise install
```

Then, you'll want to run:

```bash
just install
```

This will do some install/compilation that is needed to run the tests.

- All logging is controlled via `LOG_LEVEL`.

## TODO

- [ ] Put the GHA scaffolding in place
- [ ] Add release workflow
