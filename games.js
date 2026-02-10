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

const leaveBtn = document.getElementById("leaveBtn");

// ✅ ADDED: feed jawaban (semua peserta bisa lihat)
const feedStatus = document.getElementById("feedStatus");
const feedList = document.getElementById("feedList");

const LS_KEY = "cc_state_v1";

let state = {
  room_id: null,
  room_code: null,
  player_id: null,
  nickname: null,
  current_question_id: null,
  winner_player_id: null,
};

let currentBuzzRound = 1; // ✅ ADDED

function esc(s=""){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (s) state = s;
  }catch{}
}
function clearState(){
  localStorage.removeItem(LS_KEY);
  state = { room_id:null, room_code:null, player_id:null, nickname:null, current_question_id:null, winner_player_id:null };
}

function showGame(){
  joinCard.style.display = "none";
  gameCard.style.display = "block";
  roomLabel.textContent = state.room_code || "-";
}
function showJoin(msg=""){
  joinCard.style.display = "block";
  gameCard.style.display = "none";
  joinStatus.textContent = msg;
}

function setQuestion(text){
  qTitle.textContent = "Pertanyaan";
  qText.textContent = text || "—";
}

function setStatus(msg=""){ gameStatus.textContent = msg; }

let roomChannel = null;
let buzzChannel = null;
let answerChannel = null;

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

async function joinRoom(code, nickname){
  const room = await fetchRoomByCode(code);
  if (!room) throw new Error("Room tidak ditemukan.");

  const { data: player, error } = await supabase
    .from("quiz_players")
    .insert({ room_id: room.id, nickname })
    .select("id")
    .single();
  if (error) throw error;

  state.room_id = room.id;
  state.room_code = room.code;
  state.player_id = player.id;
  state.nickname = nickname;
  state.current_question_id = room.current_question_id;
  saveState();

  showGame();
  await syncRoomUI(room);
  subscribeRealtime();
}

async function syncRoomUI(room){
  state.current_question_id = room.current_question_id;
  saveState();

  // ✅ ADDED: ambil round buzz sekarang
  currentBuzzRound = room.buzz_round || 1;

  if (room.status !== "live"){
    setStatus(`Status: ${room.status}. Menunggu admin mulai…`);
    setQuestion("—");
    buzzBtn.disabled = true;
    buzzInfo.textContent = "Buzz akan aktif saat live.";
    answerBox.style.display = "none";
    await loadAnswerFeed(); // ✅ ADDED
    return;
  }

  setStatus(`LIVE! Round buzz: ${currentBuzzRound}`);
  buzzBtn.disabled = false;
  buzzInfo.textContent = "";

  const q = await fetchQuestion(room.current_question_id);
  setQuestion(q?.question_text || "—");

  // reset answer box setiap soal baru ATAU round berubah
  answerBox.style.display = "none";
  answerStatus.textContent = "";
  answerText.value = "";
  sendAnswerBtn.disabled = false;

  state.winner_player_id = null;
  saveState();

  await loadAnswerFeed(); // ✅ ADDED
}

