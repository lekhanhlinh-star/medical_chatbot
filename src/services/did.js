import axios from 'axios'

// Call D-ID API directly from the browser (note: this exposes the key to clients).
// Dev-time proxy path is `/d-id` (only available during `npm run dev`).
// For production builds, set `VITE_DID_API_URL` to the real D-ID API base (e.g. https://api.d-id.com)
// or set `VITE_DID_PROXY` to a server-side proxy endpoint you control.
const DID_API_BASE = (function () {
  // during development we rely on the Vite dev proxy (local `/d-id` path)
  try {
    const mode = import.meta.env.MODE
    if (mode === 'development') return '/d-id'
  } catch (e) {
    // ignore
  }
  // production: prefer explicit env var, fallback to public D-ID API
  const prodBase = import.meta.env.VITE_DID_API_URL || import.meta.env.VITE_DID_PROXY || 'https://api.d-id.com'
  // ensure no trailing slash
  return prodBase.replace(/\/$/, '')
})()

function getAuthHeader() {
  const key = import.meta.env.VITE_DID_API_KEY || import.meta.env.VITE_API_AUTHORIZATION || ''
  if (!key) return null
  // If key looks like user:pass (contains ':'), send Basic with base64
  if (key.includes(':')) {
    try {
      // btoa may not be available in all environments; use window.btoa
      const token = typeof window !== 'undefined' && window.btoa ? window.btoa(key) : Buffer.from(key).toString('base64')
      return `Basic ${token}`
    } catch (e) {
      return `Basic ${key}`
    }
  }
  // otherwise assume Bearer token
  return `Bearer ${key}`
}

async function createTalk(payload) {
  const auth = getAuthHeader()
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth

  // return full axios response so caller can read headers.location when present
  const res = await axios.post(`${DID_API_BASE}/talks`, payload, { headers })
  return res
}

async function createTalkWithAudio(audioUrl, imageUrl, config = {}) {
  const auth = getAuthHeader()
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth

  const payload = {
    script: { type: 'audio', audio_url: audioUrl },
    source_url: imageUrl,
    config: {
      fluent: config.fluent ?? true,
      pad_audio: config.pad_audio ?? 0.0,
      stitch: config.stitch ?? true
    }
  }

  return axios.post(`${DID_API_BASE}/talks`, payload, { headers })
}

// Upload an image file (Browser `File` or Blob) to D-ID and return the uploaded URL when available.
// If `file` is a string (already a URL), it will be returned immediately.
async function uploadImage(file) {
  if (!file) return null
  if (typeof file === 'string') return file

  const auth = getAuthHeader()
  const headers = {}
  if (auth) headers.Authorization = auth

  try {
    const form = new FormData()
    form.append('image', file, file.name || 'image.png')

    // Let the browser set the Content-Type (boundary)
    const res = await axios.post(`${DID_API_BASE}/images`, form, { headers })
    return res.data && (res.data.url || res.data.result_url || res.data.resultUrl) || null
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('uploadImage error', e)
    return null
  }
}

async function getTalkStatus(talkId) {
  const auth = getAuthHeader()
  const headers = {}
  if (auth) headers.Authorization = auth
  const res = await axios.get(`${DID_API_BASE}/talks/${talkId}`, { headers })
  return res.data
}

