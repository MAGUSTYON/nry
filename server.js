import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "confessions.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Helper: load + save
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
function loadConfessions() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}
function saveConfessions(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// API: get all confessions
app.get("/api/confessions", (req, res) => {
  const list = loadConfessions();
  // newest first
  list.sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

// API: add confession
app.post("/api/confessions", (req, res) => {
  const { name, anonymous, spotifyUrl, message, impression } = req.body || {};

  if (!message || String(message).trim().length < 1) {
    return res.status(400).json({ error: "Message wajib diisi." });
  }

  const safeName =
    anonymous === true || String(name || "").trim() === ""
      ? "Anonim"
      : String(name).trim().slice(0, 50);

  const item = {
    id: crypto.randomUUID(),
    name: safeName,
    spotifyUrl: (spotifyUrl || "").trim(),
    message: String(message).trim().slice(0, 1000),
    impression: String(impression || "").trim().slice(0, 500),
    createdAt: Date.now(),
  };

  const list = loadConfessions();
  list.push(item);
  saveConfessions(list);

  res.status(201).json(item);
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
