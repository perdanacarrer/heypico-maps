# 🗺️ HeyPico Maps — AI-Powered Local Guide

An AI-powered maps assistant that lets users find restaurants, cafes, attractions, and more through natural language chat. Powered by a **local LLM (Mistral via Ollama)** for NLP intent extraction and **Google Maps Platform** for place search and map rendering.

---

## 🏗️ Architecture & Tech Stack

### Architecture: MVVM (Model-View-ViewModel)
| Layer | Location | Purpose |
|---|---|---|
| **Model** | `backend/main.py` | Data fetching (Ollama + Google Maps API), business logic |
| **ViewModel** | `frontend/src/store/`, `frontend/src/hooks/` | State management (Zustand), chat logic, map state |
| **View** | `frontend/src/components/` | React UI components |

### Technologies
| Component | Technology | Why |
|---|---|---|
| **Local LLM** | Mistral 7B via Ollama | Best performance/speed ratio; strong instruction-following; runs fully locally |
| **NLP approach** | Structured JSON prompting | Forces Mistral to emit intent + search_query + place_type as structured output |
| **Backend** | Python FastAPI | Async, fast, automatic OpenAPI docs, easy rate limiting |
| **Frontend** | React 18 + TypeScript + Vite | Type-safe, fast HMR, production builds |
| **State** | Zustand | Lightweight, no boilerplate, works perfectly with MVVM |
| **Maps** | Google Maps JS API + Places API | Industry standard, rich POI data |
| **Rate limiting** | slowapi | Protects Google Maps quota |
| **Containerization** | Docker + Docker Compose | One-command startup |

---

## 📂 Project Structure

```
heypico-maps/
├── docker-compose.yml          # Production orchestration
├── docker-compose.dev.yml      # Dev override (hot reload)
├── .env.example                # Environment template
│
├── backend/
│   ├── main.py                 # FastAPI app — chat, maps, NLP orchestration
│   ├── requirements.txt
│   └── Dockerfile
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── nginx.conf              # Reverse proxy config
    ├── Dockerfile
    └── src/
        ├── main.tsx            # Entry point
        ├── App.tsx             # Root layout (split: chat | map)
        ├── index.css
        ├── types/
        │   └── index.ts        # TypeScript interfaces
        ├── store/
        │   └── appStore.ts     # Zustand ViewModel store
        ├── hooks/
        │   ├── useChat.ts      # Chat ViewModel logic
        │   └── useGoogleMap.ts # Map initialization hook
        ├── utils/
        │   └── api.ts          # Axios API client
        └── components/
            ├── App.tsx         # Split-panel layout
            ├── ChatPanel.tsx   # Chat history container
            ├── ChatMessage.tsx # Single message bubble
            ├── ChatInput.tsx   # Input + suggestion chips
            ├── MapView.tsx     # Google Map container
            └── PlaceCard.tsx   # Individual place result card
```

---

## 🚀 How to Run Locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A Google Maps API key (free tier has generous credits)

### Step 1 — Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Navigate to **APIs & Services → Library**
4. Enable these APIs:
   - ✅ **Maps JavaScript API**
   - ✅ **Places API**
5. Go to **APIs & Services → Credentials → Create Credentials → API Key**
6. (Recommended) Restrict the key:
   - For Maps JS API: restrict to `HTTP referrers` → `http://localhost:3000/*`
   - For Places API (backend): restrict to `IP addresses` → `127.0.0.1`

### Step 2 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your key:
```env
GOOGLE_MAPS_API_KEY=AIza...your_key_here
OLLAMA_MODEL=mistral
```

### Step 3 — Start Everything

```bash
docker-compose up --build
```

This will:
1. Start **Ollama** (local LLM server)
2. Pull **Mistral 7B** model (~4.1GB — takes a few minutes on first run)
3. Start **FastAPI backend** on port 8000
4. Build and start **React frontend** on port 3000

> ⏳ **First run**: The Mistral model download takes 3–10 minutes depending on your internet speed. Subsequent starts are instant.

### Step 4 — Open the App

Visit: **http://localhost:3000**

---

## 💬 Usage Examples

Try asking:
- *"Find me the best ramen restaurants near Senayan"*
- *"Coffee shops open now in SCBD"*
- *"What are some tourist attractions in Jakarta?"*
- *"Rooftop bars with a view"*
- *"Best hospitals near Kemang"*

Each query:
1. Gets sent to **Mistral** (local LLM) for intent extraction
2. LLM returns structured JSON: `{intent, search_query, place_type}`
3. Backend calls **Google Places API** with the extracted query
4. Results appear as **place cards** in chat + **markers on the map**
5. Click any card or marker to see details + links to Google Maps / Directions

---

## 🔒 Security Best Practices

- **API key never exposed in browser network requests** — all Places API calls are server-side only
- **Rate limiting** — 30 requests/minute per IP on chat endpoint
- **Input validation** — message length capped, place_id sanitized
- **CORS** — restricted to configured origins only
- **No API key logging** — keys stripped from logs

---

## 🛠️ Development Mode (Hot Reload)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

- Backend: auto-reloads on `main.py` changes
- Frontend: Vite HMR on `src/` changes → http://localhost:3000

---

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| Map shows "Failed to load" | Check `GOOGLE_MAPS_API_KEY` in `.env`; ensure Maps JS API and Places API are enabled |
| Ollama not responding | Wait for model download to finish; check `docker logs heypico-ollama` |
| Slow first response | Mistral needs ~2–5s for first inference; subsequent calls are faster |
| `429 Too Many Requests` | You've hit the rate limit (30/min); wait a moment |

---

## 📝 Assumptions

1. **Local LLM choice — Mistral 7B**: Chosen for best instruction-following in the 7B class, excellent structured JSON output, and reasonable hardware requirements (8GB RAM minimum). Alternatives configurable via `OLLAMA_MODEL` env var.

2. **Single API key**: The test uses one Google Maps API key for both the Maps JS API (frontend map rendering) and Places API (backend search). In production, you'd use separate restricted keys.

3. **Default location**: Map defaults to Jakarta/South Tangerang as the starting center point.

4. **No persistent chat storage**: Conversations are in-memory per session. A database (PostgreSQL + pgvector) could be added for history.
