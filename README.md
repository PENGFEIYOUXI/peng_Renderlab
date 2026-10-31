# HAO PENG — RENDER / LAB（私有管理版）

这是一个可部署到 GitHub Pages 的静态作品集。访客只能查看项目；只有你指定的 Supabase 管理员 UUID 可以登录并新增、修改、删除项目、上传封面图。

## 安全模型（重点）

- 浏览器只使用 Supabase **anon/public key**，不包含 service_role key。
- 访客可读取项目与公开封面图。
- 数据库 RLS 策略在服务端限制 INSERT / UPDATE / DELETE，只允许 `auth.uid()` 等于你配置的管理员 UUID。
- 管理界面还会检查当前登录用户 UUID；但真正的安全边界是 Supabase RLS，不是隐藏按钮。
- 不要把 `service_role` key 放进 `config.js`、GitHub 仓库或浏览器。

## 一次性配置

### 1. 创建 Supabase 项目和管理员账号

1. 登录 https://supabase.com/ ，创建一个新项目。
2. 打开 **Authentication → Users → Add user**，创建你自己的管理员邮箱和密码。
3. 复制该用户的 **UUID**（不是邮箱）。

### 2. 初始化数据库与权限

1. 打开 Supabase **SQL Editor → New query**。
2. 打开 `supabase/schema.sql`，把所有 `YOUR_ADMIN_USER_UUID` 替换成刚才复制的 UUID。
3. 执行 SQL。它会创建 `projects` 表、RLS 策略和 `portfolio-media` 图片桶，并插入 OpenGL 光剑项目。

### 3. 配置前端

1. 在 Supabase 项目 **Project Settings → API** 复制 Project URL 和 anon/public key。
2. 编辑根目录 `config.js`：
   - `SUPABASE_URL` 填 Project URL
   - `SUPABASE_ANON_KEY` 填 anon/public key
   - `ADMIN_UID` 填你的 Auth 用户 UUID
3. `config.js` 可以公开，因为里面只有 anon key；绝不能使用 service_role key。

### 4. 本地预览

在项目根目录运行：

```bash
python -m http.server 8000
```

浏览器访问 http://localhost:8000 。不要直接双击 HTML，因为 Supabase 登录和模块资源更适合通过本地 HTTP 服务运行。

### 5. 部署 GitHub Pages

1. 把整个文件夹内容推送到自己的 GitHub 仓库（确保 `config.js` 已填好）。
2. GitHub 仓库 → **Settings → Pages**。
3. 选择从 `main` 分支的 `/ (root)` 部署。
4. 等待 GitHub Pages 发布，访问生成的网址。

> 如果你不想把 Supabase URL / anon key 放在公开仓库，可以把仓库设为私有并确认 Pages 计划支持；但 anon key 本身设计为可公开，RLS 才是权限保护关键。

## 使用管理后台

1. 打开线上网站，滚动到页脚点击 **ADMIN ACCESS**。
2. 输入你在 Supabase Auth 中创建的管理员邮箱和密码。
3. 登录后进入私有管理后台，可添加、编辑、删除项目。
4. 项目封面图会上传到 Supabase Storage；项目文本数据保存在 Supabase 数据库。
5. 退出登录后管理后台关闭。其他访客不会看到管理后台入口以外的任何编辑功能。

## 项目字段

- 项目编号 / 状态（COMPLETED、IN PROGRESS、PLANNED）
- 项目名称 / 项目简介 / 技术标签
- 项目封面图
- Demo / 项目详情链接
- GitHub 仓库链接
- 可持续添加任意数量项目；首页自动展示并可搜索、按状态筛选。

## 后续可选增强

可以继续增加独立项目详情页、视频演示、Markdown 技术文章、项目排序拖拽、技能栈后台编辑、访问统计等。
