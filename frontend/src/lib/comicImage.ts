import { getCurrentSession } from './auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

export type GenImageInput = {
  prompt: string
  /** 输出尺寸，如 "1024x768"；缺省后端用 1024x1024 */
  size?: string
  /** 图生图参考图（公网 URL 或 data URI），用于锁定角色/风格一致性 */
  image?: string[]
}

/**
 * 调用后端 /comic/gen-image 生成图片。
 * 厂商 / Key 由后端按后台激活的生图 provider 注入，前端不接触。
 * 返回生成图片的 URL。
 */
export async function generateComicImage(input: GenImageInput): Promise<string> {
  const session = getCurrentSession()
  if (!session?.token) throw new Error('请先登录后再使用生图功能')

  const resp = await fetch(`${API_BASE_URL}/comic/gen-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      size: input.size,
      image: input.image ?? [],
    }),
  })

  const text = await resp.text()
  if (!resp.ok) {
    let msg = `生图失败（${resp.status}）`
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string }
      msg = parsed.error || parsed.message || msg
    } catch {
      if (text) msg = text.slice(0, 200)
    }
    throw new Error(msg)
  }

  const parsed = JSON.parse(text) as { url?: string }
  if (!parsed.url) throw new Error('生图响应中没有图片 URL')
  return parsed.url
}

/** 创建视频任务，返回 video_id。seconds 可选 3/5/10/18。 */
export async function createComicVideo(prompt: string, keyframeUrl?: string, seconds?: number): Promise<string> {
  const session = getCurrentSession()
  if (!session?.token) throw new Error('请先登录后再使用生视频功能')
  const resp = await fetch(`${API_BASE_URL}/comic/gen-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ prompt, image: keyframeUrl ? [keyframeUrl] : [], seconds }),
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`创建视频任务失败: ${text.slice(0, 200)}`)
  const parsed = JSON.parse(text) as { video_id?: string }
  if (!parsed.video_id) throw new Error('响应中没有 video_id')
  return parsed.video_id
}

/** 轮询视频状态，返回 {status, url?} */
export async function pollVideoStatus(videoId: string): Promise<{ status: string; url?: string }> {
  const session = getCurrentSession()
  if (!session?.token) throw new Error('请先登录')
  const resp = await fetch(`${API_BASE_URL}/comic/video-status?video_id=${encodeURIComponent(videoId)}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`查询视频状态失败: ${text.slice(0, 200)}`)
  return JSON.parse(text) as { status: string; url?: string }
}
