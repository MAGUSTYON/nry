import { supabase } from "./supabaseClient.js";

const joinCard = document.getElementById("joinCard");
const gameCard = document.getElementById("gameCard");

const roomCodeEl = document.getElementById("roomCode");
const nickEl = document.getElementById("nickname");
const joinBtn = document.getElementById("joinBtn");
const joinStatus = document.getElementById("joinStatus");

const roomLabel = document.getElementById("roomLabel");
const gameStatus = document.getElementById("gameStatus");

const qTitle = document.getElementById("qTitle");
const qText = document.getElementById("qText");

const buzzBtn = document.getElementById("buzzBtn");
const buzzInfo = document.getElementById("buzzInfo");

const answerBox = document.getElementById("answerBox");
const answerText = document.getElementById("answerText");
const sendAnswerBtn = document.getElementById("sendAnswerBtn");
const answerStatus = document.getElementById("answerStatus");

const feedStatus = document.getElementById("feedStatus");
const feedList = document.getElementById("feedList");

const leaveBtn = document.getElementById("leaveBtn");

const LS_KEY = "cc_state_v2";

let state = {
  room_id: null,
  room_code: null,
  player_id: null,
  nickname: null,
  current_question_id: null,
};

let currentBuzzRound = 1;
let roomStatus = "setup";

let chRoom = null;
let chBuzz = null;
let chAns = null;

function esc(s=""){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY)||"null");
    if (s) state = s;
  }catch{}
}
function clearState(){
  localStorage.removeItem(LS_KEY);
  state = { room_id:null, room_code:null, player_id:null, nickname:null, current_question_id:null };
}

function showJoin(msg=""){
  joinCard.style.display = "block";
  gameCard.style.display = "none";
  joinStatus.textContent = msg;
}
function showGame(){
  joinCard.style.display = "none";
  gameCard.style.display = "block";
  roomLabel.textContent = state.room_code || "-";
}

