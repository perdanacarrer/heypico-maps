# 🗺️ HeyPico Maps — AI Local Guide

An AI-powered maps assistant where users find restaurants, cafes, attractions, and more through natural language chat.

**✅ Completely FREE — No Google Maps API key, no credit card, no signup required.**

- 🤖 **Local LLM**: Phi-3 / Mistral via Ollama (runs on your machine)
- 🗺️ **Maps**: Leaflet.js + OpenStreetMap + CartoDB Voyager tiles (free forever)
- 🔍 **Place search**: Overpass API + Nominatim (OpenStreetMap, free)
- 🐍 **Backend**: Python FastAPI
- ⚛️ **Frontend**: React 18 + TypeScript + Vite

---

## 🎥 Demo Video

<video src="./demo.mp4" controls width="100%"></video>
https://youtu.be/ph8fFv7YpTk

---

## 🏗️ Architecture — MVVM

```
┌─────────────────────────────────────────────────────────┐
│                        VIEW                             │
│  ChatPanel  ChatMessage  PlaceCard  MapView  ChatInput  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    VIEWMODEL                            │
│        useAppStore (Zustand)        useChat hook        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                     MODEL                               │
│  FastAPI backend → Ollama (phi3/mistral) → Overpass API │
└─────────────────────────────────────────────────────────┘
```

### How a query flows:
1. User types: *"Find ramen in Jakarta"*
2. → **FastAPI** receives the message
3. → **Phi-3** (via Ollama) extracts structured intent:
   ```json
   { "intent": "place_search", "search_query": "ramen",
     "place_type": "restaurant", "city": "Jakarta" }
   ```
4. → **Overpass API** searches OpenStreetMap POI database by amenity tags
5. → Results returned as place list + map center coordinates
6. → **Leaflet map** pins all results with numbered markers
7. → User clicks marker → popup with directions + links

---

## 📂 Project Structure

```
heypico-maps/
├── docker-compose.yml          # Backend + frontend orchestration
├── .env.example                # Config template (copy to .env)
├── README.md
│
├── backend/
│   ├── main.py                 # FastAPI app
│   │                           #   /api/chat  — NLP + place search
│   │                           #   /api/geocode — city → lat/lng
│   │                           #   /health    — status check
│   ├── requirements.txt
│   └── Dockerfile
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── nginx.conf              # Reverse proxy /api → backend
    ├── Dockerfile
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── types/index.ts
        ├── store/appStore.ts
        ├── hooks/useChat.ts
        ├── utils/api.ts
        └── components/
            ├── ChatPanel.tsx
            ├── ChatMessage.tsx
            ├── ChatInput.tsx
            ├── MapView.tsx
            └── PlaceCard.tsx
```

---

## 🚀 How to Run

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Ollama](https://ollama.com) installed natively on your machine
- 8 GB RAM recommended (4 GB minimum with phi3)

### Step 1 — Install and start Ollama natively

```bash
# Install Ollama (if not already installed)
brew install ollama

# Start Ollama as a background service
brew services start ollama
```

### Step 2 — Pull a model

**Recommended for 8 GB RAM machines:**
```bash
ollama pull phi3
```

**For 16 GB+ RAM machines (better quality):**
```bash
ollama pull mistral
```

> ⏳ Model download takes 2–10 minutes depending on internet speed.

### Step 3 — Clone / Extract the project

```bash
cd heypico-maps
```

### Step 4 — Create environment file

```bash
cp .env.example .env
```

Edit `.env` to match the model you pulled:
```env
OLLAMA_MODEL=phi3      # or mistral if you pulled mistral
```

### Step 5 — Start the app

```bash
docker-compose up --build
```

This starts:
1. **FastAPI** backend on port `8000` (connects to your native Ollama)
2. **React** frontend on port `3000`

### Step 6 — Open the app

**http://localhost:3000** 🎉

### Verify everything is working:
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok","ollama":"connected","model":"phi3","model_loaded":true,...}`

---

## 💬 Example Queries

| You type | What happens |
|---|---|
| `Find ramen restaurants in Jakarta` | Shows ramen spots on Jakarta map |
| `Coffee shops near Senayan` | Finds cafes in Senayan area |
| `Tourist attractions in Bali` | Maps popular Bali attractions |
| `Hospitals in South Tangerang` | Lists hospitals near you |
| `Rooftop bars in SCBD` | Finds bars in Jakarta's SCBD |
| `What's good to eat nearby?` | Searches restaurants near default location |

**On the map:**
- Click any **numbered marker** → popup with name, address, hours
- Popup has **OSM Directions** link (opens OpenStreetMap routing with your location)
- Popup has **Google Maps** link (opens Google Maps directions)
- **🟢 Locate me** button (bottom-right) → shows your current position
- **Place cards** in chat are clickable → flies map to location

---

## 🔧 Changing the LLM Model

Edit `.env`:
```env
OLLAMA_MODEL=phi3         # Microsoft Phi-3 — 2.3 GB, works on 8 GB RAM ✅
OLLAMA_MODEL=mistral      # Mistral 7B — 4.1 GB, needs 16 GB RAM
OLLAMA_MODEL=tinyllama    # TinyLlama — 637 MB, minimal RAM, basic quality
OLLAMA_MODEL=llama3       # Meta Llama 3 8B — needs 16 GB RAM
```

Pull the model first, then restart backend:
```bash
ollama pull phi3
docker-compose restart backend
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `"ollama":"disconnected"` in /health | Run `brew services start ollama` on your Mac |
| `"model_loaded":false"` in /health | Run `ollama pull phi3` to download the model |
| No places found | Try adding city name: *"ramen in Jakarta"* instead of just *"ramen"* |
| "Sorry, trouble connecting" error | Check `docker logs heypico-backend --tail 20` |
| Slow first response | Model takes ~3–8s for first inference; subsequent calls faster |
| Port 3000 already in use | Change `"3000:80"` to `"3001:80"` in docker-compose.yml |
| Port 8000 already in use | Change `"8000:8000"` to `"8001:8000"` in docker-compose.yml |

### Check service health:
```bash
# Backend health
curl http://localhost:8000/health

# View logs
docker logs heypico-backend
docker logs heypico-frontend

# Check Ollama models
ollama list
ollama ps   # shows currently loaded model
```

---

## 📝 Design Decisions & Assumptions

1. **No Google Maps / No API key**: Replaced with Leaflet.js + OpenStreetMap + Nominatim. Fully free, no credit card, works immediately.

2. **LLM — Phi-3 / Mistral via native Ollama**: Ollama runs natively on macOS for better memory management. Phi-3 (2.3 GB) works on 8 GB machines; Mistral (4.1 GB) recommended for 16 GB+.

3. **Place search — Overpass API**: Switched from Nominatim (geocoder) to Overpass API (OSM's POI search engine) for better restaurant/amenity results. Nominatim used as fallback.

4. **NLP approach — structured prompting**: System prompt instructs the LLM to always return `{intent, search_query, place_type, city}`. Includes fallback keyword parser for when LLM output is malformed.

5. **Map tiles — CartoDB Voyager**: Clean, readable map style that's visible and professional. Free CDN, no key needed.

6. **Default location**: Map starts centered on South Tangerang / Jakarta.

7. **MVVM pattern**: Zustand store = ViewModel layer, React components = View layer, FastAPI + Ollama + Overpass = Model layer.
