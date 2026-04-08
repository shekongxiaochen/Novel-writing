<template>
  <div class="focus-sphere-wrap" ref="wrapRef">
    <div ref="canvasHostRef" class="focus-sphere-canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { Character, CharacterRelation } from '../types'

const props = withDefaults(
  defineProps<{
    characters: Character[]
    relations: CharacterRelation[]
    focusCharacterId: string
    selectable?: boolean
    renderScale?: number
    panelHeight?: number
  }>(),
  { selectable: false, renderScale: 1, panelHeight: 520 },
)

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const wrapRef = ref<HTMLDivElement | null>(null)
const canvasHostRef = ref<HTMLDivElement | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null

let raycaster: THREE.Raycaster | null = null
let mouseNdc: THREE.Vector2 | null = null
let animationId = 0
let isOrbiting = false
let themeObserver: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null
let lastPointerDown = { x: 0, y: 0 }

const meshById = new Map<string, THREE.Mesh>()
const nodeLabelById = new Map<string, THREE.Sprite>()
let relationLines: THREE.Line[] = []
let relationLabels: THREE.Sprite[] = []
let relationArrows: THREE.ArrowHelper[] = []

const nodeColorById = new Map<string, number>()
const lights: THREE.Light[] = []
let sphereWire: THREE.LineSegments | null = null

function clearAll() {
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

  nodeLabelById.forEach((s) => {
    scene?.remove(s)
    const mat = s.material as THREE.SpriteMaterial
    mat.map?.dispose?.()
    mat.dispose()
  })
  nodeLabelById.clear()

  relationLines.forEach((l) => {
    scene?.remove(l)
    l.geometry.dispose()
    ;(l.material as THREE.LineBasicMaterial).dispose()
  })
  relationLines = []

  relationLabels.forEach((s) => {
    scene?.remove(s)
    if (s.material) (s.material as THREE.SpriteMaterial).dispose()
  })
  relationLabels = []

  relationArrows.forEach((a) => {
    scene?.remove(a)
    ;(a.line.material as THREE.Material).dispose()
    ;(a.cone.material as THREE.Material).dispose()
  })
  relationArrows = []

  nodeColorById.clear()
}

function computeGridPositions(count: number, radius: number): THREE.Vector3[] {
  // 经纬网格交叉点：用于“节点看起来有规律”
  const out: THREE.Vector3[] = []
  if (count <= 0) return out

  const latSteps = Math.max(3, Math.ceil(Math.sqrt(count)))
  const lonSteps = Math.max(4, Math.ceil(count / Math.max(1, latSteps)))

  for (let i = 0; i <= latSteps && out.length < count; i++) {
    const phi = (i / latSteps) * Math.PI
    const y = Math.cos(phi)
    const r = Math.sin(phi)

    for (let j = 0; j < lonSteps && out.length < count; j++) {
      // 避免两极重复太多
      if ((i === 0 || i === latSteps) && j !== 0) continue
      const theta = (j / lonSteps) * Math.PI * 2
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      out.push(new THREE.Vector3(x * radius, y * radius, z * radius))
      if (out.length >= count) break
    }
  }
  return out
}

function makeTextSprite(text: string, opts?: { fontSize?: number }) {
  const fontSize = opts?.fontSize ?? 44
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }))

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
  sprite.scale.set(120, 58, 1)
  return sprite
}

