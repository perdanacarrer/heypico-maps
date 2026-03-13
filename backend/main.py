import os
import re
import httpx
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
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

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "mistral")
NOMINATIM_UA    = "HeyPico-Maps-App/1.0 (local-dev)"


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []


OSM_CATEGORY_MAP = {
    "restaurant":         {"amenity": "restaurant"},
    "cafe":               {"amenity": "cafe"},
    "bar":                {"amenity": "bar"},
    "fast_food":          {"amenity": "fast_food"},
    "hotel":              {"tourism": "hotel"},
    "tourist_attraction": {"tourism": "attraction"},
    "museum":             {"tourism": "museum"},
    "park":               {"leisure": "park"},
    "hospital":           {"amenity": "hospital"},
    "pharmacy":           {"amenity": "pharmacy"},
    "gym":                {"leisure": "fitness_centre"},
    "shopping_mall":      {"shop": "mall"},
    "supermarket":        {"shop": "supermarket"},
    "atm":                {"amenity": "atm"},
    "fuel":               {"amenity": "fuel"},
}


# ── Ollama: try /api/chat first, fall back to /api/generate ───────────────────

async def query_ollama(message: str, history: list[dict]) -> dict:
    """
    Try the modern /api/chat endpoint first.
    If that fails with 4xx/5xx, fall back to /api/generate.
    In both cases we do NOT send format:json — pure prompt engineering instead.
    """
    system = (
        "You are a local guide assistant. Always reply with ONLY a raw JSON object, no markdown, no explanation.\n"
        "If the user wants to find places, use:\n"
        '{"intent":"place_search","search_query":"<terms>","place_type":"<restaurant|cafe|bar|fast_food|hotel|tourist_attraction|museum|park|hospital|pharmacy|gym|shopping_mall|supermarket>","city":"<city or null>","user_message":"<friendly reply>"}\n'
        "Otherwise use:\n"
        '{"intent":"general","search_query":null,"place_type":null,"city":null,"user_message":"<reply>"}\n'
        "Output ONLY the JSON object. Nothing else."
    )

    # ── Attempt 1: /api/chat (modern Ollama) ──────────────────────────────────
    messages = [{"role": "system", "content": system}]
    for h in history[-4:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    chat_payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 256},
    }

    content = ""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=chat_payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["message"]["content"]
                logger.info(f"Ollama /api/chat raw: {content[:200]}")
                return _parse_llm_json(content, message)
            else:
                logger.warning(f"/api/chat returned {resp.status_code}, trying /api/generate")
    except Exception as e:
        logger.warning(f"/api/chat exception: {e}, trying /api/generate")

    # ── Attempt 2: /api/generate (older Ollama) ───────────────────────────────
    history_text = ""
    for h in history[-4:]:
        role = "User" if h["role"] == "user" else "Assistant"
        history_text += f"{role}: {h['content']}\n"

    prompt = f"{system}\n\n{history_text}User: {message}\nAssistant:"

    gen_payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 256},
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=gen_payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("response", "")
                logger.info(f"Ollama /api/generate raw: {content[:200]}")
                return _parse_llm_json(content, message)
            else:
                body = resp.text[:300]
                logger.error(f"/api/generate returned {resp.status_code}: {body}")
    except Exception as e:
        logger.error(f"/api/generate exception: {e}")

    return _fallback_parse(message)


def _parse_llm_json(content: str, original_message: str) -> dict:
    """Extract and parse the first JSON object from LLM output."""
    # Strip markdown fences
    content = re.sub(r"```(?:json)?|```", "", content).strip()
    # Extract first { ... }
    match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            # Validate required keys
            if "intent" in parsed and "user_message" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

    # Try full content as JSON
    try:
        parsed = json.loads(content)
        if "intent" in parsed:
            return parsed
    except Exception:
        pass

    logger.warning(f"Could not parse JSON from: {content[:300]}")
    return _fallback_parse(original_message)


def _fallback_parse(message: str) -> dict:
    """
    Simple keyword-based fallback when LLM fails entirely.
    Detects place-search intent from common keywords.
    """
    msg_lower = message.lower()
    place_keywords = [
        "find", "search", "show", "where", "restaurant", "cafe", "coffee",
        "hotel", "hospital", "bar", "eat", "food", "shop", "mall", "museum",
        "park", "attraction", "gym", "pharmacy", "atm", "fuel", "near", "nearby"
    ]
    is_place_search = any(kw in msg_lower for kw in place_keywords)

    if is_place_search:
        # Try to extract a city name (simple heuristic: word after "in" or "near")
        city_match = re.search(r'\b(?:in|near|around)\s+([A-Z][a-zA-Z\s]{2,20})', message)
        city = city_match.group(1).strip() if city_match else None

        return {
            "intent": "place_search",
            "search_query": message,
            "place_type": None,
            "city": city,
            "user_message": f"Let me find that for you! Searching for: {message}",
        }

    return {
        "intent": "general",
        "search_query": None,
        "place_type": None,
        "city": None,
        "user_message": "I'm here to help you find places! Try asking something like 'Find ramen in Jakarta' or 'Coffee shops near Senayan'.",
    }


