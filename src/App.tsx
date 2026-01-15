import { useState, useCallback, useRef, useEffect } from 'react'
import ChatPanel from './components/ChatPanel'
import Spreadsheet from './components/Spreadsheet'
import './App.css'

export interface SpreadsheetData {
  [key: string]: string
}

interface HistoryState {
  data: SpreadsheetData
  timestamp: number
}

function App() {
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData>({})
  const [history, setHistory] = useState<HistoryState[]>([{ data: {}, timestamp: Date.now() }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUpdatingRef = useRef(false)

  // 添加到历史记录
  const addToHistory = useCallback((newData: SpreadsheetData) => {
    if (isUpdatingRef.current) return
    
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ data: newData, timestamp: Date.now() })
    
    // 限制历史记录数量
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  // 撤销
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUpdatingRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setSpreadsheetData(history[newIndex].data)
      setTimeout(() => { isUpdatingRef.current = false }, 0)
    }
  }, [history, historyIndex])

  // 重做
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUpdatingRef.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setSpreadsheetData(history[newIndex].data)
      setTimeout(() => { isUpdatingRef.current = false }, 0)
    }
  }, [history, historyIndex])

  // formula 参数保留用于将来扩展（如公式计算）
  const updateCell = useCallback((row: number, col: number, value: string, formula?: string) => {
    const key = `${row}-${col}`
    setSpreadsheetData((prev: SpreadsheetData) => {
      const newData = {
        ...prev,
        [key]: value
      }
      addToHistory(newData)
      return newData
    })
  }, [addToHistory])

  const updateMultipleCells = useCallback((updates: Array<{ row: number; col: number; value: string; formula?: string }>) => {
    setSpreadsheetData((prev: SpreadsheetData) => {
      const updated = { ...prev }
      updates.forEach(({ row, col, value }) => {
        const key = `${row}-${col}`
        updated[key] = value
      })
      addToHistory(updated)
      return updated
    })
  }, [addToHistory])

  const getCellValue = useCallback((row: number, col: number): string => {
    const key = `${row}-${col}`
    return spreadsheetData[key] || ''
  }, [spreadsheetData])

  const getAllData = useCallback((): SpreadsheetData => {
    return spreadsheetData
  }, [spreadsheetData])

  // CSV 导出功能
  const exportToCSV = useCallback(() => {
    const csvContent = []
    const maxRow = Math.max(...Object.keys(spreadsheetData).map(key => parseInt(key.split('-')[0])), 0)
    const maxCol = Math.max(...Object.keys(spreadsheetData).map(key => parseInt(key.split('-')[1])), 0)

    // 添加列标题
    const headers = []
    for (let col = 0; col <= maxCol; col++) {
      headers.push(String.fromCharCode(65 + col))
    }
    csvContent.push(headers.join(','))

    // 添加数据行
    for (let row = 0; row <= maxRow; row++) {
      const rowData = []
      for (let col = 0; col <= maxCol; col++) {
        const key = `${row}-${col}`
        const value = spreadsheetData[key] || ''
        // 处理包含逗号、引号或换行符的值
        const escapedValue = value.includes(',') || value.includes('"') || value.includes('\n') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value
        rowData.push(escapedValue)
      }
      csvContent.push(rowData.join(','))
    }

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `spreadsheet_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [spreadsheetData])

  // CSV 导入功能
  const importFromCSV = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) return

      const newData: SpreadsheetData = {}
      
      // 跳过标题行（如果存在）
      const startRow = lines[0].match(/^[A-Z,]+$/) ? 1 : 0
      
      for (let i = startRow; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        for (let j = 0; j < values.length; j++) {
          const key = `${i - startRow}-${j}`
          newData[key] = values[j]
        }
      }
      
      setSpreadsheetData(newData)
      addToHistory(newData)
    }
    reader.readAsText(file)
  }, [addToHistory])

  // 解析CSV行
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // 跳过下一个引号
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current)
    return result
  }

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const cmdKey = e.metaKey || e.ctrlKey
      const shiftKey = e.shiftKey

      if (cmdKey && e.key === 'z' && !shiftKey) {
        e.preventDefault()
        undo()
      } else if (cmdKey && e.key === 'z' && shiftKey) {
        e.preventDefault()
        redo()
      } else if (cmdKey && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <div className="app">
      <div className="app-header">
        <h1>DataFlow - AI Native Spreadsheet</h1>
        <div className="toolbar">
          <button 
            onClick={undo} 
            disabled={historyIndex <= 0}
            title="Undo (Cmd+Z)"
            className="toolbar-button"
          >
            ↶ Undo
          </button>
          <button 
            onClick={redo} 
            disabled={historyIndex >= history.length - 1}
            title="Redo (Cmd+Shift+Z)"
            className="toolbar-button"
          >
            ↷ Redo
          </button>
          <div className="toolbar-separator"></div>
          <label className="toolbar-button import-button">
            📁 Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importFromCSV(file)
              }}
              style={{ display: 'none' }}
            />
          </label>
          <button 
            onClick={exportToCSV}
            title="Export CSV"
            className="toolbar-button"
          >
            📤 Export CSV
          </button>
        </div>
        <div className="shortcuts-hint">
          Press <kbd>Cmd+K</kbd> or <kbd>Ctrl+K</kbd> to open AI assistant
        </div>
      </div>
      <div className="app-content">
        <ChatPanel 
          updateCell={updateCell}
          updateMultipleCells={updateMultipleCells}
          getCellValue={getCellValue}
          getAllData={getAllData}
        />
        <Spreadsheet
          data={spreadsheetData}
          updateCell={updateCell}
          getCellValue={getCellValue}
        />
      </div>
    </div>
  )
}

export default App