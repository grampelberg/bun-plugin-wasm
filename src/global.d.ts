declare module 'bun:test' {
  type AssetMatcher = (content: string) => boolean

  interface Matchers<T = unknown> {
    hasAsset(ext: string, matcher: AssetMatcher): T
    valueEndsWith(key: string, ending: string): T
  }
}

declare module 'demo/index' {
  const index: import('bun').RouterTypes.RouteValue<'/*'>
  export default index
}
