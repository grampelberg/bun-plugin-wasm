import { beforeAll, expect, test } from 'bun:test'

import { spawn } from 'bun'
import ora from 'ora'

// This is to make sure --watch restarts when edits happen to the entrypoint
// import '../index.ts'

import wasmPlugin from './lib.ts'
import { log } from './log.ts'

const WASM_PATH = './demo/rust'

// beforeAll(async () => {
//   const spinner = ora('Building WASM').start()
//   const proc = spawn(['wasm-pack', 'build'], {
//     cwd: WASM_PATH,
//     stderr: 'pipe',
//   })

//   await proc.exited
//   const stderr = `\n${await proc.stderr.text()}`
//   if (proc.exitCode !== 0) {
//     spinner.fail('Failed to build WASM')
//     log.error(stderr)
//     throw new Error('Failed to build WASM')
//   }

//   spinner.succeed(`WASM compiled`)
//   log.debug('compilation', stderr)
// })

// TODO: make this into a case test for valid and invalid input
test('build', async () => {
  const result = await Bun.build({
    entrypoints: ['./index.ts'],
    // TODO: this should probably be on a per-test run basis
    outdir: './dist',
    plugins: [wasmPlugin],
  })

  expect(result.success).toBe(true)

  expect(result.logs).toBeEmpty()
})
