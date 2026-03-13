import os
import re
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="HeyPico Maps API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []


class PlaceSearchRequest(BaseModel):
    query: str
    location: dict | None = None  # {lat, lng}
    radius: int = 5000


# ── NLP via Ollama ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a helpful local guide assistant. Your job is to help users find places to go, eat, visit, and explore.

When a user asks about places, you MUST respond with a JSON object (and nothing else) in this exact format:
{
  "intent": "place_search",
  "search_query": "<specific search terms for Google Maps>",
  "place_type": "<one of: restaurant, cafe, bar, hotel, tourist_attraction, shopping_mall, park, museum, hospital, pharmacy, gym>",
  "user_message": "<friendly conversational response to the user>",
  "location_bias": null
}

If the user's message is NOT about finding places (e.g. general chat, greetings), respond with:
{
  "intent": "general",
  "search_query": null,
  "place_type": null,
  "user_message": "<your helpful response>",
  "location_bias": null
}

Always return valid JSON. No markdown, no code blocks, just raw JSON."""


async def query_ollama(message: str, history: list[dict]) -> dict:
    """Query local Ollama LLM and parse structured response."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history (last 6 turns)
    for h in history[-6:]:
        messages.append(h)

    messages.append({"role": "user", "content": message})

    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["message"]["content"]

            # Parse JSON from LLM response
            import json
            # Strip markdown code blocks if present
            content = re.sub(r"```(?:json)?", "", content).strip()
            parsed = json.loads(content)
            return parsed
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        return {
            "intent": "general",
            "search_query": None,
            "place_type": None,
            "user_message": "I'm having trouble connecting to the AI model. Please try again.",
            "location_bias": None
        }


# ── Google Maps helpers ────────────────────────────────────────────────────────

async def search_places(query: str, place_type: str | None, location: dict | None, radius: int = 5000):
    """Search Google Places API with security best practices."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    params = {
        "query": query,
        "key": GOOGLE_MAPS_API_KEY,
    }

    if location:
        params["location"] = f"{location['lat']},{location['lng']}"
        params["radius"] = radius

    if place_type:
        params["type"] = place_type

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params=params
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.error(f"Places API error: {data.get('status')} - {data.get('error_message')}")
        raise HTTPException(status_code=502, detail="Google Places API error")

    results = data.get("results", [])[:8]  # Limit to 8 results

    places = []
    for r in results:
        place = {
            "place_id": r.get("place_id"),
            "name": r.get("name"),
            "address": r.get("formatted_address"),
            "rating": r.get("rating"),
            "user_ratings_total": r.get("user_ratings_total"),
            "types": r.get("types", [])[:3],
            "lat": r["geometry"]["location"]["lat"],
            "lng": r["geometry"]["location"]["lng"],
            "open_now": r.get("opening_hours", {}).get("open_now"),
            "price_level": r.get("price_level"),
            "photo_reference": (
                r["photos"][0]["photo_reference"]
                if r.get("photos") else None
            ),
        }
        places.append(place)

    return places


async def get_place_details(place_id: str):
    """Get detailed info for a specific place."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,website,opening_hours,rating,review,geometry,url",
        "key": GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params=params
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK":
        raise HTTPException(status_code=404, detail="Place not found")

    return data.get("result", {})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        pass

    return {
        "status": "ok",
        "ollama": "connected" if ollama_ok else "disconnected",
        "model": OLLAMA_MODEL,
        "maps_configured": bool(GOOGLE_MAPS_API_KEY),
    }


@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest):
    """Main chat endpoint: NLP → intent extraction → Maps search."""
    if len(body.message) > 500:
        raise HTTPException(status_code=400, detail="Message too long")

    # Get NLP response from local LLM
    llm_response = await query_ollama(body.message, body.conversation_history)

    result = {
        "user_message": llm_response.get("user_message", "I'm here to help!"),
        "intent": llm_response.get("intent", "general"),
        "places": [],
        "map_center": None,
        "search_query": None,
    }

    # If intent is place_search, call Google Maps
    if llm_response.get("intent") == "place_search" and llm_response.get("search_query"):
        query = llm_response["search_query"]
        result["search_query"] = query

        places = await search_places(
            query=query,
            place_type=llm_response.get("place_type"),
            location=llm_response.get("location_bias"),
        )

        result["places"] = places

        if places:
            # Center map on first result
            result["map_center"] = {"lat": places[0]["lat"], "lng": places[0]["lng"]}

    return result


@app.get("/api/place/{place_id}")
@limiter.limit("20/minute")
async def place_detail(request: Request, place_id: str):
    """Get details for a specific place."""
    if not re.match(r'^[A-Za-z0-9_\-]+$', place_id):
        raise HTTPException(status_code=400, detail="Invalid place_id")

    details = await get_place_details(place_id)
    return details


@app.get("/api/maps-key")
async def get_maps_key():
    """Safely expose Maps API key for frontend map rendering only."""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Maps API key not configured")
    return {"key": GOOGLE_MAPS_API_KEY}
