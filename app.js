
(() => {
  "use strict";

  // ==============================
  // 01. 基础配置
  // ==============================

  const cfg = window.PORTFOLIO_CONFIG || {};

  const configured =
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_") &&
    cfg.ADMIN_UID &&
    !cfg.ADMIN_UID.includes("YOUR_");

  const $ = id => document.getElementById(id);

  let sb = null;
  let projects = [];
  let currentUser = null;
  let editingId = null;
  let projectsLoaded = false;

  // 安全处理文本
  const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  // 安全操作 DOM
  const open = id => {
    const el = $(id);
    if (el) el.classList.add("open");
  };

  const close = id => {
    const el = $(id);
    if (el) el.classList.remove("open");
  };

  function notify(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg;
  }

  function isAdmin(user) {
    return !!user && user.id === cfg.ADMIN_UID;
  }

  function statusLabel(s) {
    return s || "PLANNED";
  }

  // ==============================
  // 02. 弹窗控制
  // ==============================

  document.querySelectorAll("[data-close]").forEach(b => {
    b.addEventListener("click", () => close(b.dataset.close));
  });

  document.querySelectorAll(".overlay").forEach(o => {
    o.addEventListener("click", e => {
      if (e.target === o) close(o.id);
    });
  });

  // ==============================
  // 03. 项目卡片
  // ==============================

  function projectCard(p) {
    const imageStyle = p.image_url
      ? `background-image:url('${esc(p.image_url)}')`
      : "";

    return `
      <article class="project-card" data-id="${esc(p.id)}">

        <div class="thumb" style="${imageStyle}"></div>

        <div class="project-body">

          <div class="project-top">
            <span>${esc(p.project_no || "PROJECT")}</span>
            <span class="pill">${esc(statusLabel(p.status))}</span>
          </div>

          <h3>${esc(p.title)}</h3>

          <p>${esc(p.description || "")}</p>

          <div class="tags">
            ${(p.tags || []).map(t =>
              `<span class="tag">${esc(t)}</span>`
            ).join("")}
          </div>

        </div>
      </article>
    `;
  }

  // ==============================
  // 04. 项目渲染与搜索
  // ==============================

  function renderProjects() {

    const searchEl = $("search");
    const statusEl = $("statusFilter");
    const projectsEl = $("projects");

    if (!projectsEl) return;

    const q = searchEl
      ? searchEl.value.trim().toLowerCase()
      : "";

    const st = statusEl
      ? statusEl.value
      : "";

    const list = projects.filter(p => {

      const matchesStatus = !st || p.status === st;

      const keywords = [
        p.title,
        p.description,
        p.project_no,
        ...(p.tags || [])
      ].join(" ").toLowerCase();

      const matchesSearch = !q || keywords.includes(q);

      return matchesStatus && matchesSearch;
    });

    // 关键修复：
    // 新版 index.html 已经删除 projectCount，
    // 因此必须判断元素是否存在。

    const countEl = $("projectCount");

    if (countEl) {
      countEl.textContent =
        String(projects.length).padStart(2, "0");
    }

    projectsEl.innerHTML = list.length
      ? list.map(projectCard).join("")
      : `
        <div class="loading">
          ${projects.length
            ? "没有找到匹配的项目。"
            : "目前还没有项目，敬请期待。"}
        </div>
      `;

    document.querySelectorAll(".project-card").forEach(el => {
      el.addEventListener("click", () => {
        showDetail(el.dataset.id);
      });
    });
  }

  // ==============================
  // 05. 项目详情
  // ==============================

  function showDetail(id) {

    const p = projects.find(x => String(x.id) === String(id));

    if (!p) return;

    const detail = $("detailContent");

    if (!detail) return;

    const imageStyle = p.image_url
      ? `background-image:url('${esc(p.image_url)}')`
      : "";

    detail.innerHTML = `

      <div class="detail-hero" style="${imageStyle}"></div>

      <div class="detail-copy">

        <div class="eyebrow">
          ${esc(p.project_no || "PROJECT")} /
          ${esc(p.status)}
        </div>

        <h2>${esc(p.title)}</h2>

        <p>${esc(p.description || "")}</p>

        <div class="tags">
          ${(p.tags || []).map(t =>
            `<span class="tag">${esc(t)}</span>`
          ).join("")}
        </div>

        <div class="detail-links">

          ${p.demo_url
            ? `<a href="${esc(p.demo_url)}"
                target="_blank"
                rel="noopener noreferrer">
                LIVE DEMO ↗
               </a>`
            : ""}

          ${p.github_url
            ? `<a href="${esc(p.github_url)}"
                target="_blank"
                rel="noopener noreferrer">
                GITHUB ↗
               </a>`
            : ""}

        </div>

      </div>
    `;

    open("projectDialog");
  }

  // ==============================
  // 06. 从 Supabase 加载项目
  // ==============================

  async function loadProjects() {

    const projectsEl = $("projects");

    if (!configured || !sb) {

      if (projectsEl) {
        projectsEl.innerHTML = `
          <div class="loading">
            网站前端已就绪。<br>
            完成 README 中的 Supabase 配置后，
            公开项目数据会在这里显示。
          </div>
        `;
      }

      projectsLoaded = false;
      return;
    }

    try {

      const { data, error } = await sb
        .from("projects")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      projects = data || [];

      projectsLoaded = true;

      renderProjects();

    } catch (e) {

      projectsLoaded = false;

      if (projectsEl) {
        projectsEl.innerHTML = `
          <div class="loading">
            项目数据暂时无法加载：${esc(e.message)}
            <br>
            请检查 Supabase 配置与数据库初始化。
          </div>
        `;
      }

      console.error("项目加载失败：", e);
    }
  }

  // 搜索事件
  if ($("search")) {
    $("search").addEventListener("input", () => {
      if (projectsLoaded) renderProjects();
    });
  }

  if ($("statusFilter")) {
    $("statusFilter").addEventListener("change", () => {
      if (projectsLoaded) renderProjects();
    });
  }

  // ==============================
  // 07. 管理员后台
  // ==============================

  function showAdmin() {

    const panel = $("adminPanel");

    if (panel) panel.classList.add("open");

    const identity = $("adminIdentity");

    if (identity) {
      identity.textContent = currentUser?.email || "";
    }

    renderAdmin();
  }

  function hideAdmin() {
    const panel = $("adminPanel");
    if (panel) panel.classList.remove("open");
  }

  function renderAdmin() {

    const container = $("adminProjects");

    if (!container) return;

    container.innerHTML = projects.map(p => `

      <div class="admin-row">

        <div>
          <b>${esc(p.title)}</b>
          <p>
            ${esc(p.project_no)} ·
            ${esc(p.status)}
          </p>
        </div>

        <div class="tools">

          <button data-edit="${esc(p.id)}">
            编辑
          </button>

          <button class="danger" data-delete="${esc(p.id)}">
            删除
          </button>

        </div>

      </div>

    `).join("") || `
      <p class="muted">
        还没有项目，点击“添加项目”创建第一条。
      </p>
    `;

    container.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => openEditor(b.dataset.edit);
    });

    container.querySelectorAll("[data-delete]").forEach(b => {
      b.onclick = () => deleteProject(b.dataset.delete);
    });
  }

  // ==============================
  // 08. 添加 / 编辑项目
  // ==============================

  function openEditor(id = null) {

    editingId = id;

    const p = projects.find(x => String(x.id) === String(id)) || {

      project_no:
        String(projects.length + 1).padStart(2, "0") + " / PROJECT",

      status: "IN PROGRESS",
      title: "",
      description: "",
      tags: [],
      demo_url: "",
      github_url: "",
      image_url: ""

    };

    const fields = {
      editHeading: id ? "修改项目" : "添加项目",
      fNum: p.project_no || "",
      fStatus: p.status || "PLANNED",
      fTitle: p.title || "",
      fDesc: p.description || "",
      fTags: (p.tags || []).join(", "),
      fLink: p.demo_url || "",
      fGithub: p.github_url || "",
      fImage: ""
    };

    Object.entries(fields).forEach(([key, value]) => {
      const el = $(key);
      if (el) el.value = value;
    });

    const hint = $("imageHint");

    if (hint) {
      hint.textContent = p.image_url
        ? "已有封面图；选择新文件即可替换。留空则保留原图。"
        : "选择图片上传到作品集媒体库。";
    }

    notify("saveMessage", "");

    open("editDialog");
  }

  // ==============================
  // 09. 上传项目封面
  // ==============================

  async function uploadImage(file) {

    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

    const path =
      `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await sb
      .storage
      .from("portfolio-media")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg"
      });

    if (error) throw error;

    const { data } = sb
      .storage
      .from("portfolio-media")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // ==============================
  // 10. 保存项目
  // ==============================

  async function saveProject() {

    if (!isAdmin(currentUser)) {
      notify("saveMessage", "当前账号没有管理员权限。");
      return;
    }

    const titleEl = $("fTitle");

    const title = titleEl
      ? titleEl.value.trim()
      : "";

    if (!title) {
      notify("saveMessage", "请填写项目名称。");
      return;
    }

    const btn = $("saveProject");

    if (btn) btn.disabled = true;

    notify("saveMessage", "正在保存…");

    try {

      let imageUrl =
        projects.find(p => String(p.id) === String(editingId))
          ?.image_url || null;

      const imageInput = $("fImage");

      const file = imageInput?.files?.[0];

      if (file) {
        imageUrl = await uploadImage(file);
      }

      const payload = {

        project_no: $("fNum")?.value.trim() || "",

        status: $("fStatus")?.value || "PLANNED",

        title,

        description: $("fDesc")?.value.trim() || "",

        tags: ($("fTags")?.value || "")
          .split(/[,，]/)
          .map(x => x.trim())
          .filter(Boolean),

        demo_url: $("fLink")?.value.trim() || null,

        github_url: $("fGithub")?.value.trim() || null,

        image_url: imageUrl

      };

      let result;

      if (editingId) {

        result = await sb
          .from("projects")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();

      } else {

        payload.sort_order = projects.length + 1;

        result = await sb
          .from("projects")
          .insert(payload)
          .select()
          .single();

      }

      if (result.error) throw result.error;

      close("editDialog");

      await loadProjects();

      renderAdmin();

      notify("saveMessage", "");

    } catch (e) {

      notify("saveMessage", "保存失败：" + e.message);

      console.error("保存项目失败：", e);

    } finally {

      if (btn) btn.disabled = false;

    }
  }

  // ==============================
  // 11. 删除项目
  // ==============================

  async function deleteProject(id) {

    if (!isAdmin(currentUser)) return;

    if (!confirm("确定删除这个项目吗？此操作不可撤销。")) {
      return;
    }

    try {

      const { error } = await sb
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadProjects();

      renderAdmin();

    } catch (e) {

      alert("删除失败：" + e.message);

    }
  }

  // ==============================
  // 12. 管理员登录
  // ==============================

  const adminEntry = $("adminEntry");

  if (adminEntry) {

    adminEntry.onclick = () => {

      if (!configured) {

        open("authDialog");

        notify(
          "authMessage",
          "请先按 README 配置 Supabase URL、Anon Key 和管理员 UID。"
        );

        return;
      }

      open("authDialog");

    };
  }

  const loginBtn = $("loginBtn");

  if (loginBtn) {

    loginBtn.onclick = async () => {

      if (!configured || !sb) {

        notify(
          "authMessage",
          "尚未配置 Supabase。请先完成 README 中的设置。"
        );

        return;
      }

      const email = $("loginEmail")?.value.trim() || "";

      const password = $("loginPassword")?.value || "";

      if (!email || !password) {
        notify("authMessage", "请输入管理员邮箱和密码。");
        return;
      }

      notify("authMessage", "正在验证…");

      try {

        const { data, error } = await sb.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        currentUser = data.user;

        if (!isAdmin(currentUser)) {

          await sb.auth.signOut();

          currentUser = null;

          notify(
            "authMessage",
            "该账号不是指定的管理员账号，已拒绝访问。"
          );

          return;
        }

        close("authDialog");

        showAdmin();

      } catch (e) {

        notify("authMessage", "登录失败：" + e.message);

      }
    };
  }

  // ==============================
  // 13. 后台按钮
  // ==============================

  const newProject = $("newProject");

  if (newProject) {
    newProject.onclick = () => openEditor();
  }

  const saveBtn = $("saveProject");

  if (saveBtn) {
    saveBtn.onclick = saveProject;
  }

  const logoutBtn = $("logoutBtn");

  if (logoutBtn) {

    logoutBtn.onclick = async () => {

      if (sb) await sb.auth.signOut();

      currentUser = null;

      hideAdmin();

    };
  }

  // ==============================
  // 14. Supabase 初始化
  // ==============================

  if (configured) {

    try {

      if (!window.supabase) {
        throw new Error("Supabase SDK 加载失败。");
      }

      sb = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );

      sb.auth.getSession().then(({ data, error }) => {

        if (error) {
          console.error("获取登录状态失败：", error);
          return;
        }

        const user = data.session?.user;

        if (isAdmin(user)) {

          currentUser = user;

          showAdmin();

        }

      }).catch(e => {
        console.error("Session 初始化失败：", e);
      });

      sb.auth.onAuthStateChange((_event, session) => {

        if (session?.user && isAdmin(session.user)) {

          currentUser = session.user;

          showAdmin();

        } else if (!session) {

          currentUser = null;

          hideAdmin();

        }

      });

    } catch (e) {

      console.error("Supabase 初始化失败：", e);

      notify("authMessage", e.message);

    }
  }

  // ==============================
  // 15. 启动网站
  // ==============================

  loadProjects();

})();
