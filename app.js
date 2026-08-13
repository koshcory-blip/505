let state = { me:null, users:[], rooms:[], posts:[], notifications:[], feed:"for-you", page:"home" };

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = new Intl.NumberFormat("en", { notation:"compact", maximumFractionDigits:1 });

async function api(url, options={}) {
  const r = await fetch(url, { headers:{ "Content-Type":"application/json", ...(options.headers||{}) }, ...options });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function timeAgo(ms) {
  const s = Math.max(1, Math.floor((Date.now()-ms)/1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60); if (m < 60) return `${m}m`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h`;
  const d = Math.floor(h/24); return `${d}d`;
}

function esc(v="") {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function postHTML(p) {
  const mine = p.user.id === "me";
  return `
  <article class="post" data-post="${p.id}">
    <div class="avatar ${mine?'me-avatar':''}">${esc(p.user.avatar)}</div>
    <div class="post-body">
      <div class="post-head">
        <strong>${esc(p.user.name)}</strong>
        <span class="handle">@${esc(p.user.handle)}</span>
        <span class="time">· ${timeAgo(p.createdAt)}</span>
        <span class="spacer"></span>
        ${mine ? `<button class="more delete-post" data-id="${p.id}" title="Delete">×</button>` : `<button class="more" title="More">···</button>`}
      </div>
      ${p.room ? `<span class="room-tag">◌ ${esc(p.room)}</span>` : ""}
      ${p.text ? `<div class="post-text">${esc(p.text)}</div>` : ""}
      ${p.media ? `<img class="post-media" src="${esc(p.media)}" alt="Post media">` : ""}
      <div class="post-meta">${fmt.format(p.views||0)} views · ${fmt.format(p.replies||0)} replies · ${fmt.format(p.reposts||0)} echoes</div>
      <div class="reaction-bar">
        <button class="react" data-id="${p.id}" data-react="fire"><span class="emoji">🔥</span>${fmt.format(p.reactions.fire)}</button>
        <button class="react" data-id="${p.id}" data-react="real"><span class="emoji">🤝</span>${fmt.format(p.reactions.real)}</button>
        <button class="react" data-id="${p.id}" data-react="laugh"><span class="emoji">😭</span>${fmt.format(p.reactions.laugh)}</button>
        <button class="react" data-id="${p.id}" data-react="heart"><span class="emoji">♥</span>${fmt.format(p.reactions.heart)}</button>
        <span class="post-util"><button class="bookmark ${p.bookmarked?'active':''}" data-id="${p.id}" title="Save">${p.bookmarked?'◆':'◇'}</button></span>
      </div>
    </div>
  </article>`;
}

function bindPostActions(scope=document) {
  scope.querySelectorAll(".react").forEach(btn => btn.onclick = async () => {
    const post = await api(`/api/posts/${btn.dataset.id}/react`, { method:"POST", body:JSON.stringify({type:btn.dataset.react}) });
    replacePost(post);
    toast(`${{fire:"🔥",real:"🤝",laugh:"😭",heart:"♥"}[btn.dataset.react]} reacted`);
  });
  scope.querySelectorAll(".bookmark").forEach(btn => btn.onclick = async () => {
    const out = await api(`/api/posts/${btn.dataset.id}/bookmark`, { method:"POST", body:"{}" });
    const p = state.posts.find(p=>p.id===btn.dataset.id); if(p) p.bookmarked = out.bookmarked;
    renderBookmarks();
    btn.classList.toggle("active", out.bookmarked); btn.textContent = out.bookmarked ? "◆":"◇";
    toast(out.bookmarked ? "Saved" : "Removed from saved");
  });
  scope.querySelectorAll(".delete-post").forEach(btn => btn.onclick = async () => {
    if (!confirm("Delete this post?")) return;
    await api(`/api/posts/${btn.dataset.id}`, { method:"DELETE" });
    state.posts = state.posts.filter(p=>p.id!==btn.dataset.id);
    renderFeed(); renderProfile(); renderBookmarks();
    toast("Post deleted");
  });
}

function replacePost(post) {
  const i = state.posts.findIndex(p=>p.id===post.id); if(i>=0) state.posts[i]=post;
  $$(`[data-post="${post.id}"]`).forEach(node => {
    const wrap = document.createElement("div"); wrap.innerHTML = postHTML(post);
    const fresh = wrap.firstElementChild; node.replaceWith(fresh); bindPostActions(fresh);
  });
}

function renderFeed() {
  let posts = [...state.posts];
  if (state.feed==="latest") posts.sort((a,b)=>b.createdAt-a.createdAt);
  else posts.sort((a,b)=>{
    const score = p => (p.reactions.fire+p.reactions.real+p.reactions.laugh+p.reactions.heart)*2 + p.replies*3 + p.reposts*4 + p.views*.03;
    return score(b)-score(a);
  });
  $("#feed").innerHTML = posts.map(postHTML).join("");
  bindPostActions($("#feed"));
}

function renderBookmarks() {
  const posts = state.posts.filter(p=>p.bookmarked);
  $("#bookmarksFeed").innerHTML = posts.length ? posts.map(postHTML).join("") : `<div class="empty"><strong>Nothing saved yet.</strong>Keep the posts you actually want to come back to.</div>`;
  bindPostActions($("#bookmarksFeed"));
}

function renderProfile() {
  const m = state.me;
  $("#profileHero").innerHTML = `
    <div class="profile-cover"></div>
    <div class="profile-info">
      <div class="profile-big-avatar">${esc(m.avatar)}</div>
      <div class="profile-name-row"><div><h2>${esc(m.name)}</h2><span class="handle">@${esc(m.handle)}</span></div><button class="edit-profile">Edit profile</button></div>
      <div class="profile-bio">${esc(m.bio)}</div>
      <div class="profile-stats"><span><strong>${fmt.format(m.following)}</strong> following</span><span><strong>${fmt.format(m.followers)}</strong> followers</span><span>vibe: <strong>${esc(m.vibe)}</strong></span></div>
    </div>`;
  const mine = state.posts.filter(p=>p.user.id==="me");
  $("#profileFeed").innerHTML = mine.length ? mine.map(postHTML).join("") : `<div class="empty"><strong>Your lore starts here.</strong>Post something people can feel.</div>`;
  bindPostActions($("#profileFeed"));
  $(".edit-profile").onclick = () => toast("Profile editor is next on the build list");
}

function renderRooms() {
  $("#roomsGrid").innerHTML = state.rooms.map(r => `
    <button class="room-card" data-room="${esc(r.name)}"><span class="room-emoji">${r.emoji}</span><strong>${esc(r.name)}</strong><span><b style="color:#ff75b5">●</b> ${fmt.format(r.live)} live · ${fmt.format(r.members)} members</span></button>`).join("");
  $("#liveRooms").innerHTML = state.rooms.slice(0,3).map(r=>`<div class="live-room"><strong>${r.emoji} ${esc(r.name)}</strong><span><span class="live-dot">●</span>${fmt.format(r.live)} here now</span></div>`).join("");
  $$(".room-card").forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
}

function openRoom(name) {
  const room = state.rooms.find(r=>r.name===name);
  const posts = state.posts.filter(p=>p.room===name);
  openModal(`<h2>${room?.emoji||"◌"} ${esc(name)}</h2><p style="color:#8d8d99;font-size:12px">A public conversation room. ${room?fmt.format(room.live)+" people are here now.":""}</p>${posts.length?posts.map(postHTML).join(""):`<div class="empty">Quiet in here. Be first.</div>`}`);
  bindPostActions($("#modalContent"));
}

function renderPeople() {
  $("#suggestedUsers").innerHTML = state.users.slice(0,3).map(u=>`
    <div class="person-row"><div class="avatar small">${esc(u.avatar)}</div><div class="info"><strong>${esc(u.name)}</strong><span>@${esc(u.handle)}</span></div><button class="follow-btn">Follow</button></div>`).join("");
  $$(".follow-btn").forEach(b=>b.onclick=()=>{b.textContent=b.textContent==="Follow"?"Following":"Follow";toast(b.textContent==="Following"?"Following":"Unfollowed")});
}

function renderStories() {
  $("#storiesRow").innerHTML = [state.me,...state.users].map((u,i)=>`
    <button class="story"><div class="story-ring"><div>${esc(u.avatar)}</div></div><span>${i===0?"your story":esc(u.name.split(" ")[0])}</span></button>`).join("");
  $$(".story").forEach((s,i)=>s.onclick=()=>toast(i===0?"Story creation is coming next":"Story opened"));
}

function renderNotifications() {
  $("#notificationsList").innerHTML = state.notifications.map(n=>`
    <div class="notification ${n.read?"":"unread"}"><div class="notif-icon">◇</div><div><strong>${esc(n.text)}</strong><span>${timeAgo(n.time)} ago</span></div></div>`).join("");
  $("#notifDot").style.display = state.notifications.some(n=>!n.read) ? "" : "none";
}

function renderSidebar() {
  const m=state.me;
  $("#sidebarProfile").innerHTML=`<div class="avatar small me-avatar">${esc(m.avatar)}</div><div class="user-mini"><strong>${esc(m.name)}</strong><span>@${esc(m.handle)}</span></div>`;
  $("#sidebarProfile").onclick=()=>navigate("profile");
}

function navigate(page) {
  state.page=page;
  $$(".page").forEach(x=>x.classList.remove("active"));
  $(`#${page}Page`)?.classList.add("active");
  $$("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  if(page==="notifications"){state.notifications.forEach(n=>n.read=true);renderNotifications()}
  window.scrollTo({top:0,behavior:"smooth"});
}

function openModal(html) { $("#modalContent").innerHTML=html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }
$("#modalClose").onclick=closeModal; $(".modal-backdrop").onclick=closeModal;

function toast(text){const el=$("#toast");el.textContent=text;el.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove("show"),1600)}

async function publish() {
  const text=$("#postText").value.trim();
  const room=$("#selectedRoom").dataset.room||"";
  const media=$("#mediaPreview").dataset.url||"";
  try {
    const post=await api("/api/posts",{method:"POST",body:JSON.stringify({text,room,media})});
    state.posts.unshift(post);
    $("#postText").value=""; $("#selectedRoom").textContent=""; $("#selectedRoom").dataset.room="";
    $("#mediaPreview").innerHTML=""; $("#mediaPreview").dataset.url=""; $("#mediaPreview").classList.add("hidden");
    updateCount(); renderFeed(); renderProfile(); navigate("home"); toast("Posted to 505");
  } catch(e){toast(e.message)}
}

function updateCount(){const left=500-$("#postText").value.length;$("#charCount").textContent=left;$("#postBtn").disabled=!$("#postText").value.trim()&&!$("#mediaPreview").dataset.url}
$("#postText").oninput=updateCount; $("#postBtn").onclick=publish;

$("#roomPickerBtn").onclick=()=>openModal(`<h2>Post to a room</h2><button class="modal-option pick-room" data-room="">No room · main feed</button>${state.rooms.map(r=>`<button class="modal-option pick-room" data-room="${esc(r.name)}">${r.emoji} ${esc(r.name)}</button>`).join("")}`);
$("#modalContent").addEventListener("click",e=>{const b=e.target.closest(".pick-room");if(!b)return;$("#selectedRoom").dataset.room=b.dataset.room;$("#selectedRoom").textContent=b.dataset.room?`in ${b.dataset.room}`:"";closeModal()});

$("#addImageBtn").onclick=()=>openModal(`<h2>Add an image</h2><p style="color:#8d8d99;font-size:12px">Paste an image URL for this prototype.</p><input id="imageUrlInput" class="modal-input" placeholder="https://..."><button id="useImage" class="modal-option" style="margin-top:10px">Use image</button>`);
$("#modalContent").addEventListener("click",e=>{if(e.target.id!=="useImage")return;const url=$("#imageUrlInput").value.trim();if(!url)return;$("#mediaPreview").dataset.url=url;$("#mediaPreview").innerHTML=`<img src="${esc(url)}" alt="Selected media">`;$("#mediaPreview").classList.remove("hidden");closeModal();updateCount()});

$$("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$("#composeSidebar").onclick=$("#mobileCompose").onclick=()=>{navigate("home");$("#postText").focus();window.scrollTo({top:0,behavior:"smooth"})};

$$(".feed-mode").forEach(b=>b.onclick=()=>{$$(".feed-mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.feed=b.dataset.feed;renderFeed()});

async function search(q) {
  if(!q.trim()){ $("#searchResults").innerHTML=""; return; }
  const out=await api(`/api/search?q=${encodeURIComponent(q)}`);
  let html="";
  if(out.users.length) html+=`<div class="section-block"><div class="section-title"><h2>People</h2></div>${out.users.slice(0,4).map(u=>`<div class="person-row"><div class="avatar small">${esc(u.avatar)}</div><div class="info"><strong>${esc(u.name)}</strong><span>@${esc(u.handle)} · ${esc(u.bio)}</span></div></div>`).join("")}</div>`;
  if(out.rooms.length) html+=`<div class="section-block"><div class="section-title"><h2>Rooms</h2></div>${out.rooms.map(r=>`<button class="modal-option search-room" data-room="${esc(r.name)}">${r.emoji} ${esc(r.name)}</button>`).join("")}</div>`;
  if(out.posts.length) html+=`<div class="section-block"><div class="section-title"><h2>Posts</h2></div></div>${out.posts.map(postHTML).join("")}`;
  $("#searchResults").innerHTML=html||`<div class="empty"><strong>No signal.</strong>Try another search.</div>`;
  bindPostActions($("#searchResults"));
  $$(".search-room").forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
}
let timer; $("#searchInput").oninput=e=>{clearTimeout(timer);timer=setTimeout(()=>search(e.target.value),180)};
$("#rightSearch").onkeydown=e=>{if(e.key==="Enter"){navigate("explore");$("#searchInput").value=e.target.value;search(e.target.value)}};

async function boot() {
  const data=await api("/api/bootstrap"); Object.assign(state,data);
  const hour=new Date().getHours(); $("#helloLine").textContent=hour<12?"good morning.":hour<18?"good afternoon.":"late-night internet.";
  renderSidebar();renderStories();renderRooms();renderPeople();renderNotifications();renderFeed();renderBookmarks();renderProfile();updateCount();
}
boot().catch(e=>{document.body.innerHTML=`<div style="padding:40px;color:white;font-family:system-ui">505 failed to load: ${esc(e.message)}</div>`});
