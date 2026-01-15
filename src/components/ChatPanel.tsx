import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, Send, Sparkles } from 'lucide-react'
import { SpreadsheetData } from '../App'
import { aiService } from '../services/aiService'
import './ChatPanel.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  updateCell: (row: number, col: number, value: string, formula?: string) => void
  updateMultipleCells?: (updates: Array<{ row: number; col: number; value: string; formula?: string }>) => void
  getCellValue: (row: number, col: number) => string
  getAllData: () => SpreadsheetData
}

function ChatPanel({ updateCell, updateMultipleCells, getCellValue, getAllData }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you with spreadsheet operations. Try asking me to:\n- "Create a job application template"\n- "Set A1 to 100"\n- "Calculate sum of A1:A10"\n- "Create a formula in B1 that multiplies A1 by 2"\n\nPress Cmd+K (or Ctrl+K) for quick actions!',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cmd+K / Ctrl+K 快捷键 - 切换打开/关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => {
          const newState = !prev
          // 如果打开，聚焦输入框
          if (newState) {
            setTimeout(() => inputRef.current?.focus(), 100)
          }
          return newState
        })
      }
      // Escape 键关闭
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const spreadsheetData = getAllData()
      const response = await aiService.processMessage(input, spreadsheetData)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])

      // 执行AI返回的操作
      if (response.actions && response.actions.length > 0) {
        // 如果有多条操作且有批量更新方法，使用批量更新
        if (response.actions.length > 1 && updateMultipleCells) {
          const updates = response.actions
            .filter(action => action.type === 'updateCell')
            .map(action => ({
              row: action.row,
              col: action.col,
              value: action.value,
              formula: action.formula,
            }))
          updateMultipleCells(updates)
        } else {
          // 单个更新
          response.actions.forEach(action => {
            if (action.type === 'updateCell') {
              updateCell(
                action.row,
                action.col,
                action.value,
                action.formula
              )
            }
          })
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, getAllData, updateCell])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`chat-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="chat-header">
        <div className="chat-header-left">
          <Sparkles size={18} />
          <span>AI Assistant</span>
        </div>
        <button 
          className="toggle-button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle chat"
        >
          {isOpen ? '←' : '→'}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="chat-messages">
            {messages.map(message => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? (
                    <MessageCircle size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Sparkles size={16} />
                </div>
                <div className="message-content">
                  <div className="message-text">
                    <span className="typing-indicator">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Ask me to update cells, create formulas, analyze data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              className="send-button"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ChatPanel