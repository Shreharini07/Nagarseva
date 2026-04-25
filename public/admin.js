const API = "http://localhost:4004";

let adminMap = null;
let mapMarkers = [];
let pieChart = null;
let allComplaints = [];

// ── Admin Login ───────────────────────────────────────────────────────
async function doAdminLogin() {
  const adminId  = document.getElementById("adminIdInput").value.trim();
  const password = document.getElementById("adminPassInput").value;
  const errDiv   = document.getElementById("loginError");

  if (!adminId || !password) { showLoginError("Please enter both Admin ID and password"); return; }

  try {
    const res  = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, password })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("adminLoginScreen").classList.remove("active");
      document.getElementById("adminDashboard").classList.add("active");
      document.getElementById("adminHeaderRight").style.display = "flex";
      document.getElementById("adminInitial").textContent   = adminId[0].toUpperCase();
      document.getElementById("adminNameLabel").textContent = adminId;

      setTimeout(() => {
        initAdminMap();
        loadAll();
      }, 200);
    } else {
      showLoginError("Invalid credentials. Try admin / admin123");
    }
  } catch (err) {
    showLoginError("Login failed: " + err.message);
  }
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = "⚠️ " + msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

// ── Map Init ──────────────────────────────────────────────────────────
function initAdminMap() {
  if (adminMap) return;
  adminMap = L.map("adminMap").setView([20.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(adminMap);
}

// ── Load Everything ───────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadStats(), fetchAndRender()]);
  loadResolutionTimes();
}

async function fetchAndRender() {
  try {
    const res  = await fetch(`${API}/api/complaints`);
    const data = await res.json();
    allComplaints = data.complaints || [];
    renderComplaintList(allComplaints);
    renderMapMarkers(allComplaints);
    // PIE CHART FIX: always destroy old chart before creating new one
    renderPieChart(allComplaints);
  } catch (err) { console.error("fetchAndRender:", err); }
}

// ── Pie Chart (FIXED) ─────────────────────────────────────────────────
// Bug was: canvas element not found OR chart not destroyed before recreate.
// Fix: use getElementById with null-check, always destroy, set explicit size.
function renderPieChart(complaints) {
  const canvas = document.getElementById("complaintPieChart");
  if (!canvas) return;

  const counts = {
    garbage: complaints.filter(c => c.problem === "garbage").length,
    water:   complaints.filter(c => c.problem === "water").length,
    road:    complaints.filter(c => c.problem === "road").length,
    light:   complaints.filter(c => c.problem === "light").length,
  };

  const total = counts.garbage + counts.water + counts.road + counts.light;

  // If no data, show message instead
  if (total === 0) {
    canvas.style.display = "none";
    const parent = canvas.parentElement;
    if (!parent.querySelector(".no-data-msg")) {
      const msg = document.createElement("p");
      msg.className = "empty-msg no-data-msg";
      msg.textContent = "No complaints yet";
      parent.appendChild(msg);
    }
    return;
  }

  // Remove "no data" message if present
  const noData = canvas.parentElement.querySelector(".no-data-msg");
  if (noData) noData.remove();
  canvas.style.display = "block";

  // Destroy previous chart instance to avoid "Canvas already in use" error
  if (pieChart) {
    pieChart.destroy();
    pieChart = null;
  }

  pieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["🗑️ Garbage", "💧 Water", "🛣️ Road", "💡 Light"],
      datasets: [{
        data: [counts.garbage, counts.water, counts.road, counts.light],
        backgroundColor: ["#16a34a", "#2563eb", "#f97316", "#ca8a04"],
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: "700", size: 12 },
            padding: 14,
            color: "#1e293b"
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const pct = total > 0 ? Math.round(val / total * 100) : 0;
              return ` ${ctx.label.replace(/^[^\s]+\s/, "")}: ${val} (${pct}%)`;
            }
          }
        }
      },
      cutout: "55%"
    }
  });
}

// ── Stats ─────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res   = await fetch(`${API}/api/complaints/stats`);
    const stats = await res.json();
    document.getElementById("sTotalNum").textContent    = stats.total;
    document.getElementById("sPendingNum").textContent  = stats.pending;
    document.getElementById("sProgressNum").textContent = stats.in_progress;
    document.getElementById("sResolvedNum").textContent = stats.resolved;
  } catch (e) { console.error(e); }
}

