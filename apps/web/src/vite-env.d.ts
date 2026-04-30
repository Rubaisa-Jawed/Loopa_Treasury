/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string
  initDataUnsafe?: {
    user?: {
      id: number
      username?: string
      first_name?: string
      last_name?: string
    }
  }
  colorScheme?: 'light' | 'dark'
  ready: () => void
  close: () => void
  expand: () => void
  sendData: (data: string) => void
  MainButton?: {
    text: string
    show: () => void
    hide: () => void
  }
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
