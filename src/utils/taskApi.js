// 默认与当前页面同源，避免局域网/远程访问时仍指向 127.0.0.1
export function getDefaultTaskApiBase() {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:8090`
}

export function getTaskApiBase() {
  return localStorage.getItem('uav_task_api_base') || getDefaultTaskApiBase()
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
