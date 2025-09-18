import fs from 'node:fs'
import path from 'node:path'

import type { TranspilerOptions } from 'bun'
import * as ts from 'typescript'

import { log } from './log.ts'

type JavaScriptLoader = NonNullable<TranspilerOptions['loader']>

type ModuleImportSource = {
  module: string
}

type ModuleImport = {
  key: string
  ident: ts.Identifier
  node: ts.ImportDeclaration
}

function scriptKindFromLoader(loader?: JavaScriptLoader): ts.ScriptKind {
  switch (loader) {
    case 'js':
      return ts.ScriptKind.JS
    case 'jsx':
      return ts.ScriptKind.JSX
    case 'ts':
      return ts.ScriptKind.TS
    case 'tsx':
      return ts.ScriptKind.TSX
    default:
      return ts.ScriptKind.Unknown
  }
}

const resolvePath = (fname: string, modPath: string): string => {
  const actual = path.join(path.dirname(fname), modPath)
  if (!fs.existsSync(actual))
    throw new Error(`not using a supported path: ${modPath}
  File: ${fname}`)

  return actual
}

const getVarName = (node: ts.ImportDeclaration): ts.Identifier | undefined => {
  const clause = node.importClause
  if (!clause) return
  if (clause.name) return clause.name

  const bindings = clause.namedBindings
  if (!bindings) return

  if (ts.isNamespaceImport(bindings)) return bindings.name

  return
}

const debugNode = (node: ts.Node): string => {
  const printer = ts.createPrinter()
  const src = ts.createSourceFile('debug.ts', '', ts.ScriptTarget.Latest, true)
  return printer.printNode(ts.EmitHint.Unspecified, node, src)
}

