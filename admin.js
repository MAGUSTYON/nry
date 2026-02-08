import { supabase } from "./supabaseClient.js";

/* ======================
   ELEMENTS
====================== */
const loginSection = document.getElementById("loginSection");
const adminPanel   = document.getElementById("adminPanel");
const emailInput   = document.getElementById("email");
const passInput    = document.getElementById("password");
const loginBtn     = document.getElementById("loginBtn");
const logoutBtn    = document.getElementById("logoutBtn");
const loginStatus  = document.getElementById("loginStatus");

const confList     = document.getElementById("confessionsList");
const refreshConf  = document.getElementById("refreshConfBtn");

const eventTitle   = document.getElementById("eventTitle");
const eventStart   = document.getElementById("eventStart");
const eventEnd     = document.getElementById("eventEnd");
const eventDesc    = document.getElementById("eventDesc");
const eventBanner  = document.getElementById("eventBanner");
const createEvent  = document.getElementById("createEventBtn");
const eventStatus  = document.getElementById("eventStatus");
const eventsList   = document.getElementById("eventsList");

/* ======================
   HELPERS
====================== */
const esc = s =>
  String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");

function showLogin(msg=""){
  loginStatus.textContent = msg;
  loginSection.style.display = "block";
  adminPanel.style.display = "none";
}

function showPanel(){
  loginSection.style.display = "none";
  adminPanel.style.display = "block";
}

/* ======================
   AUTH
====================== */
async function verifyAdmin(){
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  const email = data.session.user.email;
  const { data: admin } = await supabase
    .from("admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!admin){
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

/* ======================
   LOGIN
====================== */
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password){
    showLogin("Email & password wajib diisi");
    return;
  }

  await supabase.auth.signOut(); // bersihin session lama
  showLogin("Login...");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session){
    showLogin("Login gagal");
    return;
  }

  showPanel();

  if (!(await verifyAdmin())){
    showLogin("Bukan admin");
    return;
  }

  loadConfessions();
  loadEvents();
});

logoutBtn.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  showLogin("");
});

/* ======================
   CONFESSIONS
====================== */
async function loadConfessions(){
  confList.innerHTML = "<small>Loading...</small>";

  const { data, error } = await supabase
    .from("confessions")
    .select("id,name,message,created_at")
    .order("created_at",{ascending:false});

  if (error){
    confList.innerHTML = `<small>${esc(error.message)}</small>`;
    return;
  }

  confList.innerHTML = data.map(c=>`
    <div class="card">
      <b>${esc(c.name || "Anonim")}</b>
      <small>${new Date(c.created_at).toLocaleString("id-ID")}</small>
      <p>${esc(c.message)}</p>
      <button class="btn secondary" data-del="${c.id}">Delete</button>
    </div>
  `).join("");

  confList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = async ()=>{
      if (!confirm("Hapus confession?")) return;
      await supabase.from("confessions").delete().eq("id", btn.dataset.del);
      loadConfessions();
    };
  });
}

refreshConf.addEventListener("click", loadConfessions);

/* ======================
   EVENTS
====================== */
async function uploadBanner(file){
  const name = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g,"-");
  const path = `events/${Date.now()}-${name}`;

  await supabase.storage.from("event-banners").upload(path, file);
  return supabase.storage.from("event-banners").getPublicUrl(path).data.publicUrl;
}

async function loadEvents(){
  eventsList.innerHTML = "<small>Loading...</small>";

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at",{ascending:false});

  if (error){
    eventsList.innerHTML = `<small>${esc(error.message)}</small>`;
    return;
  }

  eventsList.innerHTML = data.map(e=>`
    <div class="card">
      <b>${esc(e.title)}</b><br/>
      <small>${e.start_date || ""} → ${e.end_date || ""}</small>
      <button class="btn secondary" data-del="${e.id}">Delete</button>
    </div>
  `).join("");

  eventsList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = async ()=>{
      if (!confirm("Hapus event?")) return;
      await supabase.from("events").delete().eq("id", btn.dataset.del);
      loadEvents();
    };
  });
}

createEvent.addEventListener("click", async ()=>{
  eventStatus.textContent = "Menyimpan...";

  let banner = null;
  if (eventBanner.files[0]){
    banner = await uploadBanner(eventBanner.files[0]);
  }

  const { error } = await supabase.from("events").insert({
    title: eventTitle.value,
    description: eventDesc.value,
    start_date: eventStart.value,
    end_date: eventEnd.value,
    banner_url: banner
  });

  if (error){
    eventStatus.textContent = error.message;
    return;
  }

  eventStatus.textContent = "Event ditambahkan ✅";
  loadEvents();
});

/* ======================
   AUTO SESSION
====================== */
(async ()=>{
  if (await verifyAdmin()){
    showPanel();
    loadConfessions();
    loadEvents();
  } else {
    showLogin("");
  }
})();
