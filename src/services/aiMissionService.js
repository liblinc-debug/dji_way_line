import { taskApiRequest } from '../utils/taskApi.js'

export function chatAIMission(payload) {
  return taskApiRequest('/ai/mission/chat', { method: 'POST', body: JSON.stringify(payload) })
}

export function patchAIMission(payload) {
  return taskApiRequest('/ai/mission/patch', { method: 'POST', body: JSON.stringify(payload) })
}

export function validateAIMission(payload) {
  return taskApiRequest('/mission/validate', { method: 'POST', body: JSON.stringify(payload) })
}

export function reverseGeocodePoint(lat, lng) {
  const query = new URLSearchParams({ lat: Number(lat).toFixed(7), lng: Number(lng).toFixed(7) })
  return taskApiRequest(`/map/reverse-geocode?${query.toString()}`)
}
