import type { Server } from 'bun'

import index from './index.html'

export const serve = (port: number = 3000, hmr: boolean = true): Server => {
  return Bun.serve({
    port,
    routes: {
      '/*': index,
    },

    development: {
      hmr,

      console: true,
    },
  })
}
