import Taro from '@tarojs/taro'

export function navigatePage(url: string) {
  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    window.location.hash = url
    window.location.reload()
    return
  }

  Taro.redirectTo({ url })
}
