# SimGEKI-WebControl

一个用于 SimGEKI 设备的网页控制工具，支持固件刷写和设备配置。

## 功能特性

- 🔧 固件刷写：支持下载最新版本和每日构建固件
- ⚙️ 设备配置：实时摇杆监控和配置调整
- 🌐 网页界面：无需安装软件，直接在浏览器中使用
- 🔄 自动部署：每次提交后自动构建并部署到 GitHub Pages

## 在线使用

访问：https://simdevices-project.github.io/SimGEKI-WebControl/

## 本地开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 自动部署

项目配置了 GitHub Actions 自动构建工作流：

- 当代码推送到 `main` 或 `master` 分支时，会自动触发构建
- 构建完成后，通过 GitHub Pages Actions 自动部署
- 部署的静态页面可通过 GitHub Pages 访问

### 工作流程

1. **检出代码** - 获取最新的源代码
2. **设置 Node.js 环境** - 安装 Node.js 18 并配置 npm 缓存
3. **验证包文件** - 检查 package.json 和 package-lock.json
4. **安装依赖** - 运行 `npm ci`（失败时回退到 `npm install`）
5. **执行 webpack 生产构建** - 运行 `npm run build` 编译和压缩代码
6. **准备部署文件** - 将 `public` 目录的文件复制到 `dist` 目录
7. **配置 Pages** - 设置 GitHub Pages 部署环境
8. **上传构建产物** - 上传 `dist` 目录作为 Pages 部署包
9. **部署到 GitHub Pages** - 通过 GitHub Pages Actions 自动部署

### 启用 GitHub Pages

要使自动部署生效，需要在 GitHub 仓库设置中：

1. 进入仓库的 **Settings** 页面
2. 在左侧菜单找到 **Pages** 选项
3. 在 **Source** 中选择 **GitHub Actions**
4. 工作流会自动处理部署，无需手动选择分支

### 本地预览生产版本

```bash
npm run preview
```

## 浏览器支持

需要支持 WebHID API 的现代浏览器：
- Chrome 89+
- Edge 89+
- Opera 75+

## 许可证

AGPL-3.0 License
