const DEVICE_ID_KEY = 'novel-writing.device.id'

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 稳定设备 ID，注册绑定用 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing && existing.trim().length >= 16) {
      return existing.trim()
    }
    const id = `dev_${randomUuid()}`
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    return `dev_${randomUuid()}`
  }
}