async function loadAnswerFeed(){
  if (!feedStatus || !feedList) return;

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

async function buzz(){
  if (!state.room_id || !state.player_id || !state.current_question_id) return;

  buzzBtn.disabled = true;
  buzzInfo.textContent = "Mengirim buzz…";

  // ✅ CHANGED: kirim round_no
  const { error } = await supabase.from("quiz_buzzes").insert({
    room_id: state.room_id,
    question_id: state.current_question_id,
    player_id: state.player_id,
    round_no: currentBuzzRound
  });

  if (error){
    buzzBtn.disabled = false;
    buzzInfo.textContent = "Gagal buzz: " + error.message;
    return;
  }

  buzzInfo.textContent = `Buzz terkirim (round ${currentBuzzRound}). Menunggu admin pilih pemenang…`;
}

async function sendAnswer(){
  answerStatus.textContent = "Mengirim jawaban…";

  const text = (answerText.value || "").trim();
  if (!text){
    answerStatus.textContent = "Jawaban tidak boleh kosong.";
    return;
  }

  // ✅ CHANGED: kirim round_no juga
  const { error } = await supabase.from("quiz_answers").insert({
    room_id: state.room_id,
    question_id: state.current_question_id,
    player_id: state.player_id,
    answer_text: text,
    round_no: currentBuzzRound
  });

  if (error){
    answerStatus.textContent = "Gagal kirim: " + error.message;
    return;
  }

  answerStatus.textContent = "Jawaban terkirim. Menunggu verifikasi admin…";
  sendAnswerBtn.disabled = true;

  await loadAnswerFeed(); // ✅ ADDED
}

function subscribeRealtime(){
  unsubscribeRealtime();

  // room changes
  roomChannel = supabase
    .channel(`cc-room-${state.room_id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_rooms", filter: `id=eq.${state.room_id}` },
      async (payload) => {
        const room = payload.new;
        await syncRoomUI(room);
      })
    .subscribe();

  // buzz winner updates for current room
  buzzChannel = supabase
    .channel(`cc-buzz-${state.room_id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_buzzes", filter: `room_id=eq.${state.room_id}` },
      (payload) => {
        const b = payload.new;
        if (b.question_id !== state.current_question_id) return;

        // ✅ winner hanya berlaku untuk round aktif
        if ((b.round_no ?? 1) !== currentBuzzRound) return;

        // kalau admin memilih pemenang
        if (b.is_winner && b.status === "answering"){
          state.winner_player_id = b.player_id;
          saveState();

          if (b.player_id === state.player_id){
            buzzInfo.textContent = "Kamu menang buzz! Silakan jawab.";
            answerBox.style.display = "block";
            sendAnswerBtn.disabled = false;
          }else{
            buzzInfo.textContent = "Ada yang menang buzz. Menunggu jawaban…";
            answerBox.style.display = "none";
          }
        }

        // resolved -> ronde selesai (kalau SALAH, admin naikkan round dan UI akan sync dari roomChannel)
        if (b.status === "resolved"){
          buzzBtn.disabled = false;
        }
      })
    .subscribe();

  // answer updates (insert/update) buat feed
  answerChannel = supabase
    .channel(`cc-ans-${state.room_id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "quiz_answers", filter: `room_id=eq.${state.room_id}` },
      async (payload) => {
        const a = payload.new;
        if (a.question_id !== state.current_question_id) return;

        // update status pribadi kalau jawabanmu diverifikasi
        if (a.player_id === state.player_id){
          if (a.verdict === "correct") answerStatus.textContent = "✅ Benar! (+poin)";
          if (a.verdict === "wrong") answerStatus.textContent = "❌ Salah. Buzz dibuka lagi.";
        }

        await loadAnswerFeed();
      })
    .subscribe();
}

function unsubscribeRealtime(){
  if (roomChannel) supabase.removeChannel(roomChannel);
  if (buzzChannel) supabase.removeChannel(buzzChannel);
  if (answerChannel) supabase.removeChannel(answerChannel);
  roomChannel = buzzChannel = answerChannel = null;
}

joinBtn.addEventListener("click", async ()=>{
  joinStatus.textContent = "Joining…";
  try{
    const code = (roomCodeEl.value || "").trim().toUpperCase();
    const nick = (nickEl.value || "").trim();
    if (!code || !nick) { joinStatus.textContent = "Kode room & nickname wajib."; return; }
    await joinRoom(code, nick);
  }catch(e){
    joinStatus.textContent = e.message || "Gagal join.";
  }
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
  if (state.room_id && state.room_code && state.player_id){
    try{
      showGame();
      const room = await fetchRoomByCode(state.room_code);
      if (!room) { clearState(); showJoin("Room tidak ditemukan."); return; }
      await syncRoomUI(room);
      subscribeRealtime();
    }catch{
      clearState();
      showJoin("Session join sudah invalid. Join ulang ya.");
    }
  }else{
    showJoin("");
  }
})();
