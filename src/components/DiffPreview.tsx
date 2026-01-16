import { useState } from 'react'
import { Check, X, CheckCheck, XCircle } from 'lucide-react'
import { PendingChange } from '../types/diff'
import './DiffPreview.css'

interface DiffPreviewProps {
  changes: PendingChange[]
  onAcceptAll: () => void
  onRejectAll: () => void
  onAcceptOne: (id: string) => void
  onRejectOne: (id: string) => void
  onClose: () => void
}

function DiffPreview({
  changes,
  onAcceptAll,
  onRejectAll,
  onAcceptOne,
  onRejectOne,
  onClose,
}: DiffPreviewProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const pendingChanges = changes.filter(c => c.status === 'pending')
  const acceptedCount = changes.filter(c => c.status === 'accepted').length
  const rejectedCount = changes.filter(c => c.status === 'rejected').length
  
  const handleAcceptAll = () => {
    setIsProcessing(true)
    onAcceptAll()
  }
  
  const handleRejectAll = () => {
    setIsProcessing(true)
    onRejectAll()
  }

  const getCellLabel = (row: number, col: number): string => {
    return `${String.fromCharCode(65 + col)}${row + 1}`
  }

  const getConfidenceColor = (confidence?: number): string => {
    if (!confidence) return '#666'
    if (confidence >= 0.8) return '#28a745'
    if (confidence >= 0.5) return '#ffc107'
    return '#dc3545'
  }

  return (
    <div className="diff-preview-overlay">
      <div className="diff-preview-panel">
        <div className="diff-preview-header">
          <div className="diff-preview-title">
            <span className="diff-preview-icon">🤖</span>
            <span>AI Suggestions</span>
          </div>
          <button className="diff-preview-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="diff-preview-stats">
          <span className="stat-pending">{pendingChanges.length} pending</span>
          {acceptedCount > 0 && (
            <span className="stat-accepted">{acceptedCount} accepted</span>
          )}
          {rejectedCount > 0 && (
            <span className="stat-rejected">{rejectedCount} rejected</span>
          )}
        </div>

        <div className="diff-preview-list">
          {changes.map(change => (
            <div
              key={change.id}
              className={`diff-item diff-item-${change.status}`}
            >
              <div className="diff-item-header">
                <div className="diff-item-cell-label">
                  {getCellLabel(change.row, change.col)}
                </div>
                <div className="diff-item-change">
                  <span className="diff-old-value">
                    {change.oldValue || '[empty]'}
                  </span>
                  <span className="diff-arrow">→</span>
                  <span className="diff-new-value">{change.newValue}</span>
                </div>
                {change.status === 'pending' && (
                  <div className="diff-item-actions">
                    <button
                      className="diff-action-btn accept"
                      onClick={() => onAcceptOne(change.id)}
                      title="Accept this change"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="diff-action-btn reject"
                      onClick={() => onRejectOne(change.id)}
                      title="Reject this change"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {change.status === 'accepted' && (
                  <span className="diff-status-badge accepted">✓ Accepted</span>
                )}
                {change.status === 'rejected' && (
                  <span className="diff-status-badge rejected">✗ Rejected</span>
                )}
              </div>

              {change.reason && (
                <div className="diff-item-details">
                  <div className="diff-item-reason">
                    <span className="reason-label">Reason:</span>
                    <span className="reason-text">{change.reason}</span>
                  </div>
                </div>
              )}

              {change.confidence !== undefined && (
                <div className="diff-item-confidence">
                  <div className="confidence-bar-container">
                    <div
                      className="confidence-bar"
                      style={{
                        width: `${change.confidence * 100}%`,
                        backgroundColor: getConfidenceColor(change.confidence),
                      }}
                    />
                  </div>
                  <span className="confidence-label">
                    {(change.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="diff-preview-footer">
          <button
            className="diff-footer-btn reject-all"
            onClick={handleRejectAll}
            disabled={pendingChanges.length === 0 || isProcessing}
          >
            <XCircle size={16} />
            {isProcessing ? 'Processing...' : 'Reject All'}
          </button>
          <button
            className="diff-footer-btn accept-all"
            onClick={handleAcceptAll}
            disabled={pendingChanges.length === 0 || isProcessing}
          >
            <CheckCheck size={16} />
            {isProcessing ? 'Applying...' : 'Accept All'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DiffPreview
