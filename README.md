# Sandbox Server UI

沙箱服务器管理系统的前端界面，提供可视化的沙箱创建、管理和操作功能。

## 项目简介

这是一个基于 React + TypeScript + Vite 构建的沙箱管理平台前端应用，配合 Spring Boot 后端服务，提供完整的沙箱生命周期管理功能。

## 功能特性

- ✅ **沙箱列表管理** - 查看所有沙箱实例，支持状态筛选和分页
- ✅ **创建沙箱** - 可视化配置沙箱参数（镜像、资源、环境变量等）
- ✅ **沙箱详情** - 查看沙箱详细信息，包括状态、元数据、端点等
- ✅ **终端交互** - 通过 WebSocket 与沙箱进行实时终端交互
- ✅ **文件管理** - 浏览、上传、下载沙箱内的文件
- ✅ **沙箱控制** - 暂停、恢复、续期、删除沙箱操作
- ✅ **项目分组** - 通过项目名称（project.name）对沙箱进行分组管理

## 技术栈

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理
- **TanStack Query** - 数据获取和状态管理
- **Axios** - HTTP 客户端
- **Lucide React** - 图标库
- **date-fns** - 日期处理

### 后端
- **Spring Boot 3.4.1** - Java 后端框架
- **Java 21** - 运行环境
- **WebSocket** - 实时通信
- **OpenSandbox SDK** - 沙箱服务集成

## 项目结构

```
sandbox-server-ui/
├── src/                    # 前端源代码
│   ├── api/               # API 接口定义
│   ├── components/        # 可复用组件
│   │   ├── FileManager.tsx
│   │   ├── Layout.tsx
│   │   ├── StatusBadge.tsx
│   │   └── Terminal.tsx
│   ├── pages/             # 页面组件
│   │   ├── CreateSandbox.tsx
│   │   ├── SandboxDetail.tsx
│   │   └── SandboxList.tsx
│   ├── types/             # TypeScript 类型定义
│   └── App.tsx            # 应用入口
├── backend/               # 后端服务
│   └── src/main/java/com/opensandbox/backend/
│       ├── controller/    # REST 控制器
│       ├── service/       # 业务逻辑
│       ├── config/        # 配置类
│       └── dto/          # 数据传输对象
└── public/               # 静态资源
```

## 快速开始

### 环境要求

- Node.js >= 18
- Java 21
- Maven 3.6+

### 安装依赖

```bash
# 安装前端依赖
npm install

# 后端依赖会在构建时自动下载
```

### 配置

#### 前端配置

前端默认连接到 `http://127.0.0.1:8080`，可在 `src/api/sandbox.ts` 中修改：

```typescript
const api = axios.create({
  baseURL: 'http://127.0.0.1:8080',
  // ...
});
```

#### 后端配置

编辑 `backend/src/main/resources/application.yml`：

```yaml
opensandbox:
  domain: 127.0.0.1:8080
  api-key: ${OPEN_SANDBOX_API_KEY:your-api-key}
  protocol: http
```

### 运行项目

#### 开发模式

```bash
# 启动前端开发服务器（端口 5173）
npm run dev

# 启动后端服务（端口 8081）
cd backend
mvn spring-boot:run -s /Users/yanxx/data/maven/settings.xml
```

#### 构建生产版本

```bash
# 构建前端
npm run build

# 构建后端
cd backend
mvn clean package -s /Users/yanxx/data/maven/settings.xml
```

## 使用说明

### 创建沙箱

1. 点击"创建沙箱"按钮
2. 填写项目名称（可选，用于分组管理）
3. 配置镜像地址（默认：`sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/code-interpreter:latest`）
4. 设置资源限制（CPU、内存、超时时间）
5. 配置入口命令
6. 添加环境变量和元数据（可选）
7. 点击"创建沙箱"

### 管理沙箱

- **查看详情**：点击沙箱列表中的任意沙箱
- **暂停/恢复**：在详情页点击相应按钮
- **续期**：延长沙箱过期时间
- **删除**：永久删除沙箱实例
- **终端交互**：在运行中的沙箱详情页使用终端标签
- **文件管理**：在运行中的沙箱详情页使用文件管理标签

### 项目分组

通过设置 `project.name` 元数据字段，可以将沙箱按项目分组。在沙箱详情页面，标题会自动显示项目名称。

## API 接口

### 沙箱管理

- `GET /sandboxes` - 获取沙箱列表
- `GET /sandboxes/{id}` - 获取沙箱详情
- `POST /sandboxes` - 创建沙箱
- `DELETE /sandboxes/{id}` - 删除沙箱
- `POST /sandboxes/{id}/pause` - 暂停沙箱
- `POST /sandboxes/{id}/resume` - 恢复沙箱
- `POST /sandboxes/{id}/renew-expiration` - 续期沙箱

### 终端交互

- `WebSocket /ws/terminal/{sandboxId}` - 终端 WebSocket 连接

### 文件操作

- `GET /sandboxes/{id}/files` - 获取文件列表
- `POST /sandboxes/{id}/files/write` - 写入文件
- `POST /sandboxes/{id}/exec` - 执行命令

## 开发

### 代码规范

项目使用 ESLint 进行代码检查：

```bash
npm run lint
```

### 类型检查

```bash
npm run build
```

## 许可证

[待定]

## 贡献

欢迎提交 Issue 和 Pull Request！
