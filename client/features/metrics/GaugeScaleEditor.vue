<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMetricGaugeScales } from '~/composables/useMetricGaugeScales'
import Button from '~/ui/components/Button.vue'
import TextInput from '~/ui/components/TextInput.vue'
import { formatNumber } from '~/ui/utils/format'
import type { GaugeScale } from '~/utils/gauge'

const { name, scale, observed, hasOverride } = defineProps<{
  name: string
  scale: GaugeScale
  observed: GaugeScale
  hasOverride: boolean
}>()

const { setScale, resetScale } = useMetricGaugeScales()

const editing = ref(false)
const minInput = ref('')
const maxInput = ref('')
const error = ref<string | null>(null)

const scaleLabel = computed(() => `${formatNumber(scale.min)} – ${formatNumber(scale.max)}`)
const observedLabel = computed(() => `${formatNumber(observed.min)} – ${formatNumber(observed.max)}`)
const minValue = computed(() => (minInput.value.trim() === '' ? Number.NaN : Number(minInput.value)))
const maxValue = computed(() => (maxInput.value.trim() === '' ? Number.NaN : Number(maxInput.value)))
const valid = computed(() =>
  Number.isFinite(minValue.value) && Number.isFinite(maxValue.value) && maxValue.value > minValue.value
)

watch(() => name, () => {
  editing.value = false
  error.value = null
})

function toggle() {
  if (!editing.value) {
    minInput.value = String(scale.min)
    maxInput.value = String(scale.max)
    error.value = null
  }
  editing.value = !editing.value
}

function apply() {
  if (!valid.value) {
    error.value = 'Max must be greater than min.'
    return
  }
  error.value = null
  void setScale(name, { min: minValue.value, max: maxValue.value })
  editing.value = false
}

function reset() {
  void resetScale(name)
  editing.value = false
  error.value = null
}
</script>

<template>
  <div class="rounded-lg border border-base bg-raised p-2.5 flex flex-col gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-xs font-medium color-base shrink-0">Gauge scale</span>
      <span class="text-micro color-faint truncate">{{ scaleLabel }}</span>
      <span v-if="hasOverride" class="text-micro color-active shrink-0">custom</span>
      <span class="flex-1" />
      <Button
        size="sm"
        icon="icon-[ph--sliders-horizontal]"
        :active="editing"
        @click="toggle"
      >
        Scale
      </Button>
    </div>

    <div v-if="editing" class="flex flex-col gap-2">
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1">
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Min</span>
          <TextInput v-model="minInput" type="number" size="sm" />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-micro color-faint font-medium uppercase tracking-wide">Max</span>
          <TextInput v-model="maxInput" type="number" size="sm" />
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span v-if="error" class="text-micro text-error">{{ error }}</span>
        <span v-else class="text-micro color-faint">Observed: {{ observedLabel }}</span>
        <span class="flex-1" />
        <Button v-if="hasOverride" size="sm" variant="text" @click="reset">
          Reset to observed
        </Button>
        <Button size="sm" :disabled="!valid" @click="apply">
          Apply
        </Button>
      </div>
    </div>
  </div>
</template>
