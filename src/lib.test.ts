import {
  afterAll,
  beforeAll,
  type CustomMatcher,
  describe,
  expect,
  type MatcherResult,
  test,
} from 'bun:test'
import { access, rmdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { $, randomUUIDv7, spawn } from 'bun'
import index from 'demo/index'
import ora from 'ora'
import puppeteer from 'puppeteer'

// This is to make sure --watch restarts when edits happen to the entrypoint
// import '../index.ts'

import wasmPlugin from './lib.ts'
import { log } from './log.ts'

const WASM_PATH = './rust'
const ARTIFACT_DIR = './test'

beforeAll(async () => {
  const spinner = ora('Building WASM').start()

  if (await stat(path.join(WASM_PATH, 'pkg'))) {
    spinner.warn('WASM build skipped, already exists')

    return
  }

  const proc = spawn(['wasm-pack', 'build'], {
    cwd: WASM_PATH,
    stderr: 'pipe',
  })

  await proc.exited
  const stderr = `\n${await proc.stderr.text()}`
  if (proc.exitCode !== 0) {
    spinner.fail('Failed to build WASM')
    log.error(stderr)
    throw new Error('Failed to build WASM')
  }

  spinner.succeed(`WASM compiled`)
  log.debug('compilation', stderr)
})

// Verifies that the build correctly rewrites and includes WASM as an asset
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
      expect(content).toContain('WebAssembly.instantiateStreaming')
    } catch {
      throw new Error(
        `couldn't find WebAssembly.instantiateStreaming in the output, see file for full output:\n\t${entry.path}`,
      )
    }
  })

  afterAll(async () => {
    await rmdir(path.join(ARTIFACT_DIR, key), { recursive: true })
  })
})

const randomPort = (): number =>
  Math.floor(Math.random() * (65535 - 49152 + 1) + 49152)

// Verifies that the demo "works", aka it doesn't htrow an error when loading
test('[slow] serve', async () => {
  const hmr = [false, true]

  describe.each(hmr)(`hmr: %s`, async hmr => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    const port = randomPort()

    // Note: you need the serve.static configuration in bunfig.toml to pick up
    // the plugin.
    Bun.serve({
      port,
      routes: {
        '/*': index,
      },
      development: {
        hmr,
        console: true,
      },
    })

    const errors: Array<Error> = []

    page.on('pageerror', error => {
      errors.push(error)
    })

    page.on('console', msg => {
      log.debug(`console.${msg.type()}`, msg.text(), msg.args())

      if (msg.type() !== 'error') return

      errors.push(
        new Error(
          `console.error() received, check log for details: ${msg.text()}`,
        ),
      )
    })

    await page.goto(`http://localhost:${port}`)

    await browser.close()

    expect(errors).toBeEmpty()
  })
})

test('[slow] run', async () => {
  const { exitCode, stdout, stderr } = await $`bun run index.ts`
    .nothrow()
    .quiet()

  try {
    expect(exitCode).toBe(0)
  } catch {
    throw new Error(
      `process exited ${exitCode}, stderr:\n${stderr}\n, stdout:\n${stdout}`,
    )
  }
})
