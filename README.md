# BananaLecture Frontend

Next.js 前端工作台，负责：

- 用 AI 生成和编辑讲解型 PPT 规划
- 管理项目、幻灯片与对话内容
- 触发后端图片、音频、视频生成任务
- 预览完整讲解视频项目

## Development

```bash
npm run dev
npm run check
```

## Architecture

- `app/`: 路由入口与 API route handler
- `features/`: 按业务能力拆分的 UI 与领域逻辑
- `shared/`: 通用 API client 等基础设施
- `server/`: 仅服务端可用的 planner agent 配置
- `tests/unit/`: 单元测试
