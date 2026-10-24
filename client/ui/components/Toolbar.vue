<!-- @description a sticky, glass-surfaced action bar with `#start`/`#end` slots. -->
<template>
  <div class="px-3 py-2 border-b border-base flex gap-3 items-center sticky top-0 z-nav bg-glass">
    <slot name="start" />
    <div v-if="$slots.end" class="flex gap-1 items-center">
      <slot name="end" />
    </div>
  </div>
</template>
