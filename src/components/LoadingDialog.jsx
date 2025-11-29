import './LoadingDialog.css'

function LoadingDialog({ isVisible }) {
  if (!isVisible) return null

  return (
    <div className="loading-dialog">
      ⏳ Processing...
    </div>
  )
}

export default LoadingDialog
