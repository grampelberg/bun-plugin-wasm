import path from 'node:path'

import type { BuildOutput } from 'bun'

type OutputTableRow = {
  File: string
  Type: string
  Size: string
}

export default async function build(): Promise<void> {
  /**
   * Format file size in bytes to human readable string
   * @param {number} bytes File size in bytes
   * @returns {string} Formatted file size string
   */
  function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  const start: number = performance.now()

  const result: BuildOutput = await Bun.build({
    entrypoints: ['./index.ts'],
    outdir: './dist',
    // plugins: [wasmPlugin],
  })

  const end: number = performance.now()

  const outputTable: OutputTableRow[] = result.outputs.map(output => ({
    File: path.relative(process.cwd(), output.path),
    Type: output.kind,
    Size: formatFileSize(output.size),
  }))

  console.table(outputTable)
  const buildTime: string = (end - start).toFixed(2)

  console.log(`\n✅ Build completed in ${buildTime}ms\n`)

  if (result.logs.length > 0) {
    console.warn('\n🚨 Build succeeded with warnings:')
    for (const message of result.logs) {
      // Bun will pretty print the message object
      console.warn(message)
    }
  }
}

await build()
