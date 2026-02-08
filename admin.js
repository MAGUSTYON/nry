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