const toCompile = (fname: string) => {
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    const { factory } = ctx

    /* Update an import clause to use the internal name (__bun_import_wasm_*)
     */
    const updateName = (
      node: ts.ImportClause,
      name: string,
    ): ts.ImportClause => {
      const nameIdent = factory.createIdentifier(name)

      if (node.name) {
        return factory.updateImportClause(
          node,
          node.phaseModifier,
          nameIdent,
          node.namedBindings,
        )
      }

      if (node.namedBindings && ts.isNamespaceImport(node.namedBindings)) {
        return factory.updateImportClause(
          node,
          node.phaseModifier,
          node.name,
          factory.updateNamespaceImport(node.namedBindings, nameIdent),
        )
      }

      throw new Error(`unsupported import clause: ${debugNode(node)}`)
    }

    /* Replaces the original import with the WASM exports.
     *
     *   const foo = (await ...).instance.exports
     */
    const getVarAssignment = (
      modExport: ts.PropertyAccessExpression,
      varName: ts.Identifier,
    ): ts.VariableStatement =>
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              varName,
              undefined,
              undefined,
              modExport,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      )

    /* Accesses `.instance.exports` from the instantiate call.
     *
     *   (await WebAssembly.instantiateStreaming(...)).instance.exports
     *
     * We only care about the exports and need them for others to access.
     */
    const getModExportNode = (
      compileCall: ts.AwaitExpression,
    ): ts.PropertyAccessExpression =>
      factory.createPropertyAccessExpression(
        factory.createPropertyAccessExpression(
          compileCall,

          factory.createIdentifier('instance'),
        ),
        factory.createIdentifier('exports'),
      )

    /* Creates the fetch call.
     *
     *   fetch(__bun_wasm_import_foo.default || __bun_wasm_import_foo)
     *
     * Looking first at `.default` allows for imports of wasm to either be
     * namespaced or rely on the default import:
     *
     *   import foo from './foo.wasm'
     *   import * as foo from './foo.wasm'
     *
     * Ideally, the namespaced version is only ever used as that is what wasm-pack
     * does today.
     */
    const getFetchNode = (nameIdent: ts.Identifier): ts.CallExpression =>
      factory.createCallExpression(
        factory.createIdentifier('fetch'),
        undefined,
        [
          factory.createBinaryExpression(
            factory.createPropertyAccessExpression(
              nameIdent,
              factory.createIdentifier('default'),
            ),
            factory.createToken(ts.SyntaxKind.BarBarToken),
            nameIdent,
          ),
        ],
      )

    /* Creates the WebAssembly.instantiate call.
     *
     * Takes a fetch call with the correct URL to the WASM file and a object
     * with the key used to import inside WASM (eg `./foo_bg.js`) and the
     * identifier that contains those contents (eg `__bun_wasm_import_0`).
     *
     *    WebAssembly.instantiateStreaming(fetch('./foo_bg.wasm'), {
     *      "./foo_bg.js": __bun_wasm_import_0,
     *    })
     *
     * Note: this does *not* use the `import.meta.resolve` API. Unfortunately,
     * in this instance, the result of this API is relative to the current browser's
     * URL and *not* the actual asset location.
     */
    const getCompileNode = (
      fetchCall: ts.CallExpression,
      modImports: ModuleImport[],
    ): ts.AwaitExpression =>
      factory.createAwaitExpression(
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier('WebAssembly'),
            factory.createIdentifier('instantiateStreaming'),
          ),
          undefined,
          [
            fetchCall,
            factory.createObjectLiteralExpression(
              modImports.map(m =>
                factory.createPropertyAssignment(
                  factory.createStringLiteral(m.key),
                  m.ident,
                ),
              ),
            ),
          ],
        ),
      )

    /* transfomrs a wasm import statment into something that is namespaced.
     *
     * import * as foo from './foo.wasm'
     *   -->
     * import * as __bun_import_wasm_foo from './foo.wasm'
     *
     * This allows us to transparently take the original value (let's call it foo)
     * and assign that to the WebAssembly.instantiate call. The original value
     * is the path that the file exists on the server because bun treats WASM
     * as assets today.
     */
    const updateImport = (
      node: ts.ImportDeclaration,
      internalName: string,
    ): ts.ImportDeclaration => {
      if (!node.importClause) {
        throw new Error(`no import clause: ${debugNode(node)}`)
      }

      return factory.updateImportDeclaration(
        node,
        node.modifiers,
        updateName(node.importClause, internalName),
        node.moduleSpecifier,
        node.attributes,
      )
    }

    /* Creates a simple import, helper for getImports.
     */
    const getModImportNode = (
      ident: ts.Identifier,
      importPath: string,
    ): ts.ImportDeclaration => {
      return factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamespaceImport(ident),
        ),
        factory.createStringLiteral(importPath),
        undefined,
      )
    }

    /* Parses the imports from a WASM file and returns import statements.
     *
     * If the module has something like:
     *   [{
     *     module: './foo_bg.js',
     *   }]
     *
     * This gets transformed into an import statement:
     *
     *   import * as __bun_wasm_import_0 from './foo_bg.js'
     *
     * The literal is then used as part of the WebAssembly.instantiate call to
     * provide the module with imports that it requires.
     *
     * Note: this has some assumptions in it that are very specific to how
     * wasm-pack bundling works today. While it might work with some other
     * configurations, the module needs to be relative and laid out something like:
     *
     *   ./foo_bg.wasm
     *   ./foo_bg.js
     *   ./foo.js
     */
    const getImports = (wasmImport: string): ModuleImport[] => {
      log.debug(`getImports`, { fname, wasmImport })

      try {
        const mod = new WebAssembly.Module(
          fs.readFileSync(fs.openSync(resolvePath(fname, wasmImport), 'r')),
        )

        const importPaths = WebAssembly.Module.imports(mod).reduce(
          (acc, cur: ModuleImportSource) => {
            acc.add(cur.module)
            return acc
          },
          new Set<string>(),
        )

        return Array.from(importPaths).map((importPath, i) => {
          const relativePath =
            path.dirname(wasmImport) === '.'
              ? importPath
              : path.join(path.dirname(wasmImport), importPath)

          const ident = factory.createIdentifier(`__bun_wasm_import_${i}`)
          return {
            key: importPath,
            ident,
            node: getModImportNode(ident, relativePath),
          }
        })
      } catch (e) {
        throw new Error(`failed to compile ${fname}: ${e}`)
      }
    }

    // TODO: this needs to use import.meta.resolve instead of the double step
    const visit: ts.Visitor = (node: ts.Node): ts.Node => {
      if (
        !ts.isImportDeclaration(node) ||
        (ts.isStringLiteral(node.moduleSpecifier) &&
          // TODO: update this to a type check for WASM
          !node.moduleSpecifier.text.endsWith('.wasm')) ||
        node.importClause?.phaseModifier
      )
        return ts.visitEachChild(node, visit, ctx)

      const varName = getVarName(node)

      if (!varName || !node.importClause) return node

      const modImports = getImports(node.moduleSpecifier.text)

      const internalName = `__bun_import_wasm_${varName.text}`

      const importNode = updateImport(node, internalName)

      const nameIdent = factory.createIdentifier(internalName)
      const fetchNode = getFetchNode(nameIdent)
      const compileCall = getCompileNode(fetchNode, modImports)
      const modExport = getModExportNode(compileCall)
      const localVar = getVarAssignment(modExport, varName)

      return [...modImports.map(m => m.node), importNode, localVar]
    }

    return (node: ts.Node): ts.Node => ts.visitEachChild(node, visit, ctx)
  }
}

// TODO: generate differently based on node vs browser.
export function transform(
  sourceText: string,
  fileName: string,
  loader: JavaScriptLoader,
): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    scriptKindFromLoader(loader),
  )

  const result = ts.transform(sourceFile, [toCompile(fileName)])
  if (result.transformed.length === 0) {
    return sourceText
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  return printer.printFile(result.transformed[0] as ts.SourceFile)
}

export default transform