# ── Nominatim geocoding ────────────────────────────────────────────────────────

async def geocode_city(city: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": city, "format": "json", "limit": 1},
                headers={"User-Agent": NOMINATIM_UA},
            )
            results = resp.json()
            if results:
                return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
    except Exception as e:
        logger.warning(f"Geocode error '{city}': {e}")
    return None


# ── Nominatim place search ─────────────────────────────────────────────────────

async def search_places_nominatim(query: str, place_type: str | None, city: str | None) -> list[dict]:
    search_str = query
    if city and city.lower() not in query.lower():
        search_str = f"{query} in {city}"

    params: dict = {
        "q": search_str,
        "format": "json",
        "limit": 10,
        "addressdetails": 1,
        "extratags": 1,
    }

    if place_type and place_type in OSM_CATEGORY_MAP:
        key, val = next(iter(OSM_CATEGORY_MAP[place_type].items()))
        params[key] = val

    raw = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers={"User-Agent": NOMINATIM_UA},
            )
            raw = resp.json()
    except Exception as e:
        logger.error(f"Nominatim error: {e}")

    # Fallback: plain text without tags
    if not raw and place_type:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": search_str, "format": "json", "limit": 10, "addressdetails": 1},
                    headers={"User-Agent": NOMINATIM_UA},
                )
                raw = resp.json()
        except Exception:
            pass

    results = []
    for r in raw[:8]:
        name = r.get("name") or r.get("display_name", "").split(",")[0]
        if not name:
            continue
        addr = r.get("address", {})
        address = ", ".join(filter(None, [
            addr.get("road") or addr.get("pedestrian"),
            addr.get("suburb") or addr.get("neighbourhood"),
            addr.get("city") or addr.get("town") or addr.get("village"),
            addr.get("country"),
        ])) or r.get("display_name", "")
        ext = r.get("extratags") or {}
        results.append({
            "place_id":      f"osm_{r.get('osm_type','n')[0]}{r.get('osm_id', r.get('place_id'))}",
            "osm_id":        r.get("osm_id"),
            "osm_type":      r.get("osm_type"),
            "name":          name,
            "address":       address,
            "lat":           float(r["lat"]),
            "lng":           float(r["lon"]),
            "type":          r.get("type"),
            "category":      r.get("class"),
            "website":       ext.get("website") or ext.get("url"),
            "phone":         ext.get("phone") or ext.get("contact:phone"),
            "opening_hours": ext.get("opening_hours"),
            "cuisine":       ext.get("cuisine"),
        })
    return results


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    ollama_ok = False
    model_loaded = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if r.status_code == 200:
                ollama_ok = True
                tags = r.json().get("models", [])
                model_loaded = any(OLLAMA_MODEL in m.get("name", "") for m in tags)
    except Exception:
        pass
    return {
        "status": "ok",
        "ollama": "connected" if ollama_ok else "disconnected",
        "model": OLLAMA_MODEL,
        "model_loaded": model_loaded,
        "maps": "OpenStreetMap (no key required)",
    }


@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest):
    if len(body.message) > 500:
        raise HTTPException(status_code=400, detail="Message too long")

    llm_response = await query_ollama(body.message, body.conversation_history)
    logger.info(f"LLM parsed: {llm_response}")

    result = {
        "user_message": llm_response.get("user_message", "How can I help?"),
        "intent":       llm_response.get("intent", "general"),
        "places":       [],
        "map_center":   None,
        "search_query": None,
    }

    if llm_response.get("intent") == "place_search" and llm_response.get("search_query"):
        query  = llm_response["search_query"]
        city   = llm_response.get("city")
        ptype  = llm_response.get("place_type")
        result["search_query"] = query

        places = await search_places_nominatim(query, ptype, city)
        result["places"] = places

        if places:
            result["map_center"] = {"lat": places[0]["lat"], "lng": places[0]["lng"]}
        elif city:
            geo = await geocode_city(city)
            if geo:
                result["map_center"] = geo

    return result


@app.get("/api/geocode")
@limiter.limit("20/minute")
async def geocode(request: Request, q: str):
    result = await geocode_city(q)
    if not result:
        raise HTTPException(status_code=404, detail="Location not found")
    return result