// ── Map Markers ───────────────────────────────────────────────────────
function renderMapMarkers(complaints) {
  if (!adminMap) return;
  mapMarkers.forEach(m => adminMap.removeLayer(m));
  mapMarkers = [];

  const colorMap = { garbage:"#dc2626", water:"#2563eb", road:"#f97316", light:"#ca8a04" };

  complaints.forEach(c => {
    if (!c.latitude || !c.longitude) return;
    const color  = c.duplicateCount >= 3 ? "#7f1d1d" : (colorMap[c.problem] || "#64748b");
    const radius = c.duplicateCount >= 3 ? 13 : 9;

    const m = L.circleMarker([c.latitude, c.longitude], {
      radius, color, fillColor: color, fillOpacity: 0.75, weight: 2
    }).addTo(adminMap);

    m.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:180px">
        <strong style="font-size:14px;color:#1e3a5f">${c.problem.toUpperCase()}</strong><br>
        <span style="font-size:12px;color:#64748b">${(c.address||"").substring(0,70)}</span><br><br>
        <b>Status:</b> ${c.status} &nbsp; <b>Priority:</b> ${c.priority}<br>
        ${c.duplicateCount >= 2 ? `<span style="color:#dc2626;font-weight:700">⚠️ Reported ${c.duplicateCount+1} times</span>` : ""}
      </div>
    `);
    mapMarkers.push(m);
  });
}

// ── Confidence Bar Helper ─────────────────────────────────────────────
function renderConfidenceBar(confidence) {
  const raw = parseFloat(confidence);
  if (isNaN(raw)) return "";
  const pct   = Math.round(raw * 100);
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#f97316" : "#dc2626";
  const label = pct >= 80 ? "High" : pct >= 50 ? "Medium" : "Low";
  return `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <span style="font-size:11px;font-weight:800;color:var(--navy);letter-spacing:0.06em;text-transform:uppercase">🎯 Confidence Score</span>
        <span style="font-size:12px;font-weight:800;color:${color}">${pct}% · ${label}</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.6s ease"></div>
      </div>
    </div>`;
}

// ── Complaint List ────────────────────────────────────────────────────
function renderComplaintList(complaints) {
  const div = document.getElementById("adminComplaintList");
  if (!complaints.length) {
    div.innerHTML = '<p class="empty-msg">No complaints found</p>';
    return;
  }

  // Group by mobile+problem to surface duplicates
  const grouped = {};
  complaints.forEach(c => {
    const key = c.mobile + "_" + c.problem;
    if (!grouped[key]) grouped[key] = { ...c, dupCount: 1 };
    else grouped[key].dupCount++;
  });

  const list = Object.values(grouped).sort((a, b) => b.dupCount - a.dupCount);
  const icons = { garbage:"🗑️", water:"💧", road:"🛣️", light:"💡" };

  div.innerHTML = list.map(c => `
    <div class="complaint-card ${c.priority === "High" ? "high-alert" : ""}">
      <div class="cc-header">
        <span class="cc-type">${icons[c.problem]||"📋"} ${c.problem.toUpperCase()}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="ptag pt-${c.priority?.toLowerCase()}">${c.priority}</span>
          <span class="status-badge status-${c.status}">${c.status.replace("_"," ")}</span>
        </div>
      </div>
      <p style="font-size:13px;margin:6px 0"><strong>👤</strong> ${c.name} · ${c.mobile}</p>
      <p class="cc-addr">📍 ${(c.address||"").substring(0,100)}</p>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">📅 ${new Date(c.createdAt).toLocaleString()}</p>
      ${renderConfidenceBar(c.confidence)}
      ${c.dupCount > 1 ? `<div style="background:#fff7ed;border-left:3px solid #f97316;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700;color:#c2410c;margin-bottom:10px">⚠️ ${c.dupCount} citizens reported this same issue</div>` : ""}
      ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="max-width:160px;border-radius:10px;margin-bottom:10px;display:block">` : ""}
      ${c.audioUrl ? `<audio controls src="${API}${c.audioUrl}" style="width:100%;margin-bottom:10px"></audio>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="updateStatus('${c.id}','pending')">⏳ Pending</button>
        <button class="btn btn-primary btn-sm" onclick="updateStatus('${c.id}','in_progress')">🔧 In Progress</button>
        <button class="btn btn-green btn-sm"   onclick="updateStatus('${c.id}','resolved')">✅ Resolved</button>
        <button class="btn btn-red btn-sm"     onclick="deleteComplaint('${c.id}')">🗑️ Delete</button>
      </div>
    </div>
  `).join("");
}

// ── Status & Delete ───────────────────────────────────────────────────
async function updateStatus(id, status) {
  await fetch(`${API}/api/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status })
  });
  loadAll();
}

async function deleteComplaint(id) {
  if (!confirm("Delete this complaint?")) return;
  await fetch(`${API}/api/complaint/${id}`, { method: "DELETE" });
  loadAll();
}

// ── Filters ───────────────────────────────────────────────────────────
function applyFilters() {
  const mob    = document.getElementById("filterMobile").value;
  const prob   = document.getElementById("filterProblem").value;
  const status = document.getElementById("filterStatus").value;

  let filtered = allComplaints;
  if (mob)    filtered = filtered.filter(c => c.mobile.includes(mob));
  if (prob)   filtered = filtered.filter(c => c.problem === prob);
  if (status) filtered = filtered.filter(c => c.status  === status);

  renderComplaintList(filtered);
  renderMapMarkers(filtered);
  renderPieChart(filtered);
}

