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
    modifiedInChapterIds?: string[]
  }>(),
  { selectable: false, renderScale: 1, panelHeight: 520, modifiedInChapterIds: () => [] },
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
    const mat = s.material as THREE.SpriteMaterial
    mat.map?.dispose?.()
    mat.dispose()
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
  const out: THREE.Vector3[] = []
  if (count <= 0) return out

  const latSteps = Math.max(3, Math.ceil(Math.sqrt(count)))
  const lonSteps = Math.max(4, Math.ceil(count / Math.max(1, latSteps)))

  for (let i = 0; i <= latSteps && out.length < count; i++) {
    const phi = (i / latSteps) * Math.PI
    const y = Math.cos(phi)
    const r = Math.sin(phi)

    for (let j = 0; j < lonSteps && out.length < count; j++) {
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
  const isBlueprint = theme === 'blueprint'

  const padX = 18
  const padY = 10
  const radius = 14
  const textColor = isBlueprint ? '#e0f2fe' : isDark ? '#efe4d4' : '#1c1a17'
  const bgColor = isBlueprint ? 'rgba(15, 23, 42, 0.86)' : isDark ? 'rgba(33, 29, 24, 0.84)' : 'rgba(250, 246, 237, 0.86)'
  const borderColor = isBlueprint ? 'rgba(125, 211, 252, 0.42)' : isDark ? 'rgba(211, 197, 181, 0.38)' : 'rgba(42, 38, 34, 0.35)'

  const metrics = ctx.measureText(t)
  const textW = Math.min(metrics.width, canvas.width - 2 * padX)
  const textH = fontSize * 1.1
  const boxW = textW + padX * 2
  const boxH = textH + padY * 2
  const x = (canvas.width - boxW) / 2
  const y = (canvas.height - boxH) / 2

  const rr = (rx: number, ry: number, w: number, h: number, r: number) => {
    const cr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
    ctx.beginPath()
    ctx.moveTo(rx + cr, ry)
    ctx.arcTo(rx + w, ry, rx + w, ry + h, cr)
    ctx.arcTo(rx + w, ry + h, rx, ry + h, cr)
    ctx.arcTo(rx, ry + h, rx, ry, cr)
    ctx.arcTo(rx, ry, rx + w, ry, cr)
    ctx.closePath()
  }

  rr(x, y, boxW, boxH, radius)
  ctx.fillStyle = bgColor
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = borderColor
  ctx.stroke()

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
  if (!canvasHostRef.value || !wrapRef.value) return
  if (!scene || !camera || !renderer || !controls) return

  clearAll()

  const focusId = props.focusCharacterId
  if (!focusId) return

  const focusChar = props.characters.find((c) => c.id === focusId)
  if (!focusChar) return

  const theme = document.documentElement.getAttribute('data-theme') || 'light'
  const isDark = theme === 'dark' || theme === 'blueprint'

  const palettes: Record<string, number[]> = {
    mint: [0x00a884, 0xf0b85a, 0x2dd4bf, 0x6ee7b7, 0x0f766e, 0xf59e0b, 0x14b8a6, 0x84cc16],
    blueprint: [0x38bdf8, 0x818cf8, 0x60a5fa, 0xa5b4fc, 0x22d3ee, 0xfbbf24, 0x7dd3fc, 0x4f46e5],
    dark: [0x75665b, 0x74846f, 0x9a7957, 0x8a7260, 0x63756a, 0xb08c61, 0x8f8274, 0xa49787],
    light: [0x2563eb, 0x0f766e, 0x7c3aed, 0xc2410c, 0x0284c7, 0x16a34a, 0x9333ea, 0xd97706],
  }
  const palette = palettes[theme] ?? palettes.light

  const otherIds: string[] = []
  const otherSet = new Set<string>()

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

  const allNodeIds = [focusId, ...otherIds]
  allNodeIds.forEach((id, i) => nodeColorById.set(id, palette[i % palette.length]))

  const renderScale = Math.min(1.35, Math.max(0.4, Number(props.renderScale) || 1))
  const focusRadius = 16 * renderScale
  const nodeRadius = 14 * renderScale
  const orbitRadius = 196 * renderScale

  const latSteps = Math.max(4, Math.ceil(Math.sqrt(otherIds.length || 1)))
  const lonSteps = Math.max(6, Math.ceil((otherIds.length - 2) / Math.max(1, latSteps - 1)))
  const wireColor = isDark ? 0xe2e8f0 : 0x7c5c3a
  const wireOpacity = isDark ? 0.18 : 0.26
  const wireGeo = new THREE.SphereGeometry(wireRadius(orbitRadius), Math.max(10, lonSteps * 2), Math.max(8, latSteps * 2))
  const wireframe = new THREE.WireframeGeometry(wireGeo)
  sphereWire = new THREE.LineSegments(
    wireframe,
    new THREE.LineBasicMaterial({ color: wireColor, transparent: true, opacity: wireOpacity }),
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

    const name = props.characters.find((c) => c.id === id)?.name ?? ''
    if (name) {
      const label = makeTextSprite(name, { fontSize: Math.max(26, Math.round(54 * renderScale)) })
      label.position.copy(p)
      label.scale.multiplyScalar(renderScale)
      ;(label.material as THREE.SpriteMaterial).opacity = isFocus ? 1 : 0.92
      nodeLabelById.set(id, label)
      scene.add(label)
    }
  })

  const lineColor = isDark ? 0xe2e8f0 : 0x334155
  const lineOpacity = isDark ? 0.32 : 0.22
  const relationByDirection = new Map<string, string>()
  for (const r of props.relations) {
    const relationType = String(r.relationType ?? '').trim()
    if (!relationType) continue
    relationByDirection.set(`${r.fromCharacterId}->${r.toCharacterId}`, relationType)
  }

  const drawDirectedRelation = (fromId: string, toId: string) => {
    const a = positionsById.get(fromId)
    const b = positionsById.get(toId)
    if (!a || !b) return

    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-3) return

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
    mid.y += 5

    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone())
    const points = curve.getPoints(36)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity })
    const line = new THREE.Line(lineGeo, lineMat)
    scene!.add(line)
    relationLines.push(line)

    const relationType = relationByDirection.get(`${fromId}->${toId}`) ?? ''
    if (relationType) {
      const label = makeTextSprite(relationType, { fontSize: Math.max(22, Math.round(38 * renderScale)) })
      label.position.copy(curve.getPoint(0.5))
      label.position.y += 16 * renderScale
      label.scale.multiplyScalar(Math.max(0.72, renderScale * 0.8))
      ;(label.material as THREE.SpriteMaterial).opacity = 0.96
      scene!.add(label)
      relationLabels.push(label)
    }

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
    if (r.fromCharacterId === focusId) {
      drawDirectedRelation(focusId, r.toCharacterId)
    } else if (r.toCharacterId === focusId) {
      drawDirectedRelation(r.fromCharacterId, focusId)
    }
  }

  controls.target.set(0, 0, 0)
  controls.update()
}

