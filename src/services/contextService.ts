import { SpreadsheetData } from '../App'

export interface CellRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface SpreadsheetContext {
  selectedRange: CellRange | null
  selectedCells: Array<{ row: number; col: number; value: string }>
  hasData: boolean
  hasNumbers: boolean
  hasFormulas: boolean
  hasText: boolean
  isEmpty: boolean
  columnCount: number
  rowCount: number
  dataPreview: string[]
  detectedPatterns: string[]
  suggestions: string[]
}

/**
 * 上下文分析服务 - 智能分析选中区域的数据特征
 */
export const contextService = {
  /**
   * 分析选中区域的上下文
   */
  analyzeContext(
    range: CellRange | null,
    spreadsheetData: SpreadsheetData
  ): SpreadsheetContext {
    const context: SpreadsheetContext = {
      selectedRange: range,
      selectedCells: [],
      hasData: false,
      hasNumbers: false,
      hasFormulas: false,
      hasText: false,
      isEmpty: true,
      columnCount: 0,
      rowCount: 0,
      dataPreview: [],
      detectedPatterns: [],
      suggestions: [],
    }

    if (!range) {
      // 没有选中区域，分析整个表格
      return this.analyzeFullSpreadsheet(spreadsheetData)
    }

    // 分析选中区域
    const { startRow, startCol, endRow, endCol } = range
    context.rowCount = endRow - startRow + 1
    context.columnCount = endCol - startCol + 1

    const values: string[] = []
    const numbers: number[] = []

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const key = `${row}-${col}`
        const value = spreadsheetData[key] || ''
        
        context.selectedCells.push({ row, col, value })
        
        if (value) {
          context.hasData = true
          context.isEmpty = false
          values.push(value)
          
          if (value.startsWith('=')) {
            context.hasFormulas = true
          } else {
            const num = parseFloat(value)
            if (!isNaN(num)) {
              context.hasNumbers = true
              numbers.push(num)
            } else {
              context.hasText = true
            }
          }
        }
      }
    }

    // 生成数据预览
    context.dataPreview = values.slice(0, 5)

    // 检测数据模式
    context.detectedPatterns = this.detectPatterns(values, numbers)

    // 生成智能建议
    context.suggestions = this.generateSuggestions(context, numbers)

    return context
  },

  /**
   * 分析整个表格
   */
  analyzeFullSpreadsheet(spreadsheetData: SpreadsheetData): SpreadsheetContext {
    const context: SpreadsheetContext = {
      selectedRange: null,
      selectedCells: [],
      hasData: Object.keys(spreadsheetData).length > 0,
      hasNumbers: false,
      hasFormulas: false,
      hasText: false,
      isEmpty: Object.keys(spreadsheetData).length === 0,
      columnCount: 0,
      rowCount: 0,
      dataPreview: [],
      detectedPatterns: [],
      suggestions: [],
    }

    if (context.isEmpty) {
      context.suggestions = [
        '创建一个新表格模板（如：预算表、任务清单）',
        '导入CSV或Excel文件',
        '开始输入数据',
      ]
      return context
    }

    // 快速扫描数据
    const values = Object.values(spreadsheetData).slice(0, 20)
    for (const value of values) {
      if (value.startsWith('=')) {
        context.hasFormulas = true
      } else if (!isNaN(parseFloat(value))) {
        context.hasNumbers = true
      } else {
        context.hasText = true
      }
    }

    context.dataPreview = values.slice(0, 5)
    context.suggestions = [
      '选择一个区域以获取更精确的建议',
      '导出为Excel或CSV格式',
      '使用AI生成数据分析',
    ]

    return context
  },

  /**
   * 检测数据模式
   */
  detectPatterns(values: string[], numbers: number[]): string[] {
    const patterns: string[] = []

    // 检测数字序列
    if (numbers.length > 2) {
      const diffs = []
      for (let i = 1; i < numbers.length; i++) {
        diffs.push(numbers[i] - numbers[i - 1])
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
      if (Math.abs(avgDiff) > 0.01) {
        patterns.push(`数字序列（平均差值: ${avgDiff.toFixed(2)}）`)
      }
    }

    // 检测日期
    const datePattern = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/
    if (values.some(v => datePattern.test(v))) {
      patterns.push('包含日期数据')
    }

    // 检测百分比
    if (values.some(v => v.includes('%'))) {
      patterns.push('包含百分比')
    }

    // 检测货币
    if (values.some(v => v.includes('$') || v.includes('¥') || v.includes('€'))) {
      patterns.push('包含货币金额')
    }

    return patterns
  },

  /**
   * 生成智能建议
   */
  generateSuggestions(context: SpreadsheetContext, numbers: number[]): string[] {
    const suggestions: string[] = []

    if (context.isEmpty) {
      suggestions.push('该区域为空，可以填充数据或创建模板')
      return suggestions
    }

    // 纯数字区域
    if (context.hasNumbers && !context.hasText && !context.hasFormulas) {
      suggestions.push(`计算总和: SUM = ${numbers.reduce((a, b) => a + b, 0).toFixed(2)}`)
      if (numbers.length > 1) {
        suggestions.push(`计算平均值: AVG = ${(numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)}`)
        suggestions.push(`最大值: ${Math.max(...numbers)}, 最小值: ${Math.min(...numbers)}`)
      }
      suggestions.push('创建汇总公式')
      suggestions.push('生成数据可视化图表')
    }

    // 包含公式
    if (context.hasFormulas) {
      suggestions.push('编辑或复制公式到其他单元格')
      suggestions.push('查看公式计算结果')
    }

    // 混合数据
    if (context.hasText && context.hasNumbers) {
      suggestions.push('可能是表格数据，添加汇总行')
      suggestions.push('创建数据透视表')
      suggestions.push('应用数据格式化')
    }

    // 单列或单行
    if (context.columnCount === 1 || context.rowCount === 1) {
      suggestions.push('快速填充序列')
      suggestions.push('应用到相邻单元格')
    }

    // 多行多列
    if (context.columnCount > 1 && context.rowCount > 1) {
      suggestions.push('添加列标题或行标题')
      suggestions.push('创建汇总行/列')
      suggestions.push('排序或筛选数据')
    }

    return suggestions
  },

  /**
   * 生成上下文感知的 prompt
   */
  generateContextPrompt(context: SpreadsheetContext): string {
    if (context.isEmpty) {
      return '当前表格为空。我可以帮你创建模板、导入数据或开始输入。'
    }

    let prompt = '📊 智能分析：\n\n'

    if (context.selectedRange) {
      const { startRow, startCol, endRow, endCol } = context.selectedRange
      const startCell = `${String.fromCharCode(65 + startCol)}${startRow + 1}`
      const endCell = `${String.fromCharCode(65 + endCol)}${endRow + 1}`
      prompt += `选中区域: ${startCell}:${endCell}\n`
      prompt += `大小: ${context.rowCount}行 × ${context.columnCount}列\n\n`
    }

    if (context.detectedPatterns.length > 0) {
      prompt += `🔍 检测到的模式:\n`
      context.detectedPatterns.forEach(p => prompt += `  • ${p}\n`)
      prompt += '\n'
    }

    if (context.dataPreview.length > 0) {
      prompt += `📋 数据预览:\n  ${context.dataPreview.join(', ')}\n\n`
    }

    if (context.suggestions.length > 0) {
      prompt += `💡 建议操作:\n`
      context.suggestions.slice(0, 5).forEach((s, i) => prompt += `  ${i + 1}. ${s}\n`)
    }

    return prompt
  },
}
