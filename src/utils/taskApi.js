// 默认由 Web 静态服务反向代理，避免 HTTPS 页面请求 HTTP Server API 被拦截。
export function getDefaultTaskApiBase() {
  return '/api'
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
