/**
 * LLM Service - 集成大语言模型 API
 * 支持 OpenAI, Anthropic Claude, 或本地 LLM (Ollama)
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'mock'
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMResponse {
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
  }
}

// 默认配置（从环境变量读取）
const getDefaultConfig = (): LLMConfig => {
  const provider = (import.meta.env.VITE_LLM_PROVIDER || 'mock') as LLMConfig['provider']
  
  return {
    provider,
    apiKey: import.meta.env.VITE_LLM_API_KEY || '',
    baseUrl: import.meta.env.VITE_LLM_BASE_URL || '',
    model: import.meta.env.VITE_LLM_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : provider === 'anthropic' ? 'claude-3-sonnet-20240229' : 'llama2'),
  }
}

class LLMService {
  private config: LLMConfig

  constructor(config?: Partial<LLMConfig>) {
    this.config = { ...getDefaultConfig(), ...config }
  }

  /**
   * 调用 LLM API 生成回复
   */
  async generate(prompt: string, systemPrompt?: string, context?: any): Promise<LLMResponse> {
    const messages: LLMMessage[] = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    
    if (context) {
      messages.push({
        role: 'user',
        content: `Context:\n${JSON.stringify(context, null, 2)}\n\nUser Request: ${prompt}`
      })
    } else {
      messages.push({ role: 'user', content: prompt })
    }

    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(messages)
      case 'anthropic':
        return this.callAnthropic(messages)
      case 'ollama':
        return this.callOllama(messages)
      case 'mock':
      default:
        return this.callMock(messages)
    }
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API Key is required. Please set VITE_LLM_API_KEY environment variable.')
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1'
    const model = this.config.model || 'gpt-4o-mini'

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
      }
    } catch (error) {
      throw new Error(`Failed to call OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 调用 Anthropic Claude API
   */
  private async callAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API Key is required. Please set VITE_LLM_API_KEY environment variable.')
    }

    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1'
    const model = this.config.model || 'claude-3-sonnet-20240229'

    // 转换消息格式（Anthropic 使用不同的格式）
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system: systemMessage,
          messages: conversationMessages,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return {
        content: data.content[0]?.text || '',
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
        },
      }
    } catch (error) {
      throw new Error(`Failed to call Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 调用 Ollama (本地 LLM)
   */
  private async callOllama(messages: LLMMessage[]): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434'
    const model = this.config.model || 'llama2'

    // Ollama 使用不同的 API 格式
    const prompt = messages
      .map(m => `${m.role === 'system' ? 'System: ' : m.role === 'assistant' ? 'Assistant: ' : 'User: '}${m.content}`)
      .join('\n\n')

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        content: data.response || '',
      }
    } catch (error) {
      throw new Error(`Failed to call Ollama: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure Ollama is running on ${baseUrl}`)
    }
  }

  /**
   * Mock LLM (用于开发和测试)
   */
  private async callMock(messages: LLMMessage[]): Promise<LLMResponse> {
    // 模拟 API 延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    const lastMessage = messages[messages.length - 1]?.content || ''
    const lowerContent = lastMessage.toLowerCase()

    // 简单的模板识别
    if (lowerContent.includes('job application') || lowerContent.includes('求职') || lowerContent.includes('简历')) {
      return {
        content: JSON.stringify({
          type: 'template',
          name: 'Job Application Template',
          description: 'A professional job application tracking template',
          cells: [
            { row: 0, col: 0, value: 'Company Name' },
            { row: 0, col: 1, value: 'Position' },
            { row: 0, col: 2, value: 'Date Applied' },
            { row: 0, col: 3, value: 'Status' },
            { row: 0, col: 4, value: 'Interview Date' },
            { row: 0, col: 5, value: 'Notes' },
            { row: 1, col: 0, value: 'Example Corp' },
            { row: 1, col: 1, value: 'Software Engineer' },
            { row: 1, col: 2, value: '2024-01-15' },
            { row: 1, col: 3, value: 'Applied' },
            { row: 1, col: 4, value: '' },
            { row: 1, col: 5, value: 'Applied through LinkedIn' },
          ]
        }, null, 2)
      }
    }

    // 默认回复
    return {
      content: 'I understand your request. To enable full LLM capabilities, please configure an API key:\n\n1. For OpenAI: Set VITE_LLM_API_KEY and VITE_LLM_PROVIDER=openai\n2. For Anthropic: Set VITE_LLM_API_KEY and VITE_LLM_PROVIDER=anthropic\n3. For Ollama: Set VITE_LLM_PROVIDER=ollama (and optionally VITE_LLM_BASE_URL)'
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config }
  }
}

// 导出单例
export const llmService = new LLMService()

// 导出类型
export type { LLMConfig, LLMMessage, LLMResponse }