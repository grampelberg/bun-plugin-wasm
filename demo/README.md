# demo

To run, you'll want to first install the Rust dependencies, the easiet way to do this is:

```bash
mise install
```

If you don't have `mise` installed, you can install it with:

```bash
cargo install wasm-pack
```

Then, build the Rust code to WebAssembly:

```bash
cd ../rust && wasm-pack build
```
