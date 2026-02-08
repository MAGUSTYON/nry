import { supabase } from "./supabaseClient.js";

console.log("admin.js loaded ✅");

/* =========================
   ELEMENTS
========================= */
const loginSection = document.getElementById("loginSection");
const adminPanel   = document.getElementById("adminPanel");

const emailInput   = document.getElementById("email");
const passInput    = document.getElementById("password");
const loginBtn     = document.getElementById("loginBtn");
const logoutBtn    = document.getElementById("logoutBtn");
const loginStatus  = document.getElementById("loginStatus");

// Confessions
const confList     = document.getElementById("confessionsList");
const refreshConf  = document.getElementById("refreshConfBtn");

// Events
const eventTitle   = document.getElementById("eventTitle");
const eventStart   = document.getElementById("eventStart");
const eventEnd     = document.getElementById("eventEnd");
const eventDesc    = document.getElementById("eventDesc");
const eventBanner  = document.getElementById("eventBanner");
const createEvent  = document.getElementById("createEventBtn");
const eventStatus  = document.getElementById("eventStatus");
const eventsList   = document.getElementById("eventsList");

/* =========================
   HELPERS
========================= */
function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLogin(msg = "") {
  if (loginStatus) loginStatus.textContent = msg;
  if (loginSection) loginSection.style.display = "block";
  if (adminPanel) adminPanel.style.display = "none";
}

function showPanelInstant() {
  if (loginSection) loginSection.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";
}

function setEventStatus(msg = "") {
  if (eventStatus) eventStatus.textContent = msg;
}

function safeName(filename = "file") {
  return filename.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

/* =========================
   AUTH (ADMIN ONLY)
========================= */
async function verifyAdminOrKick() {
  const { data: sessRes, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessRes?.session) {
    console.log("No session");
    showLogin("");
    return false;
  }

  const email = sessRes.session.user?.email;
  console.log("Session email:", email);

  const { data: adminRow, error: adminErr } = await supabase
    .from("admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (adminErr) {
    console.error("admins check error:", adminErr);
    await supabase.auth.signOut();
    showLogin("Error cek admin: " + adminErr.message);
    return false;
  }

  if (!adminRow) {
    await supabase.auth.signOut();
    showLogin("Akun ini bukan admin.");
    return false;
  }

  console.log("Admin verified ✅");
  return true;
}

/* =========================
   CONFESSIONS
========================= */
async function loadConfessions() {
  if (!confList) return;

  confList.innerHTML = "<small>Loading...</small>";

  const { data, error } = await supabase
    .from("confessions")
    .select("id, name, message, impression, spotify_url, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("loadConfessions error:", error);
    confList.innerHTML = `<small>Gagal load confessions: ${esc(error.message)}</small>`;
    return;
  }

  console.log("Confessions loaded:", data?.length);

  if (!data || data.length === 0) {
    confList.innerHTML = "<small>Tidak ada confession.</small>";
    return;
  }

  confList.innerHTML = data
    .map((c) => {
      const name = c.name?.trim() ? esc(c.name) : "Anonim";
      const msg = esc(c.message || "");
      const imp = c.impression ? `<div style="margin-top:6px;"><small><b>Impression:</b> ${esc(c.impression)}</small></div>` : "";
      const sp  = c.spotify_url ? `<div style="margin-top:8px;"><small><a href="${esc(c.spotify_url)}" target="_blank" rel="noreferrer">Spotify link</a></small></div>` : "";
      const time = c.created_at ? new Date(c.created_at).toLocaleString("id-ID") : "";

      return `
        <div class="card">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <b>${name}</b>
              <div><small>${esc(time)}</small></div>
            </div>
            <button class="btn secondary" data-del-conf="${c.id}">Delete</button>
          </div>
          <p style="white-space:pre-wrap; margin:10px 0 0;">${msg}</p>
          ${imp}
          ${sp}
        </div>
      `;
    })
    .join("");

  confList.querySelectorAll("[data-del-conf]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-conf");
      if (!confirm("Yakin hapus confession ini?")) return;

      const { error: delErr } = await supabase.from("confessions").delete().eq("id", id);
      if (delErr) {
        alert("Gagal delete: " + delErr.message);
        return;
      }
      await loadConfessions();
    });
  });
}

