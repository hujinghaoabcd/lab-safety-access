/**
 * 设备检测工具
 * 判断是否为桌面端设备
 */

/**
 * 检测是否为桌面端
 * @returns {boolean} true 为桌面端，false 为移动端
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  
  const userAgent = navigator.userAgent.toLowerCase()
  const width = window.innerWidth
  
  // 优先通过屏幕宽度判断（>= 768px 视为桌面端）
  // 这样可以支持桌面浏览器窗口调整大小的情况
  if (width >= 768) {
    return true
  }
  
  // 如果宽度小于 768px，再通过 User Agent 判断
  // 通过 User Agent 判断桌面端设备
  const desktopPatterns = [
    /windows/i,
    /macintosh/i,
    /linux/i,
    /x11/i
  ]
  
  // 排除移动设备
  const mobilePatterns = [
    /android/i,
    /iphone/i,
    /ipad/i,
    /ipod/i,
    /blackberry/i,
    /windows phone/i,
    /mobile/i
  ]
  
  // 如果是移动设备，返回 false
  if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
    return false
  }
  
  // 如果是桌面设备，返回 true
  return desktopPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * 检测是否为移动端
 * @returns {boolean} true 为移动端，false 为桌面端
 */
export function isMobile(): boolean {
  return !isDesktop()
}


