import { useEffect, useRef } from 'react'
import './ChatBox.css'

function ChatBox({ messages }) {
  const chatLogRef = useRef(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="chat-box">
      <h2>對話紀錄</h2>
      <div className="chat-log" ref={chatLogRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            {msg.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChatBox
