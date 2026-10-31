(() => {
const cfg=window.PORTFOLIO_CONFIG||{};
const configured=cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_") && cfg.ADMIN_UID && !cfg.ADMIN_UID.includes("YOUR_");
const $=id=>document.getElementById(id);
let sb=null, projects=[], currentUser=null, editingId=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const open=id=>$(id).classList.add("open"), close=id=>$(id).classList.remove("open");
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)close(o.id)}));
function notify(id,msg){$(id).textContent=msg}
function isAdmin(user){return !!user && user.id===cfg.ADMIN_UID}
function statusLabel(s){return s||"PLANNED"}
function projectCard(p){return `<article class="project-card" data-id="${esc(p.id)}"><div class="thumb" style="${p.image_url?`background-image:url('${esc(p.image_url)}')`:""}"></div><div class="project-body"><div class="project-top"><span>${esc(p.project_no||"PROJECT")}</span><span class="pill">${esc(statusLabel(p.status))}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.description||"")}</p><div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div></div></article>`}
function renderProjects(){
 const q=$("search").value.trim().toLowerCase(), st=$("statusFilter").value;
 const list=projects.filter(p=>(!st||p.status===st)&&(!q||[p.title,p.description,p.project_no,...(p.tags||[])].join(" ").toLowerCase().includes(q)));
 $("projectCount").textContent=String(projects.length).padStart(2,"0");
 $("projects").innerHTML=list.length?list.map(projectCard).join(""):`<div class="loading">没有找到匹配的项目。</div>`;
 document.querySelectorAll(".project-card").forEach(el=>el.addEventListener("click",()=>showDetail(el.dataset.id)));
}
function showDetail(id){
 const p=projects.find(x=>x.id===id);if(!p)return;
 $("detailContent").innerHTML=`<div class="detail-hero" style="${p.image_url?`background-image:url('${esc(p.image_url)}')`:""}"></div><div class="detail-copy"><div class="eyebrow">${esc(p.project_no||"PROJECT")} / ${esc(p.status)}</div><h2>${esc(p.title)}</h2><p>${esc(p.description||"")}</p><div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div><div class="detail-links">${p.demo_url?`<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">LIVE DEMO ↗</a>`:""}${p.github_url?`<a href="${esc(p.github_url)}" target="_blank" rel="noopener">GITHUB ↗</a>`:""}</div></div>`;
 open("projectDialog");
}
async function loadProjects(){
 if(!configured){$("projects").innerHTML=`<div class="loading">网站前端已就绪。完成 README 中的 Supabase 配置后，公开项目数据会在这里显示。</div>`;return}
 try{
 const {data,error}=await sb.from("projects").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:true});
 if(error)throw error;projects=data||[];renderProjects();
 }catch(e){$("projects").innerHTML=`<div class="loading">项目数据暂时无法加载：${esc(e.message)}<br>请检查 Supabase 配置与数据库初始化。</div>`}
}
$("search").addEventListener("input",renderProjects);$("statusFilter").addEventListener("change",renderProjects);
$("projects").addEventListener("click",()=>{});
function showAdmin(){
 $("adminPanel").classList.add("open");$("adminIdentity").textContent=currentUser?.email||"";
 renderAdmin();
}
function hideAdmin(){$("adminPanel").classList.remove("open")}
function renderAdmin(){
 $("adminProjects").innerHTML=projects.map(p=>`<div class="admin-row"><div><b>${esc(p.title)}</b><p>${esc(p.project_no)} · ${esc(p.status)}</p></div><div class="tools"><button data-edit="${esc(p.id)}">编辑</button><button class="danger" data-delete="${esc(p.id)}">删除</button></div></div>`).join("")||"<p class='muted'>还没有项目，点击“添加项目”创建第一条。</p>";
 $("adminProjects").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
 $("adminProjects").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProject(b.dataset.delete));
}
function openEditor(id=null){
 editingId=id;const p=projects.find(x=>x.id===id)||{project_no:String(projects.length+1).padStart(2,"0")+" / PROJECT",status:"IN PROGRESS",title:"",description:"",tags:[],demo_url:"",github_url:"",image_url:""};
 $("editHeading").textContent=id?"修改项目":"添加项目";
 $("fNum").value=p.project_no||"";$("fStatus").value=p.status||"PLANNED";$("fTitle").value=p.title||"";$("fDesc").value=p.description||"";$("fTags").value=(p.tags||[]).join(", ");$("fLink").value=p.demo_url||"";$("fGithub").value=p.github_url||"";$("fImage").value="";$("imageHint").textContent=p.image_url?"已有封面图；选择新文件即可替换。留空则保留原图。":"选择图片上传到作品集媒体库。";
 notify("saveMessage","");open("editDialog");
}
async function uploadImage(file){
 const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
 const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;
 const {error}=await sb.storage.from("portfolio-media").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
 if(error)throw error;
 const {data}=sb.storage.from("portfolio-media").getPublicUrl(path);return data.publicUrl;
}
async function saveProject(){
 if(!isAdmin(currentUser)){notify("saveMessage","当前账号没有管理员权限。");return}
 const title=$("fTitle").value.trim();if(!title){notify("saveMessage","请填写项目名称。");return}
 const btn=$("saveProject");btn.disabled=true;notify("saveMessage","正在保存…");
 try{
 let imageUrl=projects.find(p=>p.id===editingId)?.image_url||null;
 const file=$("fImage").files[0];if(file)imageUrl=await uploadImage(file);
 const payload={project_no:$("fNum").value.trim(),status:$("fStatus").value,title,description:$("fDesc").value.trim(),tags:$("fTags").value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),demo_url:$("fLink").value.trim()||null,github_url:$("fGithub").value.trim()||null,image_url:imageUrl};
 let result;
 if(editingId)result=await sb.from("projects").update(payload).eq("id",editingId).select().single();
 else {payload.sort_order=projects.length+1;result=await sb.from("projects").insert(payload).select().single()}
 if(result.error)throw result.error;
 close("editDialog");await loadProjects();renderAdmin();notify("saveMessage","");
 }catch(e){notify("saveMessage","保存失败："+e.message)}
 finally{btn.disabled=false}
}
async function deleteProject(id){
 if(!isAdmin(currentUser)||!confirm("确定删除这个项目吗？此操作不可撤销。"))return;
 const {error}=await sb.from("projects").delete().eq("id",id);
 if(error){alert("删除失败："+error.message);return}
 await loadProjects();renderAdmin();
}
$("adminEntry").onclick=()=>{if(!configured){open("authDialog");notify("authMessage","请先按 README 配置 Supabase URL、Anon Key 和管理员 UID。");return}open("authDialog")};
$("loginBtn").onclick=async()=>{
 if(!configured){notify("authMessage","尚未配置 Supabase。请先完成 README 中的设置。");return}
 const email=$("loginEmail").value.trim(),password=$("loginPassword").value;
 notify("authMessage","正在验证…");
 const {data,error}=await sb.auth.signInWithPassword({email,password});
 if(error){notify("authMessage","登录失败："+error.message);return}
 currentUser=data.user;
 if(!isAdmin(currentUser)){await sb.auth.signOut();currentUser=null;notify("authMessage","该账号不是指定的管理员账号，已拒绝访问。");return}
 close("authDialog");showAdmin();
};
$("newProject").onclick=()=>openEditor();$("saveProject").onclick=saveProject;
$("logoutBtn").onclick=async()=>{await sb.auth.signOut();currentUser=null;hideAdmin()};
if(configured){
 sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 sb.auth.getSession().then(async({data})=>{const u=data.session?.user;if(isAdmin(u)){currentUser=u;showAdmin()}});
 sb.auth.onAuthStateChange((_event,session)=>{if(session?.user&&isAdmin(session.user)){currentUser=session.user;showAdmin()}else if(!session){currentUser=null;hideAdmin()}});
}
loadProjects();
})();