/* =========================
   EVENTS
========================= */
async function uploadBanner(file) {
  // bucket: event-banners (public)
  const safe = safeName(file.name || "banner.jpg");
  const path = `events/${Date.now()}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from("event-banners")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (upErr) throw new Error("Upload banner gagal: " + upErr.message);

  const { data } = supabase.storage.from("event-banners").getPublicUrl(path);
  return data.publicUrl;
}

function renderEventCard(e) {
  const title = esc(e.title || "");
  const desc  = e.description ? esc(e.description) : "";
  const start = e.start_date ? new Date(e.start_date).toLocaleDateString("id-ID") : "-";
  const end   = e.end_date ? new Date(e.end_date).toLocaleDateString("id-ID") : "-";
  const banner = e.banner_url
    ? `<div style="margin-top:10px;">
         <img src="${e.banner_url}" alt="" style="width:100%; border-radius:14px; border:1px solid rgba(255,255,255,.14);" />
       </div>`
    : "";

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
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

async function loadEvents() {
  if (!eventsList) return;

  eventsList.innerHTML = "<small>Loading...</small>";

  const { data, error } = await supabase
    .from("events")
    .select("id, created_at, title, description, banner_url, start_date, end_date")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("loadEvents error:", error);
    eventsList.innerHTML = `<small>Gagal load events: ${esc(error.message)}</small>`;
    return;
  }

  console.log("Events loaded:", data?.length);

  if (!data || data.length === 0) {
    eventsList.innerHTML = "<small>Belum ada event.</small>";
    return;
  }

  eventsList.innerHTML = data.map(renderEventCard).join("");

  eventsList.querySelectorAll("[data-del-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-event");
      if (!confirm("Yakin hapus event ini?")) return;

      const { error: delErr } = await supabase.from("events").delete().eq("id", id);
      if (delErr) {
        alert("Gagal delete event: " + delErr.message);
        return;
      }
      await loadEvents();
    });
  });
}

async function handleCreateEvent() {
  if (!createEvent) return;

  setEventStatus("");

  const title = (eventTitle?.value || "").trim();
  const description = (eventDesc?.value || "").trim() || null;
  const start_date = eventStart?.value || null;
  const end_date = eventEnd?.value || null;

  if (!title) {
    setEventStatus("Judul wajib diisi.");
    return;
  }
  if (start_date && end_date && end_date < start_date) {
    setEventStatus("End date tidak boleh lebih awal dari start date.");
    return;
  }

  createEvent.disabled = true;
  setEventStatus("Menyimpan...");

  try {
    let banner_url = null;
    const file = eventBanner?.files?.[0] || null;
    if (file) {
      banner_url = await uploadBanner(file);
    }

    const payload = { title, description, start_date, end_date, banner_url };
    console.log("Insert event payload:", payload);

    const { error } = await supabase.from("events").insert(payload);
    if (error) throw new Error(error.message);

    setEventStatus("Event ditambahkan ✅");

    // reset form
    if (eventTitle) eventTitle.value = "";
    if (eventDesc) eventDesc.value = "";
    if (eventStart) eventStart.value = "";
    if (eventEnd) eventEnd.value = "";
    if (eventBanner) eventBanner.value = "";

    await loadEvents();
  } catch (e) {
    console.error(e);
    setEventStatus("Gagal tambah event: " + (e?.message || "unknown"));
  } finally {
    createEvent.disabled = false;
  }
}

/* =========================
   INIT
========================= */
async function initAdmin() {
  await loadConfessions();
  await loadEvents();
}

/* =========================
   WIRING
========================= */
loginBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = (emailInput?.value || "").trim();
  const password = passInput?.value || "";

  if (!email || !password) {
    showLogin("Email & password wajib diisi.");
    return;
  }

  // IMPORTANT: bersihin session lama biar password salah gak "tetap masuk"
  await supabase.auth.signOut();

  showLogin("Login...");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.session) {
    await supabase.auth.signOut();
    showLogin("Login gagal: " + (error?.message || "Unknown error"));
    return;
  }

  // tampil panel langsung
  showPanelInstant();

  // cek admin whitelist (silent)
  const ok = await verifyAdminOrKick();
  if (!ok) return;

  await initAdmin();
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin("");
});

refreshConf?.addEventListener("click", loadConfessions);
createEvent?.addEventListener("click", handleCreateEvent);

// auto-check kalau session masih ada
(async () => {
  const ok = await verifyAdminOrKick();
  if (ok) {
    showPanelInstant();
    await initAdmin();
  } else {
    showLogin("");
  }
})();
