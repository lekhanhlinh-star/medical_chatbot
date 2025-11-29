import './SuggestedQuestions.css'

function SuggestedQuestions({ currentQuestion, onQuestionClick }) {
  // Don't render if no question
  if (!currentQuestion) {
    return null
  }

  return (
    <div className="suggested-questions">
      <h3>💡 你可以問我：</h3>
      <div className="questions-container">
        <button 
          className="suggest-btn"
          onClick={() => onQuestionClick(currentQuestion)}
        >
          {currentQuestion}
        </button>
      </div>
    </div>
  )
}

export default SuggestedQuestions
