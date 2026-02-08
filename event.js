import { supabase } from "./supabaseClient.js";

const list = document.getElementById("list");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");

const esc = (s="") =>
  String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

function fmtDate(d){
  if (!d) return "-";
  try{
    return new Date(d).toLocaleDateString("id-ID");
  }catch{
    return d;
  }
}

function renderEvent(e){
  const title = esc(e.title || "");
  const desc = e.description ? esc(e.description) : "";
  const start = fmtDate(e.start_date);
  const end = fmtDate(e.end_date);

  const banner = e.banner_url
    ? `<div style="margin-top:10px;">
         <img src="${e.banner_url}" alt="" style="width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.14);" />
       </div>`
    : "";

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <b style="font-size:16px;">${title}</b><br/>
          <small>${esc(start)} → ${esc(end)}</small>
        </div>
      </div>
      ${desc ? `<p style="white-space:pre-wrap;margin:10px 0 0;line-height:1.6;">${desc}</p>` : ""}
      ${banner}
    </div>
  `;
}

async function loadEvents(){
  statusEl.textContent = "Loading...";
  list.innerHTML = "";

  const { data, error } = await supabase
    .from("events")
    .select("id, created_at, title, description, banner_url, start_date, end_date")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error){
    statusEl.textContent = "Gagal load: " + error.message;
    list.innerHTML = `<div class="card"><small>${esc(error.message)}</small></div>`;
    return;
  }

  if (!data || data.length === 0){
    statusEl.textContent = "Belum ada event.";
    list.innerHTML = `<div class="card"><small>Belum ada event.</small></div>`;
    return;
  }

  statusEl.textContent = `${data.length} event ditampilkan`;
  list.innerHTML = data.map(renderEvent).join("");
}

refreshBtn.addEventListener("click", loadEvents);

loadEvents();
