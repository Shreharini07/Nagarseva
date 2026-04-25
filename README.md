# 📚 **NAGARSEVA - README FILE**

```markdown
# 🏛️ NAGARSEVA - Civic Complaint Management System

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 About

**NagarSeva** (நகர சேவை) is a civic complaint management system with **AI-powered voice recognition**, **geospatial duplicate detection**, and **real-time analytics**.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎤 **Voice-to-Text** | Speech recognition with Tamil support |
| 🔥 **Priority Detection** | Auto-detects urgency from voice (High/Medium/Low) |
| 📍 **GPS Location** | Auto-fetch current location or click on map |
| 🔄 **Duplicate Detection** | Finds similar complaints within 50m radius |
| 📊 **Analytics Dashboard** | Pie charts, resolution times, trends |
| 📄 **PDF Reports** | Export complaint reports |
| 👨‍💼 **Admin Panel** | Full CRUD operations with filters |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

### 3. Open Browser
| App | URL | Login |
|-----|-----|-------|
| **User** | `http://localhost:4004` | Any name + 10-digit mobile |
| **Admin** | `http://localhost:4004/admin` | `admin` / `admin123` |

---

## 📁 Project Structure

```
nagarseva/
├── server.js              # Backend API
├── package.json           # Dependencies
├── public/
│   ├── index.html        # User app
│   ├── admin.html        # Admin dashboard
│   ├── app.js            # User logic
│   ├── admin.js          # Admin logic
│   └── style.css         # Styles
├── data/                 # JSON storage (auto-created)
└── uploads/              # Images & audio (auto-created)
```

---

## 🎮 How to Use

### 👤 User Mode
1. **Login** → Enter Name + Mobile
2. **Select Problem** → Garbage/Water/Road/Light
3. **Pick Location** → Click "Use My Current Location" OR tap on map
4. **Add Photo** (Optional)
5. **Record Voice** → Speak to set priority
   - Say "urgent" → 🔴 High Priority
   - Say "problem" → 🟠 Medium Priority
6. **Submit** → Complaint registered

### 👨‍💼 Admin Mode
1. **Login** → `admin` / `admin123`
2. **View Stats** → Total, Pending, Resolved counts
3. **Analytics** → Pie chart + Resolution times
4. **Filter** → By date range, mobile, problem, status
5. **Manage** → Update status or delete complaints
6. **Export** → Download PDF reports

---

## 🛠️ Built With

| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | Backend REST API |
| **Leaflet.js** | Interactive maps |
| **WebkitSpeechRecognition** | Voice-to-text |
| **Chart.js** | Analytics charts |
| **jsPDF** | PDF generation |
| **Haversine Formula** | Distance calculation |
| **bcryptjs** | Password hashing |
| **Multer** | File uploads |

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/complaint` | Submit complaint (with file upload) |
| `GET` | `/api/complaints` | Get all complaints |
| `GET` | `/api/complaints/stats` | Get statistics |
| `POST` | `/api/admin/login` | Admin authentication |
| `PUT` | `/api/status` | Update complaint status |
| `DELETE` | `/api/complaint/:id` | Delete complaint |
| `GET` | `/api/analytics/resolution-time` | Get resolution stats |
| `POST` | `/api/complaints/date-range` | Filter by date |

---

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| **Location not working** | Allow browser permission (lock icon → Allow Location) |
| **Voice not working** | Allow microphone permission; use Chrome/Edge |
| **Port 4004 in use** | Run `npx kill-port 4004` then `npm start` |
| **Login failed** | Use `admin` / `admin123` |

---

## 📝 Environment Variables

No environment variables required. Default configuration:
- **Port:** `4004`
- **API URL:** `http://localhost:4004`

---

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- OpenStreetMap for map tiles
- Leaflet.js for mapping library
- Chart.js for analytics

---

## 📧 Contact

**Project Link:** [http://localhost:4004](http://localhost:4004)

## 🚀 **One Command Setup**

After creating all files, run:

```bash
npm install && npm start
```

Then open `http://localhost:4004` 🎉
