import path from 'node:path'

// biome-ignore lint: tsc doesn't like that there are no types for babel/core
// @ts-ignore
import { transform } from '@babel/core'
import type { PluginObj } from 'babel-core'
import type { NodePath } from 'babel-traverse'
import type { ImportDeclaration } from 'babel-types'
import type {
  BunPlugin,
  OnLoadArgs,
  PluginBuilder,
  TranspilerOptions,
} from 'bun'
import { plugin, Transpiler } from 'bun'
import type { ILogObj, Logger } from 'tslog'

import { name } from '../package.json'
import { log as rootLog } from './log.ts'

const log: Logger<ILogObj> = rootLog.getSubLogger({ name: 'plugin' })

type BabelTypes = typeof import('babel-types')

type JavaScriptLoader = TranspilerOptions['loader']

function isJavaScriptLoader(loader?: string): loader is JavaScriptLoader {
  return (
    loader === 'js' || loader === 'jsx' || loader === 'ts' || loader === 'tsx'
  )
}

/* Super naive converstion of [import-wasm-source](https://babeljs.io/docs/babel-plugin-proposal-import-wasm-source) that works without the "source" keyword.
 */
function importWasm({ types: t }: { types: BabelTypes }): PluginObj {
  return {
    name,
    visitor: {
      ImportDeclaration(path: NodePath<ImportDeclaration>): void {
        if (!path.node.source.value.endsWith('.wasm')) {
          return
        }

        const specifier = path.node.specifiers?.[0]

        if (!specifier) {
          return
        }

        path.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              specifier.local,

              t.awaitExpression(
                t.callExpression(
                  t.memberExpression(
                    t.identifier('WebAssembly'),
                    t.identifier('compileStreaming'),
                  ),
                  [
                    t.callExpression(t.identifier('fetch'), [
                      t.callExpression(
                        t.memberExpression(
                          t.metaProperty(
                            // biome-ignore lint: the types don't seem to have been updated.
                            // @ts-ignore
                            t.identifier('import'),
                            t.identifier('meta'),
                          ),
                          t.identifier('resolve'),
                        ),
                        [path.node.source],
                      ),
                    ]),
                  ],
                ),
              ),
            ),
          ]),
        )
      },
    },
  }
}

export const wasmPlugin: BunPlugin = {
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
          log.debug('updating import', { path: fname })

          const source = await transform(result.contents, {
            plugins: [importWasm],
          })

          if (source?.code) {
            result.contents = source.code
          }
        }

        return result
      },
    )
  },
}

plugin(wasmPlugin)

export default wasmPlugin
