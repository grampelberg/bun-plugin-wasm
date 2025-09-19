// This tests importing a package that was built with wasm-pack.
import { add } from 'bun-wasm-demo'

console.log(add(2, 3))
console.log('.....test complete.....')
