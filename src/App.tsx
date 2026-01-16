import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import ChatPanel from './components/ChatPanel'
import Spreadsheet from './components/Spreadsheet'
import DiffPreview from './components/DiffPreview'
import { PendingChange } from './types/diff'
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
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [showDiffPreview, setShowDiffPreview] = useState(false)

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

  const updateCell = useCallback((row: number, col: number, value: string) => {
    const key = `${row}-${col}`
    setSpreadsheetData((prev: SpreadsheetData) => {
      const newData = {
        ...prev,
        [key]: String(value)
      }
      addToHistory(newData)
      return newData
    })
  }, [addToHistory])

  const updateMultipleCells = useCallback((updates: Array<{ row: number; col: number; value: string }>) => {
    console.log('updateMultipleCells called with:', updates)
    setSpreadsheetData((prev: SpreadsheetData) => {
      const updated = { ...prev }
      updates.forEach(({ row, col, value }) => {
        const key = `${row}-${col}`
        updated[key] = String(value)
        console.log(`Updated ${key}: ${value}`)
      })
      addToHistory(updated)
      console.log('New spreadsheet data:', updated)
      return updated
    })
  }, [addToHistory])

  const getCellValue = useCallback((row: number, col: number): string => {
    const key = `${row}-${col}`
    const value = spreadsheetData[key]
    return value ? String(value) : ''
  }, [spreadsheetData])

  const getAllData = useCallback((): SpreadsheetData => {
    return spreadsheetData
  }, [spreadsheetData])

  // 添加pending changes
  const addPendingChanges = useCallback((changes: PendingChange[]) => {
    setPendingChanges(changes)
    setShowDiffPreview(true)
  }, [])

  // 接受单个变更
  const acceptChange = useCallback((id: string) => {
    setPendingChanges(prev => 
      prev.map(change => 
        change.id === id ? { ...change, status: 'accepted' as const } : change
      )
    )
  }, [])

  // 拒绝单个变更
  const rejectChange = useCallback((id: string) => {
    setPendingChanges(prev => 
      prev.map(change => 
        change.id === id ? { ...change, status: 'rejected' as const } : change
      )
    )
  }, [])

  // 接受所有变更
  const acceptAllChanges = useCallback(() => {
    try {
      const updates = pendingChanges
        .filter(c => c.status === 'pending')
        .map(c => ({
          row: c.row,
          col: c.col,
          value: c.newValue
        }))
      
      console.log('Accepting changes:', updates)
      
      if (updates.length > 0) {
        updateMultipleCells(updates)
      }
      
      // 立即标记为accepted
      setPendingChanges(prev => 
        prev.map(c => c.status === 'pending' ? { ...c, status: 'accepted' as const } : c)
      )
      
      // 等待动画完成后关闭
      setTimeout(() => {
        setShowDiffPreview(false)
        // 稍后清空，避免在关闭动画期间清空
        setTimeout(() => setPendingChanges([]), 100)
      }, 600)
    } catch (error) {
      console.error('Error accepting changes:', error)
      // 发生错误时也要关闭弹窗
      setShowDiffPreview(false)
      setPendingChanges([])
    }
  }, [pendingChanges, updateMultipleCells])

  // 拒绝所有变更
  const rejectAllChanges = useCallback(() => {
    setPendingChanges(prev => 
      prev.map(c => ({ ...c, status: 'rejected' as const }))
    )
    
    setTimeout(() => {
      setShowDiffPreview(false)
      setPendingChanges([])
    }, 500)
  }, [])

  // 关闭diff预览
  const closeDiffPreview = useCallback(() => {
    setShowDiffPreview(false)
    setPendingChanges([])
  }, [])

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

  // Excel 导出功能
  const exportToExcel = useCallback(() => {
    const maxRow = Math.max(...Object.keys(spreadsheetData).map(key => parseInt(key.split('-')[0])), 0)
    const maxCol = Math.max(...Object.keys(spreadsheetData).map(key => parseInt(key.split('-')[1])), 0)

    const ws: XLSX.WorkSheet = {}
    const range = { s: { c: 0, r: 0 }, e: { c: maxCol, r: maxRow } }

    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= maxCol; col++) {
        const key = `${row}-${col}`
        const value = spreadsheetData[key]
        
        if (value) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          
          if (value.startsWith('=')) {
            // 保存公式
            ws[cellAddress] = {
              t: 'n',
              f: value.substring(1),
              v: 0
            }
          } else {
            // 普通值
            const numValue = parseFloat(value)
            if (!isNaN(numValue)) {
              ws[cellAddress] = { t: 'n', v: numValue }
            } else {
              ws[cellAddress] = { t: 's', v: value }
            }
          }
        }
      }
    }

    ws['!ref'] = XLSX.utils.encode_range(range)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

    XLSX.writeFile(wb, `spreadsheet_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [spreadsheetData])

  // Excel 导入功能
  const importFromExcel = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellFormula: true })
        
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        const newData: SpreadsheetData = {}
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
        
        for (let row = range.s.r; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
            const cell = worksheet[cellAddress]
            
            if (cell) {
              const key = `${row}-${col}`
              
              if (cell.f) {
                // 保存公式（带=前缀）
                newData[key] = `=${cell.f}`
              } else if (cell.v !== undefined) {
                // 保存值
                newData[key] = String(cell.v)
              }
            }
          }
        }
        
        setSpreadsheetData(newData)
        addToHistory(newData)
      } catch (error) {
        console.error('Error importing Excel file:', error)
        alert('导入Excel文件失败，请确保文件格式正确')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [addToHistory])

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
          <div className="toolbar-separator"></div>
          <label className="toolbar-button import-button">
            📊 Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importFromExcel(file)
              }}
              style={{ display: 'none' }}
            />
          </label>
          <button 
            onClick={exportToExcel}
            title="Export Excel with formulas"
            className="toolbar-button"
          >
            📈 Export Excel
          </button>
        </div>
        <div className="shortcuts-hint">
          Press <kbd>Cmd+K</kbd> to toggle AI assistant | <kbd>Cmd+I</kbd> for smart suggestions
        </div>
      </div>
      <div className="app-content">
        <ChatPanel 
          updateCell={updateCell}
          updateMultipleCells={updateMultipleCells}
          getCellValue={getCellValue}
          getAllData={getAllData}
          selectedRange={selectedRange}
          addPendingChanges={addPendingChanges}
        />
        <Spreadsheet
          data={spreadsheetData}
          updateCell={updateCell}
          getCellValue={getCellValue}
          onSelectionChange={setSelectedRange}
          pendingChanges={pendingChanges}
        />
      </div>
      
      {showDiffPreview && (
        <DiffPreview
          changes={pendingChanges}
          onAcceptAll={acceptAllChanges}
          onRejectAll={rejectAllChanges}
          onAcceptOne={acceptChange}
          onRejectOne={rejectChange}
          onClose={closeDiffPreview}
        />
      )}
    </div>
  )
}

export default App