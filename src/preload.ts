import { plugin } from 'bun'

import wasmPlugin from './lib.ts'

// There's a bug somewhere in the interaction between `plugin()` and bundler
// plugins (especially bun-plugin-tailwind). Until that's fixed, this makes it
// possible to use the `bun` target stuff entirely separate from other plugins.
plugin(wasmPlugin)
