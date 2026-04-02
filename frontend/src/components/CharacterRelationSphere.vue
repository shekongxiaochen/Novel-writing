<template>
  <div class="sphere-wrap" ref="wrapRef">
    <div ref="canvasHostRef" class="sphere-canvas"></div>

    <div
      v-if="hoverLabel"
      class="sphere-tooltip"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      {{ hoverLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { Character, CharacterRelation } from '../types'

const props = defineProps<{
  characters: Character[]
  relations: CharacterRelation[]
  focusCharacterId: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const wrapRef = ref<HTMLDivElement | null>(null)
const canvasHostRef = ref<HTMLDivElement | null>(null)

const tooltipX = ref(0)
const tooltipY = ref(0)
const hoverId = ref<string>('')

const hoverLabel = computed(() => {
  const id = hoverId.value
  if (!id) return ''
  return props.characters.find((c) => c.id === id)?.name ?? ''
})

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null

let raycaster: THREE.Raycaster | null = null
let mouseNdc: THREE.Vector2 | null = null

let animationId = 0
let isOrbiting = false
let pointerDownClient: { x: number; y: number } | null = null
let pointerMovedSinceDown = false
let themeObserver: MutationObserver | null = null

const meshById = new Map<string, THREE.Mesh>()
const lights: THREE.Light[] = []
const labelById = new Map<string, THREE.Sprite>()
const nodeColorById = new Map<string, number>()
let sphereWire: THREE.LineSegments | null = null

function computeNodePositions(ids: string[]): Record<string, { x: number; y: number; z: number }> {
  const out: Record<string, { x: number; y: number; z: number }> = {}
  const n = ids.length
  if (n === 0) return out

  // 网格化球面：让节点落在“经线/纬线”的交叉点上
  const wireRadius = 220

  // 让候选点数量 >= n，尽量避免重复叠点
  const latSteps = Math.max(4, Math.ceil(Math.sqrt(n)))
  const lonSteps = Math.max(6, Math.ceil((n - 2) / Math.max(1, latSteps - 1)))

  const candidates: THREE.Vector3[] = []
  for (let i = 0; i <= latSteps; i++) {
    // phi: 0..PI
    const phi = (i / latSteps) * Math.PI
    const y = Math.cos(phi)
    const r = Math.sin(phi)

    for (let j = 0; j < lonSteps; j++) {
      // 两个极点会重复很多次：只保留一个交叉点
      if ((i === 0 || i === latSteps) && j !== 0) continue

      const theta = (j / lonSteps) * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      candidates.push(new THREE.Vector3(x * wireRadius, y * wireRadius, z * wireRadius))
    }
  }

  for (let k = 0; k < n; k++) {
    const p = candidates[k % candidates.length]
    out[ids[k]] = { x: p.x, y: p.y, z: p.z }
  }
  return out
}

function clearMeshes() {
  if (sphereWire) {
    scene?.remove(sphereWire)
    sphereWire.geometry.dispose()
    ;(sphereWire.material as THREE.Material).dispose()
    sphereWire = null
  }

  meshById.forEach((m) => {
    scene?.remove(m)
    m.geometry.dispose()
    if (Array.isArray(m.material)) {
      m.material.forEach((mat) => mat.dispose())
    } else {
      m.material.dispose()
    }
  })
  meshById.clear()

  labelById.forEach((s) => {
    scene?.remove(s)
    if (s.material) {
      const mat = s.material as THREE.SpriteMaterial
      mat.map?.dispose?.()
      mat.dispose()
    }
  })
  labelById.clear()

  nodeColorById.clear()
}

function makeTextSprite(text: string, opts?: { fontSize?: number }) {
  const fontSize = opts?.fontSize ?? 56
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }))

  // 画布固定大小，超长文本截断（MVP）
  const maxLen = 10
  const t = text.length > maxLen ? `${text.slice(0, maxLen)}…` : text

  canvas.width = 512
  canvas.height = 256

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.font = `700 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  const isDark = theme === 'dark'

  // 文字底牌：半透明底 + 细边框，确保在复杂 3D 背景上仍清楚
  const padX = 18
  const padY = 10
  const radius = 14
  const textColor = isDark ? '#f5f2ed' : '#1c1a17'
  const bgColor = isDark ? 'rgba(24, 23, 22, 0.78)' : 'rgba(250, 246, 237, 0.86)'
  const borderColor = isDark ? 'rgba(201, 184, 166, 0.55)' : 'rgba(42, 38, 34, 0.35)'

  ctx.font = `700 ${fontSize}px sans-serif`
  const metrics = ctx.measureText(t)
  const textW = Math.min(metrics.width, canvas.width - 2 * padX)
  const textH = fontSize * 1.1
  const boxW = textW + padX * 2
  const boxH = textH + padY * 2
  const x = (canvas.width - boxW) / 2
  const y = (canvas.height - boxH) / 2

  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    const cr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
    ctx.beginPath()
    ctx.moveTo(x + cr, y)
    ctx.arcTo(x + w, y, x + w, y + h, cr)
    ctx.arcTo(x + w, y + h, x, y + h, cr)
    ctx.arcTo(x, y + h, x, y, cr)
    ctx.arcTo(x, y, x + w, y, cr)
    ctx.closePath()
  }

  rr(x, y, boxW, boxH, radius)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = borderColor
  ctx.stroke()

  // 文字：轻描边 + 轻阴影（比单纯 shadow 更稳）
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = isDark ? 10 : 8
  ctx.shadowOffsetY = 1
  ctx.fillStyle = textColor
  ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = 3
  ctx.strokeText(t, canvas.width / 2, canvas.height / 2)
  ctx.fillText(t, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    opacity: 1,
  })

  const sprite = new THREE.Sprite(spriteMat)
  // sprite 的世界尺寸（经验值）
  sprite.scale.set(110, 55, 1)

  return sprite
}

function build() {
  if (!canvasHostRef.value) return
  if (!wrapRef.value) return

  clearMeshes()
  if (!scene || !camera || !renderer || !controls) return

  // 清理上一次 build 造成的光源
  lights.splice(0, lights.length).forEach((l) => scene?.remove(l))

  const ids = props.characters.map((c) => c.id)
  const pos = computeNodePositions(ids)

  const wireRadius = 220
  const latSteps = Math.max(4, Math.ceil(Math.sqrt(ids.length || 1)))
  const lonSteps = Math.max(6, Math.ceil((ids.length - 2) / Math.max(1, latSteps - 1)))

  // 网格化的最大球（只做“背景骨架”，不参与点击）
  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  const isDark = theme === 'dark'
  const lineColor = isDark ? 0xe2e8f0 : 0x7c5c3a
  const lineOpacity = isDark ? 0.18 : 0.26
  const wireGeo = new THREE.SphereGeometry(wireRadius, Math.max(10, lonSteps * 2), Math.max(8, latSteps * 2))
  const wireframe = new THREE.WireframeGeometry(wireGeo)
  sphereWire = new THREE.LineSegments(
    wireframe,
    new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity })
  )
  scene.add(sphereWire)

  const palette = [
    0x5c534c, // warm umber
    0x5f6b5a, // sage
    0x7d6654, // bronze
    0x6b5d4f, // cocoa
    0x4d5c52, // pine
    0x8b7355, // tan
    0x6e6258, // taupe
    0x7a6f63, // stone
  ]
  ids.forEach((id, i) => nodeColorById.set(id, palette[i % palette.length]))

  const sphereGeo = new THREE.SphereGeometry(16, 24, 24)
  ids.forEach((id) => {
    const baseColor = nodeColorById.get(id) ?? 0x5c534c
    const mesh = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: new THREE.Color(baseColor),
        emissiveIntensity: id === props.focusCharacterId ? 0.35 : 0.08,
        transparent: true,
        // 非聚焦也别太透明，否则球体视觉上“消失”，影响文字可读性
        opacity: id === props.focusCharacterId ? 0.72 : 0.42,
        metalness: 0.08,
        roughness: 0.6,
        depthWrite: false,
      }),
    )
    const p = pos[id]
    if (!p) return
    mesh.position.set(p.x, p.y, p.z)

    mesh.userData = { id }
    meshById.set(id, mesh)
    scene.add(mesh)

    const name = props.characters.find((c) => c.id === id)?.name ?? ''
    const label = makeTextSprite(name)
    // 文字符号放在对应角色球的中心
    label.position.set(p.x, p.y, p.z)
    // 聚焦更清晰（不改文字颜色，避免描边/描边感）
    ;(label.material as THREE.SpriteMaterial).opacity = id === props.focusCharacterId ? 1 : 0.85
    labelById.set(id, label)
    scene.add(label)
  })

  // 光照
  const amb = new THREE.AmbientLight(0xffffff, 0.65)
  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(250, 350, 180)
  scene.add(amb)
  scene.add(dir)
  lights.push(amb, dir)

  controls.update()
}

function setFocusMaterials() {
  meshById.forEach((mesh, id) => {
    const m = mesh.material as THREE.MeshStandardMaterial
    const isFocus = id === props.focusCharacterId
    m.opacity = isFocus ? 0.88 : 0.48
    const baseColor = nodeColorById.get(id) ?? 0x5c534c
    m.emissive.setHex(baseColor)
    m.emissiveIntensity = isFocus ? 0.4 : 0.1
  })

  labelById.forEach((sprite, id) => {
    const isFocus = id === props.focusCharacterId
    const mat = sprite.material as THREE.SpriteMaterial
    mat.opacity = isFocus ? 1 : 0.88
  })
}

function measureAndRender() {
  if (!renderer || !wrapRef.value || !camera) return
  const el = wrapRef.value
  const w = el.clientWidth
  const h = el.clientHeight
  if (w <= 0 || h <= 0) return

  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene!, camera!)
}

function onPointerMove(e: PointerEvent) {
  if (!canvasHostRef.value) return
  if (pointerDownClient) {
    const dx = e.clientX - pointerDownClient.x
    const dy = e.clientY - pointerDownClient.y
    // 3px 以内视为“点击”，超过就当作拖拽旋转
    if (dx * dx + dy * dy > 9) pointerMovedSinceDown = true
  }

  if (!raycaster || !mouseNdc) return
  if (isOrbiting) return

  const domEl = renderer?.domElement
  if (!domEl) return
  const rect = domEl.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  mouseNdc.x = (x / rect.width) * 2 - 1
  mouseNdc.y = -(y / rect.height) * 2 + 1

  raycaster.setFromCamera(mouseNdc, camera!)
  const meshes = Array.from(meshById.values())
  const hit = raycaster.intersectObjects(meshes, false)[0]
  if (hit?.object) {
    const id = (hit.object as THREE.Mesh).userData.id as string
    hoverId.value = id
    tooltipX.value = Math.min(e.clientX + 12, window.innerWidth - 140)
    tooltipY.value = Math.max(e.clientY + 12, 10)
  } else {
    hoverId.value = ''
  }
}

function onPointerDown(e: PointerEvent) {
  pointerDownClient = { x: e.clientX, y: e.clientY }
  pointerMovedSinceDown = false
}

function onPointerUp(e: PointerEvent) {
  if (!raycaster || !mouseNdc) return
  if (!pointerDownClient) return

  // 拖拽旋转时不触发选中（避免“点不到/点错”）
  if (pointerMovedSinceDown) {
    pointerDownClient = null
    return
  }

  const domEl = renderer?.domElement
  if (!domEl) return
  const rect = domEl.getBoundingClientRect()

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  mouseNdc.x = (x / rect.width) * 2 - 1
  mouseNdc.y = -(y / rect.height) * 2 + 1

  raycaster.setFromCamera(mouseNdc, camera!)
  const meshes = Array.from(meshById.values())
  const hit = raycaster.intersectObjects(meshes, false)[0]
  const id = hit?.object ? ((hit.object as THREE.Mesh).userData.id as string) : ''
  if (id) emit('select', id)

  pointerDownClient = null
}

onMounted(() => {
  if (!canvasHostRef.value) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  canvasHostRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.enableZoom = false
  controls.rotateSpeed = 0.65
  controls.target.set(0, 0, 0)
  controls.update()
  controls.addEventListener('start', () => {
    isOrbiting = true
  })
  controls.addEventListener('end', () => {
    isOrbiting = false
  })

  raycaster = new THREE.Raycaster()
  mouseNdc = new THREE.Vector2()

  // 相机摆到球的外侧
  camera.position.set(0, 0, 760)

  measureAndRender()
  build()
  setFocusMaterials()

  window.addEventListener('resize', measureAndRender)

  // 事件
  canvasHostRef.value.addEventListener('pointermove', onPointerMove)
  canvasHostRef.value.addEventListener('pointerdown', onPointerDown)
  canvasHostRef.value.addEventListener('pointerup', onPointerUp)

  // 主题切换时重建文字贴图（暗色下需要白字）
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      build()
      setFocusMaterials()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }

  animate()
})

watch(
  () => props.characters.map((c) => c.id).join('|'),
  () => {
    build()
    setFocusMaterials()
  },
)

watch(
  () => props.focusCharacterId,
  () => {
    setFocusMaterials()
  },
)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', measureAndRender)

  const host = canvasHostRef.value
  if (host) {
    host.removeEventListener('pointermove', onPointerMove)
    host.removeEventListener('pointerdown', onPointerDown)
    host.removeEventListener('pointerup', onPointerUp)
  }

  clearMeshes()
  lights.splice(0, lights.length).forEach((l) => scene?.remove(l))
  themeObserver?.disconnect?.()
  themeObserver = null
  renderer?.dispose()
  controls?.dispose()
  scene = null
  camera = null
  renderer = null
  controls = null
})
</script>

<style scoped>
.sphere-wrap {
  position: relative;
  width: 100%;
  /* 放大可视区域：避免球体占不满导致“看不全” */
  height: clamp(540px, 56vh, 760px);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin: 0 auto;
  max-width: 740px;
  /* 暖米色背景：让半透明彩色球在浅色底上也更明显 */
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(217, 186, 135, 0.26) 0%,
    rgba(217, 186, 135, 0.12) 40%,
    rgba(255, 255, 255, 0) 70%
  );
}

/* 暗色主题：同样用暖米色，但对比更克制一点 */
[data-theme='dark'] .sphere-wrap {
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(217, 186, 135, 0.12) 0%,
    rgba(217, 186, 135, 0.06) 40%,
    rgba(0, 0, 0, 0) 70%
  );
}

.sphere-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sphere-tooltip {
  position: fixed;
  z-index: 10;
  padding: 8px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-strong);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  font-weight: 700;
  font-size: 0.8125rem;
  pointer-events: none;
  white-space: nowrap;
}
</style>

