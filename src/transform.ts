import type { BunPlugin, PluginBuilder, TranspilerOptions } from 'bun'
import * as ts from 'typescript'

import { log } from './log.ts'

type JavaScriptLoader = NonNullable<TranspilerOptions['loader']>

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

const getVarName = (node: ts.ImportDeclaration): ts.Identifier | undefined => {
  const clause = node.importClause
  if (!clause) return
  if (clause.name) return clause.name

  const bindings = clause.namedBindings
  if (!bindings) return

  if (ts.isNamespaceImport(bindings)) return bindings.name
  if (bindings.elements.length > 0) return bindings.elements[0].name

  return
}

/* Transforms normal imports into something that loads WASM correctly.
 *
 *
 */
const toCompile: ts.TransformerFactory<ts.SourceFile> = ctx => {
  const { factory } = ctx

  const other = (node: ts.Node): ts.Node => {
    console.log('yay')

    return ts.visitEachChild(node, other, ctx)
  }

  const visit: ts.Visitor = (node: ts.Node): ts.Node => {
    if (
      !ts.isImportDeclaration(node) ||
      (ts.isStringLiteral(node.moduleSpecifier) &&
        !node.moduleSpecifier.text.endsWith('.wasm')) ||
      node.importClause?.phaseModifier
    )
      return ts.visitEachChild(node, visit, ctx)

    const varName = getVarName(node)

    if (!varName) return node

    const assetPath = factory.createCallExpression(
      factory.createIdentifier('import'),
      undefined,
      [factory.createStringLiteral(node.moduleSpecifier.text)],
    )

    const fetchCall = factory.createCallExpression(
      factory.createIdentifier('fetch'),
      undefined,
      [assetPath],
    )

    const compileCall = factory.createAwaitExpression(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier('WebAssembly'),
          factory.createIdentifier('compileStreaming'),
        ),
        undefined,
        [fetchCall],
      ),
    )

    return factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            varName,
            undefined,
            undefined,
            compileCall,
          ),
        ],
        ts.NodeFlags.Const,
      ),
    )
  }

  return (node: ts.Node): ts.Node => ts.visitEachChild(node, visit, ctx)
}

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

  const result = ts.transform(sourceFile, [toCompile])
  if (result.transformed.length === 0) {
    return sourceText
  }

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

  return printer.printFile(result.transformed[0] as ts.SourceFile)
}

export default transform
