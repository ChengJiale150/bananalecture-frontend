# BananaLecture 数据库设计文档

## 表结构

### projects 表（项目表）

存储项目的基本信息，是整个数据模型的核心。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PRIMARY KEY) | 项目唯一标识符 |
| user_id | TEXT | 用户ID |
| name | TEXT | 项目名称 |
| messages | TEXT | 聊天消息内容，存储为 JSON 格式 |
| video_path | TEXT | 生成视频的文件路径 |
| created_at | INTEGER | 项目创建时间戳（毫秒） |
| updated_at | INTEGER | 项目最后更新时间戳（毫秒） |

### ppt_plans 表（幻灯片表）

存储每个项目的 PPT 幻灯片信息。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PRIMARY KEY) | 幻灯片唯一标识符 |
| project_id | TEXT (NOT NULL) | 关联的项目ID，外键 |
| type | TEXT | 幻灯片类型，包括：cover、introduction、content、summary、ending |
| title | TEXT | 幻灯片标题 |
| description | TEXT | 幻灯片描述 |
| content | TEXT | 幻灯片详细内容 |
| idx | INTEGER | 幻灯片在项目中的顺序索引 |
| image_path | TEXT | 幻灯片配图的文件路径 |
| audio_path | TEXT | 幻灯片配音的音频文件路径 |
| created_at | INTEGER | 幻灯片创建时间戳（毫秒） |
| updated_at | INTEGER | 幻灯片最后更新时间戳（毫秒） |

### dialogues 表（对话表）

存储每个幻灯片的角色对话信息。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | TEXT (PRIMARY KEY) | 对话唯一标识符 |
| plan_id | TEXT (NOT NULL) | 关联的幻灯片ID，外键 |
| role | TEXT | 角色名称，包括：大雄、哆啦A梦、旁白、其他男声、其他女声、道具 |
| content | TEXT | 对话文本内容 |
| emotion | TEXT | 情感状态，包括：开心的、悲伤的、生气的、害怕的、惊讶的、无明显情感 |
| speed | TEXT | 语速设置，包括：慢速、中速、快速 |
| idx | INTEGER | 对话在幻灯片中的顺序索引 |
| audio_path | TEXT | 对话音频的文件路径 |
| created_at | INTEGER | 对话创建时间戳（毫秒） |
| updated_at | INTEGER | 对话最后更新时间戳（毫秒） |

### tasks 表（任务表）

存储异步任务的状态与进度信息，供任务查询与取消接口使用。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 任务唯一标识符 |
| project_id | string | 关联的项目ID |
| type | TaskType | 任务类型 |
| status | TaskStatus | 任务状态 |
| current_step | int | 当前步骤 |
| total_steps | int | 总步骤数 |
| error_message | string | 错误信息（可选） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

## 表关系

```
projects (1)
    │
    ├── ppt_plans (N)
    │         │
    │         └── dialogues (N)
    │
    └── tasks (N)
```

- **projects → ppt_plans**：一对多关系，一个项目包含多个幻灯片
- **ppt_plans → dialogues**：一对多关系，一个幻灯片包含多个对话
- **projects → tasks**：一对多关系，一个项目可关联多个异步任务记录
- 级联删除：删除项目时会自动删除关联的幻灯片，删除幻灯片时会自动删除关联的对话

## 索引

为提升查询性能，建立了以下索引：

- `idx_ppt_plans_project_id`：加速按项目ID查询幻灯片
- `idx_dialogues_plan_id`：加速按幻灯片ID查询对话

## 补充说明

### 当前推荐输入

- `projects.user_id` 当前没有数据库层默认值
- 由于系统暂未实现用户认证，当前创建项目时推荐传入 `admin`

### 枚举类型

**幻灯片类型 (SlideType)**：
- `cover`：封面
- `introduction`：引言
- `content`：内容
- `summary`：总结
- `ending`：结尾

**对话角色 (DialogueRole)**：
- `大雄`
- `哆啦A梦`
- `旁白`
- `其他男声`
- `其他女声`
- `道具`

**对话情感 (DialogueEmotion)**：
- `开心的`
- `悲伤的`
- `生气的`
- `害怕的`
- `惊讶的`
- `无明显情感`

**语速 (DialogueSpeed)**：
- `慢速`
- `中速`
- `快速`

**任务类型 (TaskType)**：
- `dialogue_generation`：对话生成
- `audio_generation`：音频生成
- `image_generation`：图片生成
- `video_generation`：视频生成

**任务状态 (TaskStatus)**：
- `pending`：待处理
- `running`：运行中
- `completed`：已完成
- `cancelled`：已取消
- `failed`：失败
