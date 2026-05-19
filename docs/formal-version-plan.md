# Wedding Seating Planner 正式版方案

## 1. 目标

当前版本已经验证了核心流程：

- 宾客名单录入
- 正式名单 / 候补池管理
- 必须同桌分组
- 自动排座
- 手动调座
- 有候补 / 无候补两套排座预演

正式版的目标不是“换个壳上线”，而是把它升级成一个可长期使用、可协作、可跨设备同步的产品。

优先级建议：

1. 先做 Web 正式版
2. 再兼容微信小程序
3. 后续再考虑 App

原因：

- Web 开发和调试效率最高
- 当前项目已使用 Taro，后续转小程序成本可控
- 婚礼筹备场景里，电脑端做名单管理和排座更高频

## 2. 产品范围

### 2.1 MVP 范围

第一版正式版建议只做这些：

- 婚礼项目创建与基础信息
- 宾客名单管理
- 候补池管理
- 自定义宾客类型
- 必须同桌分组
- 排座方案生成
- 手动调座
- 多方案保存
- Excel / CSV 导入导出
- 候补参与预演开关

### 2.2 第二阶段再做

- 不能同桌规则
- 多人协作与评论
- 操作历史与撤销恢复
- AI 优化排座建议
- 电子请柬 / RSVP 联动
- 酒店桌型模板

## 3. 技术路线

## 3.1 前端

建议继续保留当前技术栈：

- `Taro + React + TypeScript`
- Web 作为主端
- 后续增加 `weapp` 构建目标支持微信小程序

原因：

- 当前 Demo 已经在这套技术栈上
- 后续小程序迁移成本最低
- 可以共用大部分业务逻辑、状态、数据模型

前端建议补充：

- 状态管理：`Zustand` 或 `Redux Toolkit`
- 接口层：`React Query` / `TanStack Query`
- 表单校验：`zod`
- 表格/导入：`xlsx`

## 3.2 后端

有两种推荐路线。

### 方案 A：MVP 快速版

- 后端能力：`Supabase`
- 数据库：`PostgreSQL`
- 认证：Supabase Auth
- 文件：Supabase Storage

适合：

- 尽快上线可用版本
- 个人项目或小团队维护

优点：

- 开发快
- 登录、数据库、权限、存储一体化
- 成本低

### 方案 B：长期产品版

- 服务端：`NestJS`
- 数据库：`PostgreSQL`
- ORM：`Prisma`
- 对象存储：`S3 / COS / OSS`
- 认证：JWT + refresh token

适合：

- 后续要做多人协作
- 希望产品边界更可控
- 后面可能做更复杂的权限、分享、版本管理

我的建议：

- 先用 `Supabase + PostgreSQL` 起正式版 MVP
- 当需求明显变复杂时，再迁移到独立后端

## 4. 核心数据表设计

以下是建议的最小可用表结构。

## 4.1 weddings

存婚礼项目。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| title | varchar(100) | 婚礼名称 |
| event_date | date | 婚礼日期 |
| venue_name | varchar(200) | 场地名称 |
| owner_user_id | uuid | 创建人 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

## 4.2 wedding_members

存协作者权限。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| user_id | uuid | 用户 |
| role | varchar(20) | `owner/editor/viewer` |
| created_at | timestamptz | 创建时间 |

## 4.3 guests

存宾客。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| name | varchar(100) | 宾客姓名 |
| group_name | varchar(50) | 宾客类型 |
| status | varchar(20) | `confirmed/waitlist` |
| note | text | 备注 |
| sort_order | int | 排序 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

建议索引：

- `(wedding_id, status)`
- `(wedding_id, group_name)`

## 4.4 guest_group_options

存可选宾客类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| name | varchar(50) | 类型名称 |
| sort_order | int | 排序 |
| created_at | timestamptz | 创建时间 |

## 4.5 seating_tables

存桌位定义。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| name | varchar(50) | 如 `1号桌` |
| base_capacity | int | 默认席位数 |
| current_capacity | int | 当前席位数 |
| sort_order | int | 桌序 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

说明：

- `base_capacity` 记录标准桌位
- `current_capacity` 记录当前方案实际席位

## 4.6 seating_rules

存排座规则。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| rule_type | varchar(20) | 先支持 `must` |
| title | varchar(100) | 可选，如“大学室友组” |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

## 4.7 seating_rule_guests

规则和宾客的关联表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| rule_id | uuid | 规则 ID |
| guest_id | uuid | 宾客 ID |

