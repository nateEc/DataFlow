# DataFlow - AI Native Spreadsheet Editor

一个基于网页的电子表格 AI 编辑器，重新定义表格的交互方式。

## 功能特性

- 📊 **专业的电子表格组件**：自定义实现的表格，支持编辑、公式计算
- 🤖 **AI 聊天助手**：左侧聊天面板，自然语言操作表格
- ⚡ **快捷键支持**：`Cmd+K` (Mac) 或 `Ctrl+K` (Windows/Linux) 快速打开 AI 助手
- 🎨 **模板生成**：AI 可以理解自然语言并生成完整的表格模板（如 "创建一个job application的模版"）
- 🔧 **智能操作**：AI 可以理解并执行表格操作
  - 生成表格模板（如 "创建预算表"、"创建任务列表"）
  - 设置单元格值
  - 创建公式
  - 填充数据范围
  - 计算统计信息（总和、平均值等）
  - 清除单元格

## 快速开始

### 安装依赖

```bash
npm install
```

**注意**：项目使用自定义表格组件，避免了外部表格库的依赖冲突问题，直接安装即可。

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物将在 `dist` 目录中。

## 使用指南

### 基本操作

1. **生成表格模板**（新功能）：
   - `创建一个job application的模版`
   - `Create a budget template`
   - `生成一个任务追踪表`
   - `Make a sales report template`

2. **设置单元格值**：
   - 直接在聊天中输入：`Set A1 to 100`
   - 或使用赋值语法：`A1 = 100`

3. **创建公式**：
   - `B1 = A1 * 2`
   - `Create formula in B1 that multiplies A1 by 2`
   - `C1 = SUM(A1:A10)`

4. **填充数据**：
   - `Fill A1 to A10 with numbers 1 to 10`

5. **计算统计**：
   - `Calculate sum of A1:A10`
   - `What's the average of B1:B20`

6. **清除单元格**：
   - `Clear A1`

### 快捷键

- `Cmd+K` / `Ctrl+K`：打开/聚焦 AI 聊天输入框
- `Escape`：关闭聊天面板

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **自定义表格组件** - 原生实现的电子表格（无外部依赖冲突）
- **Lucide React** - 图标库

## 项目结构

```
dataFlow/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx      # 聊天面板组件
│   │   ├── ChatPanel.css
│   │   ├── Spreadsheet.tsx    # 电子表格组件
│   │   └── Spreadsheet.css
│   ├── services/
│   │   └── aiService.ts       # AI 服务（意图识别和操作生成）
│   ├── App.tsx                # 主应用组件
│   ├── App.css
│   ├── main.tsx               # 入口文件
│   └── index.css              # 全局样式
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## AI 服务配置

项目已集成 LLM 支持，可以连接到真实的 AI 服务。默认使用 Mock 模式（本地模拟），可以通过环境变量配置真实 API。

### 配置 LLM API

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 选择 LLM 提供商
VITE_LLM_PROVIDER=openai  # 选项: openai, anthropic, ollama, mock

# API Key (OpenAI 和 Anthropic 需要)
VITE_LLM_API_KEY=sk-...

# 可选：自定义 Base URL（用于 Ollama 或自定义端点）
VITE_LLM_BASE_URL=http://localhost:11434

# 可选：指定模型名称（默认: gpt-4o-mini）
VITE_LLM_MODEL=gpt-4o-mini
```

### 支持的 LLM 提供商

1. **OpenAI**（推荐）：
   ```bash
   VITE_LLM_PROVIDER=openai
   VITE_LLM_API_KEY=sk-your-openai-key
   VITE_LLM_MODEL=gpt-4o-mini  # 默认模型，或 gpt-4o, gpt-4-turbo
   ```
   
   **快速配置**：在项目根目录创建 `.env` 文件：
   ```bash
   VITE_LLM_PROVIDER=openai
   VITE_LLM_API_KEY=你的API密钥
   VITE_LLM_MODEL=gpt-4o-mini
   ```

2. **Anthropic Claude**：
   ```bash
   VITE_LLM_PROVIDER=anthropic
   VITE_LLM_API_KEY=sk-ant-your-anthropic-key
   VITE_LLM_MODEL=claude-3-sonnet-20240229
   ```

3. **Ollama（本地 LLM）**：
   ```bash
   # 首先安装并启动 Ollama
   # https://ollama.ai
   
   VITE_LLM_PROVIDER=ollama
   VITE_LLM_BASE_URL=http://localhost:11434
   VITE_LLM_MODEL=llama2  # 或其他模型
   ```

4. **Mock 模式（默认）**：
   - 无需配置
   - 支持基本的模板生成（如 job application template）
   - 用于开发和测试

### 模板生成示例

配置好 API 后，你可以说：
- "创建一个job application的模版" → 生成求职申请表
- "Create a budget tracking spreadsheet" → 生成预算追踪表
- "生成一个项目任务管理表格" → 生成项目管理表

AI 会自动理解你的需求并生成完整的表格结构！

## 未来改进方向

- [ ] 集成真实的 LLM API（OpenAI / Claude / Ollama）
- [ ] 实现 Diff 预览（操作前显示变更）
- [ ] 支持更复杂的公式和函数
- [ ] 多表支持
- [ ] 数据导入/导出（CSV, Excel）
- [ ] 撤销/重做功能
- [ ] 协作编辑支持

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！# DataFlow
