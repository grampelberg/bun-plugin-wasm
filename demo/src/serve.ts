import { type Server, serve } from 'bun'

import index from './index.html'

const server: Server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,
  },

  development: process.env.NODE_ENV !== 'production' && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
})

// eslint-disable-next-line no-console -- Server startup message needed for development
console.log(`🚀 Server running at ${server.url}`)
