export function getTaskApiBase() {
  return localStorage.getItem('uav_task_api_base') || 'http://127.0.0.1:8090'
}

export async function taskApiRequest(path, options = {}) {
  const response = await fetch(`${getTaskApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  return data
}

export function encodeResourceId(value) {
  return encodeURIComponent(String(value || ''))
}
