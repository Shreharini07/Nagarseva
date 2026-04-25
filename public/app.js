const API = "http://localhost:4004";

let selectedProblem = "";
let selectedLocation = null;
let selectedAddress = "";
let map, marker;
let mediaRecorder = null;
let audioChunks = [];
let audioBase64 = null;
let recognition = null;
let voiceText = "";
let selectedPriority = "Low";

// ── Speech Recognition ──────────────────────────────────────────────
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    voiceText = e.results[0][0].transcript;
    setRecordStatus("📝 " + voiceText);
    detectSentiment(voiceText);
  };
  recognition.onerror = () => setRecordStatus("❌ Speech recognition failed.");
}

function setRecordStatus(msg) {
  const el = document.getElementById("recordStatus");
  if (el) el.innerHTML = msg;
}

// ── Sentiment ───────────────────────────────────────────────────────
function detectSentiment(text) {
  const t = text.toLowerCase();
  const high   = ["urgent","emergency","danger","immediately","serious","critical","accident","fire","flood","leak","burst","severe","very bad","அவசரம்","உடனே","ஆபத்து"];
  const medium = ["problem","issue","not working","damage","complaint","repair","broken","பிரச்சனை","சரியில்லை","பழுது"];
  selectedPriority = high.some(w => t.includes(w)) ? "High" : medium.some(w => t.includes(w)) ? "Medium" : "Low";
  setRecordStatus("📝 " + text + "  |  🔥 Priority: " + selectedPriority);
}

// ── Login ────────────────────────────────────────────────────────────
function doLogin() {
  const mobile = document.getElementById("loginMobile").value.trim();
  const name   = document.getElementById("loginName").value.trim();
  if (!mobile || mobile.length !== 10) { alert("Enter a valid 10-digit mobile number"); return; }

  localStorage.setItem("userMobile", mobile);
  localStorage.setItem("userName",   name || "Citizen");

  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("appScreen").classList.add("active");

  const initial = (name || "C")[0].toUpperCase();
  document.getElementById("userInitial").textContent    = initial;
  document.getElementById("userNameLabel").textContent  = name || "Citizen";
  document.getElementById("headerUser").style.display   = "flex";

  // Map div is now visible — init then GPS
  setTimeout(() => {
    initMap();
    getCurrentLocation();
  }, 150);

  loadHistory();
}

// ── Map Init ─────────────────────────────────────────────────────────
function initMap() {
  if (map) return;
  map = L.map("map").setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
  map.on("click", (e) => setLocation(e.latlng.lat, e.latlng.lng));
}

// ── Get Current Location ─────────────────────────────────────────────
// ROOT CAUSE OF WRONG LOCATION: Leaflet renders the map tile at 0,0 
// when the container was hidden (display:none). We must call 
// map.invalidateSize() BEFORE setView so Leaflet recalculates the 
// container dimensions properly, otherwise setView centres on wrong pixel.
function getCurrentLocation() {
  setLocStatus("⏳ Getting your location…", "warn");
  document.getElementById("addressText").innerHTML = "Fetching…";

  if (!navigator.geolocation) {
    setLocStatus("❌ Geolocation not supported", "err"); return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // CRITICAL: recalculate map size before panning
      map.invalidateSize();

      setLocStatus("✅ Location found!", "ok");
      setLocation(lat, lng);
      setTimeout(() => setLocStatus("", ""), 3000);
    },
    (err) => {
      const msgs = {
        1: "❌ Permission denied. Allow location in browser settings, or click on map.",
        2: "❌ Position unavailable. Click on map to select.",
        3: "❌ Timed out. Try again or click on map."
      };
      setLocStatus(msgs[err.code] || "❌ Could not get location.", "err");
      document.getElementById("addressText").innerHTML = "Click on the map to pick your location";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function setLocStatus(msg, type) {
  const el = document.getElementById("locationStatus");
  if (!el) return;
  el.innerHTML = msg;
  el.className = msg ? "loc-status " + type : "";
}

// ── Set Location ─────────────────────────────────────────────────────
async function setLocation(lat, lng) {
  selectedLocation = { lat, lng };

  if (marker) map.removeLayer(marker);
  marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    setLocation(p.lat, p.lng);
  });

  map.setView([lat, lng], 16);

  document.getElementById("addressText").innerHTML = "Fetching address…";
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
    const d = await r.json();
    selectedAddress = d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    selectedAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  const short = selectedAddress.length > 110 ? selectedAddress.substring(0, 110) + "…" : selectedAddress;
  document.getElementById("addressText").innerHTML = "📍 " + short;
}