async function fetchRoomByCode(code){
  const { data, error } = await supabase
    .from("quiz_rooms")
    .select("id, code, status, current_question_id, buzz_round")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchQuestion(qid){
  if (!qid) return null;
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, question_text")
    .eq("id", qid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function setUIForRoom(){
  roomLabel.textContent = state.room_code || "-";
  gameStatus.textContent = `Status: ${roomStatus} • round ${currentBuzzRound}`;

  const live = roomStatus === "live";
  buzzBtn.disabled = !live;
  if (!live) buzzInfo.textContent = "Menunggu admin (Start/Next)…";

  // default: answer box disembunyikan sampai kamu benar-benar BUZZ tercepat
  if (!live) answerBox.style.display = "none";
}

async function loadAnswerFeed(){
  if (!state.current_question_id){
    feedStatus.textContent = "";
    feedList.innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("quiz_answers")
    .select("id, answer_text, verdict, submitted_at, round_no, quiz_players(nickname)")
    .eq("question_id", state.current_question_id)
    .order("submitted_at", { ascending: true })
    .limit(50);

  if (error){
    feedStatus.textContent = "Feed error: " + error.message;
    feedList.innerHTML = "";
    return;
  }

  if (!data?.length){
    feedStatus.textContent = "Belum ada jawaban.";
    feedList.innerHTML = `<div class="card"><small>Belum ada jawaban.</small></div>`;
    return;
  }

  feedStatus.textContent = `${data.length} jawaban`;
  feedList.innerHTML = data.map(a => `
    <div class="card">
      <b>${esc(a.quiz_players?.nickname || "Player")}</b>
      <small>• round ${a.round_no ?? 1} • ${esc(a.verdict)}</small>
      <p style="white-space:pre-wrap;margin-top:8px;">${esc(a.answer_text)}</p>
    </div>
  `).join("");
}

async function checkIfFirstBuzzerAndToggleAnswer(){
  if (roomStatus !== "live") {
    answerBox.style.display = "none";
    return;
  }
  if (!state.current_question_id) {
    answerBox.style.display = "none";
    return;
  }

  // ambil buzzer tercepat untuk round aktif
  const { data, error } = await supabase
    .from("quiz_buzzes")
    .select("player_id, buzzed_at")
    .eq("question_id", state.current_question_id)
    .eq("round_no", currentBuzzRound)
    .order("buzzed_at", { ascending: true })
    .limit(1);

  if (error) return;

  const first = data?.[0]?.player_id || null;
  if (!first) {
    // belum ada buzz
    answerBox.style.display = "none";
    return;
  }

  if (first === state.player_id) {
    // kamu yang tercepat → boleh jawab
    answerBox.style.display = "block";
    sendAnswerBtn.disabled = false;
    answerStatus.textContent = "";
    buzzInfo.textContent = "Kamu BUZZ tercepat! Silakan jawab.";
  } else {
    answerBox.style.display = "none";
    buzzInfo.textContent = "Sudah ada yang BUZZ duluan. Tunggu verifikasi / round berikutnya.";
  }
}

async function buzz(){
  if (roomStatus !== "live") return;
  if (!state.room_id || !state.player_id || !state.current_question_id) return;

  buzzBtn.disabled = true;
  buzzInfo.textContent = "Mengirim buzz…";

  const { error } = await supabase.from("quiz_buzzes").insert({
    room_id: state.room_id,
    question_id: state.current_question_id,
    player_id: state.player_id,
    round_no: currentBuzzRound,
    status: "waiting"
  });

  if (error){
    buzzBtn.disabled = false;
    buzzInfo.textContent = "Gagal buzz: " + error.message;
    return;
  }

  buzzInfo.textContent = `Buzz terkirim (round ${currentBuzzRound}).`;
  // setelah buzz, cek apakah kamu first
  await checkIfFirstBuzzerAndToggleAnswer();
  buzzBtn.disabled = false;
}

async function sendAnswer(){
  if (roomStatus !== "live") return;
  const text = (answerText.value || "").trim();
  if (!text){
    answerStatus.textContent = "Jawaban tidak boleh kosong.";
    return;
  }

  // pastikan kamu memang buzzer tercepat
  const { data: firstBuzz, error: fbErr } = await supabase
    .from("quiz_buzzes")
    .select("player_id")
    .eq("question_id", state.current_question_id)
    .eq("round_no", currentBuzzRound)
    .order("buzzed_at", { ascending: true })
    .limit(1);

  if (fbErr || !firstBuzz?.length || firstBuzz[0].player_id !== state.player_id){
    answerStatus.textContent = "Kamu bukan BUZZ tercepat. Tidak bisa jawab.";
    answerBox.style.display = "none";
    return;
  }

  answerStatus.textContent = "Mengirim jawaban…";
  sendAnswerBtn.disabled = true;

  const { error } = await supabase.from("quiz_answers").insert({
    room_id: state.room_id,
    question_id: state.current_question_id,
    player_id: state.player_id,
    round_no: currentBuzzRound,
    answer_text: text,
    verdict: "pending"
  });

  if (error){
    answerStatus.textContent = "Gagal kirim: " + error.message;
    sendAnswerBtn.disabled = false;
    return;
  }

  answerStatus.textContent = "Terkirim. Menunggu admin verifikasi…";
  await loadAnswerFeed();
}

function subscribeRealtime(){
  unsubscribeRealtime();

  // room changes
  chRoom = supabase.channel(`cc-room-${state.room_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_rooms", filter:`id=eq.${state.room_id}` }, async (p)=>{
      const r = p.new;
      roomStatus = r.status;
      currentBuzzRound = r.buzz_round || 1;

      const changedQuestion = (state.current_question_id !== r.current_question_id);
      state.current_question_id = r.current_question_id;
      saveState();

      setUIForRoom();

      if (changedQuestion){
        answerText.value = "";
        answerStatus.textContent = "";
        answerBox.style.display = "none";
      }

      const q = await fetchQuestion(state.current_question_id);
      qTitle.textContent = "Pertanyaan";
      qText.textContent = q?.question_text || "—";

      await loadAnswerFeed();
      await checkIfFirstBuzzerAndToggleAnswer();
    })
    .subscribe();

  // buzz changes
  chBuzz = supabase.channel(`cc-buzz-${state.room_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_buzzes", filter:`room_id=eq.${state.room_id}` }, async (p)=>{
      const b = p.new;
      if (b.question_id !== state.current_question_id) return;
      if ((b.round_no ?? 1) !== currentBuzzRound) return;

      await checkIfFirstBuzzerAndToggleAnswer();
    })
    .subscribe();

  // answers changes (real-time feed + verdict update)
  chAns = supabase.channel(`cc-ans-${state.room_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"quiz_answers", filter:`room_id=eq.${state.room_id}` }, async (p)=>{
      const a = p.new;
      if (a.question_id !== state.current_question_id) return;
      await loadAnswerFeed();

      // kalau jawabanmu diverifikasi
      if (a.player_id === state.player_id && a.round_no === currentBuzzRound){
        if (a.verdict === "correct") answerStatus.textContent = "✅ Benar! (+poin)";
        if (a.verdict === "wrong") {
          answerStatus.textContent = "❌ Salah. Tunggu round berikutnya.";
          answerBox.style.display = "none";
        }
      }
    })
    .subscribe();
}

function unsubscribeRealtime(){
  if (chRoom) supabase.removeChannel(chRoom);
  if (chBuzz) supabase.removeChannel(chBuzz);
  if (chAns) supabase.removeChannel(chAns);
  chRoom = chBuzz = chAns = null;
}

async function joinRoom(){
  joinStatus.textContent = "Joining…";
  const code = (roomCodeEl.value || "").trim().toUpperCase();
  const nick = (nickEl.value || "").trim();
  if (!code || !nick) { joinStatus.textContent = "Kode room & nickname wajib."; return; }

  const room = await fetchRoomByCode(code);
  if (!room) { joinStatus.textContent = "Room tidak ditemukan."; return; }

  const { data: player, error } = await supabase
    .from("quiz_players")
    .insert({ room_id: room.id, nickname: nick })
    .select("id")
    .single();

  if (error){ joinStatus.textContent = error.message; return; }

  state.room_id = room.id;
  state.room_code = room.code;
  state.player_id = player.id;
  state.nickname = nick;
  state.current_question_id = room.current_question_id;
  saveState();

  roomStatus = room.status;
  currentBuzzRound = room.buzz_round || 1;

  showGame();
  setUIForRoom();

  const q = await fetchQuestion(state.current_question_id);
  qText.textContent = q?.question_text || "—";

  await loadAnswerFeed();
  await checkIfFirstBuzzerAndToggleAnswer();
  subscribeRealtime();
}

joinBtn.addEventListener("click", ()=>{
  joinRoom().catch(e => joinStatus.textContent = e.message || "Error");
});

buzzBtn.addEventListener("click", buzz);
sendAnswerBtn.addEventListener("click", sendAnswer);

leaveBtn.addEventListener("click", ()=>{
  unsubscribeRealtime();
  clearState();
  showJoin("");
});

(async ()=>{
  loadState();
  if (state.room_code && state.room_id && state.player_id){
    try{
      showGame();
      const r = await fetchRoomByCode(state.room_code);
      if (!r) { clearState(); showJoin("Room tidak ditemukan. Join ulang."); return; }

      roomStatus = r.status;
      currentBuzzRound = r.buzz_round || 1;
      state.current_question_id = r.current_question_id;
      saveState();

      setUIForRoom();
      const q = await fetchQuestion(state.current_question_id);
      qText.textContent = q?.question_text || "—";

      await loadAnswerFeed();
      await checkIfFirstBuzzerAndToggleAnswer();
      subscribeRealtime();
    }catch{
      clearState();
      showJoin("Session invalid. Join ulang ya.");
    }
  }else{
    showJoin("");
  }
})();
