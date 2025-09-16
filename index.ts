// TODO: move this next to the test as that's the only place it should be used.
// TODO: import this as a pacckage, not a file path
// import wasm from './pkg/bun_wasm_demo_bg.wasm'
import { add } from './demo/rust/pkg'

console.log(add(2))
