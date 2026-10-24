import { useOtelStore } from '~/app/otel'

export function useLogs() {
  const { logs, clearAllLogs } = useOtelStore()

  return {
    logs,
    clearAllLogs,
  }
}
