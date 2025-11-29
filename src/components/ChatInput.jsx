import { useState, useRef } from 'react'
import './ChatInput.css'

function ChatInput({ onSendMessage, onAudioUpload, onDownloadChatLog, responseWithAudio, setResponseWithAudio }) {
  const [inputText, setInputText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim(), !!responseWithAudio)
      setInputText('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorderRef.current = new MediaRecorder(stream)
        audioChunksRef.current = []

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          const transcription = await onAudioUpload(audioBlob)
          setInputText(transcription)
        }

        mediaRecorderRef.current.start()
        setIsRecording(true)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('無法訪問麥克風')
      }
    } else {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <>
      <div className="chat-input-container">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="請輸入訊息..."
        />
        <button onClick={handleSend}>📤 發送</button>
        <button onClick={handleMicClick}>
          {isRecording ? '🛑' : '🎤'}
        </button>
      </div>

      <div className="chat-options">
        <label>
          <input
            type="checkbox"
            checked={!!responseWithAudio}
            onChange={(e) => setResponseWithAudio && setResponseWithAudio(e.target.checked)}
          />
          Response with audio
        </label>
        <button onClick={onDownloadChatLog} className="download-btn">
          Download ChatLog
        </button>
      </div>
    </>
  )
}

export default ChatInput
