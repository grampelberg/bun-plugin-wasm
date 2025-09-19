declare module 'bun:test' {
  interface Matchers<T = unknown> {
    valueEndsWith(key: string, ending: string): T
  }

  interface AsymmetricMatchers {
    valueEndsWith(key: string, ending: string): unknown
  }
}

declare module 'demo/index' {
  const index: import('bun').RouterTypes.RouteValue<'/*'>
  export default index
}
