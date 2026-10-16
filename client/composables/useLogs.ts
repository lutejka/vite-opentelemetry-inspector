import { useOtelStore } from '../otel.ts'

export function useLogs() {
  const { logs, clearAllLogs } = useOtelStore()

  return {
    logs,
    clearAllLogs,
  }
}
