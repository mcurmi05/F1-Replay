export {}

declare global {
  interface Window {
    desktop?: {
      chooseFolder: () => Promise<string | null>
    }
  }
}
