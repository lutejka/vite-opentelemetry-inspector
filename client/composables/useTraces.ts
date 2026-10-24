import { useOtelStore } from '~/app/otel'

export function useTraces() {
  const {
    traces,
    spans,
    clearAllTraces,
    getSpansForTrace,
  } = useOtelStore()

  return {
    traces,
    spans,
    getSpansForTrace,
    clearAllTraces,
  }
}
