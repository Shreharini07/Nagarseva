const express = require("express");
const multer = require("multer");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 4004;

// Paths
const DATA_DIR = path.join(__dirname, "data");
const COMPLAINTS_FILE = path.join(DATA_DIR, "complaints.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(COMPLAINTS_FILE)) fs.writeFileSync(COMPLAINTS_FILE, "[]");
if (!fs.existsSync(ADMINS_FILE)) fs.writeFileSync(ADMINS_FILE, "[]");

const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file)); }
  catch { return []; }
};

const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

let admins = readJSON(ADMINS_FILE);
if (admins.length === 0) {
  admins.push({
    id: uuidv4(),
    adminId: "admin",
    passwordHash: bcrypt.hashSync("admin123", 10)
  });
  writeJSON(ADMINS_FILE, admins);
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("public"));
app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function saveBase64Audio(base64Data) {
  try {
    if (!base64Data) return null;
    const matches = base64Data.match(/^data:audio\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const ext = matches[1];
    const data = matches[2];
    const fileName = `${uuidv4()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    return `/uploads/${fileName}`;
  } catch (err) {
    return null;
  }
}

// ============== API ==============

app.post("/api/complaint", upload.single("photo"), (req, res) => {
  try {
    const { name, mobile, problem, address, latitude, longitude, voiceNote, priority: voicePriority } = req.body;
    const complaints = readJSON(COMPLAINTS_FILE);
    
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    
    let photoUrl = null;
    if (req.file) photoUrl = `/uploads/${req.file.filename}`;
    
    let duplicateCount = 0;
    let isDuplicate = false;
    let parentTicket = null;
    
    for (const c of complaints) {
      if (c.problem === problem && c.status !== "resolved") {
        const distance = calculateDistance(latNum, lonNum, c.latitude, c.longitude);
        if (distance <= 0.05) {
          duplicateCount++;
          if (!isDuplicate) {
            isDuplicate = true;
            parentTicket = c.id;
          }
        }
      }
    }
    
    const priorityMap = { water: "High", light: "High", road: "Medium", garbage: "Low" };
    let priority = voicePriority || priorityMap[problem] || "Medium";
    if (duplicateCount >= 3) priority = "High";
    
    let confidence = 0.5;
    if (req.file) confidence += 0.3;
    if (voiceNote) confidence += 0.2;
    
    const newComplaint = {
      id: uuidv4(),
      name: name || "Anonymous",
      mobile,
      problem,
      address: address || "Location selected on map",
      latitude: latNum,
      longitude: lonNum,
      photoUrl,
      audioUrl: voiceNote ? saveBase64Audio(voiceNote) : null,
      status: "pending",
      priority,
      confidence: confidence.toFixed(2),
      duplicateCount: duplicateCount,
      isDuplicate: isDuplicate,
      parentTicket: parentTicket,
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };
    
    complaints.push(newComplaint);
    writeJSON(COMPLAINTS_FILE, complaints);
    
    res.json({ success: true, priority: newComplaint.priority, isDuplicate: isDuplicate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/complaints", (req, res) => {
  res.json({ complaints: readJSON(COMPLAINTS_FILE) });
});

app.get("/api/complaints/stats", (req, res) => {
  const c = readJSON(COMPLAINTS_FILE);
  res.json({
    total: c.length,
    pending: c.filter(x => x.status === "pending").length,
    in_progress: c.filter(x => x.status === "in_progress").length,
    resolved: c.filter(x => x.status === "resolved").length
  });
});

app.post("/api/admin/login", (req, res) => {
  const { adminId, password } = req.body;
  const admin = readJSON(ADMINS_FILE).find(a => a.adminId === adminId);
  if (!admin) return res.json({ success: false });
  if (!bcrypt.compareSync(password, admin.passwordHash)) return res.json({ success: false });
  res.json({ success: true, token: uuidv4() });
});

app.put("/api/status", (req, res) => {
  let complaints = readJSON(COMPLAINTS_FILE);
  complaints = complaints.map(c => c.id === req.body.id ? { ...c, status: req.body.status } : c);
  writeJSON(COMPLAINTS_FILE, complaints);
  res.json({ success: true });
});

app.delete("/api/complaint/:id", (req, res) => {
  let complaints = readJSON(COMPLAINTS_FILE);
  complaints = complaints.filter(c => c.id !== req.params.id);
  writeJSON(COMPLAINTS_FILE, complaints);
  res.json({ success: true });
});

app.get("/api/analytics/resolution-time", (req, res) => {
  const complaints = readJSON(COMPLAINTS_FILE);
  const resolvedComplaints = complaints.filter(c => c.status === "resolved" && c.resolvedAt);
  const resolutionTimes = { garbage: null, water: null, road: null, light: null };
  ["garbage", "water", "road", "light"].forEach(type => {
    const typeComplaints = resolvedComplaints.filter(c => c.problem === type);
    if (typeComplaints.length > 0) {
      let totalHours = 0;
      typeComplaints.forEach(c => {
        const hours = (new Date(c.resolvedAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
        totalHours += hours;
      });
      resolutionTimes[type] = (totalHours / typeComplaints.length).toFixed(1);
    }
  });
  res.json({ resolutionTimes });
});

app.post("/api/complaints/date-range", (req, res) => {
  const { startDate, endDate } = req.body;
  const complaints = readJSON(COMPLAINTS_FILE);
  const filtered = complaints.filter(c => {
    const complaintDate = c.createdAt.split('T')[0];
    return complaintDate >= startDate && complaintDate <= endDate;
  });
  res.json({ complaints: filtered, count: filtered.length });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`👤 User App: http://localhost:${PORT}`);
  console.log(`👨‍💼 Admin App: http://localhost:${PORT}/admin`);
  console.log(`🔑 Admin Login: admin / admin123\n`);
});