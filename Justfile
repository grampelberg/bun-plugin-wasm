install:
    mise install
    wasm-pack build rust --target bundler
    bun install

clean:
    git clean -Xdf
