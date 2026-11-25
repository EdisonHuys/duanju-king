# 《漫剧大导演》全栈工程仓库 (duanju-king)

本项目为互动短剧创作与小游戏平台《漫剧大导演》的三端全栈源码仓库，包含微信小游戏 / H5 预览端、运营管理后台前端与后端服务（含数据库初始化及增量升级脚本）。

## 目录结构

```text
duanju-king/
├── app/                     # 微信小游戏与 H5 实时预览前端
│   ├── game.js              # 微信小游戏 Canvas 2D 主渲染引擎（交互式脉冲搜证、V2 结局判定）
│   ├── preview.html         # Web / H5 浏览器端实时预览页面
│   ├── pages/               # UniApp 多端页面源码
│   ├── api/ & utils/        # 客户端接口封装、音效与算分工具
│   └── static/              # 封面、分镜插画、结局海报与音效静态资源
├── web/                     # 运营管理后台前端
│   ├── index.html           # 剧情脑图工作台（全链路 / 单条预览双模式）、图鉴、排行榜与管理员配置
│   ├── admin-server.js      # 独立管理端开发预览服务
│   └── src/                 # Vue3 API 与页面组件源码
└── java/                    # 后端服务、Java 业务模块、SQL 与文档
    ├── ruoyi-server/        # Node API 网关与防作弊核算服务（参考 .env.example 配置环境变量）
    ├── ruoyi-duanju/        # Spring Boot 业务模块源码（pom.xml 与 application-prod.yml）
    ├── ruoyi-java-module/   # 控制器、服务层与 MyBatis Mapper 模块
    ├── sql/                 # MySQL 建表与 V2.1 ~ V2.4 增量升级 SQL 脚本
    └── docs/                # 剧本库种子 SCRIPTS_DATABASE.json 与技术文档
```

## 快速启动与环境配置

1. **数据库准备**：依次执行 `java/sql/ry_duanju_2026.sql` 及后续增量脚本（`update_v2_*.sql`）。
2. **后端环境变量**：复制 `java/ruoyi-server/.env.example` 并在运行环境中注入 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`、`ADMIN_TOKEN_SECRET`、`WX_APPID`、`WX_APP_SECRET` 等变量；Spring Boot 端同样通过 `MYSQL_*` 环境变量注入。
3. **小游戏端**：在 `app/manifest.json` 与 `app/config.js` 中配置目标小程序 AppID 与合法 HTTPS 域名后编译预览。
