import { useOtelStore } from '../otel.ts'

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
