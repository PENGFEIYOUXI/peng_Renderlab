(() => {
"use strict";
const cfg = window.PORTFOLIO_CONFIG || {};
const configured = !!(cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY &&
  !String(cfg.SUPABASE_ANON_KEY).includes("YOUR_") && cfg.ADMIN_UID && !String(cfg.ADMIN_UID).includes("YOUR_"));
const $ = id => document.getElementById(id);
const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
let sb = null, projects = [], currentUser = null, editingId = null, existingGallery = [];
const BUCKET = cfg.STORAGE_BUCKET || "portfolio-media";
const MAX_VIDEO_MB = Number(cfg.MAX_VIDEO_MB || 100);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const open = id => $(id)?.classList.add("open");
const close = id => $(id)?.classList.remove("open");
const notify = (id, msg) => setText(id, msg);
const isAdmin = user => !!user && user.id === cfg.ADMIN_UID;
const statusLabel = s => s || "PLANNED";
const safeUrl = value => {
  if (!value) return "";
  try { const u = new URL(value); return ["https:","http:"].includes(u.protocol) ? u.href : ""; }
  catch { return ""; }
};
const safeHtml = html => {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const allowed = new Set(["P","BR","H2","H3","H4","STRONG","B","EM","I","U","UL","OL","LI","PRE","CODE","BLOCKQUOTE","A","IMG","HR","SPAN","DIV"]);
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }
        [...child.attributes].forEach(attr => {
          const name = attr.name.toLowerCase();
          if (name === "style") {
            const safeStyle = attr.value.split(";").map(x=>x.trim()).filter(x=>/^(color|font-size|text-align|font-weight|font-style|text-decoration)\s*:\s*[-#(),.%\w\s]+$/i.test(x)).join(";");
            if (safeStyle) child.setAttribute("style", safeStyle); else child.removeAttribute("style");
          } else if (child.tagName === "A" && name === "href") {
            const u = safeUrl(attr.value); if (u) child.setAttribute("href",u); else child.removeAttribute("href");
          } else if (child.tagName === "IMG" && name === "src") {
            const u = safeUrl(attr.value); if (u) child.setAttribute("src",u); else child.removeAttribute("src");
          } else if (!["href","src","alt","title","style","target","rel"].includes(name)) child.removeAttribute(attr.name);
        });
        if (child.tagName === "A") { child.setAttribute("target","_blank"); child.setAttribute("rel","noopener noreferrer"); }
        if (child.tagName === "IMG") { child.setAttribute("loading","lazy"); child.removeAttribute("onerror"); }
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    });
  };
  walk(template.content);
  return template.innerHTML;
};
function normalizeProject(p) {
  return {
    ...p,
    overview: p.overview || "",
    video_type: p.video_type || "none",
    video_url: p.video_url || "",
    video_path: p.video_path || "",
    gallery_urls: Array.isArray(p.gallery_urls) ? p.gallery_urls : [],
    content_html: p.content_html || ""
  };
}
function projectCard(p) {
  const image = safeUrl(p.image_url);
  return `<article class="project-card" data-id="${esc(p.id)}">
    <div class="thumb" ${image ? `style="background-image:url('${esc(image)}')"` : ""}></div>
    <div class="project-body"><div class="project-top"><span>${esc(p.project_no || "PROJECT")}</span><span class="pill">${esc(statusLabel(p.status))}</span></div>
    <h3>${esc(p.title)}</h3><p>${esc(p.description || p.overview || "")}</p>
    <div class="tags">${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <span class="card-more">VIEW PROJECT ↗</span></div></article>`;
}
function renderProjects() {
  const search = $("search"), status = $("statusFilter"), target = $("projects");
  if (!target) return;
  const q = (search?.value || "").trim().toLowerCase(), st = status?.value || "";
  const list = projects.filter(p => {
    const keywords = [p.title,p.description,p.overview,p.project_no,...(p.tags||[])].join(" ").toLowerCase();
    return (!st || p.status === st) && (!q || keywords.includes(q));
  });
  const countEl = $("projectCount");
  if (countEl) countEl.textContent = String(projects.length).padStart(2,"0");
  target.innerHTML = list.length ? list.map(projectCard).join("") :
    `<div class="loading">${projects.length ? "没有找到匹配的项目。" : "目前还没有项目，敬请期待。"}<br><span>项目发布后会自动显示在这里。</span></div>`;
}
function getBilibiliEmbed(url) {
  const safe = safeUrl(url);
  if (!safe || !/bilibili\.com$/i.test(new URL(safe).hostname) && !/\.bilibili\.com$/i.test(new URL(safe).hostname)) return "";
  const u = new URL(safe);
  const bvid = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1];
  const aid = u.pathname.match(/\/video\/av(\d+)/i)?.[1];
  if (bvid) return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&high_quality=1&danmaku=0`;
  if (aid) return `https://player.bilibili.com/player.html?aid=${encodeURIComponent(aid)}&page=1&high_quality=1&danmaku=0`;
  return "";
}
function showDetail(id) {
  const p = projects.find(x => String(x.id) === String(id));
  if (!p) return;
  const image = safeUrl(p.image_url);
  const gallery = (p.gallery_urls || []).map((url,i) => safeUrl(url) ? `<figure class="gallery-item" data-lightbox="${esc(safeUrl(url))}"><img src="${esc(safeUrl(url))}" alt="${esc(p.title)} 图片 ${i+1}"><figcaption>IMAGE / ${String(i+1).padStart(2,"0")}</figcaption></figure>` : "").join("");
  let video = "";
  if (p.video_type === "bilibili" && getBilibiliEmbed(p.video_url)) {
    video = `<div class="video-frame"><iframe src="${esc(getBilibiliEmbed(p.video_url))}" title="${esc(p.title)} 视频演示" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  } else if (p.video_type === "mp4" && p.video_path && sb) {
    const { data } = sb.storage.from(BUCKET).getPublicUrl(p.video_path);
    const videoUrl = safeUrl(data?.publicUrl);
    if (videoUrl) video = `<div class="video-frame"><video controls preload="metadata" playsinline src="${esc(videoUrl)}"></video></div>`;
  } else if (p.video_type === "mp4" && safeUrl(p.video_url)) {
    video = `<div class="video-frame"><video controls preload="metadata" playsinline src="${esc(p.video_url)}"></video></div>`;
  }
  const github = safeUrl(p.github_url), demo = safeUrl(p.demo_url);
  $("detailContent").innerHTML = `
    ${image ? `<div class="detail-hero" style="background-image:url('${esc(image)}')"></div>` : ""}
    <div class="detail-meta">${esc(p.project_no || "PROJECT")} / ${esc(p.status || "IN PROGRESS")} / ${(p.tags||[]).map(esc).join(" · ")}</div>
    <div class="detail-title-row"><div><h2>${esc(p.title)}</h2><p class="detail-lead">${esc(p.description || "")}</p></div></div>
    <div class="detail-actions">${github ? `<a href="${esc(github)}" target="_blank" rel="noopener">GITHUB REPOSITORY ↗</a>` : ""}${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener">LIVE DEMO ↗</a>` : ""}</div>
    ${p.overview ? `<div class="detail-section-title">PROJECT OVERVIEW / 项目总述</div><div class="detail-overview">${esc(p.overview)}</div>` : ""}
    ${video ? `<div class="detail-section-title">VIDEO DEMONSTRATION / 视频演示</div>${video}` : ""}
    ${gallery ? `<div class="detail-section-title">VISUAL GALLERY / 图片展示</div><div class="gallery-grid">${gallery}</div>` : ""}
    ${p.content_html ? `<div class="detail-section-title">TECHNICAL NOTES / 原理与实现</div><article class="rich-content">${safeHtml(p.content_html)}</article>` : ""}
    ${!p.overview && !video && !gallery && !p.content_html ? `<div class="loading">该项目尚未补充详细档案。管理员可以在后台编辑项目总述、视频、图片和技术文章。</div>` : ""}
  `;
  open("projectDialog");
}
async function loadProjects() {
  const target = $("projects");
  if (!configured) {
    if (target) target.innerHTML = `<div class="loading">网站前端已就绪，但尚未配置 Supabase。请检查 config.js 和数据库迁移说明。</div>`;
    projects = []; return;
  }
  try {
    const { data, error } = await sb.from("projects").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true});
    if (error) throw error;
    projects = (data || []).map(normalizeProject);
    renderProjects();
  } catch (e) {
    if (target) target.innerHTML = `<div class="loading">项目数据暂时无法加载：${esc(e.message)}<br>请检查 Supabase 配置、数据库迁移和 RLS 权限。</div>`;
  }
}
function showAdmin() {
  $("adminPanel")?.classList.add("open");
  setText("adminIdentity",currentUser?.email || "");
  renderAdmin();
}
function hideAdmin() { $("adminPanel")?.classList.remove("open"); }
function renderAdmin() {
  const target = $("adminProjects"); if (!target) return;
  target.innerHTML = projects.map(p => `<div class="admin-row"><div><b>${esc(p.title)}</b><p>${esc(p.project_no)} · ${esc(p.status)} · ${(p.gallery_urls||[]).length} 张画廊图片 · ${esc(p.video_type||"none")}</p></div><div class="tools"><button data-edit="${esc(p.id)}">编辑</button><button class="danger" data-delete="${esc(p.id)}">删除</button></div></div>`).join("") || "<p class='muted'>还没有项目，点击“添加项目”创建第一条。</p>";
  target.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEditor(b.dataset.edit));
  target.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteProject(b.dataset.delete));
}
function renderGalleryManager() {
  const target = $("existingGallery"); if (!target) return;
  target.innerHTML = existingGallery.length ? `<div class="gallery-manage">${existingGallery.map((url,i)=>`<div class="gallery-manage-item"><img src="${esc(url)}" alt="画廊图片 ${i+1}"><button type="button" data-remove-gallery="${i}" aria-label="移除图片">×</button></div>`).join("")}</div>` : `<small>当前没有已保存的画廊图片。</small>`;
  target.querySelectorAll("[data-remove-gallery]").forEach(b => b.onclick = () => { existingGallery.splice(Number(b.dataset.removeGallery),1); renderGalleryManager(); });
}
function openEditor(id=null) {
  editingId = id;
  const p = projects.find(x => String(x.id) === String(id)) || {project_no:String(projects.length+1).padStart(2,"0")+" / PROJECT",status:"IN PROGRESS",title:"",description:"",overview:"",tags:[],demo_url:"",github_url:"",image_url:"",video_type:"none",video_url:"",video_path:"",gallery_urls:[],content_html:""};
  existingGallery = [...(p.gallery_urls || [])];
  setText("editHeading",id ? "编辑项目档案" : "创建项目档案");
  $("fNum").value=p.project_no||""; $("fStatus").value=p.status||"PLANNED"; $("fTitle").value=p.title||"";
  $("fDesc").value=p.description||""; $("fOverview").value=p.overview||""; $("fTags").value=(p.tags||[]).join(", ");
  $("fLink").value=p.demo_url||""; $("fGithub").value=p.github_url||""; $("fImage").value="";
  $("fVideoType").value=p.video_type||"none"; $("fVideoUrl").value=p.video_url||""; $("fVideoFile").value=""; $("fGallery").value="";
  $("fContent").innerHTML=safeHtml(p.content_html||"");
  $("imageHint").textContent=p.image_url?"已有封面；选择新图片即可替换。留空保留原图。":"建议上传 16:9 高清封面图。";
  $("videoHint").textContent=p.video_path ? "已有 MP4 视频；选择新文件即可替换。" : "建议压缩到 "+MAX_VIDEO_MB+"MB 以内；具体限制取决于 Storage 配置。";
  $("galleryHint").textContent="当前 "+existingGallery.length+" 张；新选图片会追加。";
  renderGalleryManager(); updateVideoFields();
  notify("saveMessage",""); open("editDialog");
}
function updateVideoFields() {
  const type=$("fVideoType")?.value||"none";
  $("videoUrlWrap").style.display=type==="bilibili"?"block":"none";
  $("videoFileWrap").style.display=type==="mp4"?"block":"none";
}
async function uploadFile(file, folder) {
  if (!isAdmin(currentUser)) throw new Error("当前账号没有管理员权限。");
  const safeName=(file.name||"upload").normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-80);
  const path=`${currentUser.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
  if(error) throw error;
  const {data}=sb.storage.from(BUCKET).getPublicUrl(path);
  return {path,url:data.publicUrl};
}
async function saveProject() {
  if(!isAdmin(currentUser)){notify("saveMessage","当前账号没有管理员权限。");return;}
  const title=$("fTitle").value.trim(); if(!title){notify("saveMessage","请填写项目名称。");return;}
  const btn=$("saveProject"); btn.disabled=true; notify("saveMessage","正在上传文件并保存项目，请稍候…");
  try {
    const old=projects.find(p=>String(p.id)===String(editingId));
    let imageUrl=old?.image_url||null, videoPath=old?.video_path||null, videoUrl="";
    const imageFile=$("fImage").files?.[0];
    if(imageFile) imageUrl=(await uploadFile(imageFile,"covers")).url;
    const videoType=$("fVideoType").value;
    if(videoType==="bilibili") {
      videoUrl=safeUrl($("fVideoUrl").value.trim());
      if(!videoUrl || !getBilibiliEmbed(videoUrl)) throw new Error("请输入有效的 B 站视频链接（支持 BV 或 av 视频地址）。");
      videoPath=null;
    } else if(videoType==="mp4") {
      const file=$("fVideoFile").files?.[0];
      if(file) {
        if(file.size>MAX_VIDEO_MB*1024*1024) throw new Error(`视频超过 ${MAX_VIDEO_MB}MB 限制，请压缩后再上传。`);
        if(!["video/mp4","video/webm"].includes(file.type)) throw new Error("目前仅支持 MP4 或 WebM 视频。");
        const uploaded=await uploadFile(file,"videos"); videoPath=uploaded.path; videoUrl=uploaded.url;
      } else if(old?.video_type==="mp4" && old.video_path) {
        videoPath=old.video_path; videoUrl=old.video_url||"";
      } else if(!videoPath) throw new Error("请选择要上传的 MP4 / WebM 视频文件。");
    } else { videoPath=null; videoUrl=""; }
    const galleryFiles=[...($("fGallery").files||[])];
    const gallery=[...existingGallery];
    for(const file of galleryFiles) {
      if(!file.type.startsWith("image/")) continue;
      const uploaded=await uploadFile(file,"gallery"); gallery.push(uploaded.url);
    }
    const payload={
      project_no:$("fNum").value.trim(),status:$("fStatus").value,title,
      description:$("fDesc").value.trim(),overview:$("fOverview").value.trim(),
      tags:$("fTags").value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),
      demo_url:safeUrl($("fLink").value.trim())||null,github_url:safeUrl($("fGithub").value.trim())||null,
      image_url:imageUrl,video_type:videoType,video_url:videoUrl,video_path:videoPath,
      gallery_urls:gallery,content_html:safeHtml($("fContent").innerHTML)
    };
    let result;
    if(editingId) result=await sb.from("projects").update(payload).eq("id",editingId).select().single();
    else {payload.sort_order=projects.length+1; result=await sb.from("projects").insert(payload).select().single();}
    if(result.error) throw result.error;
    close("editDialog"); await loadProjects(); renderAdmin(); notify("saveMessage","");
  } catch(e) { notify("saveMessage","保存失败："+e.message); }
  finally { btn.disabled=false; }
}
async function deleteProject(id) {
  if(!isAdmin(currentUser)||!confirm("确定删除这个项目吗？此操作不可撤销。")) return;
  const {error}=await sb.from("projects").delete().eq("id",id);
  if(error){alert("删除失败："+error.message);return;}
  await loadProjects();renderAdmin();
}
function bindEditorToolbar() {
  document.querySelectorAll("[data-command]").forEach(button=>button.addEventListener("click",()=>{
    $("fContent")?.focus();
    const command=button.dataset.command, value=button.dataset.value||null;
    document.execCommand(command,false,value);
  }));
  $("editorFontSize")?.addEventListener("change",e=>{ $("fContent")?.focus(); document.execCommand("fontSize",false,e.target.value); });
  $("editorColor")?.addEventListener("input",e=>{ $("fContent")?.focus(); document.execCommand("foreColor",false,e.target.value); });
  $("clearFormat")?.addEventListener("click",()=>{ $("fContent")?.focus(); document.execCommand("removeFormat",false,null); });
}
function bindLightbox() {
  document.addEventListener("click",e=>{
    const item=e.target.closest("[data-lightbox]");
    if(item) {
      const box=$("lightbox"); if(!box) return;
      $("lightboxImage").src=item.dataset.lightbox; box.classList.add("open");
    }
  });
  $("lightboxClose")?.addEventListener("click",()=> $("lightbox")?.classList.remove("open"));
  $("lightbox")?.addEventListener("click",e=>{if(e.target.id==="lightbox") e.currentTarget.classList.remove("open");});
}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)close(o.id);}));
$("search")?.addEventListener("input",renderProjects);
$("statusFilter")?.addEventListener("change",renderProjects);
$("projects")?.addEventListener("click",e=>{const card=e.target.closest(".project-card");if(card)showDetail(card.dataset.id);});
$("adminEntry")?.addEventListener("click",()=>{open("authDialog");if(!configured)notify("authMessage","尚未配置 Supabase，请先检查 config.js。");});
$("loginBtn")?.addEventListener("click",async()=>{
  if(!configured){notify("authMessage","尚未配置 Supabase。请先完成 config.js 设置。");return;}
  const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
  notify("authMessage","正在验证…");
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){notify("authMessage","登录失败："+error.message);return;}
  currentUser=data.user;
  if(!isAdmin(currentUser)){await sb.auth.signOut();currentUser=null;notify("authMessage","该账号不是指定的管理员账号，已拒绝访问。");return;}
  close("authDialog");showAdmin();
});
$("newProject")?.addEventListener("click",()=>openEditor());
$("saveProject")?.addEventListener("click",saveProject);
$("logoutBtn")?.addEventListener("click",async()=>{await sb?.auth.signOut();currentUser=null;hideAdmin();});
$("fVideoType")?.addEventListener("change",updateVideoFields);
bindEditorToolbar(); bindLightbox();
if(configured) {
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  sb.auth.getSession().then(({data})=>{const u=data.session?.user;if(isAdmin(u)){currentUser=u;showAdmin();}});
  sb.auth.onAuthStateChange((_event,session)=>{if(session?.user&&isAdmin(session.user)){currentUser=session.user;showAdmin();}else if(!session){currentUser=null;hideAdmin();}});
}
loadProjects();
})();