install:
    mise install
    wasm-pack build rust --target bundler
    bun install --frozen-lockfile

clean:
    git clean -Xdf
