<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '~/ui/utils/format'
import { gaugeArcPath, gaugeFraction, gaugePoint, gaugeValueOutsideScale } from '~/utils/gauge'
import type { GaugeScale } from '~/utils/gauge'

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 232
const CX = 160
const CY = 150
const RADIUS = 120
const NEEDLE_RADIUS = RADIUS - 16
const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1]

const { value, scale, unit } = defineProps<{
  value: number | null
  scale: GaugeScale
  unit?: string | null
}>()

const fraction = computed(() => gaugeFraction(value, scale))
const backgroundArc = computed(() => gaugeArcPath(CX, CY, RADIUS, 0, 1))
const valueArc = computed(() => gaugeArcPath(CX, CY, RADIUS, 0, fraction.value))
const outsideScale = computed(() => gaugeValueOutsideScale(value, scale))

const needle = computed(() => {
  const angle = Math.PI + fraction.value * Math.PI
  const end = gaugePoint(CX, CY, NEEDLE_RADIUS, fraction.value)
  return {
    x1: CX + Math.cos(angle) * 12,
    y1: CY + Math.sin(angle) * 12,
    x2: end.x,
    y2: end.y,
  }
})

const ticks = computed(() =>
  TICK_FRACTIONS.map((fraction) => {
    const inner = gaugePoint(CX, CY, RADIUS - 11, fraction)
    const outer = gaugePoint(CX, CY, RADIUS + 1, fraction)
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y }
  })
)

const bounds = computed(() => [
  { key: 'min', value: scale.min, x: CX - RADIUS, y: CY + 22, anchor: 'start' },
  { key: 'max', value: scale.max, x: CX + RADIUS, y: CY + 22, anchor: 'end' },
])

const valueText = computed(() => value === null ? '–' : formatNumber(value, { maximumFractionDigits: 2 }))

const ariaLabel = computed(() =>
  `${valueText.value}${unit ? ` ${unit}` : ''} on a scale from ${formatBound(scale.min)} to ${formatBound(scale.max)}`
)

function formatBound(bound: number): string {
  return formatNumber(bound, { notation: 'compact', maximumSignificantDigits: 3 })
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <svg
      :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
      class="w-full max-w-[360px]"
      role="img"
      :aria-label="ariaLabel"
    >
      <title>{{ ariaLabel }}</title>

      <path
        :d="backgroundArc"
        fill="none"
        stroke="currentColor"
        stroke-width="10"
        stroke-linecap="round"
        opacity="0.12"
      />
      <path
        :d="valueArc"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="10"
        stroke-linecap="round"
      />

      <line
        v-for="(tick, index) in ticks"
        :key="index"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.35"
      />

      <line
        :x1="needle.x1"
        :y1="needle.y1"
        :x2="needle.x2"
        :y2="needle.y2"
        stroke="var(--color-primary)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <circle :cx="CX" :cy="CY" r="5" fill="var(--color-primary)" />

      <text
        v-for="bound in bounds"
        :key="bound.key"
        :x="bound.x"
        :y="bound.y"
        :text-anchor="bound.anchor"
        class="text-micro"
        fill="currentColor"
        opacity="0.55"
      >
        {{ formatBound(bound.value) }}
      </text>

      <text
        :x="CX"
        :y="CY + 54"
        text-anchor="middle"
        class="font-mono tabular-nums"
        fill="currentColor"
        font-size="22"
        font-weight="600"
      >
        {{ valueText }}
      </text>
      <text
        v-if="unit"
        :x="CX"
        :y="CY + 70"
        text-anchor="middle"
        fill="currentColor"
        font-size="11"
        opacity="0.55"
      >
        {{ unit }}
      </text>
    </svg>

    <p v-if="outsideScale" class="text-micro text-warning">
      Latest value is outside the configured scale
    </p>
  </div>
</template>
