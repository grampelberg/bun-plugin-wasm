import * as stuff from '../rust/pkg/bun_wasm_demo.js'

// import wasm from '../rust/pkg/bun_wasm_demo_bg.wasm'

// async function parseWasm(wasmFilePath: string): Promise<WasmInfo> {
//   try {
//     const wasmBinary = await (await fetch(wasmFilePath)).arrayBuffer()
//     const wasmModule = await WebAssembly.compile(wasmBinary)
//     const imports = Object.entries(
//       WebAssembly.Module.imports(wasmModule).reduce(
//         (result, item) => ({
//           ...result,
//           [item.module]: [...(result[item.module] || []), item.name],
//         }),
//         {} as Record<string, string[]>,
//       ),
//     ).map(([from, names]) => ({ from, names }))

//     const exports = WebAssembly.Module.exports(wasmModule).map(
//       item => item.name,
//     )

//     return { imports, exports }
//   } catch (e) {
//     throw new Error(`Failed to parse WASM file: ${e.message}`)
//   }
// }

// const { imports, exports } = await parseWasm(wasm)

// const importObject = imports.map(({ from, names }, i) => {
//   return {
//     key: JSON.stringify(from),
//     value: names.map(name => {
//       return {
//         key: JSON.stringify(name),
//         value: `__vite__wasmImport_${i}[${JSON.stringify(name)}]`,
//       }
//     }),
//   }
// })

// const mod = await WebAssembly.instantiateStreaming(fetch(wasm), {
//   './bun_wasm_demo_bg.js': stuff,
// })

console.log(stuff.add(2))