建议唯一约束：

- `(rule_id, guest_id)`

## 4.8 seat_plans

存“某一套排座方案”。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| wedding_id | uuid | 所属婚礼 |
| name | varchar(100) | 方案名，如“正式名单版” |
| include_waitlist | boolean | 是否包含候补 |
| status | varchar(20) | `draft/final` |
| created_by | uuid | 创建人 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

## 4.9 seat_plan_assignments

存这套方案里的座位分配结果。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| seat_plan_id | uuid | 方案 ID |
| table_id | uuid | 桌位 ID |
| guest_id | uuid | 宾客 ID |
| seat_order | int | 桌内排序 |
| created_at | timestamptz | 创建时间 |

建议唯一约束：

- `(seat_plan_id, guest_id)`

## 4.10 seat_plan_warnings

存排座警告信息。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| seat_plan_id | uuid | 方案 ID |
| warning_type | varchar(30) | 如 `unassigned_guest` |
| message | text | 展示文案 |
| related_guest_ids | jsonb | 相关宾客 |
| created_at | timestamptz | 创建时间 |

## 5. 接口设计建议

MVP 阶段至少需要这些接口：

- `POST /weddings`
- `GET /weddings/:id`
- `PATCH /weddings/:id`

- `GET /weddings/:id/guests`
- `POST /weddings/:id/guests`
- `PATCH /guests/:id`
- `DELETE /guests/:id`

- `GET /weddings/:id/group-options`
- `POST /weddings/:id/group-options`
- `DELETE /group-options/:id`

- `GET /weddings/:id/tables`
- `PATCH /weddings/:id/tables`

- `GET /weddings/:id/rules`
- `POST /weddings/:id/rules`
- `PATCH /rules/:id`
- `DELETE /rules/:id`

- `GET /weddings/:id/seat-plans`
- `POST /weddings/:id/seat-plans/generate`
- `PATCH /seat-plans/:id`
- `POST /seat-plans/:id/move`
- `POST /seat-plans/:id/swap`

## 6. 推荐页面结构

正式版建议拆成 4 个页面：

### 6.1 首页 / 项目页

- 婚礼项目列表
- 新建婚礼
- 最近编辑的方案

### 6.2 宾客管理页

- 正式名单 / 候补池
- 类型筛选
- 批量导入
- 同桌分组管理

### 6.3 排座页

- 桌位设置
- 是否包含候补预演
- 自动生成
- 手动调整
- 桌位看板

### 6.4 方案页

- 方案列表
- 保存为新方案
- 对比正式版 / 含候补版
- 导出打印

## 7. 开发排期

按 1 人开发估算，给一个现实版本。

### 第 1 周：技术底座

- 项目初始化正式版目录结构
- 接入后端（推荐 Supabase）
- 建表与基础鉴权
- 本地状态切到接口层

交付物：

- 能登录
- 能创建婚礼项目
- 数据不再只存在浏览器本地

### 第 2 周：宾客管理正式化

- 宾客 CRUD
- 候补池
- 自定义宾客类型
- 批量导入
- 同桌分组新增 / 编辑 / 删除

交付物：

- 名单管理页可稳定使用

### 第 3 周：排座方案正式化

- 自动排座接口
- 手动调座持久化
- 单桌席位微调
- 候补预演开关
- 多方案保存

交付物：

- 能保存多套方案
- 能稳定切换正式 / 候补方案

### 第 4 周：导入导出与上线准备

- Excel / CSV 导入
- 文本 / 表格导出
- 错误提示优化
- 响应式优化
- 部署上线

交付物：

- 第一版 Web MVP

## 8. 部署建议

如果先做 Web：

- 前端部署：`Vercel` / `Netlify`
- 后端与数据库：`Supabase`

优点：

- 上线快
- 成本低
- 适合 MVP 验证

如果后续上小程序：

- 保持业务逻辑抽离
- 避免严重依赖浏览器专属能力
- 文件导出要预留“小程序下载/转发”方案

## 9. 下一步建议

最推荐的执行顺序：

1. 先把当前 Demo 稳定住
2. 补一版“多方案保存”
3. 上 `Supabase`
4. 把名单、规则、桌位都存云端
5. 再开始做小程序适配

如果你要我继续，我建议下一步我直接帮你做两件事之一：

- 方案 A：把这份文档继续细化成 API 字段级设计
- 方案 B：直接开始把当前项目升级成 `Supabase` 正式版骨架
