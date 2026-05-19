# Wedding Seating Demo

一个用于婚宴备婚场景的排座小工具 Demo，目标是先把「录入宾客信息 -> 配置同桌规则 -> 自动生成座位安排 -> 手动调整 -> 导出结果」这条链路跑通。

## 项目定位

这个项目优先考虑后续扩展到微信小程序，因此采用 `Taro + React + TypeScript` 作为基础方向。这样当前可以先做 H5 Demo，后面再逐步编译到微信小程序，业务模型和排座逻辑也能尽量复用。

当前仓库里的 Demo 已经逐步长成一个可继续升级的原型，后续可以沿着：

- `H5 正式版`
- `微信小程序`
- `多方案排座协作工具`

这条路线继续演进。

## 当前能力

- 配置桌数与每桌人数
- 支持按桌单独微调席位数
- 录入宾客姓名与分组
- 支持自定义宾客类型
- 正式名单 / 候补池分开管理
- 候补人员可参与“必须同桌”分组
- 支持“必须同桌”规则新增、编辑、删除
- 自动生成一版基础排座结果
- 排座页支持“仅正式名单”与“加上候补一起预演”两种模式切换
- 排座页支持看板式桌位结果、选中宾客后移动到目标桌或交换座位
- 自动保存当前方案到本地存储
- 导出当前排座结果到剪贴板
- 首页、名单页、排座页通过顶部导航切换

## 当前页面结构

- `主页`
  - 项目入口和能力概览
- `名单页`
  - 批量录入
  - 正式名单 / 候补池管理
  - 宾客类型管理
  - 同桌分组配置
- `排座页`
  - 桌位设置
  - 是否包含候补预演
  - 自动排座
  - 桌位看板手动调整

## 项目结构

```text
.
├── README.md
├── config
│   └── index.ts
├── package.json
├── project.config.json
├── src
│   ├── app.config.ts
│   ├── app.scss
│   ├── app.tsx
│   ├── components
│   │   ├── top-nav.scss
│   │   └── top-nav.tsx
│   ├── data
│   │   └── demo.ts
│   ├── pages
│   │   ├── home
│   │   ├── roster
│   │   └── seating
│   │   # index 为早期单页 Demo 备份，当前路由不再使用
│   │   └── index
│   │       ├── index.config.ts
│   │       ├── index.scss
│   │       └── index.tsx
│   ├── types
│   │   └── seating.ts
│   └── utils
│       ├── plan.ts
│       └── seating.ts
└── wedding-seating-demo-prd.md
```

## 核心设计

### 1. 数据模型

- `Table`: 桌位信息，包含桌号与容量
- `Guest`: 宾客信息，包含姓名、分组、正式/候补状态
- `Rule`: 规则信息，当前页面重点使用 `must`
- `SeatingResult`: 自动排座后的结果和警告信息

### 2. 排座策略

当前版本采用规则优先的轻量算法：

1. 先根据“必须同桌”规则把宾客合并成组
2. 按组大小从大到小安排
3. 优先往同圈层较多的桌子分配
4. 如果无法满足容量限制，则输出 warning

这版不是复杂最优化求解器，但足够作为 MVP 验证交互链路。

### 3. 当前交互

当前页面已经支持一版可用的交互链路：

- 新增、编辑、删除宾客
- 正式名单和候补池分开管理
- 按宾客类型筛选名单
- 配置“必须同桌”分组，并支持后续编辑
- 一键生成排座结果
- 排座页点击宾客后，可直接在桌位看板上选择“移入此桌”
- 点击另一位宾客可直接交换座位
- 每张桌支持单独 `− / ＋` 调整席位
- 可对比“仅正式名单”和“含候补预演”两种排座情况
- 自动保存和恢复当前方案

## 分支说明

- 日常开发分支：`develop`
- 可根据需要再合并到 `main` / `master`

## 本地启动

先安装依赖：

```bash
npm install
```

启动 H5 开发环境：

```bash
npm run dev:h5
```

启动后通常可以在浏览器打开本地地址，例如：

```bash
http://localhost:10086/
```

说明：

- 项目脚本默认会给 Node 分配 `8192MB` 堆内存
- 可以通过 `NODE_HEAP_SIZE` 覆盖默认值
- 如果你的机器上仍然出现 `heap out of memory`，可以临时手动调大：

```bash
NODE_HEAP_SIZE=12288 npm run dev:h5
```

如果 `dev:h5` 的 watch 模式在你的机器上依然不稳定，推荐改用下面这条更稳的预览方式：

1. 先构建静态页面

```bash
npm run build:h5
```

2. 再启动本地静态服务

```bash
npm run preview:h5
```

3. 浏览器打开

```bash
http://localhost:4173/
```

这条路径不依赖 Taro 的 watch 进程，通常会更稳，适合先确认页面效果。

编译微信小程序版本：

```bash
npm run build:weapp
```

如果要在微信开发者工具中预览小程序，通常需要把 `dist` 目录作为小程序项目打开，并根据你自己的小程序 `appid` 更新 [project.config.json](/Users/bytedance/Documents/Codex/2026-05-12-demo/project.config.json)。

## 正式版规划

仓库里已经补了一份正式版方案文档：

- [docs/formal-version-plan.md](/Users/bytedance/Documents/Codex/2026-05-12-demo/docs/formal-version-plan.md)

内容包括：

- 正式版技术路线
- 数据库表结构
- 核心接口建议
- 页面结构建议
- 4 周开发排期

## 下一步建议

- 多方案保存
- CSV / Excel 导入导出
- 不能同桌规则
- 桌位备注与桌型模板
- 云端存储与多人协作
