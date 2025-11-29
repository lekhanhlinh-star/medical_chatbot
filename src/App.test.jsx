import './App.css'

function App() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>✅ React is Working!</h1>
      <p>If you see this, React is running correctly.</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
    </div>
  )
}

export default App
