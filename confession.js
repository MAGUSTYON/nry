import { supabase } from "./supabaseClient.js";

const elName = document.getElementById("name");
const elSpotify = document.getElementById("spotify_url");
const elMsg = document.getElementById("message");
const elImp = document.getElementById("impression");
const elSubmit = document.getElementById("submitBtn");
const elStatus = document.getElementById("status");
const elList = document.getElementById("list");
const elRefresh = document.getElementById("refreshBtn");

function setStatus(text, kind = "info") {
  elStatus.style.display = "inline-block";
  elStatus.textContent = text;
  // styling minimal: pakai badge aja
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function spotifyEmbedFromUrl(url) {
  // Support: open.spotify.com/track/{id} or spotify:track:{id}
  if (!url) return null;

  let id = null;
  try {
    if (url.startsWith("spotify:track:")) id = url.split(":")[2];
    if (url.includes("open.spotify.com/track/")) {
      const part = url.split("open.spotify.com/track/")[1];
      id = part.split("?")[0];
    }
  } catch (_) {}

  if (!id) return null;
  const src = `https://open.spotify.com/embed/track/${id}`;
  return `
    <div class="embed">
      <iframe
        style="border:0"
        src="${src}"
        width="100%"
        height="152"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </div>
  `;
}

function renderItem(item) {
  const name = item.name?.trim() ? escapeHtml(item.name.trim()) : "Anonim";
  const created = new Date(item.created_at).toLocaleString("id-ID");
  const msg = escapeHtml(item.message || "");
  const imp = escapeHtml(item.impression || "");
  const embed = spotifyEmbedFromUrl(item.spotify_url);

  return `
    <div class="card">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
        <div><b>${name}</b> <span class="badge">${created}</span></div>
      </div>
      <p style="white-space:pre-wrap; margin:10px 0 0;">${msg}</p>
      ${imp ? `<p style="white-space:pre-wrap; color:#b8b8c7; margin:10px 0 0;"><b>Impression:</b>\n${imp}</p>` : ""}
      ${embed ? `<div style="margin-top:12px;">${embed}</div>` : ""}
    </div>
  `;
}

async function loadFeed() {
  elList.innerHTML = `<small>Loading...</small>`;
  const { data, error } = await supabase
    .from("confessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    elList.innerHTML = `<small>Gagal load: ${escapeHtml(error.message)}</small>`;
    return;
  }
  elList.innerHTML = data.map(renderItem).join("") || `<small>Belum ada confession.</small>`;
}

async function submitConfession() {
  const payload = {
    name: elName.value.trim() || null,
    spotify_url: elSpotify.value.trim() || null,
    message: elMsg.value.trim(),
    impression: elImp.value.trim() || null,
  };

  if (!payload.message) {
    setStatus("Message wajib diisi.");
    return;
  }

  elSubmit.disabled = true;
  setStatus("Mengirim...");

  const { error } = await supabase.from("confessions").insert(payload);

  elSubmit.disabled = false;

  if (error) {
    setStatus("Gagal kirim: " + error.message);
    return;
  }

  setStatus("Terkirim ✅");
  elMsg.value = "";
  elImp.value = "";
  elSpotify.value = "";
  await loadFeed();
}

elSubmit.addEventListener("click", submitConfession);
elRefresh.addEventListener("click", loadFeed);

loadFeed();
const fab = document.getElementById("fab");
const modal = document.getElementById("confessionModal");
const closeModal = document.getElementById("closeModal");

fab.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});
modal.classList.add("hidden");