function build() {
  if (!canvasHostRef.value) return
  if (!wrapRef.value) return
  if (!scene || !camera || !renderer || !controls) return

  clearAll()

  const focusId = props.focusCharacterId
  if (!focusId) return

  const focusChar = props.characters.find((c) => c.id === focusId)
  if (!focusChar) return

  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  const isDark = theme === 'dark'

  const palette = [
    0x5c534c,
    0x5f6b5a,
    0x7d6654,
    0x6b5d4f,
    0x4d5c52,
    0x8b7355,
    0x6e6258,
    0x7a6f63,
  ]

  const otherIds: string[] = []
  const otherSet = new Set<string>()

  // relations 保证只包含与 focus 有关的边；从边上收集“有关人物”
  for (const r of props.relations) {
    if (r.fromCharacterId === focusId && r.toCharacterId) {
      if (!otherSet.has(r.toCharacterId)) {
        otherSet.add(r.toCharacterId)
        otherIds.push(r.toCharacterId)
      }
    } else if (r.toCharacterId === focusId && r.fromCharacterId) {
      if (!otherSet.has(r.fromCharacterId)) {
        otherSet.add(r.fromCharacterId)
        otherIds.push(r.fromCharacterId)
      }
    }
  }

  // 节点颜色映射
  const allNodeIds = [focusId, ...otherIds]
  allNodeIds.forEach((id, i) => nodeColorById.set(id, palette[i % palette.length]))

  const renderScale = Math.min(1.5, Math.max(0.45, Number(props.renderScale) || 1))
  const focusRadius = 18 * renderScale
  const nodeRadius = 16 * renderScale
  const orbitRadius = 180 * renderScale

  // 大球网格轮廓线（和上面的 3D 图一致的“网格球”感觉）
  const wireRadius = orbitRadius
  const latSteps = Math.max(4, Math.ceil(Math.sqrt(otherIds.length || 1)))
  const lonSteps = Math.max(6, Math.ceil((otherIds.length - 2) / Math.max(1, latSteps - 1)))
  const wireColor = isDark ? 0xe2e8f0 : 0x7c5c3a
  const wireOpacity = isDark ? 0.18 : 0.26
  const wireGeo = new THREE.SphereGeometry(wireRadius, Math.max(10, lonSteps * 2), Math.max(8, latSteps * 2))
  const wireframe = new THREE.WireframeGeometry(wireGeo)
  sphereWire = new THREE.LineSegments(
    wireframe,
    new THREE.LineBasicMaterial({ color: wireColor, transparent: true, opacity: wireOpacity })
  )
  scene.add(sphereWire)

  const positionsById = new Map<string, THREE.Vector3>()
  positionsById.set(focusId, new THREE.Vector3(0, 0, 0))

  const otherPositions = computeGridPositions(otherIds.length, orbitRadius)
  otherIds.forEach((id, i) => {
    const p = otherPositions[i]
    if (!p) return
    positionsById.set(id, p)
  })

  // 节点：中心（聚焦角色）+ 侧面（相关角色）
  const sphereGeoFocus = new THREE.SphereGeometry(focusRadius, 24, 24)
  const sphereGeo = new THREE.SphereGeometry(nodeRadius, 24, 24)

  const makeMat = (id: string, isFocus: boolean): THREE.MeshStandardMaterial => {
    const baseColor = nodeColorById.get(id) ?? 0x5c534c
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: new THREE.Color(baseColor),
      emissiveIntensity: isFocus ? 0.55 : 0.18,
      transparent: true,
      opacity: isFocus ? 0.78 : 0.36,
      depthWrite: false,
      roughness: 0.55,
      metalness: 0.08,
    })
  }

  allNodeIds.forEach((id) => {
    const isFocus = id === focusId
    const geo = isFocus ? sphereGeoFocus : sphereGeo
    const mesh = new THREE.Mesh(geo, makeMat(id, isFocus))

    const p = positionsById.get(id)
    if (!p) return
    mesh.position.copy(p)
    mesh.userData = { id }
    meshById.set(id, mesh)
    scene.add(mesh)

    // 角色名：放在球心（不描边）
    const name = props.characters.find((c) => c.id === id)?.name ?? ''
    if (name) {
      const label = makeTextSprite(name, { fontSize: Math.max(26, Math.round(54 * renderScale)) })
      // label 对齐球心：sprite 的原点在中心
      label.position.copy(p)
      label.scale.multiplyScalar(renderScale)
      ;(label.material as THREE.SpriteMaterial).opacity = isFocus ? 1 : 0.92
      nodeLabelById.set(id, label)
      scene.add(label)
    }
  })

  // 连线：只从中心指向“有关人物”
  const lineColor = isDark ? 0xe2e8f0 : 0x334155
  const lineOpacity = isDark ? 0.32 : 0.22

  const drawDirectedRelation = (fromId: string, toId: string, relationText: string) => {
    const a = positionsById.get(fromId)
    const b = positionsById.get(toId)
    if (!a || !b) return

    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-3) return

    // 与“角色对（无向）”绑定的偏移法向量：确保 A->B 与 B->A 永远分居两侧，而不会叠线
    const minId = fromId < toId ? fromId : toId
    const maxId = fromId < toId ? toId : fromId
    const pMin = positionsById.get(minId)
    const pMax = positionsById.get(maxId)
    if (!pMin || !pMax) return

    const baseDir = new THREE.Vector3().subVectors(pMax, pMin)
    if (baseDir.lengthSq() < 1e-3) return
    baseDir.normalize()

    let baseNormal = new THREE.Vector3().crossVectors(baseDir, new THREE.Vector3(0, 1, 0))
    if (baseNormal.lengthSq() < 1e-4) {
      baseNormal = new THREE.Vector3().crossVectors(baseDir, new THREE.Vector3(1, 0, 0))
    }
    baseNormal.normalize()

    const sideSign: 1 | -1 = fromId === minId ? 1 : -1
    const normal = baseNormal.multiplyScalar(18 * sideSign)

    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).add(normal)
    // 轻微外鼓，减少和节点/网格重叠
    mid.y += 5

    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone())
    const points = curve.getPoints(36)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({
      color: lineColor,
      transparent: true,
      opacity: lineOpacity,
    })
    const line = new THREE.Line(lineGeo, lineMat)
    scene!.add(line)
    relationLines.push(line)

    // 在线的 58% 处放标签，避免和箭头/节点重叠
    const labelPos = curve.getPoint(0.58)
    const label = makeTextSprite(relationText || '关系', {
      fontSize: Math.max(20, Math.round(36 * renderScale)),
    })
    label.position.copy(labelPos)
    label.scale.multiplyScalar(renderScale)
    scene!.add(label)
    relationLabels.push(label)

    // 箭头放在线尾部附近，表示方向
    const p0 = curve.getPoint(0.86)
    const p1 = curve.getPoint(0.96)
    const arrowDir = new THREE.Vector3().subVectors(p1, p0).normalize()
    const arrowLen = Math.max(8 * renderScale, len * 0.06)
    const arrow = new THREE.ArrowHelper(arrowDir, p0, arrowLen, lineColor, 9 * renderScale, 6 * renderScale)
    ;(arrow.line.material as THREE.LineBasicMaterial).transparent = true
    ;(arrow.line.material as THREE.LineBasicMaterial).opacity = lineOpacity + 0.08
    ;(arrow.cone.material as THREE.MeshBasicMaterial).transparent = true
    ;(arrow.cone.material as THREE.MeshBasicMaterial).opacity = lineOpacity + 0.18
    scene!.add(arrow)
    relationArrows.push(arrow)
  }

  for (const r of props.relations) {
    // A=focusId。若关系是 A->B，则箭头指向 B；若关系是 B->A，则箭头指向 A。
    if (r.fromCharacterId === focusId) {
      drawDirectedRelation(focusId, r.toCharacterId, r.relationType || '关系')
    } else if (r.toCharacterId === focusId) {
      drawDirectedRelation(r.fromCharacterId, focusId, r.relationType || '关系')
    }
  }

  controls.target.set(0, 0, 0)
  controls.update()
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

