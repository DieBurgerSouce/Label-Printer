# 📦 Screenshot Algo - DEPLOYMENT GUIDE

## 🎯 Package Contents

This deployment package contains a **complete, ready-to-run** Screenshot Algo system with:

- ✅ **1363 pre-loaded articles**
- ✅ Complete source code (Frontend + Backend)
- ✅ Docker configuration
- ✅ Automated installation scripts
- ✅ Tier quantities CSV for updates

## 📊 Pre-loaded Article Statistics

| Category | Count | Description |
|----------|-------|-------------|
| **FROM_EXCEL** | 1039 | Articles from your Excel import |
| **SHOP_ONLY** | 324 | Articles only from shop crawl |
| **NEEDS_TIER_QUANTITIES** | 236 | Articles needing tier quantity updates |
| **TOTAL** | **1363** | All articles ready to use |

## 🚀 Quick Start Installation

### Prerequisites

1. **Windows 10/11** (64-bit)
2. **Docker Desktop** installed and running
3. **Node.js 18+** (for running scripts)
4. **8GB RAM minimum** (16GB recommended)
5. **10GB free disk space**

### Installation Steps

1. **Extract the ZIP file** to your desired location (e.g., `C:\Screenshot_Algo`)

2. **Run the automated installer:**
   ```cmd
   FRESH_INSTALL.bat
   ```
   This will:
   - Set up Docker containers
   - Initialize the database
   - Import all 1363 articles
   - Configure the system

3. **Wait for completion** (approximately 5-10 minutes)

4. **Access the system:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📁 Directory Structure

```
Screenshot_Algo/
├── backend/               # Backend API server
│   ├── src/              # Source code
│   ├── prisma/           # Database schema
│   └── data/             # Data storage
├── frontend/             # React frontend
│   └── src/              # Source code
├── data/                 # Pre-loaded data
│   ├── articles-export.json       # 1363 articles
│   ├── nachpflege-staffelmengen.csv  # Tier quantities
│   └── export-summary.json        # Statistics
├── scripts/              # Utility scripts
│   ├── import-articles-fresh.js   # Article importer
│   └── update-tier-quantities.js  # Tier updater
├── docker-compose.yml    # Docker configuration
├── FRESH_INSTALL.bat    # Automated installer
├── START.bat            # Start system
├── STOP.bat             # Stop system
└── UPDATE.bat           # Update system
```

## 🔧 Manual Installation (if automated fails)

1. **Set up environment:**
   ```cmd
   copy .env.example .env
   ```

2. **Start Docker containers:**
   ```cmd
   docker-compose up -d
   ```

3. **Install dependencies:**
   ```cmd
   cd backend
   npm install
   cd ../frontend
   npm install
   cd ..
   ```

4. **Import articles:**
   ```cmd
   node scripts\import-articles-fresh.js
   ```

## 💡 Daily Operations

### Starting the System
```cmd
START.bat
```

### Stopping the System
```cmd
STOP.bat
```

### Updating Dependencies
```cmd
UPDATE.bat
```

## 📝 Tier Quantities Update

236 articles need tier quantity information. To update:

1. Open `data\nachpflege-staffelmengen.csv` in Excel
2. Fill in the missing "Menge2", "Menge3", "Menge4" columns
3. Save the file
4. Import updates via API or database

Example CSV format:
```csv
Artikelnummer,Name,Preis1,Preis2,Preis3,Preis4,Menge2,Menge3,Menge4
1003,Abfallsammler,83.70,78.39,78.39,78.39,[ENTER],,[ENTER],[ENTER]
```

## 🔍 System Verification

After installation, verify the system:

1. **Check Docker containers:**
   ```cmd
   docker ps
   ```
   Should show:
   - screenshot_algo_backend
   - screenshot_algo_frontend
   - screenshot_algo_db

2. **Check article count:**
   - Open http://localhost:5173
   - Navigate to Articles page
   - Should show 1363 articles

3. **Test API:**
   ```cmd
   curl http://localhost:3001/api/articles?limit=1
   ```

## ⚠️ Troubleshooting

### Docker not starting
- Ensure Docker Desktop is running
- Check Windows Hyper-V is enabled
- Restart Docker Desktop

### Port conflicts
- Frontend uses port 5173
- Backend uses port 3001
- Database uses port 5433
- Change in docker-compose.yml if needed

### Articles not importing
- Check backend is running: http://localhost:3001
- Re-run: `node scripts\import-articles-fresh.js`
- Check logs: `docker logs screenshot_algo_backend`

### Database connection issues
- Ensure PostgreSQL container is running
- Check .env file has correct DATABASE_URL
- Restart containers: `docker-compose restart`

## 📞 Support Information

- **System Version:** 1.0.0
- **Export Date:** See data/export-summary.json
- **Total Articles:** 1363
- **Categories:** FROM_EXCEL, SHOP_ONLY, NEEDS_TIER_QUANTITIES

## 🔐 Security Notes

1. Change default passwords in .env file
2. Don't expose ports to internet without proper security
3. Regular backups recommended
4. Keep Docker and dependencies updated

## 📈 Performance Tips

- Allocate at least 4GB RAM to Docker
- Use SSD for better performance
- Close unnecessary applications during import
- Enable Docker WSL2 backend on Windows

## ✅ Post-Installation Checklist

- [ ] System accessible at http://localhost:5173
- [ ] All 1363 articles imported
- [ ] Can create new labels
- [ ] Can search/filter articles
- [ ] Print templates working
- [ ] WebSocket connection active

---

**Package Created:** November 2025
**Articles Included:** 1363
**Ready for Production Use**