function toSpotifyEmbed(url) {
  if (!url) return "";
  // Support open.spotify.com and spotify: links
  let u = url.trim();

  // spotify:track:xxxx -> https://open.spotify.com/track/xxxx
  if (u.startsWith("spotify:")) {
    const parts = u.split(":");
    if (parts.length >= 3) {
      u = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
    }
  }

  // Convert to embed
  // e.g. https://open.spotify.com/track/ID?si=... -> https://open.spotify.com/embed/track/ID
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.includes("spotify.com")) return "";
    const path = parsed.pathname.replace(/^\/+/, ""); // remove leading /
    if (!path) return "";
    return `https://open.spotify.com/embed/${path}`;
  } catch {
    return "";
  }
}

function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

async function fetchConfessions() {
  const res = await fetch("/api/confessions");
  if (!res.ok) throw new Error("Gagal ambil data.");
  return res.json();
}

function renderList(listEl, items) {
  listEl.innerHTML = "";
  if (!items.length) {
    listEl.innerHTML = `<div class="muted">Belum ada confession. Jadi yang pertama 👀</div>`;
    return;
  }

  for (const it of items) {
    const embed = toSpotifyEmbed(it.spotifyUrl);
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="top">
        <div><b>${escapeHtml(it.name)}</b> <span class="badge">• ${fmtTime(it.createdAt)}</span></div>
      </div>

      ${embed ? `<div class="embed"><iframe src="${embed}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>` : ""}

      <p class="msg">${escapeHtml(it.message)}</p>

      ${it.impression ? `<div class="hr"></div><div class="small"><b>Impression:</b><br/>${escapeHtml(it.impression)}</div>` : ""}
    `;
    listEl.appendChild(el);
  }
}

async function initConfessionPage() {
  const form = document.getElementById("confessForm");
  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const refreshBtn = document.getElementById("refreshBtn");
  const submitBtn = document.getElementById("submitBtn");

  async function refresh() {
    statusEl.className = "small muted";
    statusEl.textContent = "Memuat...";
    try {
      const items = await fetchConfessions();
      renderList(listEl, items);
      statusEl.textContent = "";
    } catch (e) {
      statusEl.className = "error";
      statusEl.textContent = e.message || "Terjadi error.";
    }
  }

  refreshBtn?.addEventListener("click", refresh);

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    statusEl.textContent = "";
    submitBtn.disabled = true;

    const payload = {
      name: document.getElementById("name").value,
      anonymous: document.getElementById("anonymous").checked,
      spotifyUrl: document.getElementById("spotifyUrl").value,
      message: document.getElementById("message").value,
      impression: document.getElementById("impression").value,
    };

    try {
      const res = await fetch("/api/confessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal kirim confession.");
      }

      form.reset();
      statusEl.className = "success";
      statusEl.textContent = "Terkirim ✅";

      await refresh();
    } catch (e) {
      statusEl.className = "error";
      statusEl.textContent = e.message || "Terjadi error.";
    } finally {
      submitBtn.disabled = false;
      setTimeout(() => { statusEl.textContent = ""; }, 2500);
    }
  });

  await refresh();
}

// Only run on confession page
if (location.pathname.endsWith("confession.html")) {
  initConfessionPage();
}
