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

- All logging is controlled via `LOG_LEVEL`.

## TODO

- [x] Pull `demo/rust` in as a package for the test
- [ ] Get the node version working
- [ ] Put the GHA scaffolding in place
- [ ] Add release workflow
- [ ] Add index.ts to test watchlist
  - [ ] Add demo/src/index.ts to test watchlist (the server reloads, but tests
        don't rerun).
- [ ] Move index.ts to somewhere else, maybe a test assets folder?
- [ ] Why does `import ./rust/pkg/bun_Wasm_demo_bg.js` not work?
- [ ] Add test case to verify that relative paths are in all rewritten rules
      (`./foo_bg.js`)
- [ ] Add test case that handles `../`, `./` and `/` paths. Does there need to
      be a case for module imports as well?
- [ ] Include `LOG_LEVEL` setting from the test runner in the `bun run` call
