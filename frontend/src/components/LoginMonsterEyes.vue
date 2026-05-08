<template>
  <div
    class="login-cat-sketch"
    aria-hidden="true"
    :class="{ 'is-hovering': hovering, 'is-blinking': blinking }"
    @pointerenter="onEnter"
    @pointerleave="onLeave"
  >
    <svg class="login-cat-sketch__svg" viewBox="0 0 280 240" role="presentation">
      <ellipse class="login-cat-sketch__shadow" cx="138" cy="218" rx="74" ry="11" />

      <g class="login-cat-sketch__bodyGroup">
        <path
          class="login-cat-sketch__line"
          d="M96 208c-5-17-8-39-10-65-2-27 0-54 7-76 8-25 23-43 44-52"
        />
        <path
          class="login-cat-sketch__line"
          d="M179 208c5-17 9-39 10-65 2-27 0-54-7-76-8-25-23-43-44-52"
        />

        <path class="login-cat-sketch__line" d="M137 15c-7-11-15-18-23-24-3 12-4 22-8 33" />
        <path class="login-cat-sketch__line" d="M141 15c7-11 15-18 23-24 3 12 4 22 8 33" />

        <path
          class="login-cat-sketch__line login-cat-sketch__tail"
          d="M89 206c-10 5-22 6-31 2-9-4-15-11-17-20-2-11 3-21 12-27 9-5 20-4 27 2 5 4 8 10 9 17"
        />

        <path class="login-cat-sketch__line" d="M122 208c0-13 1-28 3-42 2-13 5-24 9-34" />
        <path class="login-cat-sketch__line" d="M154 208c0-13-1-28-3-42-2-13-5-24-9-34" />
        <path class="login-cat-sketch__line" d="M127 208c3 5 7 7 11 7 4 0 8-2 11-7" />
      </g>

      <g class="login-cat-sketch__faceGroup">
        <circle class="login-cat-sketch__eyeDot" cx="123" cy="82" r="3.3" />
        <circle class="login-cat-sketch__eyeDot" cx="153" cy="82" r="3.3" />
        <path class="login-cat-sketch__blink" d="M117 82c3 2 8 2 11 0" />
        <path class="login-cat-sketch__blink" d="M147 82c3 2 8 2 11 0" />

        <path class="login-cat-sketch__line" d="M138 90c-3 2-4 6-1 9 1 1 1 2 1 3" />
        <path class="login-cat-sketch__line login-cat-sketch__mouth" d="M132 105c2-2 4-3 6-3s4 1 6 3" />

        <path class="login-cat-sketch__line" d="M112 95c-9-2-17-4-26-5" />
        <path class="login-cat-sketch__line" d="M112 102c-10 0-19 0-28 1" />
        <path class="login-cat-sketch__line" d="M112 109c-8 3-15 5-22 9" />

        <path class="login-cat-sketch__line" d="M164 95c9-2 17-4 26-5" />
        <path class="login-cat-sketch__line" d="M164 102c10 0 19 0 28 1" />
        <path class="login-cat-sketch__line" d="M164 109c8 3 15 5 22 9" />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const hovering = ref(false)
const blinking = ref(false)
let blinkTimer: number | null = null
let innerBlinkTimer: number | null = null

function onEnter() {
  hovering.value = true
}

function onLeave() {
  hovering.value = false
}

function scheduleBlink() {
  const next = 2400 + Math.random() * 2600
  blinkTimer = window.setTimeout(() => {
    blinking.value = true
    innerBlinkTimer = window.setTimeout(() => {
      blinking.value = false
      scheduleBlink()
    }, 120) as unknown as number
  }, next) as unknown as number
}

onMounted(() => {
  scheduleBlink()
})

onUnmounted(() => {
  if (blinkTimer) window.clearTimeout(blinkTimer)
  if (innerBlinkTimer) window.clearTimeout(innerBlinkTimer)
})
</script>

<style scoped>
.login-cat-sketch {
  width: min(340px, 44vw);
  max-width: 360px;
  aspect-ratio: 280 / 240;
  color: color-mix(in srgb, #111827 90%, #374151 10%);
  filter: drop-shadow(0 12px 18px rgba(15, 23, 42, 0.08));
  transform-origin: 50% 78%;
  animation: catSketchIdle 3.6s ease-in-out infinite;
}

.login-cat-sketch__svg {
  width: 100%;
  height: 100%;
  display: block;
}

.login-cat-sketch__shadow {
  fill: rgba(15, 23, 42, 0.07);
}

.login-cat-sketch__bodyGroup {
  transform-origin: 138px 144px;
  animation: catSketchBody 3.6s ease-in-out infinite;
}

.login-cat-sketch__faceGroup {
  transform-origin: 138px 92px;
}

.login-cat-sketch.is-hovering .login-cat-sketch__faceGroup {
  animation: catSketchTilt 1s ease-in-out infinite;
}

.login-cat-sketch__line,
.login-cat-sketch__blink {
  fill: none;
  stroke: currentColor;
  stroke-width: 4.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.login-cat-sketch__tail {
  transform-origin: 80px 192px;
}

.login-cat-sketch.is-hovering .login-cat-sketch__tail {
  animation: catSketchTail 1.1s ease-in-out infinite;
}

.login-cat-sketch__eyeDot {
  fill: currentColor;
}

.login-cat-sketch__blink {
  opacity: 0;
}

.login-cat-sketch.is-blinking .login-cat-sketch__eyeDot {
  opacity: 0;
}

.login-cat-sketch.is-blinking .login-cat-sketch__blink {
  opacity: 1;
}

.login-cat-sketch__mouth {
  stroke-width: 3.7;
}

@keyframes catSketchIdle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.35deg);
  }
  50% {
    transform: translateY(-3px) rotate(0.35deg);
  }
}

@keyframes catSketchBody {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.008);
  }
}

@keyframes catSketchTail {
  0%,
  100% {
    transform: rotate(-3deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

@keyframes catSketchTilt {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-1.2deg);
  }
}

[data-theme='dark'] .login-cat-sketch {
  color: color-mix(in srgb, #e5e7eb 90%, #cbd5e1 10%);
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.18));
}
</style>