function clearFilters() {
  document.getElementById("filterMobile").value  = "";
  document.getElementById("filterProblem").value = "";
  document.getElementById("filterStatus").value  = "";
  renderComplaintList(allComplaints);
  renderMapMarkers(allComplaints);
  renderPieChart(allComplaints);
}

// ── Resolution Times ──────────────────────────────────────────────────
async function loadResolutionTimes() {
  try {
    const res  = await fetch(`${API}/api/analytics/resolution-time`);
    const data = await res.json();
    const rt   = data.resolutionTimes;
    const colors = { garbage:"#16a34a", water:"#2563eb", road:"#f97316", light:"#ca8a04" };

    document.getElementById("resolutionTimes").innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${["garbage","water","road","light"].map(type => `
          <div class="resolution-card" style="background:${colors[type]}">
            <div>${{garbage:"🗑️ Garbage",water:"💧 Water",road:"🛣️ Road",light:"💡 Light"}[type]}</div>
            <div class="resolution-time">${rt[type] ? rt[type]+"h" : "N/A"}</div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (e) { console.error(e); }
}

// ── Date Filter ───────────────────────────────────────────────────────
async function filterByDate() {
  const start = document.getElementById("startDate").value;
  const end   = document.getElementById("endDate").value;
  if (!start || !end) { alert("Select both start and end dates"); return; }

  const res  = await fetch(`${API}/api/complaints/date-range`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: start, endDate: end })
  });
  const data = await res.json();
  renderComplaintList(data.complaints);
  renderMapMarkers(data.complaints);
  renderPieChart(data.complaints);
  document.getElementById("filterResult").textContent = `✅ ${data.count} complaints from ${start} to ${end}`;
}

function clearDateFilter() {
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value   = "";
  document.getElementById("filterResult").textContent = "";
  renderComplaintList(allComplaints);
  renderMapMarkers(allComplaints);
  renderPieChart(allComplaints);
}

// ── PDF ───────────────────────────────────────────────────────────────
async function downloadPDFReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let data = allComplaints;

  const start = document.getElementById("startDate").value;
  const end   = document.getElementById("endDate").value;
  if (start && end) {
    const res = await fetch(`${API}/api/complaints/date-range`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end })
    });
    const r = await res.json(); data = r.complaints;
  }

  const total       = data.length;
  const pending     = data.filter(c => c.status === "pending").length;
  const resolved    = data.filter(c => c.status === "resolved").length;
  const highPri     = data.filter(c => c.priority === "High").length;
  const counts      = { garbage:0, water:0, road:0, light:0 };
  data.forEach(c => { if (counts[c.problem] !== undefined) counts[c.problem]++; });

  doc.setFontSize(20); doc.setTextColor(30,58,95);
  doc.text("NagarSeva Complaint Report", 20, 22);
  doc.setFontSize(10); doc.setTextColor(100,116,139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 32);
  if (start && end) doc.text(`Period: ${start} → ${end}`, 20, 40);

  doc.setFontSize(13); doc.setTextColor(30,58,95);
  doc.text("Summary", 20, 54);
  doc.setFontSize(11); doc.setTextColor(30,41,59);
  const lines = [
    `Total: ${total}`,`Pending: ${pending}`,`Resolved: ${resolved}`,`High Priority: ${highPri}`,
    `Garbage: ${counts.garbage}  Water: ${counts.water}  Road: ${counts.road}  Light: ${counts.light}`
  ];
  lines.forEach((l, i) => doc.text("• " + l, 20, 64 + i * 9));

  doc.setFontSize(13); doc.setTextColor(30,58,95);
  doc.text("Recent Complaints (top 10)", 20, 118);
  doc.setFontSize(9); doc.setTextColor(30,41,59);
  let y = 128;
  data.slice(0, 10).forEach((c, i) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`${i+1}. ${c.problem} — ${c.status} (${c.priority}) — ${new Date(c.createdAt).toLocaleDateString()}`, 20, y);
    y += 9;
  });

  doc.save(`nagarseva_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ── Tab Switching ─────────────────────────────────────────────────────
function showAdminTab(tab, btn) {
  document.getElementById("mapView").style.display  = tab === "mapView"  ? "block" : "none";
  document.getElementById("listView").style.display = tab === "listView" ? "block" : "none";
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (tab === "mapView" && adminMap) setTimeout(() => adminMap.invalidateSize(), 200);
}

function adminLogout() { location.reload(); }

// ── Auto-refresh every 30s ────────────────────────────────────────────
setInterval(() => {
  if (document.getElementById("adminDashboard")?.classList.contains("active")) loadAll();
}, 30000);

// Expose to HTML onclick
window.doAdminLogin    = doAdminLogin;
window.showAdminTab    = showAdminTab;
window.filterByDate    = filterByDate;
window.clearDateFilter = clearDateFilter;
window.downloadPDFReport = downloadPDFReport;
window.applyFilters    = applyFilters;
window.clearFilters    = clearFilters;
window.updateStatus    = updateStatus;
window.deleteComplaint = deleteComplaint;
window.adminLogout     = adminLogout;