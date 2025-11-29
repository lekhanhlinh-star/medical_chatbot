import { useState, useEffect } from 'react'
import ChatPage from './components/ChatPage'
import SpecialtySelection from './components/SpecialtySelection'
import './App.css'

function App() {
  console.log('App component rendering...')
  
  const [hasSelectedSpecialty, setHasSelectedSpecialty] = useState(false)
  
  useEffect(() => {
    // Check if user has already selected a specialty
    const selectedSpecialty = localStorage.getItem('selectedSpecialty')
    if (selectedSpecialty) {
      setHasSelectedSpecialty(true)
    }
  }, [])
  
  const handleSpecialtySelected = () => {
    setHasSelectedSpecialty(true)
  }
  
  return (
    <div className="app">
      {!hasSelectedSpecialty ? (
        <SpecialtySelection onSelect={handleSpecialtySelected} />
      ) : (
        <ChatPage onReset={() => setHasSelectedSpecialty(false)} />
      )}
    </div>
  )
}

export default App
