import { createRequire } from 'node:module'
import path from 'node:path'

import type { BunPlugin, PluginBuilder } from 'bun'
import { pathToFileURL } from 'bun'
import type { ILogObj, Logger } from 'tslog'

import { name as projectName } from '../package.json'
import { log as rootLog } from './log.ts'

const log: Logger<ILogObj> = rootLog.getSubLogger({ name: 'plugin' })

async function base64Text(file: string): Promise<string> {
  const content = Buffer.from(await Bun.file(file).arrayBuffer()).toString(
    'base64',
  )
  return `data:application/wasm;base64,${content}`
}

export const wasmPlugin: BunPlugin = {
  name: 'wasm',
  setup(build: PluginBuilder): void {
    build.onStart(() => {
      log.debug('Starting')
    })

    build.onResolve({ filter: /\.wasm$/ }, args => ({
      path: createRequire(args.importer).resolve(args.path),
      namespace: projectName,
    }))

    build.onLoad(
      { filter: /.*/, namespace: projectName },
      async ({ path: fname }) => {
        log.debug('load', { path: fname })

        return {
          contents: await Bun.file(fname).text(),
          loader: 'file',
          // resolveDir: path.dirname(fname),
        }
      },
    )
  },
}