function wireRadius(radius: number): number {
  return radius
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
  if (!props.selectable || !raycaster || !mouseNdc || !canvasHostRef.value || !camera) return

  const dx = e.clientX - lastPointerDown.x
  const dy = e.clientY - lastPointerDown.y
  if (dx * dx + dy * dy > 100) return

  const rect = canvasHostRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  mouseNdc.x = (x / rect.width) * 2 - 1
  mouseNdc.y = -(y / rect.height) * 2 + 1

  raycaster.setFromCamera(mouseNdc, camera)
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

  raycaster = new THREE.Raycaster()
  mouseNdc = new THREE.Vector2()

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
    props.relations.map((r) => `${r.id}:${r.fromCharacterId}->${r.toCharacterId}:${r.relationType}:${r.note ?? ''}:${r.updatedAt ?? ''}`).join('|'),
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
  themeObserver?.disconnect()
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
  border-radius: 24px;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(ellipse at 28% 18%, rgba(192, 138, 92, 0.16) 0%, rgba(192, 138, 92, 0.07) 36%, rgba(255, 255, 255, 0) 68%),
    radial-gradient(ellipse at 78% 84%, rgba(147, 168, 139, 0.12) 0%, rgba(147, 168, 139, 0.04) 34%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, transparent), color-mix(in srgb, var(--color-surface-muted) 82%, transparent));
  border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
}

.focus-sphere-canvas {
  width: 100%;
  height: 100%;
  display: flex;
}

[data-theme='dark'] .focus-sphere-wrap {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(192, 138, 92, 0.11) 0%, rgba(192, 138, 92, 0.05) 36%, rgba(255, 255, 255, 0) 68%),
    radial-gradient(ellipse at 78% 84%, rgba(147, 168, 139, 0.08) 0%, rgba(147, 168, 139, 0.03) 34%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-elevated) 98%, transparent), color-mix(in srgb, var(--color-surface-muted) 82%, transparent));
}

[data-theme='blueprint'] .focus-sphere-wrap {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0.06) 36%, rgba(255, 255, 255, 0) 68%),
    radial-gradient(ellipse at 78% 84%, rgba(129, 140, 248, 0.12) 0%, rgba(129, 140, 248, 0.04) 34%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-elevated) 96%, #020617 4%), color-mix(in srgb, var(--color-surface-muted) 82%, #020617 18%));
  border-color: rgba(125, 211, 252, 0.2);
}

:root:not([data-theme='dark']):not([data-theme='blueprint']) .focus-sphere-wrap {
  background:
    radial-gradient(ellipse at 28% 18%, rgba(47, 111, 237, 0.08) 0%, rgba(47, 111, 237, 0.03) 36%, rgba(255, 255, 255, 0) 68%),
    radial-gradient(ellipse at 78% 84%, rgba(15, 159, 203, 0.07) 0%, rgba(15, 159, 203, 0.02) 34%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(180deg, color-mix(in srgb, #ffffff 98%, transparent), color-mix(in srgb, #f5f7fb 86%, transparent));
  border-color: rgba(15, 23, 42, 0.08);
}
</style>
