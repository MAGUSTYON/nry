import { supabase } from "./supabaseClient.js";

const loginCard = document.getElementById("loginCard");
const panel = document.getElementById("panel");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginStatus = document.getElementById("loginStatus");

const createRoomBtn = document.getElementById("createRoomBtn");
const roomInfo = document.getElementById("roomInfo");
const loadCode = document.getElementById("loadCode");
const loadRoomBtn = document.getElementById("loadRoomBtn");
const loadStatus = document.getElementById("loadStatus");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const endBtn = document.getElementById("endBtn");
const liveStatus = document.getElementById("liveStatus");

const qText = document.getElementById("qText");
const addQBtn = document.getElementById("addQBtn");
const qStatus = document.getElementById("qStatus");
const qList = document.getElementById("qList");

const buzzStatus = document.getElementById("buzzStatus");
const buzzList = document.getElementById("buzzList");

const ansStatus = document.getElementById("ansStatus");
const ansList = document.getElementById("ansList");

let room = null;
let questions = [];
let channels = [];

const POINTS_CORRECT = 10;

function esc(s=""){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function showLogin(msg=""){
  loginStatus.textContent = msg;
  loginCard.style.display = "block";
  panel.style.display = "none";
}
function showPanel(){
  loginCard.style.display = "none";
  panel.style.display = "block";
}

async function verifyAdmin(){
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return false;
  const email = sess.session.user.email;

  const { data: adminRow } = await supabase
    .from("admins").select("email").eq("email", email).maybeSingle();
  return !!adminRow;
}

function genCode(){
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function setRoomInfo(){
  if (!room) { roomInfo.textContent = ""; return; }
  roomInfo.textContent = `Kode: ${room.code} • status: ${room.status} • current: ${room.current_question_id || "-"} • round: ${room.buzz_round ?? 1}`;
}
function setLiveStatus(){
  if (!room) { liveStatus.textContent = ""; return; }
  liveStatus.textContent = `Status: ${room.status}`;
}

async function fetchRoomByCode(code){
  const { data, error } = await supabase
    .from("quiz_rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchQuestions(){
  if (!room) return [];
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, order_no, question_text, created_at")
    .eq("room_id", room.id)
    .order("order_no", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function refreshQuestions(){
  questions = await fetchQuestions();
  if (!questions.length){
    qList.innerHTML = `<div class="card"><small>Belum ada pertanyaan.</small></div>`;
    return;
  }
  qList.innerHTML = questions.map(q => `
    <div class="card">
      <b>#${q.order_no}</b>
      <p style="white-space:pre-wrap;margin-top:8px;">${esc(q.question_text)}</p>
    </div>
  `).join("");
}

async function startLive(){
  if (!room) return;
  questions = await fetchQuestions();
  if (!questions.length) { liveStatus.textContent = "Tambah pertanyaan dulu."; return; }

  const first = questions[0];

  const { data, error } = await supabase
    .from("quiz_rooms")
    .update({ status: "live", current_index: 0, current_question_id: first.id, buzz_round: 1 })
    .eq("id", room.id)
    .select("*")
    .single();

  if (error) { liveStatus.textContent = error.message; return; }
  room = data;
  setRoomInfo();
  setLiveStatus();
}

async function nextQuestion(){
  if (!room) return;
  questions = await fetchQuestions();
  if (!questions.length) return;

  const nextIndex = Math.min(room.current_index + 1, questions.length - 1);
  const nextQ = questions[nextIndex];

  // resolve semua buzz soal lama (biar rapih)
  if (room.current_question_id){
    await supabase
      .from("quiz_buzzes")
      .update({ status: "resolved" })
      .eq("question_id", room.current_question_id);
  }

  const { data, error } = await supabase
    .from("quiz_rooms")
    .update({ status: "live", current_index: nextIndex, current_question_id: nextQ.id, buzz_round: 1 })
    .eq("id", room.id)
    .select("*")
    .single();

  if (error) { liveStatus.textContent = error.message; return; }
  room = data;
  setRoomInfo();
  setLiveStatus();
}

async function endLive(){
  if (!room) return;
  const { data, error } = await supabase
    .from("quiz_rooms")
    .update({ status: "ended" })
    .eq("id", room.id)
    .select("*")
    .single();
  if (error) { liveStatus.textContent = error.message; return; }
  room = data;
  setRoomInfo();
  setLiveStatus();
}

async function renderBuzzes(){
  if (!room?.current_question_id){
    buzzStatus.textContent = "Mulai live dulu.";
    buzzList.innerHTML = `<div class="card"><small>Belum ada soal aktif.</small></div>`;
    return;
  }

  const round = room.buzz_round ?? 1;
  buzzStatus.textContent = `Buzz list (round ${round})`;

  const { data, error } = await supabase
    .from("quiz_buzzes")
    .select("id, player_id, buzzed_at, status, round_no, quiz_players(nickname)")
    .eq("question_id", room.current_question_id)
    .eq("round_no", round)
    .order("buzzed_at", { ascending: true })
    .limit(30);

  if (error){
    buzzList.innerHTML = `<div class="card"><small>${esc(error.message)}</small></div>`;
    return;
  }

  if (!data?.length){
    buzzList.innerHTML = `<div class="card"><small>Belum ada yang buzz.</small></div>`;
    return;
  }

  // yang pertama = tercepat
  buzzList.innerHTML = data.map((b,i)=>`
    <div class="card">
      <b>${i+1}. ${esc(b.quiz_players?.nickname || "Player")}</b>
      <div><small>${new Date(b.buzzed_at).toLocaleTimeString("id-ID")} • ${esc(b.status)} • round ${b.round_no}</small></div>
      ${i===0 ? `<div><small>🏆 Tercepat</small></div>` : ""}
    </div>
  `).join("");
}

async function renderAnswers(){
  if (!room?.current_question_id){
    ansList.innerHTML = `<div class="card"><small>Mulai live dulu.</small></div>`;
    return;
  }

  const round = room.buzz_round ?? 1;

  const { data, error } = await supabase
    .from("quiz_answers")
    .select("id, player_id, answer_text, verdict, submitted_at, round_no, quiz_players(nickname)")
    .eq("question_id", room.current_question_id)
    .eq("round_no", round)
    .order("submitted_at", { ascending: false })
    .limit(20);

  if (error){
    ansList.innerHTML = `<div class="card"><small>${esc(error.message)}</small></div>`;
    return;
  }

  if (!data?.length){
    ansList.innerHTML = `<div class="card"><small>Belum ada jawaban masuk (round ${round}).</small></div>`;
    return;
  }

  ansList.innerHTML = data.map(a => `
    <div class="card">
      <b>${esc(a.quiz_players?.nickname || "Player")}</b>
      <div><small>${new Date(a.submitted_at).toLocaleTimeString("id-ID")} • ${esc(a.verdict)} • round ${a.round_no}</small></div>
      <p style="white-space:pre-wrap;margin-top:10px;">${esc(a.answer_text)}</p>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap;">
        <button class="btn primary" data-v="correct" data-id="${a.id}" type="button">Benar</button>
        <button class="btn secondary" data-v="wrong" data-id="${a.id}" type="button">Salah</button>
      </div>
    </div>
  `).join("");

  ansList.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-id");
      const verdict = btn.getAttribute("data-v"); // correct / wrong

      // ambil jawaban lengkap
      const { data: ansRow, error: ansErr } = await supabase
        .from("quiz_answers")
        .select("id, player_id, question_id, round_no")
        .eq("id", id)
        .single();

      if (ansErr){ ansStatus.textContent = ansErr.message; return; }

      // update verdict
      const { error: upErr } = await supabase
        .from("quiz_answers")
        .update({ verdict, verified_at: new Date().toISOString() })
        .eq("id", id);

      if (upErr){ ansStatus.textContent = upErr.message; return; }

      // resolve buzz round ini
      await supabase
        .from("quiz_buzzes")
        .update({ status: "resolved" })
        .eq("question_id", ansRow.question_id)
        .eq("round_no", ansRow.round_no);

      if (verdict === "correct"){
        // tambah poin
        const { data: pRow, error: pErr1 } = await supabase
          .from("quiz_players")
          .select("points")
          .eq("id", ansRow.player_id)
          .single();
        if (pErr1){ ansStatus.textContent = pErr1.message; return; }

        const cur = pRow?.points ?? 0;
        const { error: pErr2 } = await supabase
          .from("quiz_players")
          .update({ points: cur + POINTS_CORRECT })
          .eq("id", ansRow.player_id);
        if (pErr2){ ansStatus.textContent = pErr2.message; return; }

        // pause room supaya gak ada buzz baru sampai admin next
        const { error: rErr } = await supabase
          .from("quiz_rooms")
          .update({ status: "paused" })
          .eq("id", room.id);
        if (rErr){ ansStatus.textContent = rErr.message; return; }

        ansStatus.textContent = `✅ BENAR (+${POINTS_CORRECT} poin) • room PAUSED`;
      } else {
        // salah → buka buzz round baru (tetap live)
        const { error: rErr } = await supabase
          .from("quiz_rooms")
          .update({ buzz_round: (room.buzz_round ?? 1) + 1, status: "live" })
          .eq("id", room.id);
        if (rErr){ ansStatus.textContent = rErr.message; return; }

        ansStatus.textContent = "❌ SALAH — Buzz dibuka lagi (round + 1)";
      }

      await renderAnswers();
      await renderBuzzes();
    });
  });
}

function subscribe(){
  unsubscribe();
  if (!room) return;

  const ch1 = supabase.channel(`adm-room-${room.id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_rooms", filter:`id=eq.${room.id}` }, async (p)=>{
      room = p.new;
      setRoomInfo();
      setLiveStatus();
      await renderBuzzes();
      await renderAnswers();
    })
    .subscribe();

  const ch2 = supabase.channel(`adm-buzz-${room.id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_buzzes", filter:`room_id=eq.${room.id}` }, async ()=>{
      await renderBuzzes();
    })
    .subscribe();

  const ch3 = supabase.channel(`adm-ans-${room.id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_answers", filter:`room_id=eq.${room.id}` }, async ()=>{
      await renderAnswers();
    })
    .subscribe();

  channels.push(ch1, ch2, ch3);
}

function unsubscribe(){
  channels.forEach(ch => supabase.removeChannel(ch));
  channels = [];
}

/* UI handlers */
loginBtn.addEventListener("click", async ()=>{
  loginStatus.textContent = "Login…";
  await supabase.auth.signOut();

  const email = (emailEl.value||"").trim();
  const password = passEl.value||"";
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.session){
    showLogin("Login gagal: " + (error?.message || "unknown"));
    return;
  }

  if (!(await verifyAdmin())){
    await supabase.auth.signOut();
    showLogin("Bukan admin.");
    return;
  }

  showPanel();
});

logoutBtn.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  unsubscribe();
  room = null;
  showLogin("");
});

createRoomBtn.addEventListener("click", async ()=>{
  roomInfo.textContent = "Membuat room…";
  const code = genCode();

  const { data, error } = await supabase
    .from("quiz_rooms")
    .insert({ code, status: "setup", buzz_round: 1 })
    .select("*")
    .single();

  if (error){ roomInfo.textContent = error.message; return; }
  room = data;
  setRoomInfo();
  await refreshQuestions();
  await renderBuzzes();
  await renderAnswers();
  subscribe();
});

loadRoomBtn.addEventListener("click", async ()=>{
  loadStatus.textContent = "Loading…";
  try{
    const code = (loadCode.value||"").trim().toUpperCase();
    if (!code) { loadStatus.textContent = "Isi kode dulu."; return; }
    const r = await fetchRoomByCode(code);
    if (!r) { loadStatus.textContent = "Room tidak ditemukan."; return; }
    room = r;
    loadStatus.textContent = "OK.";
    setRoomInfo();
    setLiveStatus();
    await refreshQuestions();
    await renderBuzzes();
    await renderAnswers();
    subscribe();
  }catch(e){
    loadStatus.textContent = e.message || "Error.";
  }
});

addQBtn.addEventListener("click", async ()=>{
  qStatus.textContent = "";
  if (!room){ qStatus.textContent = "Buat/load room dulu."; return; }

  const text = (qText.value||"").trim();
  if (!text){ qStatus.textContent = "Pertanyaan kosong."; return; }

  questions = await fetchQuestions();
  const nextOrder = questions.length ? (questions[questions.length-1].order_no + 1) : 1;

  const { error } = await supabase.from("quiz_questions").insert({
    room_id: room.id,
    order_no: nextOrder,
    question_text: text
  });

  if (error){ qStatus.textContent = error.message; return; }
  qText.value = "";
  qStatus.textContent = "Pertanyaan ditambahkan ✅";
  await refreshQuestions();
});

startBtn.addEventListener("click", startLive);
nextBtn.addEventListener("click", nextQuestion);
endBtn.addEventListener("click", endLive);

(async ()=>{
  if (await verifyAdmin()){
    showPanel();
  }else{
    showLogin("");
  }
})();
