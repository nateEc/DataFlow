import { SpreadsheetData } from '../App'
import { llmService } from './llmService'

export interface AIAction {
  type: 'updateCell' | 'updateMultipleCells'
  row: number
  col: number
  value: string
  formula?: string
}

export interface AIResponse {
  message: string
  actions?: AIAction[]
}

interface TemplateStructure {
  type: 'template'
  name: string
  description?: string
  cells: Array<{
    row: number
    col: number
    value: string
    formula?: string
  }>
}

/**
 * AI Service - 处理用户消息并生成表格操作
 * 集成 LLM 以理解复杂指令并生成表格模板
 */
export const aiService = {
  async processMessage(
    message: string,
    spreadsheetData: SpreadsheetData
  ): Promise<AIResponse> {
    const lowerMessage = message.toLowerCase().trim()
    const actions: AIAction[] = []

    // 检查是否是模板生成请求
    const templateKeywords = ['template', '模版', '表格', '创建', '生成', 'create', 'generate', 'make']
    const isTemplateRequest = templateKeywords.some(keyword => lowerMessage.includes(keyword))

    if (isTemplateRequest) {
      return this.generateTemplate(message, spreadsheetData)
    }

    // 继续使用规则匹配处理简单操作
    // 1. 设置单元格值
    const setValuePattern = /(?:set|put|make)\s*([A-Z])(\d+)\s*(?:to|=|as)\s*([^\s]+)/i
    const directAssignmentPattern = /^([A-Z])(\d+)\s*=\s*(.+)$/i
    
    let match = lowerMessage.match(setValuePattern) || message.match(directAssignmentPattern)
    if (match) {
      const col = match[1].charCodeAt(0) - 65
      const row = parseInt(match[2]) - 1
      const value = match[3]
      
      actions.push({
        type: 'updateCell',
        row,
        col,
        value,
      })
      
      return {
        message: `✓ Set cell ${match[1]}${match[2]} to ${value}`,
        actions,
      }
    }

    // 2. 创建公式
    const formulaPattern = /(?:create|add|make)\s+(?:a\s+)?formula\s+in\s+([A-Z])(\d+)\s+(?:that|which|to)\s+(.+)/i
    match = lowerMessage.match(formulaPattern)
    if (match) {
      const col = match[1].charCodeAt(0) - 65
      const row = parseInt(match[2]) - 1
      const formulaDesc = match[3]
      
      let formula = this.parseFormulaDescription(formulaDesc, message)
      if (!formula) {
        return {
          message: `I couldn't understand the formula description: "${formulaDesc}". Please try a simpler format like "=A1*2" or "=SUM(A1:A10)"`,
        }
      }
      
      actions.push({
        type: 'updateCell',
        row,
        col,
        value: formula,
        formula,
      })
      
      return {
        message: `✓ Created formula in ${match[1]}${match[2]}: ${formula}`,
        actions,
      }
    }

    // 3. 直接公式输入
    const directFormulaPattern = /^([A-Z])(\d+)\s*=\s*(=?.+)$/i
    match = message.match(directFormulaPattern)
    if (match) {
      const col = match[1].charCodeAt(0) - 65
      const row = parseInt(match[2]) - 1
      let formula = match[3].trim()
      if (!formula.startsWith('=')) {
        formula = '=' + formula
      }
      
      actions.push({
        type: 'updateCell',
        row,
        col,
        value: formula,
        formula,
      })
      
      return {
        message: `✓ Created formula in ${match[1]}${match[2]}: ${formula}`,
        actions,
      }
    }

    // 4. 填充数据
    const fillPattern = /fill\s+([A-Z])(\d+)\s+to\s+([A-Z])(\d+)\s+with\s+(.+)/i
    match = lowerMessage.match(fillPattern)
    if (match) {
      const startCol = match[1].charCodeAt(0) - 65
      const startRow = parseInt(match[2]) - 1
      const endCol = match[3].charCodeAt(0) - 65
      const endRow = parseInt(match[4]) - 1
      const fillDesc = match[5]
      
      const fillActions = this.parseFillPattern(
        startRow,
        startCol,
        endRow,
        endCol,
        fillDesc
      )
      
      actions.push(...fillActions)
      
      return {
        message: `✓ Filled cells from ${match[1]}${match[2]} to ${match[3]}${match[4]} with ${fillDesc}`,
        actions,
      }
    }

    // 5. 计算总和/平均值等
    const calcPattern = /(?:calculate|what'?s?\s+(?:the|is))?\s*(sum|average|avg|max|min|count)\s+(?:of|in)?\s*([A-Z])(\d+):([A-Z])(\d+)/i
    match = lowerMessage.match(calcPattern)
    if (match) {
      const operation = match[1].toLowerCase()
      const startCol = match[2].charCodeAt(0) - 65
      const startRow = parseInt(match[3]) - 1
      const endCol = match[4].charCodeAt(0) - 65
      const endRow = parseInt(match[5]) - 1
      
      const result = this.calculateRange(
        spreadsheetData,
        startRow,
        startCol,
        endRow,
        endCol,
        operation
      )
      
      const rangeStr = `${match[2]}${match[3]}:${match[4]}${match[5]}`
      return {
        message: `The ${operation} of ${rangeStr} is: ${result}`,
      }
    }

    // 6. 清除单元格
    const clearPattern = /(?:clear|delete|empty|remove)\s+([A-Z])(\d+)/i
    match = lowerMessage.match(clearPattern)
    if (match) {
      const col = match[1].charCodeAt(0) - 65
      const row = parseInt(match[2]) - 1
      
      actions.push({
        type: 'updateCell',
        row,
        col,
        value: '',
      })
      
      return {
        message: `✓ Cleared cell ${match[1]}${match[2]}`,
        actions,
      }
    }

    // 7. 对于其他复杂请求，使用 LLM
    return this.handleComplexRequest(message, spreadsheetData)
  },

  /**
   * 生成表格模板（使用 LLM）
   */
  async generateTemplate(
    message: string,
    spreadsheetData: SpreadsheetData
  ): Promise<AIResponse> {
    try {
      const systemPrompt = `You are an AI assistant that helps create spreadsheet templates. 
When a user asks you to create a template, you should respond with a JSON object in this exact format:

{
  "type": "template",
  "name": "Template Name",
  "description": "Brief description",
  "cells": [
    {"row": 0, "col": 0, "value": "Header 1"},
    {"row": 0, "col": 1, "value": "Header 2"},
    {"row": 1, "col": 0, "value": "Data 1"},
    {"row": 1, "col": 1, "value": "Data 2"}
  ]
}

Rules:
- row and col are 0-indexed (0 = first row/column)
- Use row 0 for headers
- Keep templates practical and useful
- Include 3-10 columns typically
- Include 2-5 example data rows
- Use clear, descriptive headers
- Return ONLY valid JSON, no additional text

Current spreadsheet has ${Object.keys(spreadsheetData).length} filled cells.`

      const response = await llmService.generate(message, systemPrompt, {
        currentData: spreadsheetData,
      })

      // 尝试解析 JSON
      let templateData: TemplateStructure
      try {
        // 尝试提取 JSON（可能在代码块中）
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          templateData = JSON.parse(jsonMatch[0])
        } else {
          templateData = JSON.parse(response.content)
        }
      } catch (parseError) {
        // 如果解析失败，尝试从 LLM 回复中提取信息并手动构建
        return {
          message: `I understand you want to create a template for "${message}". However, I couldn't parse the response. Please try a more specific request, or check your LLM API configuration.\n\nResponse: ${response.content.substring(0, 200)}`,
        }
      }

      if (templateData.type === 'template' && templateData.cells) {
        const actions: AIAction[] = templateData.cells.map(cell => ({
          type: 'updateCell',
          row: cell.row,
          col: cell.col,
          value: cell.value,
          formula: cell.formula,
        }))

        return {
          message: `✓ Created template: "${templateData.name}"\n${templateData.description || ''}\n\nGenerated ${actions.length} cells.`,
          actions,
        }
      }

      return {
        message: `I tried to create a template, but the format wasn't recognized. Please try again with a more specific request.`,
      }
    } catch (error) {
      return {
        message: `Error creating template: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure your LLM API is configured correctly.`,
      }
    }
  },

  /**
   * 处理复杂请求（使用 LLM）
   */
  async handleComplexRequest(
    message: string,
    spreadsheetData: SpreadsheetData
  ): Promise<AIResponse> {
    try {
      const systemPrompt = `You are an AI assistant that helps users work with spreadsheets. 
The user can ask you to:
- Create or modify spreadsheet content
- Generate templates
- Analyze data
- Perform calculations

When you need to modify the spreadsheet, respond with a JSON object like:
{
  "message": "Your response message",
  "actions": [
    {"type": "updateCell", "row": 0, "col": 0, "value": "Data", "formula": "optional formula"}
  ]
}

If no spreadsheet actions are needed, just respond with a helpful message.`

      const response = await llmService.generate(message, systemPrompt, {
        currentData: spreadsheetData,
      })

      // 尝试解析 JSON 响应
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.actions && Array.isArray(parsed.actions)) {
            return {
              message: parsed.message || response.content,
              actions: parsed.actions as AIAction[],
            }
          }
        }
      } catch {
        // 如果不是 JSON，返回文本回复
      }

      return {
        message: response.content,
      }
    } catch (error) {
      // 如果 LLM 调用失败，返回友好的错误消息
      return {
        message: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. For complex requests, please configure an LLM API key (see README for setup instructions).`,
      }
    }
  },

  parseFormulaDescription(desc: string, originalMessage: string): string | null {
    desc = desc.toLowerCase()
    
    if (desc.includes('multipl') || desc.includes('times')) {
      const match = desc.match(/([a-z])(\d+)\s*(?:by|times|x)\s*(\d+)/i)
      if (match) {
        return `=${match[1].toUpperCase()}${match[2]}*${match[3]}`
      }
    }
    
    if (desc.includes('add') || desc.includes('plus') || desc.includes('sum')) {
      const match = desc.match(/([a-z])(\d+)\s*(?:and|plus|\+)\s*([a-z])(\d+)/i)
      if (match) {
        return `=${match[1].toUpperCase()}${match[2]}+${match[3].toUpperCase()}${match[4]}`
      }
    }
    
    if (desc.includes('sum')) {
      const match = desc.match(/([a-z])(\d+):([a-z])(\d+)/i)
      if (match) {
        return `=SUM(${match[1].toUpperCase()}${match[2]}:${match[3].toUpperCase()}${match[4]})`
      }
    }
    
    const formulaMatch = originalMessage.match(/(=[^\s]+)/i)
    if (formulaMatch) {
      return formulaMatch[1]
    }
    
    return null
  },

  parseFillPattern(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    fillDesc: string
  ): AIAction[] {
    const actions: AIAction[] = []
    
    const numberPattern = /numbers?\s+(\d+)\s+to\s+(\d+)/i
    let match = fillDesc.match(numberPattern)
    if (match) {
      const start = parseInt(match[1])
      const end = parseInt(match[2])
      const step = start < end ? 1 : -1
      let value = start
      let row = startRow
      let col = startCol
      
      while (
        (step > 0 && value <= end) || 
        (step < 0 && value >= end)
      ) {
        actions.push({
          type: 'updateCell',
          row,
          col,
          value: String(value),
        })
        
        value += step
        if (col < endCol) {
          col++
        } else if (row < endRow) {
          row++
          col = startCol
        } else {
          break
        }
      }
      
      return actions
    }
    
    return actions
  },

  calculateRange(
    data: SpreadsheetData,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    operation: string
  ): number | string {
    const values: number[] = []
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const key = `${row}-${col}`
        const value = data[key] || ''
        const numValue = parseFloat(value)
        if (!isNaN(numValue)) {
          values.push(numValue)
        }
      }
    }
    
    if (values.length === 0) {
      return 'No numeric values found'
    }
    
    switch (operation.toLowerCase()) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0)
      case 'average':
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'max':
        return Math.max(...values)
      case 'min':
        return Math.min(...values)
      case 'count':
        return values.length
      default:
        return 'Unknown operation'
    }
  },
}