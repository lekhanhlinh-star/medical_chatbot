import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import ChatBox from './ChatBox'
import ChatInput from './ChatInput'
import SuggestedQuestions from './SuggestedQuestions'
import LoadingDialog from './LoadingDialog'
import { getInitialData, sendMessage, uploadAudio } from '../services/api'
import { createTalkAndWait, createTalkWithText, waitForCompletion } from '../services/did'
import './ChatPage.css'

function ChatPage({ onReset }) {
  console.log('ChatPage rendering...')
  
  const [messages, setMessages] = useState([
    { role: 'bot', text: '您好！我可以為您提供什麼協助？' }
  ])
  const [selectedImg, setSelectedImg] = useState()
  const [selectedRole, setSelectedRole] = useState('pharmacist')
  const [selectedGender, setSelectedGender] = useState('male')
  const [isSidebarVisible, setIsSidebarVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [questions, setQuestions] = useState([
    '這個疾病的症狀有哪些？',
    '需要注意什麼飲食禁忌？',
    '藥物的副作用是什麼？'
  ])
  const [currentQuestion, setCurrentQuestion] = useState('這個疾病的症狀有哪些？')
  const [responseWithAudio, setResponseWithAudio] = useState(false)
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoMuted, setVideoMuted] = useState(true)
  // keep track of currently playing audio so we can stop it when needed
  const audioRef = useRef(null)
  const audioURLRef = useRef(null)
  const videoRef = useRef(null)
  const lastBotProcessedRef = useRef(-1)

  useEffect(() => {
    console.log('ChatPage useEffect running...')
    
    // Load saved values from localStorage
    const savedDoctor = localStorage.getItem('selectedDoctor')
    const savedRole = localStorage.getItem('selectedRole')
  const savedGender = localStorage.getItem('selectedGender')
    
    if (savedDoctor) setSelectedImg(savedDoctor)
    if (savedRole) setSelectedRole(savedRole)
  if (savedGender) setSelectedGender(savedGender)

    // Load questions from backend (non-blocking)
    loadInitialData().catch(err => {
      console.error('Failed to load initial data, using fallback:', err)
    })

    // cleanup on unmount: stop any playing audio and revoke blob URL
    return () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        if (audioURLRef.current) {
          URL.revokeObjectURL(audioURLRef.current)
          audioURLRef.current = null
        }
        if (videoRef.current && videoRef.current.dataset && videoRef.current.dataset.blobUrl) {
          try { URL.revokeObjectURL(videoRef.current.dataset.blobUrl) } catch (e) {}
          try { delete videoRef.current.dataset.blobUrl } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Global user interaction handler: if the user clicks anywhere, remember it and allow unmuted autoplay for future videos.
  useEffect(() => {
    const stored = localStorage.getItem('allowAudioAutoplay') === 'true'
    if (stored) return // already allowed

    const onFirstInteraction = () => {
      try {
        localStorage.setItem('allowAudioAutoplay', 'true')
        // Unmute current video if present
        if (videoRef.current) {
          try { videoRef.current.muted = false; setVideoMuted(false); videoRef.current.play().catch(() => {}) } catch (e) {}
        }
      } catch (e) {}
      // remove listener after first interaction
      document.removeEventListener('click', onFirstInteraction)
    }

    document.addEventListener('click', onFirstInteraction)
    return () => document.removeEventListener('click', onFirstInteraction)
  }, [])

  // watch messages and trigger face-talking when a new bot message arrives
  useEffect(() => {
    async function processNewBotMessages() {
      try {
        for (let i = lastBotProcessedRef.current + 1; i < messages.length; i++) {
          const m = messages[i]
          if (m && m.role === 'bot') {
            // mark as processed immediately to avoid duplicate work
            lastBotProcessedRef.current = i
            // trigger D-ID talk when selected image is either a local /static asset or an absolute http(s) URL
            if (selectedImg && (selectedImg.startsWith('/static/images/') || selectedImg.startsWith('http'))) {
              // build absolute URL for the avatar image
              const sourceUrl = selectedImg.startsWith('http') ? selectedImg : `${window.location.origin}${selectedImg}`
              // create payload for D-ID

              try {
                setIsLoading(true)

                // Only generate video if the UI checkbox/state `responseWithAudio` is enabled
                const respWithAudioFlag = !!responseWithAudio
                console.log('Response with audio flag:', respWithAudioFlag)
                if (respWithAudioFlag) {
                  const gender = localStorage.getItem('selectedGender') || selectedGender || 'male'
                  let d_id_voice_id = 'zh-TW-HsiaoChenNZeural'
                  if (String(gender).toLowerCase() === 'male') {
                    d_id_voice_id = 'zh-TW-YunJheNeural'
                  } else if (String(gender).toLowerCase() === 'female') {
                    d_id_voice_id = 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural'
                  }

                  console.log('🎬 Generating talking face video with D-ID (text-to-speech)...')
                  console.log('   Voice ID:', d_id_voice_id)
                  console.log('   Text length:', m.text ? m.text.length : 0)
                  console.log('   Text preview:', (m.text || '').slice(0, 100))

                  const start_time = Date.now()
                  // Create the talk (returns talk id)
                  const talkId = await createTalkWithText(m.text, sourceUrl, 'microsoft', d_id_voice_id, { pollInterval: 2000, timeout: 120000 })

                  if (talkId) {
                    console.log(`✅ Talk created with ID: ${talkId}`)
                    // Wait for completion (returns [videoUrl, statusMessage])
                    const [video_url, statusMsg] = await waitForCompletion(talkId, 120, 3)
                    if (video_url) {
                      console.log('✅ Video generated:', video_url)
                      const elapsed = (Date.now() - start_time) / 1000
                      console.log(`✅ D-ID TTS+Video: ${elapsed.toFixed(2)}s`)
                      await setVideoFromUrlCandidate(video_url)
                    setIsLoading(false)

                    } else {
                      console.warn('⚠️ Video generation failed:', statusMsg)
                      throw new Error(`D-ID video generation failed: ${statusMsg}`)
                    }
                  } else {
                    console.warn('⚠️ Failed to create D-ID talk')
                    throw new Error('Failed to create D-ID talk')
                  }
                } else {
                  // Audio/video responses disabled by UI checkbox — do not call D-ID.
                  console.log('D-ID generation skipped because responseWithAudio is false')
                  // continue to next message
                  continue
                }
              } catch (err) {
                console.error('Error creating D-ID talk:', err)
              } finally {
                setIsLoading(false)
              }
            }
          }
        }
      } catch (e) {
        console.error('Error processing bot messages for D-ID:', e)
      }
    }

    processNewBotMessages()
    // only re-run when messages or selectedImg change
  }, [messages, selectedImg])

  // When videoUrl changes, set the video element's src and try to play it
  useEffect(() => {
    if (!videoUrl) return
    const v = videoRef.current
    if (!v) {
      // video element not mounted yet — nothing to do
      return
    }

    try {
      // If src differs, assign it
      if (v.src !== videoUrl) {
        v.src = videoUrl
      }

      // Attempt unmuted autoplay when allowed; otherwise fall back to muted autoplay.
      const allowUnmuted = localStorage.getItem('allowAudioAutoplay') === 'true'
      const tryPlay = async () => {
        try {
          if (allowUnmuted) {
            v.muted = false
            setVideoMuted(false)
          } else {
            // try unmuted once; if blocked we'll mute below
            v.muted = false
          }

          const p = v.play()
          if (p && typeof p.then === 'function') {
            await p
          }
          // play succeeded unmuted
          setVideoMuted(false)
        } catch (err) {
          // Autoplay blocked with sound — mute and play silently
          // eslint-disable-next-line no-console
          console.warn('Unmuted autoplay blocked; falling back to muted autoplay', err)
          try {
            v.muted = true
            setVideoMuted(true)
            const p2 = v.play()
            if (p2 && typeof p2.then === 'function') p2.catch(() => {})
          } catch (e) {
            // ignore
          }
        }
      }

      // start attempt
      tryPlay()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error setting videoRef src/play:', err)
    }

    // Cleanup: don't revoke external URLs; if using object URLs, revoke elsewhere
    return () => {}
  }, [videoUrl])

  const loadInitialData = async () => {
    console.log('Loading initial data...')
    try {
      const modelType = localStorage.getItem('selectedSpecialty') || 'gdm'
      const data = await getInitialData(modelType)
      console.log('Data received:', data)
      
      if (data.success && data.questions && data.questions.length > 0) {
        setQuestions(data.questions)
        setCurrentQuestion(data.random_question || data.questions[0])
        console.log('Questions loaded successfully')
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      // Keep using fallback questions (already set in state)
    }
  }

  const handleSelectCharacter = (src, role, gender) => {
    localStorage.setItem('selectedDoctor', src)
    localStorage.setItem('selectedRole', role)
    localStorage.setItem('selectedGender', gender)
    setSelectedImg(src)
    setSelectedRole(role)
    setSelectedGender(gender)
    setIsSidebarVisible(false)
  }

  const handleSendMessage = async (text, responseWithAudio) => {
    const modelType = localStorage.getItem('selectedSpecialty') || 'gdm'
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', text }])
    setIsLoading(true)

    // stop any currently playing audio and clear video when user sends a new message
    setVideoUrl(null)
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch (e) {}
      audioRef.current = null
    }
    if (audioURLRef.current) {
      try { URL.revokeObjectURL(audioURLRef.current) } catch (e) {}
      audioURLRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      } catch (e) {}
    }

    try {
      const gender = localStorage.getItem('selectedGender') || selectedGender || 'male'
      const result = await sendMessage(text, selectedRole, gender, modelType, responseWithAudio)

      // Server now removes <think> tags, so answer is already clean
      const cleanedAnswer = result.answer

      // If responseWithAudio (video) is desired and we have an avatar image, create the D-ID video
      const wantsVideo = !!responseWithAudio && selectedImg && (selectedImg.startsWith('/static/images/') || selectedImg.startsWith('http'))

      if (wantsVideo) {
        // Build absolute sourceUrl
        const sourceUrl = selectedImg.startsWith('http') ? selectedImg : `${window.location.origin}${selectedImg}`

        try {
          // setIsLoading(true)
          // Create talk and wait for video
          const genderLocal = localStorage.getItem('selectedGender') || selectedGender || 'male'
          let d_id_voice_id = 'zh-TW-HsiaoChenNeural'
          if (String(genderLocal).toLowerCase() === 'male') d_id_voice_id = 'zh-TW-YunJheNeural'
          else if (String(genderLocal).toLowerCase() === 'female') d_id_voice_id = 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural'
          console.log('🎬 Generating talking face video with D-ID (text-to-speech)...', d_id_voice_id )

          const talkId = await createTalkWithText(cleanedAnswer, sourceUrl, 'microsoft', d_id_voice_id, { pollInterval: 2000, timeout: 120000 })
          if (talkId) {
            const [video_url, statusMsg] = await waitForCompletion(talkId, 120, 3)
            if (video_url) {
              // Set video and append bot message together so they appear at same time
              await setVideoFromUrlCandidate(video_url)
              setMessages(prev => {
                const next = [...prev, { role: 'bot', text: cleanedAnswer }]
                // mark this bot message as already processed to avoid duplicate D-ID calls
                try { lastBotProcessedRef.current = next.length - 1 } catch (e) {}
                return next
              })
            } else {
              // fallback: append message without video
              console.warn('D-ID video generation failed:', statusMsg)
              setMessages(prev => {
                const next = [...prev, { role: 'bot', text: cleanedAnswer }]
                try { lastBotProcessedRef.current = next.length - 1 } catch (e) {}
                return next
              })
            }
            } else {
              console.warn('Failed to create D-ID talk; appending message without video')
              setMessages(prev => {
                const next = [...prev, { role: 'bot', text: cleanedAnswer }]
                try { lastBotProcessedRef.current = next.length - 1 } catch (e) {}
                return next
              })
            }
        } catch (e) {
          console.error('Error generating video, appending bot message without video:', e)
          setMessages(prev => {
            const next = [...prev, { role: 'bot', text: cleanedAnswer }]
            try { lastBotProcessedRef.current = next.length - 1 } catch (err) {}
            return next
          })
        } finally {
          // setIsLoading(false)
        }
      } else {
        // No video desired — append bot message immediately
        setMessages(prev => {
          const next = [...prev, { role: 'bot', text: cleanedAnswer }]
          try { lastBotProcessedRef.current = next.length - 1 } catch (e) {}
          return next
        })
        // Play audio if provided
        if (result.video_url) {
          setVideoUrl(result.video_url)
        } else if (result.audio_base64) {
          playRemoteMP3(result.audio_base64)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { role: 'bot', text: '❌ 錯誤：無法獲取回應' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAudioUpload = async (audioBlob) => {
    setIsLoading(true)
    try {
      const transcription = await uploadAudio(audioBlob)
      return transcription
    } catch (error) {
      console.error('Error uploading audio:', error)
      setMessages(prev => [...prev, { role: 'bot', text: '❌ 錯誤：無法辨識音訊' }])
      return ''
    } finally {
      setIsLoading(false)
    }
  }

  const playRemoteMP3 = (audioBase64) => {
    // stop existing audio first
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch (e) {}
      audioRef.current = null
    }
    if (audioURLRef.current) {
      try { URL.revokeObjectURL(audioURLRef.current) } catch (e) {}
      audioURLRef.current = null
    }

    const audioBlob = new Blob(
      [new Uint8Array(atob(audioBase64).split('').map(char => char.charCodeAt(0)))],
      { type: 'audio/mp3' }
    )
    const audioURL = URL.createObjectURL(audioBlob)
    audioURLRef.current = audioURL
    const audio = new Audio(audioURL)
    audioRef.current = audio
    // when finished, revoke URL and clear refs
    audio.addEventListener('ended', () => {
      try { URL.revokeObjectURL(audioURLRef.current) } catch (e) {}
      audioURLRef.current = null
      audioRef.current = null
    })
    audio.play().catch(err => {
      console.error('Error playing audio:', err)
    })
  }

  // Find first http(s) URL recursively in an object
  const findFirstUrl = (obj) => {
    if (!obj) return null
    if (typeof obj === 'string') {
      if (obj.startsWith('http://') || obj.startsWith('https://')) return obj
      return null
    }
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const u = findFirstUrl(it)
        if (u) return u
      }
      return null
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const u = findFirstUrl(obj[k])
        if (u) return u
      }
    }
    return null
  }

  // Validate and set a video URL candidate. Attempts HEAD/GET to confirm content-type
  // If the URL points to JSON containing a nested URL, follow it. If the resource is video,
  // create an object URL (blob) to avoid playback CORS issues when possible.
  const setVideoFromUrlCandidate = async (candidateUrl) => {
    if (!candidateUrl) return

    // revoke previous object URL if any
    try {
      if (videoRef.current && videoRef.current.dataset && videoRef.current.dataset.blobUrl) {
        URL.revokeObjectURL(videoRef.current.dataset.blobUrl)
        delete videoRef.current.dataset.blobUrl
      }
    } catch (e) {}

    // Try to probe the resource. Many endpoints block HEAD via CORS, so wrap in try/catch.
    try {
      let resp
      try {
        resp = await fetch(candidateUrl, { method: 'HEAD' })
        if (!resp.ok) {
          // fallback to GET
          resp = await fetch(candidateUrl, { method: 'GET' })
        }
      } catch (headErr) {
        // HEAD failed (CORS or not allowed), try GET
        resp = await fetch(candidateUrl, { method: 'GET' })
      }

      if (!resp) {
        setVideoUrl(candidateUrl)
        return
      }

      const contentType = resp.headers.get('content-type') || ''

      if (contentType.startsWith('video/')) {
        // If GET returned a real response with video body, create blob URL
        // If the response for GET was used above, it may already have body; if HEAD used, do a GET
        let getResp = resp
        if (resp.type === 'opaque' || resp.status === 0 || resp.headers.get('content-length') == null) {
          // opaque or missing info — try GET to obtain blob
          getResp = await fetch(candidateUrl)
        }
        try {
          const blob = await getResp.blob()
          const blobUrl = URL.createObjectURL(blob)
          if (videoRef.current) videoRef.current.dataset.blobUrl = blobUrl
          setVideoUrl(blobUrl)
          return
        } catch (e) {
          // couldn't get blob; fall back to direct URL
          setVideoUrl(candidateUrl)
          return
        }
      }

      // If content-type is JSON, parse and try to find nested URL
      if (contentType.includes('application/json') || candidateUrl.endsWith('.json')) {
        const json = await resp.json()
        const nested = findFirstUrl(json)
        if (nested && nested !== candidateUrl) {
          return setVideoFromUrlCandidate(nested)
        }
      }

      // unknown content-type or non-video; still set and let browser attempt playback
      setVideoUrl(candidateUrl)
      return
    } catch (err) {
      // network/CORS error probing the resource — fallback to setting URL directly
      // eslint-disable-next-line no-console
      console.warn('Could not probe video URL (CORS or network). Will attempt dev-proxy fallback:', err)

      // If this looks like an S3/d-id result URL, try fetching via the Vite dev proxy at `/s3-did`.
      // This makes the dev server perform the remote request server-side (same-origin for the browser).
      try {
        const u = new URL(candidateUrl)
        // heuristic: S3 host or d-id-talks bucket
        if (u.hostname.includes('.s3.') || u.hostname.includes('d-id-talks-prod.s3')) {
          const proxied = `/s3-did${u.pathname}${u.search}`
          console.log('Retrying video fetch via dev proxy:', proxied)
          // try GET via proxy and create blob URL for playback
          const proxiedResp = await fetch(proxied)
          if (proxiedResp && proxiedResp.ok) {
            try {
              const blob = await proxiedResp.blob()
              const blobUrl = URL.createObjectURL(blob)
              if (videoRef.current) videoRef.current.dataset.blobUrl = blobUrl
              setVideoUrl(blobUrl)
              return
            } catch (e) {
              console.warn('Proxy fetch succeeded but failed to create blob, falling back to proxied URL as src', e)
              setVideoUrl(proxied)
              return
            }
          } else {
            // proxy returned non-ok; still set proxied URL as src to let browser try
            setVideoUrl(proxied)
            return
          }
        }
      } catch (e) {
        // ignore URL parsing/proxy errors and fall back to setting original URL
      }

      // final fallback: set original URL (may still be blocked by CORS in browser)
      setVideoUrl(candidateUrl)
    }
  }

  const handleQuestionChange = () => {
    const filtered = questions.filter(q => q.trim() !== currentQuestion.trim())
    if (filtered.length > 0) {
      const newQuestion = filtered[Math.floor(Math.random() * filtered.length)]
      setCurrentQuestion(newQuestion)
    }
  }

  const handleDownloadChatLog = () => {
    const chatText = messages
      .map(msg => `${msg.role === 'bot' ? 'Bot' : 'User'}: ${msg.text}`)
      .join('\n')
    
    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chatlog.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <button 
        className="toggle-sidebar" 
        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
      >
        選擇醫事人員
      </button>

      <button 
        className="back-to-selection"
        onClick={() => {
          // Stop any playing audio/video, then clear localStorage and go back to specialty selection
          setVideoUrl(null)
          try {
            if (audioRef.current) {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
              audioRef.current = null
            }
            if (audioURLRef.current) {
              URL.revokeObjectURL(audioURLRef.current)
              audioURLRef.current = null
            }
            if (videoRef.current) {
              videoRef.current.pause()
              videoRef.current.currentTime = 0
            }
          } catch (e) {}

          localStorage.removeItem('selectedSpecialty')
          localStorage.removeItem('selectedDoctor')
          localStorage.removeItem('selectedRole')
          localStorage.removeItem('selectedRoleName')
          localStorage.removeItem('selectedGender')
          onReset()
        }}
      >
        🔙 重新選擇教案
      </button>

      <Sidebar
        isVisible={isSidebarVisible}
        onSelectCharacter={handleSelectCharacter}
      />

      <main className="main-content">
        <div className="selected-character">
          <h2>教案名稱</h2>
          <div className="avatar-video-container">
            <img 
              src={selectedImg} 
              alt="選擇的醫事人員" 
              className={videoUrl ? 'avatar-hidden' : ''}
            />
            {videoUrl && (
              <>
                <video
                  ref={videoRef}
                  className="talking-face-video"
                  src={videoUrl}
                  autoPlay
                  muted={videoMuted}
                  playsInline
                  onClick={() => {
                    // allow user to toggle mute on interaction
                    try {
                      if (videoRef.current) {
                        if (videoRef.current.muted) {
                          videoRef.current.muted = false
                          setVideoMuted(false)
                          videoRef.current.play().catch(() => {})
                        } else {
                          videoRef.current.muted = true
                          setVideoMuted(true)
                        }
                      }
                    } catch (e) {}
                  }}
                  onEnded={() => setVideoUrl(null)}
                  title="Click to toggle mute"
                />

                {/* Visible overlay prompting user to unmute if autoplay with sound was blocked */}
                {videoMuted && (
                  <div
                    className="unmute-overlay"
                    onClick={() => {
                      try {
                        if (videoRef.current) {
                          videoRef.current.muted = false
                          setVideoMuted(false)
                          // remember user's gesture to allow future unmuted autoplay
                          localStorage.setItem('allowAudioAutoplay', 'true')
                          videoRef.current.play().catch(() => {})
                        }
                      } catch (e) {}
                    }}
                    role="button"
                    aria-label="Unmute video"
                  >
                    🔊 點擊解除靜音
                  </div>
                )}
              </>
            )}
          </div>
          <div className="selected-specialty">
            {localStorage.getItem('selectedSpecialty')?.toUpperCase() || 'GDM'}
          </div>
        </div>

        <ChatBox messages={messages} />

        <div className="controls">
          <ChatInput
            onSendMessage={handleSendMessage}
            onAudioUpload={handleAudioUpload}
            onDownloadChatLog={handleDownloadChatLog}
            responseWithAudio={responseWithAudio}
            setResponseWithAudio={setResponseWithAudio}
          />

          <SuggestedQuestions
            currentQuestion={currentQuestion}
            onQuestionClick={(question) => {
              handleSendMessage(question, responseWithAudio)
              handleQuestionChange()
            }}
          />
        </div>
      </main>

      <LoadingDialog isVisible={isLoading} />
    </div>
  )
}

export default ChatPage
