# 🗺️ HeyPico Maps — AI Local Guide

An AI-powered maps assistant where users find restaurants, cafes, attractions, and more through natural language chat.

**✅ Completely FREE — No Google Maps API key, no credit card, no signup required.**

- 🤖 **Local LLM**: Mistral 7B via Ollama (runs on your machine)
- 🗺️ **Maps**: Leaflet.js + OpenStreetMap + CartoDB dark tiles (free forever)
- 🔍 **Place search**: Nominatim API (OpenStreetMap geocoding, free)
- 🐍 **Backend**: Python FastAPI
- ⚛️ **Frontend**: React 18 + TypeScript + Vite

---

## 🎥 Demo Video



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
│  useAppStore (Zustand)   useChat hook   useGoogleMap   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                     MODEL                               │
│  FastAPI backend  →  Ollama (Mistral)  →  Nominatim    │
└─────────────────────────────────────────────────────────┘
```

### How a query flows:
1. User types: *"Find ramen in Jakarta"*
2. → **FastAPI** receives the message
3. → **Mistral 7B** (via Ollama) extracts structured intent:
   ```json
   { "intent": "place_search", "search_query": "ramen restaurant Jakarta",
     "place_type": "restaurant", "city": "Jakarta" }
   ```
4. → **Nominatim API** searches OpenStreetMap for matching places
5. → Results returned as place list + map center coordinates
6. → **Leaflet map** pins all results with numbered markers
7. → User clicks marker → popup with directions + links

---

## 📂 Project Structure

```
heypico-maps/
├── docker-compose.yml          # Full stack orchestration
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
        ├── main.tsx            # React entry point
        ├── App.tsx             # Root layout (sidebar + map)
        ├── index.css           # Tailwind + Leaflet dark overrides
        ├── types/index.ts      # TypeScript interfaces (Place, ChatMessage…)
        ├── store/
        │   └── appStore.ts     # Zustand ViewModel — global state
        ├── hooks/
        │   ├── useChat.ts      # Chat send logic + state updates
        ├── utils/
        │   └── api.ts          # Axios client + URL helpers
        └── components/
            ├── ChatPanel.tsx   # Scrollable message history
            ├── ChatMessage.tsx # Single message bubble + place cards
            ├── ChatInput.tsx   # Textarea + suggestion chips
            ├── MapView.tsx     # Leaflet map + markers + popups
            └── PlaceCard.tsx   # Individual result card
```

---

## 🚀 How to Run

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- ~6 GB free disk space (for the Mistral model)
- 8 GB RAM recommended

### Step 1 — Clone / Extract the project

```bash
cd heypico-maps
```

### Step 2 — Create environment file

```bash
cp .env.example .env
```

The default `.env` works out of the box — no changes needed!

### Step 3 — Start everything

```bash
docker-compose up --build
```

This automatically:
1. Starts **Ollama** LLM server
2. Downloads **Mistral 7B** model (~4.1 GB — only on first run)
3. Starts **FastAPI** backend on port `8000`
4. Builds and starts **React** frontend on port `3000`

> ⏳ **First run only**: Mistral model download takes 5–15 minutes depending on internet speed.
> You'll see: `✅ Model ready!` in the logs when it's done.

### Step 4 — The model download takes time based on your internet speed, do this step 4 on terminal new tab

```bash
docker logs heypico-ollama-init -f
```

You should see something like:
```
pulling manifest
pulling ff82381e2bea...  23% ██░░░░░░  950 MB / 4.1 GB  2.1 MB/s  25m
```

### Step 5 — Open the app

**http://localhost:3000** 🎉

---

## 💬 Example Queries

| You type | What happens |
|---|---|
| `Find ramen restaurants in Jakarta` | Shows ramen spots on Jakarta map |
| `Coffee shops near Senayan` | Finds cafes in Senayan area |
| `Tourist attractions in Bali` | Maps popular Bali attractions |
| `Hospitals in South Tangerang` | Lists hospitals near you |
| `Rooftop bars in SCBD` | Finds bars in Jakarta's SCBD |
| `What's good to eat nearby?` | General food recommendation chat |

**On the map:**
- Click any **numbered marker** → popup with name, address, hours
- Popup has **Directions** link (opens OpenStreetMap routing)
- Popup has **Google Maps** link (opens Google Maps at that location)
- **Place cards** in chat are also clickable → flies map to location

---

## 🔧 Changing the LLM Model

Edit `.env`:
```env
OLLAMA_MODEL=llama3       # Meta Llama 3 8B
OLLAMA_MODEL=gemma2       # Google Gemma 2 9B
OLLAMA_MODEL=phi3         # Microsoft Phi-3 (faster, smaller)
OLLAMA_MODEL=mistral      # Default — recommended
```

Then restart:
```bash
docker-compose down && docker-compose up --build
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| Map is blank / grey tiles | Check internet — tile CDN needs connection |
| "Ollama not connected" in /health | Wait for model download; check `docker logs heypico-ollama-init` |
| No places found | Try adding city name: *"ramen in Jakarta"* instead of just *"ramen"* |
| Slow first response | Mistral takes ~3–8s for first inference; subsequent calls faster |
| Port 3000 already in use | Change `"3000:80"` to `"3001:80"` in docker-compose.yml |
| Port 8000 already in use | Change `"8000:8000"` to `"8001:8000"` in docker-compose.yml |

### Check service health:
```bash
# Backend health
curl http://localhost:8000/health

# View logs
docker logs heypico-backend
docker logs heypico-ollama
docker logs heypico-frontend
```

---

## 📝 Design Decisions & Assumptions

1. **No Google Maps / No API key**: Replaced with Leaflet.js + OpenStreetMap + Nominatim. Fully free, no credit card, works immediately.

2. **LLM — Mistral 7B**: Best instruction-following and structured JSON output at the 7B parameter scale. Uses Ollama's `format: "json"` mode to guarantee valid JSON every response.

3. **NLP approach — structured prompting**: The system prompt instructs Mistral to always return `{intent, search_query, place_type, city}`. This gives us reliable intent extraction without fine-tuning.

4. **Map tiles — CartoDB Dark**: Beautiful dark theme matching the UI, free CDN, no key needed.

5. **Default location**: Map starts centered on South Tangerang / Jakarta.

6. **MVVM pattern**: Zustand store = ViewModel layer, React components = View layer, FastAPI + Ollama + Nominatim = Model layer.
