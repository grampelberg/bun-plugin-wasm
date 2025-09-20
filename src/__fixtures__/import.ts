// This tests importing a package that was built with wasm-pack.
// biome-ignore lint/correctness/noUndeclaredDependencies: workspace dependency
import { add } from 'bun-wasm-demo'

console.log(add(2, 3))
console.log('.....test complete.....')
