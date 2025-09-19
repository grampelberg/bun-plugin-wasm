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

import wasmPlugin from './lib.ts'
import { log } from './log.ts'

// These import adds the runtime file to test's watch list but loads it as an
// asset (aka file) so that there's nothing funny going on.
import './__fixtures__/import.ts' with { type: 'file' }
import 'demo/index' with { type: 'file' }

const WASM_PATH = './rust'
const ARTIFACT_DIR = './test'
const FIXTURES_DIR = './src/__fixtures__'

// Verifies that the build correctly rewrites and includes WASM as an asset
test('build', async () => {
  const targets = ['browser', 'node']
  const entrypoints = ['import.ts', 'relative.ts']
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
    describe.each(entrypoints)('path: %s', async entrypoint => {
      const result = await Bun.build({
        entrypoints: [path.join(FIXTURES_DIR, entrypoint)],
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

      try {
        expect(content).toContain('WebAssembly.instantiateStreaming')
      } catch {
        throw new Error(
          `couldn't find WebAssembly.instantiateStreaming in the output, see file for full output:\n\t${entry.path}`,
        )
      }
    })

    afterAll(async () => {
      try {
        await rmdir(path.join(ARTIFACT_DIR, key), { recursive: true })
      } catch {
        log.debug('asset directory cleanup failed, continuing')
      }
    })
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

const header = (msg: string): string => {
  const width = 80

  const totalPadding = width - msg.length
  const left = Math.floor(totalPadding / 2)
  const right = totalPadding - left

  return `${'='.repeat(left)} ${msg} ${'='.repeat(right)}\n`
}

const debugSection = (name: string, ...args: string[]): void => {
  log.debug('\n', header(name), ...args)
}

test('[slow] run', async () => {
  if ('LOG_LEVEL' in process.env) {
    $.env({ LOG_LEVEL: process.env.LOG_LEVEL })
  }

  const { exitCode, stdout, stderr } =
    await $`bun run ${path.join(FIXTURES_DIR, 'import.ts')}`.nothrow().quiet()

  debugSection('stdout', stdout.toString())
  debugSection('stderr', stderr.toString())

  try {
    expect(exitCode).toBe(0)
  } catch {
    throw new Error(`process exited ${exitCode}`)
  }

  expect(stdout.toString()).toContain('.....test complete.....')
})
