import { supabase } from "./supabaseClient.js";

const elEmail = document.getElementById("email");
const elPassword = document.getElementById("password");
const elLogin = document.getElementById("loginBtn");
const elLogout = document.getElementById("logoutBtn");
const elStatus = document.getElementById("status");
const elList = document.getElementById("list");
const elRefresh = document.getElementById("refreshBtn");

function setStatus(t) { elStatus.textContent = t; }
function escapeHtml(str="") {
  return str.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
            .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function login() {
  setStatus("Logging in...");
  const { error } = await supabase.auth.signInWithPassword({
    email: elEmail.value.trim(),
    password: elPassword.value
  });
  if (error) return setStatus("Login gagal: " + error.message);
  setStatus("Login sukses ✅");
  await loadConfessions();
}

async function logout() {
  await supabase.auth.signOut();
  setStatus("Logout.");
}

function renderItem(item) {
  const name = item.name?.trim() ? escapeHtml(item.name.trim()) : "Anonim";
  const created = new Date(item.created_at).toLocaleString("id-ID");
  const msg = escapeHtml(item.message || "");
  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
        <div><b>${name}</b> <span class="badge">${created}</span></div>
        <button class="btn secondary" data-del="${item.id}">Delete</button>
      </div>
      <p style="white-space:pre-wrap; margin:10px 0 0;">${msg}</p>
    </div>
  `;
}

async function loadConfessions() {
  elList.innerHTML = "<small>Loading...</small>";
  const { data, error } = await supabase
    .from("confessions")
    .select("id, created_at, name, message")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    elList.innerHTML = `<small>Gagal load: ${escapeHtml(error.message)}</small>`;
    return;
  }

  elList.innerHTML = (data || []).map(renderItem).join("") || "<small>Kosong.</small>";

  elList.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Yakin hapus confession ini?")) return;

      const { error: delErr } = await supabase.from("confessions").delete().eq("id", id);
      if (delErr) return alert("Gagal delete: " + delErr.message);

      await loadConfessions();
    });
  });
}

elLogin.addEventListener("click", login);
elLogout.addEventListener("click", logout);
elRefresh.addEventListener("click", loadConfessions);

// auto load kalau sudah login
supabase.auth.getSession().then(({ data }) => {
  if (data.session) loadConfessions();
});
// ===== EVENTS ADMIN =====
const elEventBanner = document.getElementById("eventBanner");
const elEventTitle = document.getElementById("eventTitle");
const elEventStart = document.getElementById("eventStart");
const elEventEnd = document.getElementById("eventEnd");
const elEventDesc = document.getElementById("eventDesc");
const elCreateEventBtn = document.getElementById("createEventBtn");
const elEventStatus = document.getElementById("eventStatus");
const elEventsList = document.getElementById("eventsList");
const elRefreshEventsBtn = document.getElementById("refreshEventsBtn");

function setEventStatus(t){ if (elEventStatus) elEventStatus.textContent = t; }

function safeName(filename){
  return filename.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

async function uploadBanner(file){
  // bucket harus public: event-banners
  const ext = file.name.split(".").pop() || "jpg";
  const path = `events/${Date.now()}-${safeName(file.name || ("banner."+ext))}`;

  const { error } = await supabase.storage
    .from("event-banners")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error("Upload banner gagal: " + error.message);

  const { data } = supabase.storage.from("event-banners").getPublicUrl(path);
  return data.publicUrl;
}

function renderEventItem(e){
  const title = escapeHtml(e.title || "");
  const desc = escapeHtml(e.description || "");
  const start = e.start_date ? new Date(e.start_date).toLocaleDateString("id-ID") : "-";
  const end = e.end_date ? new Date(e.end_date).toLocaleDateString("id-ID") : "-";
  const banner = e.banner_url
    ? `<div style="margin-top:10px;"><img src="${e.banner_url}" alt="" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);"/></div>`
    : "";

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
        <div>
          <b>${title}</b><br/>
          <small>${start} → ${end}</small>
        </div>
        <button class="btn secondary" data-del-event="${e.id}">Delete</button>
      </div>
      ${desc ? `<p style="white-space:pre-wrap; margin:10px 0 0;">${desc}</p>` : ""}
      ${banner}
    </div>
  `;
}

async function loadEvents(){
  if (!elEventsList) return;
  elEventsList.innerHTML = "<small>Loading...</small>";

  const { data, error } = await supabase
    .from("events")
    .select("id, created_at, title, description, banner_url, start_date, end_date")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error){
    elEventsList.innerHTML = `<small>Gagal load events: ${escapeHtml(error.message)}</small>`;
    return;
  }

  elEventsList.innerHTML = (data || []).map(renderEventItem).join("") || "<small>Belum ada event.</small>";

  elEventsList.querySelectorAll("[data-del-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-event");
      if (!confirm("Yakin hapus event ini?")) return;

      const { error: delErr } = await supabase.from("events").delete().eq("id", id);
      if (delErr) return alert("Gagal delete event: " + delErr.message);

      await loadEvents();
    });
  });
}

async function createEvent(){
  setEventStatus("");

  const title = elEventTitle?.value.trim();
  const description = elEventDesc?.value.trim() || null;
  const start_date = elEventStart?.value || null;
  const end_date = elEventEnd?.value || null;

  if (!title){
    setEventStatus("Judul wajib diisi.");
    return;
  }
  if (start_date && end_date && end_date < start_date){
    setEventStatus("End date tidak boleh lebih awal dari start date.");
    return;
  }

  elCreateEventBtn.disabled = true;
  setEventStatus("Menyimpan...");

  try{
    let banner_url = null;
    const file = elEventBanner?.files?.[0] || null;
    if (file){
      banner_url = await uploadBanner(file);
    }

    const payload = { title, description, start_date, end_date, banner_url };

    const { error } = await supabase.from("events").insert(payload);
    if (error) throw new Error(error.message);

    setEventStatus("Event ditambahkan ✅");
    if (elEventBanner) elEventBanner.value = "";
    if (elEventTitle) elEventTitle.value = "";
    if (elEventDesc) elEventDesc.value = "";
    if (elEventStart) elEventStart.value = "";
    if (elEventEnd) elEventEnd.value = "";

    await loadEvents();
  } catch (e){
    setEventStatus("Gagal: " + (e.message || "unknown"));
  } finally{
    elCreateEventBtn.disabled = false;
  }
}

// wiring
elRefreshEventsBtn?.addEventListener("click", loadEvents);
elCreateEventBtn?.addEventListener("click", createEvent);

// auto load kalau sudah login
supabase.auth.getSession().then(({ data }) => {
  if (data.session) loadEvents();
});
