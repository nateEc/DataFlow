# 环境变量配置指南

## 快速配置 OpenAI API

在项目根目录创建 `.env` 文件（如果不存在），并添加以下内容：

```bash
# OpenAI Configuration
VITE_LLM_PROVIDER=openai
VITE_LLM_API_KEY=你的OpenAI_API_Key
VITE_LLM_MODEL=gpt-4o-mini
```

### 步骤

1. 在项目根目录（`/Users/nathanshan/Desktop/dataFlow/`）创建 `.env` 文件

2. 复制以下内容到 `.env` 文件，并将 `你的OpenAI_API_Key` 替换为你的实际 API Key：

```bash
VITE_LLM_PROVIDER=openai
VITE_LLM_API_KEY=sk-你的实际API密钥
VITE_LLM_MODEL=gpt-4o-mini
```

3. 保存文件后，重启开发服务器：

```bash
npm run dev
```

### 支持的 OpenAI 模型

- `gpt-4o-mini` - 推荐（成本低，速度快）
- `gpt-4o` - 更强大的模型
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - GPT-3.5 Turbo（更便宜）

### 验证配置

配置完成后，在聊天中输入：
- "创建一个job application的模版"

如果看到表格自动生成，说明配置成功！

### 安全提示

⚠️ `.env` 文件已被添加到 `.gitignore`，不会提交到 Git 仓库。

不要在代码中硬编码 API Key。
