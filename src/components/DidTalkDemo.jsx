import React, { useState } from 'react'
import { createTalkAndWait } from '../services/did'

export default function DidTalkDemo() {
  const [text, setText] = useState('Hello from the frontend!')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleCreate = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const resp = await createTalkAndWait(text, 'standard')
      setResult(resp)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  // Try to extract a playable video URL from common response shapes
  function extractVideoUrl(res) {
    if (!res) return null
    // common shapes: res.result.urls, res.output.videoUrl, res.videoUrl, res.urls
    if (res.result && res.result[0] && res.result[0].url) return res.result[0].url
    if (res.result && res.result.urls && res.result.urls[0]) return res.result.urls[0]
    if (res.output && res.output[0] && res.output[0].url) return res.output[0].url
    if (res.videoUrl) return res.videoUrl
    if (res.urls && res.urls[0]) return res.urls[0]
    if (res.location) return res.location
    // fallback: return JSON string for debugging
    return null
  }

  const videoUrl = extractVideoUrl(result)

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 6 }}>
      <h3>D-ID Talks (Demo)</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleCreate} disabled={loading}>
          {loading ? 'Đang tạo...' : 'Tạo talk'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 8, color: 'red' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div><strong>Raw response:</strong></div>
          <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {videoUrl && (
        <div style={{ marginTop: 12 }}>
          <div><strong>Video:</strong></div>
          <video src={videoUrl} controls style={{ maxWidth: '100%' }} />
        </div>
      )}
    </div>
  )
}
