import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { SpreadsheetData } from '../App'
import './Spreadsheet.css'

interface SpreadsheetProps {
  data: SpreadsheetData
  updateCell: (row: number, col: number, value: string, formula?: string) => void
  getCellValue: (row: number, col: number) => string
}

interface CellPosition {
  row: number
  col: number
}

const COLUMN_COUNT = 10 // A-J
const ROW_COUNT = 50
const COLUMN_LETTERS = Array.from({ length: COLUMN_COUNT }, (_, i) => 
  String.fromCharCode(65 + i)
)

function Spreadsheet({ data, updateCell, getCellValue }: SpreadsheetProps) {
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)

  // 同步外部数据更新
  const cells = useMemo(() => {
    const result: string[][] = []
    for (let row = 0; row < ROW_COUNT; row++) {
      const rowData: string[] = []
      for (let col = 0; col < COLUMN_COUNT; col++) {
        rowData.push(getCellValue(row, col))
      }
      result.push(rowData)
    }
    return result
  }, [data, getCellValue])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col })
    const value = cells[row][col]
    setEditValue(value)
    setEditingCell({ row, col })
  }

  const handleCellDoubleClick = (row: number, col: number) => {
    handleCellClick(row, col)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const handleInputBlur = () => {
    if (editingCell) {
      const { row, col } = editingCell
      const formula = editValue.trim().startsWith('=') ? editValue.trim() : undefined
      updateCell(row, col, editValue.trim(), formula)
      setEditingCell(null)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editingCell) return

    const { row, col } = editingCell

    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputBlur()
      // 移动到下一行
      if (row < ROW_COUNT - 1) {
        handleCellClick(row + 1, col)
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleInputBlur()
      // 移动到下一列
      if (col < COLUMN_COUNT - 1) {
        handleCellClick(row, col + 1)
      }
    } else if (e.key === 'Escape') {
      setEditValue(cells[row][col])
      setEditingCell(null)
    } else if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault()
      handleInputBlur()
      if (row > 0) {
        handleCellClick(row - 1, col)
      }
    } else if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault()
      handleInputBlur()
      if (row < ROW_COUNT - 1) {
        handleCellClick(row + 1, col)
      }
    } else if (e.key === 'ArrowLeft' && !e.shiftKey) {
      e.preventDefault()
      handleInputBlur()
      if (col > 0) {
        handleCellClick(row, col - 1)
      }
    } else if (e.key === 'ArrowRight' && !e.shiftKey) {
      e.preventDefault()
      handleInputBlur()
      if (col < COLUMN_COUNT - 1) {
        handleCellClick(row, col + 1)
      }
    }
  }

  const getDisplayValue = (value: string, row: number, col: number): string => {
    if (!value) return ''
    
    // 如果是公式（以=开头），计算并显示结果
    if (value.startsWith('=')) {
      try {
        const result = evaluateFormula(value, row, col, data)
        return result
      } catch {
        return '#ERROR'
      }
    }
    
    return value
  }

  return (
    <div className="spreadsheet-container">
      <div className="spreadsheet-table">
        {/* Header row with column letters */}
        <div className="spreadsheet-row header-row">
          <div className="spreadsheet-cell header-cell row-header"></div>
          {COLUMN_LETTERS.map(letter => (
            <div key={letter} className="spreadsheet-cell header-cell column-header">
              {letter}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: ROW_COUNT }, (_, rowIdx) => (
          <div key={rowIdx} className="spreadsheet-row">
            {/* Row number header */}
            <div className="spreadsheet-cell header-cell row-header">
              {rowIdx + 1}
            </div>

            {/* Cells */}
            {COLUMN_LETTERS.map((letter, colIdx) => {
              const cellKey = `${rowIdx}-${colIdx}`
              const value = cells[rowIdx][colIdx]
              const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
              const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx
              const displayValue = isEditing ? editValue : getDisplayValue(value, rowIdx, colIdx)
              const isFormula = value.startsWith('=')

              return (
                <div
                  key={cellKey}
                  className={`spreadsheet-cell data-cell ${
                    isSelected ? 'selected' : ''
                  } ${isFormula ? 'formula' : ''}`}
                  onClick={() => handleCellClick(rowIdx, colIdx)}
                  onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                  title={isFormula ? `Formula: ${value}` : ''}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="cell-input"
                      value={editValue}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      onKeyDown={handleInputKeyDown}
                    />
                  ) : (
                    <span className="cell-content">{displayValue}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// 公式计算函数
function evaluateFormula(
  formula: string,
  currentRow: number,
  currentCol: number,
  data: SpreadsheetData
): string {
  if (!formula.startsWith('=')) {
    return formula
  }

  let expr = formula.substring(1).trim()

  // 替换单元格引用（如 A1, B2 等）
  const cellRefRegex = /([A-Z]+)(\d+)/g
  expr = expr.replace(cellRefRegex, (match, col, rowNum) => {
    const rowIdx = parseInt(rowNum) - 1
    const colIdx = col.charCodeAt(0) - 65
    const key = `${rowIdx}-${colIdx}`
    const cellValue = data[key] || '0'
    
    // 如果值也是公式，防止循环引用
    if (cellValue.startsWith('=')) {
      return '0'
    }
    
    const numValue = parseFloat(cellValue)
    return isNaN(numValue) ? '0' : String(numValue)
  })

  // 处理 SUM, AVERAGE, MAX, MIN, COUNT 函数
  const sumRegex = /SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/gi
  expr = expr.replace(sumRegex, (match, startCol, startRow, endCol, endRow) => {
    const startRowIdx = parseInt(startRow) - 1
    const startColIdx = startCol.charCodeAt(0) - 65
    const endRowIdx = parseInt(endRow) - 1
    const endColIdx = endCol.charCodeAt(0) - 65
    
    let sum = 0
    for (let r = startRowIdx; r <= endRowIdx; r++) {
      for (let c = startColIdx; c <= endColIdx; c++) {
        const key = `${r}-${c}`
        const val = data[key] || '0'
        if (!val.startsWith('=')) {
          const num = parseFloat(val)
          if (!isNaN(num)) {
            sum += num
          }
        }
      }
    }
    return String(sum)
  })

  const avgRegex = /AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/gi
  expr = expr.replace(avgRegex, (match, startCol, startRow, endCol, endRow) => {
    const startRowIdx = parseInt(startRow) - 1
    const startColIdx = startCol.charCodeAt(0) - 65
    const endRowIdx = parseInt(endRow) - 1
    const endColIdx = endCol.charCodeAt(0) - 65
    
    let sum = 0
    let count = 0
    for (let r = startRowIdx; r <= endRowIdx; r++) {
      for (let c = startColIdx; c <= endColIdx; c++) {
        const key = `${r}-${c}`
        const val = data[key] || '0'
        if (!val.startsWith('=')) {
          const num = parseFloat(val)
          if (!isNaN(num)) {
            sum += num
            count++
          }
        }
      }
    }
    return count > 0 ? String(sum / count) : '0'
  })

  try {
    // 使用 Function 构造函数计算数学表达式
    // 注意：生产环境应该使用更安全的表达式解析器
    const result = Function(`"use strict"; return (${expr})`)()
    return String(result)
  } catch (error) {
    return '#ERROR'
  }
}

export default Spreadsheet