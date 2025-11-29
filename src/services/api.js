import axios from 'axios'

// Use relative URLs in development to leverage Vite proxy
// In production, set VITE_API_URL environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Create axios instance with default config
const AUTH_TOKEN = import.meta.env.VITE_API_AUTHORIZATION || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {})
  }
})

export const getInitialData = async (modelType = 'gdm') => {
  // pass model_type as query param so backend can return role-specific questions
  const response = await api.get('/api/chat', { params: { model_type: modelType } })
  return response.data
}

export const sendMessage = async (question, role, gender, modelType, responseWithAudio) => {
  const formData = new FormData()
  formData.append('question', question)
  formData.append('role', role)
  formData.append('gender', gender)
  formData.append('model_type', modelType)
  formData.append('responseWithAudio', responseWithAudio)

  // Use relative URL to leverage Vite proxy
  const response = await api.post('/ask', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const uploadAudio = async (audioBlob) => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.wav')

  // Use relative URL to leverage Vite proxy
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export default api