// ── Problem Selection ────────────────────────────────────────────────
function selectProblem(problem, btn) {
  selectedProblem = problem;
  document.querySelectorAll(".problem-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

// ── Voice Recording ──────────────────────────────────────────────────
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => { audioBase64 = reader.result; };
    };
    mediaRecorder.start();
    if (recognition) { recognition.start(); setRecordStatus("🎙️ Recording… Speak now"); }
    else setRecordStatus("🎙️ Recording audio…");
  } catch (err) { alert("Microphone access denied: " + err.message); }
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks().forEach(t => t.stop());
  }
  try { recognition?.stop(); } catch {}
  if (!voiceText) setRecordStatus("⏹️ Stopped — no speech detected");
}

// ── Submit ───────────────────────────────────────────────────────────
async function submitComplaint() {
  if (!selectedProblem)  { alert("Please select a problem type"); return; }
  if (!selectedLocation) { alert("Please select a location on the map"); return; }

  const formData = new FormData();
  formData.append("name",      localStorage.getItem("userName"));
  formData.append("mobile",    localStorage.getItem("userMobile"));
  formData.append("problem",   selectedProblem);
  formData.append("address",   selectedAddress);
  formData.append("latitude",  selectedLocation.lat);
  formData.append("longitude", selectedLocation.lng);
  formData.append("priority",  selectedPriority);
  formData.append("voiceText", voiceText);

  const photo = document.getElementById("photoInput").files[0];
  if (photo) formData.append("photo", photo);
  if (audioBase64) formData.append("voiceNote", audioBase64);

  try {
    const res  = await fetch(`${API}/api/complaint`, { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      const toast = document.getElementById("successToast");
      toast.innerHTML = `✅ Submitted! Priority: <strong>${data.priority}</strong>`;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3500);
      if (data.isDuplicate) alert("⚠️ A similar complaint exists nearby. Yours was logged as a reference.");

      selectedProblem = ""; selectedLocation = null; selectedPriority = "Low";
      voiceText = ""; audioBase64 = null;
      document.querySelectorAll(".problem-btn").forEach(b => b.classList.remove("selected"));
      document.getElementById("photoInput").value = "";
      document.getElementById("photoPreview").style.display = "none";
      setRecordStatus("Tap Start to describe the issue by voice");
      loadHistory();
    } else alert("Error submitting. Please try again.");
  } catch (err) { alert("Network error: " + err.message); }
}

// ── Confidence Bar Helper ─────────────────────────────────────────────
function renderConfidenceBar(confidence) {
  const raw = parseFloat(confidence);
  if (isNaN(raw)) return "";
  const pct   = Math.round(raw * 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f97316" : "#dc2626";
  const label = pct >= 80 ? "High" : pct >= 50 ? "Medium" : "Low";
  return `
    <div style="margin:10px 0 4px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:11px;font-weight:800;color:var(--navy);letter-spacing:0.06em;text-transform:uppercase">🎯 Confidence</span>
        <span style="font-size:12px;font-weight:800;color:${color}">${pct}% · ${label}</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:7px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:99px"></div>
      </div>
    </div>`;
}

// ── History ──────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch(`${API}/api/complaints`);
    const data = await res.json();
    const mob  = localStorage.getItem("userMobile");
    const list = data.complaints.filter(c => c.mobile === mob).slice(0, 6);
    const div  = document.getElementById("historyList");

    if (!list.length) { div.innerHTML = '<p class="empty-msg">No complaints submitted yet</p>'; return; }

    const icons = { garbage:"🗑️", water:"💧", road:"🛣️", light:"💡" };
    div.innerHTML = list.map(c => `
      <div class="complaint-card">
        <div class="cc-header">
          <span class="cc-type">${icons[c.problem]||"📋"} ${c.problem.toUpperCase()}</span>
          <span class="status-badge status-${c.status}">${c.status.replace("_"," ")}</span>
        </div>
        <p class="cc-addr">📍 ${(c.address||"").substring(0,90)}…</p>
        <div class="cc-meta">
          <span>📅 ${new Date(c.createdAt).toLocaleDateString()}</span>
          <span class="ptag pt-${c.priority?.toLowerCase()}">🔥 ${c.priority}</span>
        </div>
        ${renderConfidenceBar(c.confidence)}
        ${c.audioUrl ? `<audio controls src="${API}${c.audioUrl}" style="width:100%;margin-top:10px"></audio>` : ""}
      </div>`).join("");
  } catch (e) { console.error(e); }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("photoInput")?.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) { const p = document.getElementById("photoPreview"); p.src = URL.createObjectURL(f); p.style.display = "block"; }
  });
});

window.doLogin = doLogin;
window.selectProblem = selectProblem;
window.getCurrentLocation = getCurrentLocation;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.submitComplaint = submitComplaint;