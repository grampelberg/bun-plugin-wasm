import {
  afterAll,
  beforeAll,
  type CustomMatcher,
  describe,
  expect,
  type MatcherResult,
  test,
} from 'bun:test'
import { readdir, rmdir } from 'node:fs/promises'
import path from 'node:path'

import { randomUUIDv7, spawn, type Target } from 'bun'
import ora from 'ora'

// This is to make sure --watch restarts when edits happen to the entrypoint
// import '../index.ts'

import wasmPlugin from './lib.ts'
import { log } from './log.ts'

const WASM_PATH = './demo/rust'
const ARTIFACT_DIR = './test'

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
  const targets = ['browser', 'node']
  const key = randomUUIDv7()

  log.debug('run id:', key)

  expect.extend({
    valueEndsWith(
      actual: Array<Object>,
      key: string,
      ending: string,
    ): MatcherResult {
      for (const item of actual) {
        if (key in item && item[key].endsWith(ending)) {
          return {
            message: () => `did not expect ${this.utils.printExpected(key)}
              to have a value ending with ${this.utils.printExpected(ending)}
              in ${this.utils.printReceived(item)}`,
            pass: true,
          }
        }
      }

      return {
        message: () => `expected ${this.utils.printExpected(key)}
          to have a value ending with ${this.utils.printExpected(ending)}
          in ${this.utils.printReceived(actual)}`,
        pass: false,
      }
    },
  })

  describe.each(targets)('target: %s', async target => {
    const result = await Bun.build({
      entrypoints: ['./index.ts'],
      // TODO: this should probably be on a per-test run basis
      outdir: path.join(ARTIFACT_DIR, key, target),
      // target: target as Target,
      plugins: [wasmPlugin],
    })

    expect(result.success).toBe(true)

    expect(result.logs).toBeEmpty()

    expect(result.outputs).valueEndsWith('path', '.wasm')

    const entry = result.outputs.find(o => o.kind === 'entry-point')

    expect(entry).toBeDefined()

    const content = await Bun.file(entry.path).text()

    // console.log(content)

    try {
      expect(content).toContain('WebAssembly.compileStreaming')
    } catch {
      throw new Error(
        `couldn't find WebAssembly.compileStreaming in the output, see file for full output:\n\t${entry.path}`,
      )
    }
  })

  afterAll(async () => {
    await rmdir(path.join(ARTIFACT_DIR, key), { recursive: true })
  })
})
