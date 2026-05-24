/** 用户可见余额（元人民币） */
export function formatBalanceYuan(yuan: number): string {
  const n = Math.max(0, Number(yuan) || 0)
  if (!Number.isFinite(n)) return '¥0.00'
  if (n >= 10_000) {
    const wan = n / 10_000
    return `${wan % 1 === 0 ? wan.toFixed(0) : wan.toFixed(2)}万元`
  }
  return `¥${n.toFixed(2)}`
}
