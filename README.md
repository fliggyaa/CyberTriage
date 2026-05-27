# CyberTriage (测试)

AI-driven Emergency Response Platform — 智能应急响应分析平台

采集 → 分析 → AI 研判 → 处置，一站式应急响应工作台。

## Features

- **多平台采集** — 内置 Windows / Linux / macOS 采集脚本，一键生成结构化报告
- **自动风险定级** — 基于规则引擎的实时威胁等级评估（critical / high / medium / low / info）
- **AI 智能分析** — 接入任意 LLM（OpenAI / 本地模型），自动生成威胁评估、异常发现、处置建议、加固方案
- **AI 安全对话** — 类 ChatGPT 交互式安全分析助手，支持多轮对话、上下文压缩、任务绑定
- **可视化报告** — Chart.js 图表展示进程、服务、网络连接、用户权限分布
- **模型管理** — 多模型配置、连通性测试、一键激活切换

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.21+ / Gin / SQLite |
| Frontend | Vanilla JS SPA / Chart.js |
| AI Integration | OpenAI-compatible API |
| Scripts | PowerShell / Bash |

## Quick Start

### Prerequisites

- Go 1.21+
- GCC (for SQLite CGo-free driver — Windows use [TDM-GCC](https://jmeubank.github.io/tdm-gcc/))

### Run

```bash
# Clone
git clone https://github.com/fliggyaa/CyberTriage.git
cd CyberTriage

# Run
go run cmd/server/main.go
```

Open http://localhost:8080

<img width="1920" height="998" alt="72631a87a6c804e4afe708e8d941ba07" src="https://github.com/user-attachments/assets/6b9c3f94-944e-4230-a999-2b2ef78a2f2b" />

<img width="1920" height="995" alt="93b93d21b6fea220a175828a4d25a88e" src="https://github.com/user-attachments/assets/69f57fe6-bb0c-4abd-904f-6a742c0e1780" />


### Configure AI Model

1. Navigate to **模型管理** → **添加模型**
2. Fill in your LLM endpoint, API key, and model name
3. Click **测试连接** then **激活**

## Project Structure

```
├── cmd/server/          # Entry point
├── internal/
│   ├── config/          # App configuration
│   ├── handler/         # HTTP handlers (Gin routes)
│   ├── llm/             # LLM client
│   ├── middleware/       # Gin middleware
│   ├── model/           # Data models
│   ├── repository/      # Database layer (SQLite)
│   └── service/         # Business logic
├── scripts/
│   ├── windows/         # PowerShell collection script
│   ├── linux/           # Bash collection script
│   └── macos/           # Bash collection script
└── web/
    ├── index.html       # SPA entry
    └── static/
        ├── css/         # Styles (dark security console theme)
        └── js/          # Frontend modules (api, pages, app)
```

## Workflow

1. **Create Task** — 新建应急响应任务，指定 OS 类型
2. **Deploy Script** — 在目标机器运行采集脚本，获得 JSON 报告
3. **Upload Report** — 上传报告，系统自动解析并评估风险等级
4. **AI Analysis** — 选择模型，AI 生成专业安全分析报告
5. **Chat** — 在对话页面进一步追问、深挖细节

## License

MIT