// Create a talk from text only (return talk id if created)
async function createTalkWithText(text, imageUrl, providerType = 'microsoft', voiceId = null, options = {}) {
  // Ensure we use the exact image provided. If `imageUrl` is a File/Blob, upload it
  // to D-ID images endpoint and use the returned URL. If it's a string, use it
  // unchanged (could be an absolute URL or a local /static path).
  let sourceUrl = imageUrl
  if (imageUrl && typeof imageUrl !== 'string') {
    try {
      const uploaded = await uploadImage(imageUrl)
      if (uploaded) sourceUrl = uploaded
    } catch (e) {
      // If upload fails, fall back to the original value (may cause server error).
      // Log a warning so developers can diagnose upload issues.
      // eslint-disable-next-line no-console
      console.warn('createTalkWithText: uploadImage failed, falling back to original image value', e)
    }
  }

  const payload = {
    script: { type: 'text', input: text, provider: providerType ? { type: providerType, voice_id: voiceId } : undefined },
    source_url: sourceUrl,
    config: {
      fluent: options.fluent ?? true,
      pad_audio: options.pad_audio ?? 0.0,
      stitch: options.stitch ?? true
    }
  }

  const res = await createTalk(payload)
  const body = res.data || {}
  const location = res.headers && (res.headers.location || res.headers.Location)
  let id = body.id || body.job_id || body.uuid || (body.result && body.result.id) || null
  if (!id && location) {
    const m = String(location).match(/\/talks\/(.+)$/)
    if (m) id = m[1]
  }
  return id
}

// Wait for a talk to complete. Returns [videoUrl|null, statusMessage]
async function waitForCompletion(talkId, timeoutSeconds = 120, pollSeconds = 3) {
  const start = Date.now()
  while (Date.now() - start < timeoutSeconds * 1000) {
    try {
      const data = await getTalkStatus(talkId)
      const status = data.status || data.state || data.job_status
      if (status === 'done' || String(status).toLowerCase() === 'done') {
        const url = extractResultUrl(data)
        return [url, 'Video generated successfully']
      }
      if (status === 'error' || String(status).toLowerCase() === 'error') {
        return [null, `Error: ${JSON.stringify(data)}`]
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('waitForCompletion poll error', e)
    }
    // sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollSeconds * 1000))
  }
  return [null, 'Timeout waiting for video generation']
}

// Create a text talk and poll until completion. Returns final status object when done.
async function createTalkAndWait(scriptText, imageUrl, options = {}) {
  const pollInterval = options.pollInterval || 2000
  const timeout = options.timeout || 120000

  const payload = {
    script: { type: 'text', input: scriptText, provider: options.provider ? { type: options.provider, voice_id: options.voice_id } : undefined },
    source_url: imageUrl,
    config: {
      fluent: options.fluent ?? true,
      pad_audio: options.pad_audio ?? 0.0,
      stitch: options.stitch ?? true
    }
  }

  const createResp = await createTalk(payload)
  const body = createResp.data || {}
  const location = createResp.headers && (createResp.headers.location || createResp.headers.Location)

  // Try to get id from body or Location header
  let id = body.id || body.job_id || body.uuid || (body.result && body.result.id) || null
  if (!id && location) {
    const m = String(location).match(/\/talks\/(.+)$/)
    if (m) id = m[1]
  }

  // If response already contains final result, return it
  if (body.result || body.output || body.videoUrl || body.urls) return body

  if (!id) {
    // Nothing to poll
    return body
  }

  const start = Date.now()
  while (true) {
    const statusResp = await getTalkStatus(id)
    const state = statusResp.status || statusResp.state || statusResp.job_status
    if (state && ['done', 'finished', 'succeeded', 'completed'].includes(String(state).toLowerCase())) return statusResp
    if (state && ['failed', 'error'].includes(String(state).toLowerCase())) throw new Error('D-ID job failed: ' + JSON.stringify(statusResp))
    if (Date.now() - start > timeout) throw new Error('Timeout waiting for D-ID talk')
    // wait
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}

/**
 * Extract the best candidate result URL (prefer mp4/video) from a D-ID job response.
 * Handles common shapes: `result_url`, `resultUrl`, `result.url`, `output`, `urls`, `videoUrl`, etc.
 * Returns a string URL or null if none found.
 */
function extractResultUrl(resp) {
  if (!resp) return null

  // normalize: if it's an axios response object, prefer resp.data
  const body = resp.data || resp

  const candidates = new Set()

  // helper to add if string looks like a URL
  const addIfUrl = (v) => {
    if (!v || typeof v !== 'string') return
    const s = v.trim()
    if (s.startsWith('http://') || s.startsWith('https://')) candidates.add(s)
  }

  // common direct fields
  addIfUrl(body.result_url || body.resultUrl || body.videoUrl || body.video_url || body.url || body.output_url)

  // result or output object
  const maybeObjs = [body.result, body.output, body.data, body.urls, body.files]
  maybeObjs.forEach((o) => {
    if (!o) return
    if (typeof o === 'string') addIfUrl(o)
    if (Array.isArray(o)) {
      o.forEach((it) => addIfUrl(typeof it === 'string' ? it : (it && (it.url || it.result_url || it.videoUrl))))
    } else if (typeof o === 'object') {
      addIfUrl(o.result_url || o.resultUrl || o.url || o.videoUrl || o.location)
      // nested search for common keys
      Object.values(o).forEach((v) => {
        if (typeof v === 'string') addIfUrl(v)
        if (Array.isArray(v)) v.forEach((it) => typeof it === 'string' && addIfUrl(it))
      })
    }
  })

  // deep recursive scan for strings that look like URLs (limits depth)
  const visited = new Set()
  function recurse(obj, depth = 0) {
    if (!obj || depth > 6 || visited.has(obj)) return
    visited.add(obj)
    if (typeof obj === 'string') { addIfUrl(obj); return }
    if (Array.isArray(obj)) return obj.forEach((it) => recurse(it, depth + 1))
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k]
        if (typeof v === 'string') addIfUrl(v)
        else recurse(v, depth + 1)
      }
    }
  }
  recurse(body)

  if (candidates.size === 0) return null

  // Prefer urls that look like mp4/webm/ogg or have common video keywords
  const preferredExt = ['.mp4', '.webm', '.ogg', '.mov']
  const list = Array.from(candidates)
  const byExt = list.find((u) => preferredExt.some((ext) => u.toLowerCase().includes(ext)))
  if (byExt) return byExt

  // prefer fields named result_url-like
  const preferResult = list.find((u) => /result[_-]?url/i.test(u) || /\d+\.mp4/.test(u))
  if (preferResult) return preferResult

  // fallback to first candidate
  return list[0]
}

