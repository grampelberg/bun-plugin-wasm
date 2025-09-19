// This tests that wasm can be imported with a relative path that isn't mangled.
// Note: this assumes that the imports are relative to the file.
import * as wasm from '../../rust/pkg/bun_wasm_demo_bg.wasm'

console.log(wasm.add(3, 4))
