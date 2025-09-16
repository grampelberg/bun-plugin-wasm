import { env } from 'node:process'

import { type ILogObj, Logger } from 'tslog'

import { name } from '../package.json'

const key = 'LOG_LEVEL'

export const levelMap: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
}

// @ts-expect-error
if (key in env && !(env[key] in levelMap)) {
  throw new Error(`Invalid log level: ${env[key]}`)
}

export const log: Logger<ILogObj> = new Logger({
  name,
  minLevel: levelMap[env[key] ?? 'info'],
})
