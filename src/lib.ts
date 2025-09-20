import path from 'node:path'

import type {
  BunPlugin,
  OnLoadArgs,
  PluginBuilder,
  TranspilerOptions,
} from 'bun'
import { Transpiler } from 'bun'
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
          return build.config?.target === 'browser' ? undefined : result
        }

        const imps = new Transpiler({ loader: result.loader }).scanImports(
          result.contents,
        )

        if (!imps.find(i => i.path.endsWith('.wasm'))) {
          return build.config?.target === 'browser' ? undefined : result
        }

        const contents = transform(result.contents, {
          // When `bun run` is used, the target doesn't get set, but we can
          // assume that it is `bun`. All the browser examples appear to
          // correctly set the config object.
          target: build.config?.target || 'bun',
          path: fname,
          loader: result.loader,
        })

        if (log.settings.minLevel <= (levelMap.debug || 0)) {
          log.debug(
            'transformed',
            '\n',
            createPatch(fname, result.contents, contents),
          )
        }

        result.contents = contents

        return result
      },
    )
  },
}

export default wasmPlugin