function onPointerDown(e: PointerEvent) {
  if (!props.selectable) return
  lastPointerDown = { x: e.clientX, y: e.clientY }
}

function onClick(e: MouseEvent) {
  if (!props.selectable) return
  if (!raycaster || !mouseNdc) return
  if (!canvasHostRef.value) return

  const dx = e.clientX - lastPointerDown.x
  const dy = e.clientY - lastPointerDown.y
  // 避免旋转视角时误触选中节点
  if (dx * dx + dy * dy > 100) return

  const rect = canvasHostRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  mouseNdc.x = (x / rect.width) * 2 - 1
  mouseNdc.y = -(y / rect.height) * 2 + 1

  raycaster.setFromCamera(mouseNdc, camera!)
  const meshes = Array.from(meshById.values())
  const hit = raycaster.intersectObjects(meshes, false)[0]
  if (hit?.object) {
    const id = (hit.object as THREE.Mesh).userData.id as string
    if (id) emit('select', id)
  }
}

onMounted(() => {
  if (!canvasHostRef.value) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  canvasHostRef.value.appendChild(renderer.domElement)

  // 光照（MeshStandardMaterial 需要灯光）
  const amb = new THREE.AmbientLight(0xffffff, 0.65)
  const dir = new THREE.DirectionalLight(0xffffff, 0.9)
  dir.position.set(250, 350, 180)
  scene.add(amb)
  scene.add(dir)
  lights.push(amb, dir)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.enableZoom = false
  controls.enableRotate = true
  controls.rotateSpeed = 0.65
  controls.target.set(0, 0, 0)
  controls.update()
  renderer.domElement.style.touchAction = 'none'

  controls.addEventListener('start', () => {
    isOrbiting = true
  })
  controls.addEventListener('end', () => {
    isOrbiting = false
  })

  raycaster = new THREE.Raycaster()
  mouseNdc = new THREE.Vector2()

  // 相机摆到球的外侧
  const renderScale = Math.min(1.5, Math.max(0.45, Number(props.renderScale) || 1))
  camera.position.set(0, 0, 520 * renderScale)

  measureAndRender()
  build()
  animate()

  window.addEventListener('resize', measureAndRender)
  if (typeof ResizeObserver !== 'undefined' && wrapRef.value) {
    resizeObserver = new ResizeObserver(() => {
      measureAndRender()
    })
    resizeObserver.observe(wrapRef.value)
  }
  canvasHostRef.value.addEventListener('pointerdown', onPointerDown)
  canvasHostRef.value.addEventListener('click', onClick)

  // 主题切换时重建文字贴图（暗色下需要白字）
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => build())
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
})

