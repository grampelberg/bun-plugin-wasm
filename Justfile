install:
    mise install
    wasm-pack build rust --target bundler
    bun install

release: install
    npm version patch
    npm publish --access public

clean:
    git clean -Xdf
