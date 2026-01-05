
# 智能发票管理系统 🧾✨

基于 **Gemini 3.0** 及多种视觉大模型的发票数字化管理工具。支持 PDF/图片批量识别，并自动生成可导出的财务台账。

## 🛠️ 基础环境要求

### 1. 软件环境
- **Node.js**: v18.17.0 或更高版本 (推荐 v20)
- **包管理器**: NPM v9.0.0 或更高
- **浏览器**: 现代浏览器（必须支持 IndexedDB）

### 2. 操作系统支持
- **Windows**: Windows 10/11 (推荐使用 PowerShell)
- **Linux**: 主流发行版 (Ubuntu, Debian, CentOS 等)
- **Docker**: Engine 20.10+ & Compose v2.0+

### 3. 核心依赖版本
- **React**: ^19.0.0 (前端框架)
- **Vite**: ^6.0.5 (构建工具)
- **TypeScript**: ~5.6.2 (语法检查)
- **@google/genai**: ^1.34.0 (Gemini 官方 SDK)
- **@types/node**: ^22.10.2 (解决 Windows 环境下 `process` 变量报错的关键)

---

## 🏗️ 编译与开发指南

### 1. 安装依赖
```bash
npm install
```

### 2. 环境变量配置 (API Key)
系统需要 Google Gemini API 密钥。
- **Windows (PowerShell)**: `$env:API_KEY="您的密钥"`
- **Windows (CMD)**: `set API_KEY=您的密钥`
- **Linux/macOS**: `export API_KEY=您的密钥`

### 3. 执行编译
```bash
# 执行此命令会进行 TypeScript 严格类型检查并打包
npm run build
```
**Windows 编译报错排查：**
- 若提示 `Cannot find name 'process'`：请确保 `npm install` 已执行，且 `devDependencies` 中包含 `@types/node`。
- 若提示 `TS2688`：请检查 `tsconfig.json` 中的 `types` 选项是否包含 `node`。

---

## 🚀 部署方案

### 方案 1：纯前端静态部署 (Nginx)
此模式下，发票数据存储在用户的浏览器本地 (IndexedDB)。
1. 执行 `npm run build`。
2. 将 `dist` 文件夹内的所有内容拷贝至 Nginx 的 `html` 目录。
3. Nginx 配置需包含 `try_files` 以支持单页应用：
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

### 方案 2：全栈部署 (Node.js + SQLite)
支持多用户数据持久化。
1. 执行 `npm run build` 生成前端包。
2. 执行 `node server.js` 启动后端。
3. 默认访问地址：`http://localhost:8080`。

### 方案 3：Docker 一键部署
```bash
# 自动处理 SQLite 编译环境及前端构建
docker-compose up -d --build
```

---

## 💡 注意事项
- **首位管理员**: 系统第一个注册的用户会自动获得“总管理员”权限。
- **PDF 支持**: 内部集成 PDF.js，支持直接在浏览器预览或提取图片版 PDF。
- **数据导出**: 导出的 CSV 文件采用 UTF-8 BOM 编码，确保 Excel 打开不乱码。

## 📄 许可证
MIT License.
