export {}

declare global {
  const __DEBUG_TOOLS__: boolean
  const __HOSTED__: boolean

  interface Window {
    desktop?: {
      chooseFolder: () => Promise<string | null>
    }
  }
}