export { createTalk, createTalkWithAudio, getTalkStatus, createTalkAndWait, extractResultUrl, uploadImage, createTalkWithText, waitForCompletion, createTalkWithTextAndWait }

// Create a text talk using a specific provider/voice and poll until completion.
// Returns an array: [videoUrl|null, finalStatusObject]
async function createTalkWithTextAndWait(scriptText, imageUrl, providerType = 'microsoft', voiceId = null, options = {}) {
  const pollInterval = options.pollInterval || 2000
  const timeout = options.timeout || 120000

  const payload = {
    script: { type: 'text', input: scriptText, provider: providerType ? { type: providerType, voice_id: voiceId } : undefined },
    source_url: imageUrl,
    config: {
      fluent: options.fluent ?? true,
      pad_audio: options.pad_audio ?? 0.0,
      stitch: options.stitch ?? true
    }
  }

  const createResp = await createTalk(payload)
  const body = createResp.data || {}
  const location = createResp.headers && (createResp.headers.location || createResp.headers.Location)

  // Try to get id from body or Location header
  let id = body.id || body.job_id || body.uuid || (body.result && body.result.id) || null
  if (!id && location) {
    const m = String(location).match(/\/talks\/(.+)$/)
    if (m) id = m[1]
  }

  // If response already contains final result, try to extract url
  if (body.result || body.output || body.videoUrl || body.urls) {
    const found = extractResultUrl(body)
    return [found, body]
  }

  if (!id) {
    return [null, body]
  }

  const start = Date.now()
  while (true) {
    const statusResp = await getTalkStatus(id)
    const state = statusResp.status || statusResp.state || statusResp.job_status
    if (state && ['done', 'finished', 'succeeded', 'completed'].includes(String(state).toLowerCase())) {
      const found = extractResultUrl(statusResp)
      return [found, statusResp]
    }
    if (state && ['failed', 'error'].includes(String(state).toLowerCase())) return [null, statusResp]
    if (Date.now() - start > timeout) return [null, { timeout: true }]
    // wait
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}
