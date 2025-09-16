import path from 'node:path'

import type { BunPlugin, PluginBuilder, TranspilerOptions } from 'bun'
import { type OnLoadArgs, plugin, Transpiler } from 'bun'
import { createPatch } from 'diff'
import type { ILogObj, Logger } from 'tslog'

import { name } from '../package.json'
import { levelMap, log as rootLog } from './log.ts'
import transform from './transform.ts'

const log: Logger<ILogObj> = rootLog.getSubLogger({ name: 'plugin' })

type JavaScriptLoader = NonNullable<TranspilerOptions['loader']>

function isJavaScriptLoader(loader?: string): loader is JavaScriptLoader {
  return (
    loader === 'js' || loader === 'jsx' || loader === 'ts' || loader === 'tsx'
  )
}

const wasmPlugin: BunPlugin = {
  name,
  setup(build: PluginBuilder): void {
    build.onLoad(
      { filter: /.(js|ts)x?$/ },
      async ({ path: fname, loader }: OnLoadArgs) => {
        const result = {
          contents: await Bun.file(fname).text(),
          loader,
        }

        if (!loader) {
          const ext = path.extname(fname).slice(1)
          if (isJavaScriptLoader(ext)) {
            result.loader = ext
          }
        }

        if (!isJavaScriptLoader(result.loader)) {
          return result
        }

        const imps = new Transpiler({ loader: result.loader }).scanImports(
          result.contents,
        )

        if (imps.find(i => i.path.endsWith('.wasm'))) {
          const contents = transform(result.contents, fname, result.loader)

          if (log.settings.minLevel <= (levelMap.debug || 0)) {
            log.debug(
              'transformed',
              '\n',
              createPatch(fname, result.contents, contents),
            )
          }

          result.contents = contents
        }

        return result
      },
    )
  },
}

plugin(wasmPlugin)

export default wasmPlugin