watch(
  () => [
    props.focusCharacterId,
    String(props.renderScale ?? 1),
    String(props.panelHeight ?? 520),
    props.characters.map((c) => c.id).join('|'),
    props.relations
      .map((r) => `${r.id}:${r.fromCharacterId}->${r.toCharacterId}:${r.relationType}:${r.note ?? ''}:${r.updatedAt ?? ''}`)
      .join('|'),
  ].join('::'),
  () => build(),
)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', measureAndRender)
  resizeObserver?.disconnect()
  resizeObserver = null

  if (canvasHostRef.value) {
    canvasHostRef.value.removeEventListener('pointerdown', onPointerDown)
    canvasHostRef.value.removeEventListener('click', onClick)
  }

  clearAll()
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
.focus-sphere-wrap {
  width: 100%;
  height: v-bind('`${props.panelHeight}px`');
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(217, 186, 135, 0.22) 0%,
    rgba(217, 186, 135, 0.1) 40%,
    rgba(255, 255, 255, 0) 70%
  );
}

.focus-sphere-canvas {
  width: 100%;
  height: 100%;
  display: flex;
}

[data-theme='dark'] .focus-sphere-wrap {
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(217, 186, 135, 0.12) 0%,
    rgba(217, 186, 135, 0.06) 40%,
    rgba(0, 0, 0, 0) 70%
  );
}
</style>

