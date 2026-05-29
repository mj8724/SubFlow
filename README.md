# SubFlow

SubFlow 是一款本地全自动视频字幕生成与翻译工具。它采用前后端分离架构，专为在无独立显卡 (CPU-only) 环境或边缘设备上高效处理音视频而设计。不仅提供了极客风范的现代 Web 界面，更完全集成了先进的离线大模型。

## 核心功能 (Features)

* 🎬 **全自动字幕流水线**：一键完成 `视频提取音频 -> 语音识别(STT) -> 英中翻译 -> 生成 SRT 字幕文件` 的全流程。
* ⚡ **深度优化 CPU 推理**：
    * **语音识别 (STT)**：集成 CTranslate2 驱动的 `faster-whisper` 引擎，支持 int8 量化，纯 CPU 环境下依旧能实现多倍加速。
    * **离线翻译**：深度集成 `Helsinki-NLP/opus-mt-en-zh` (MarianMT)，专门针对长文本实现了智能分块 (Chunking) 批处理，彻底杜绝内存溢出 (OOM)。
* 🌐 **优雅的 Web 界面**：基于 Next.js 与 React 构建的美观交互前端，支持文件服务器级别的目录浏览 (File Browser)。
* 📊 **实时处理状态监控**：通过 Celery 队列异步调度任务。前端提供酷炫的终端样式 **Log Modal**，实时轮询抓取底层的打印日志并展现滚动的极客控制台界面。
* ⚙️ **灵活的参数配置**：在界面设置中随意切换不同精度的模型（如 `tiny`, `base`, `medium`, `large-v2` 等），您的偏好设置将被持久化保存在本地浏览器中。

## 系统架构 (Architecture)

* **Frontend**: Next.js + React + Tailwind CSS + Lucide Icons
* **Backend**: FastAPI + Uvicorn
* **Task Queue**: Celery + Redis
* **AI Models**: Hugging Face Transformers (`MarianMTModel`), `faster-whisper`
* **Media Toolkit**: FFmpeg

## 安装与运行 (Getting Started)

### 前置要求
* 确保您的系统已安装 `ffmpeg` 并加入环境变量。
* 安装 Redis 并在本地 6379 端口启动。

### 后端 (Backend)
1. 进入 `backend` 目录，安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
2. 启动 FastAPI 后端服务：
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8888
   ```
3. 在新终端启动 Celery 任务消费节点 (Windows 环境建议加上 `--pool=solo`)：
   ```bash
   celery -A tasks worker --pool=solo --loglevel=info
   ```

### 前端 (Frontend)
1. 进入 `frontend` 目录，安装依赖：
   ```bash
   npm install
   ```
2. 启动开发服务器：
   ```bash
   npm run dev
   ```
3. 在浏览器中打开 `http://localhost:3000` 即可开始使用。

## 使用说明
1. **浏览文件**：在左侧文件浏览器中导航到您的视频所在文件夹。
2. **生成字幕**：点击视频右侧的 **Generate** 按钮。
3. **监控进度**：在右侧 Translation Tasks 面板查看总体百分比进度。点击小终端图标 📄 即可弹出实时日志窗口，围观底层 AI 的硬核运行过程。
4. **获取字幕**：任务显示完成后，原始视频同级目录下会自动生成一份同名的 `.srt` 格式中文字幕文件。
