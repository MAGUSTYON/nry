import { supabase } from "supabaseClient.js";

/* ========= ELEMENTS ========= */
const loginSection = document.getElementById("loginSection");
const adminPanel   = document.getElementById("adminPanel");
const status       = document.getElementById("loginStatus");

const emailInput   = document.getElementById("email");
const passInput    = document.getElementById("password");
const loginBtn     = document.getElementById("loginBtn");
const logoutBtn    = document.getElementById("logoutBtn");

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

/* ========= HELPERS ========= */
function showLogin(msg=""){
  status.textContent = msg;
  loginSection.style.display = "block";
  adminPanel.style.display = "none";
}
function showPanel(){
  loginSection.style.display = "none";
  adminPanel.style.display = "block";
}
function esc(s=""){
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

/* ========= AUTH ========= */
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

loginBtn.addEventListener("click", async () => {
  showLogin("Login...");
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passInput.value
  });

  if (error){
    showLogin(error.message);
    return;
  }

  showPanel();                 // langsung tampil
  if (!(await verifyAdmin()))  // cek admin diam-diam
    showLogin("Bukan admin");
  else
    initAdmin();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin("");
});

/* ========= CONFESSIONS ========= */
async function loadConfessions(){
  confList.innerHTML = "<small>Loading...</small>";
  const { data, error } = await supabase
    .from("confessions")
    .select("id,name,message,created_at")
    .order("created_at",{ascending:false})
    .limit(50);

  if (error){
    confList.innerHTML = "<small>Gagal load</small>";
    return;
  }

  confList.innerHTML = data.map(c=>`
    <div class="card">
      <b>${esc(c.name || "Anonim")}</b>
      <p>${esc(c.message)}</p>
      <button data-del="${c.id}" class="btn secondary">Delete</button>
    </div>
  `).join("");

  confList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = async ()=>{
      if (!confirm("Hapus confession ini?")) return;
      await supabase.from("confessions").delete().eq("id", btn.dataset.del);
      loadConfessions();
    };
  });
}

/* ========= EVENTS ========= */
async function uploadBanner(file){
  const path = `events/${Date.now()}-${file.name}`;
  await supabase.storage.from("event-banners").upload(path,file);
  return supabase.storage.from("event-banners").getPublicUrl(path).data.publicUrl;
}

async function loadEvents(){
  eventsList.innerHTML = "<small>Loading...</small>";
  const { data } = await supabase
    .from("events")
    .select("*")
    .order("created_at",{ascending:false});

  eventsList.innerHTML = data.map(e=>`
    <div class="card">
      <b>${esc(e.title)}</b>
      <small>${e.start_date || ""} → ${e.end_date || ""}</small>
      <button data-del="${e.id}" class="btn secondary">Delete</button>
    </div>
  `).join("");

  eventsList.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = async ()=>{
      if (!confirm("Hapus event ini?")) return;
      await supabase.from("events").delete().eq("id", btn.dataset.del);
      loadEvents();
    };
  });
}

createEvent.addEventListener("click", async ()=>{
  eventStatus.textContent = "Menyimpan...";
  let banner = null;

  if (eventBanner.files[0])
    banner = await uploadBanner(eventBanner.files[0]);

  await supabase.from("events").insert({
    title: eventTitle.value,
    description: eventDesc.value,
    start_date: eventStart.value,
    end_date: eventEnd.value,
    banner_url: banner
  });

  eventStatus.textContent = "Event ditambahkan";
  loadEvents();
});

/* ========= INIT ========= */
async function initAdmin(){
  loadConfessions();
  loadEvents();
}

refreshConf.addEventListener("click", loadConfessions);

// auto-login kalau session masih ada
(async ()=>{
  const ok = await verifyAdmin();
  if (ok){
    showPanel();
    initAdmin();
  } else {
    showLogin("");
  }
})();
