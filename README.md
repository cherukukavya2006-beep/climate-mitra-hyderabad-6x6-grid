# Climate Mitra

Climate Mitra is a complete, professional, dynamic Climate Prediction + Weather + Agriculture + AI Voice Assistant website.

## Architecture
- **Backend:** Python 3.7+ (Flask)
- **Frontend:** HTML5, CSS3, JS, Bootstrap 5
- **AI/Voice:** Sarvam AI, OpenAI
- **Database:** MongoDB
- **Weather API:** Open-Meteo

## Installation

### Prerequisites
- Python 3.7+
- MongoDB

### Setup

```bash
# Clone the repository
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Copy .env.example to .env and configure your keys
cp .env.example .env

# Run the backend (which also serves the frontend on port 3000)
python backend/app.py
```

## Features
- 🌦️ Live Weather Dashboard
- 🌱 Smart Agriculture Advisory
- 🤖 AI Assistant (English & Telugu)
- 📞 Sarvam AI Voice Calling
- 📈 Climate Trends & Predictions

## Current Stack (Node / React)

- **Frontend:** React 19 + Vite + Tailwind (`src/`)
- **Backend:** Express API (`server/app.ts`) — weather (Open-Meteo), 6×6 Hyderabad grid, farming advisory, Gemini AI assistant
- **Local server:** `server.ts` (Vite dev middleware + API on port 3000)
- **Vercel:** `api/index.ts` serves the same Express app as a serverless function; `vercel.json` routes `/api/*` to it and everything else to the SPA

### Local development

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev            # http://localhost:3000
```

Production build locally: `npm run build && NODE_ENV=production npm start`.

### Deploying to Vercel

1. Import the repository in Vercel (settings come from `vercel.json`: framework Vite, build `npm run build:client`, output `dist`).
2. In **Project Settings → Environment Variables**, add `GEMINI_API_KEY` (optionally `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`) for Production and Preview, then redeploy.
3. Verify: `https://<your-app>.vercel.app/api/health` should return `{"status":"ok"}`.

API routes: `GET /api/health`, `GET /api/weather/current?city=`, `GET /api/weather/grid`, `POST /api/farming/analyze`, `POST /api/ai/ask`.
