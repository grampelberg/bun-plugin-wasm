import type { Server } from 'bun'

import { serve } from './serve.ts'

const server: Server = serve()

console.log(`🚀 Server running at ${server.url}`)
