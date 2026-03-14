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

    # Find the first complete JSON object (handles phi3 that keeps talking after })
    # Try increasingly greedy matches
    for pattern in [
        r'\{[^{}]*\}',           # simple single-level
        r'\{(?:[^{}]|\{[^{}]*\})*\}',  # nested one level
    ]:
        for match in re.finditer(pattern, content, re.DOTALL):
            try:
                parsed = json.loads(match.group(0))
                if "intent" in parsed:
                    parsed = _normalize_llm_fields(parsed, original_message)
                    return parsed
            except json.JSONDecodeError:
                continue

    # Try truncating at first } and parsing
    brace_start = content.find('{')
    brace_end = content.find('}')
    if brace_start != -1 and brace_end != -1:
        candidate = content[brace_start:brace_end+1]
        # Fill in missing closing fields if phi3 cut off mid-json
        try:
            parsed = json.loads(candidate)
            if "intent" in parsed:
                parsed = _normalize_llm_fields(parsed, original_message)
                return parsed
        except Exception:
            pass

    # Try full content as JSON
    try:
        parsed = json.loads(content)
        if "intent" in parsed:
            parsed = _normalize_llm_fields(parsed, original_message)
            return parsed
    except Exception:
        pass

    logger.warning(f"Could not parse JSON from: {content[:300]}")
    return _fallback_parse(original_message)


def _normalize_llm_fields(parsed: dict, original_message: str) -> dict:
    """Normalize field name variations from different LLM models."""
    # city field variations
    if "city" not in parsed:
        for alt in ["location", "destination", "destinations", "place", "area", "region"]:
            val = parsed.get(alt)
            if val:
                parsed["city"] = val[0] if isinstance(val, list) else val
                break

    # search_query variations
    if "search_query" not in parsed:
        for alt in ["query", "search", "term", "keyword"]:
            val = parsed.get(alt)
            if val:
                parsed["search_query"] = val
                break

    # user_message fallback
    if "user_message" not in parsed:
        sq = parsed.get("search_query", original_message)
        parsed["user_message"] = f"Let me find that for you! Searching for: {sq}"

    return parsed


def _fallback_parse(message: str) -> dict:
    """
    Keyword-based fallback when LLM fails. Normalizes vague queries into
    clean search terms instead of passing raw natural language to Nominatim.
    """
    msg_lower = message.lower()

    # Map vague food/place patterns → concrete search queries
    VAGUE_FOOD_PATTERNS = [
        (r"good.*eat|eat.*nearby|food.*nearby|what.*eat|where.*eat|hungry|makan", "restaurant"),
        (r"coffee|cafe|kopi|ngopi", "cafe"),
        (r"drink|bar|cocktail|beer|pub", "bar"),
        (r"hotel|stay|penginapan|menginap", "hotel"),
        (r"hospital|doctor|clinic|sick|sakit|rs\b", "hospital"),
        (r"pharmacy|obat|apotek|apotik", "pharmacy"),
        (r"museum|gallery|galeri", "museum"),
        (r"park|taman|garden", "park"),
        (r"mall|shopping|belanja|supermarket", "shopping mall"),
        (r"gym|fitness|olahraga", "gym"),
        (r"atm|bank", "ATM"),
        (r"petrol|gas|fuel|bensin|spbu|pom\s*bensin", "gas station"),
        (r"tourist|wisata|attraction|sightseeing", "tourist attraction"),
    ]

    place_keywords = [
        "find", "search", "show", "where", "near", "nearby", "around",
        "restaurant", "cafe", "coffee", "hotel", "hospital", "bar", "eat",
        "food", "shop", "mall", "museum", "park", "attraction", "gym",
        "pharmacy", "atm", "fuel", "makan", "kopi", "wisata",
    ]

    is_place_search = any(kw in msg_lower for kw in place_keywords)

    # Check vague patterns and normalize to clean query
    normalized_query = None
    for pattern, label in VAGUE_FOOD_PATTERNS:
        if re.search(pattern, msg_lower):
            is_place_search = True
            normalized_query = label
            break

    if is_place_search:
        # Extract city (word after "in", "near", "around", "di", "di sekitar")
        city_match = re.search(
            r'\b(?:in|near|around|di|di\s+sekitar)\s+([A-Z][a-zA-Z\s]{2,20})',
            message
        )
        city = city_match.group(1).strip() if city_match else None

        # Use normalized query if available, else fall back to raw message
        search_query = f"{normalized_query} in {city}" if (normalized_query and city) \
            else normalized_query or message

        return {
            "intent": "place_search",
            "search_query": search_query,
            "place_type": normalized_query,
            "city": city,
            "user_message": f"Let me find that for you! Searching for: {search_query}",
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



# ── Overpass API place search (better for POIs than Nominatim) ────────────────

async def search_places_overpass(query: str, place_type: str | None, city_coords: dict | None) -> list[dict]:
    """Use Overpass API to find POIs by amenity/cuisine tags near a city center."""
    if not city_coords:
        return []

    lat, lng = city_coords["lat"], city_coords["lng"]
    radius = 10000  # 10km radius

    # Build Overpass query based on place type
    OVERPASS_TAGS = {
        "restaurant": '[amenity=restaurant]',
        "cafe": '[amenity=cafe]',
        "bar": '[amenity=bar]',
        "fast_food": '[amenity=fast_food]',
        "hotel": '[tourism=hotel]',
        "museum": '[tourism=museum]',
        "park": '[leisure=park]',
        "hospital": '[amenity=hospital]',
        "pharmacy": '[amenity=pharmacy]',
        "gym": '[leisure=fitness_centre]',
        "shopping mall": '[shop=mall]',
        "supermarket": '[shop=supermarket]',
        "gas station": '[amenity=fuel]',
        "atm": '[amenity=atm]',
        "tourist attraction": '[tourism=attraction]',
    }

    # Detect cuisine from query
    CUISINE_MAP = {
        "ramen": "ramen", "sushi": "sushi", "japanese": "japanese",
        "italian": "italian", "pizza": "pizza", "burger": "burger",
        "chinese": "chinese", "korean": "korean", "thai": "thai",
        "indian": "indian", "indonesian": "indonesian", "padang": "padang",
        "seafood": "seafood", "steak": "steak", "coffee": "coffee",
    }

    query_lower = query.lower()
    cuisine_filter = next((v for k, v in CUISINE_MAP.items() if k in query_lower), None)
    tag = OVERPASS_TAGS.get(place_type or "", '[amenity=restaurant]')

    if cuisine_filter:
        overpass_q = f'[out:json][timeout:25];(node[amenity=restaurant][cuisine~"{cuisine_filter}",i](around:{radius},{lat},{lng});way[amenity=restaurant][cuisine~"{cuisine_filter}",i](around:{radius},{lat},{lng}););out center 10;'
    else:
        overpass_q = f'[out:json][timeout:25];(node{tag}(around:{radius},{lat},{lng});way{tag}(around:{radius},{lat},{lng}););out center 10;'


    OVERPASS_ENDPOINTS = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    elements = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                resp = await client.post(
                    endpoint,
                    data={"data": overpass_q},
                    headers={"User-Agent": "HeyPico-Maps-App/1.0"},
                )
                data = resp.json()
                elements = data.get("elements", [])
                if elements:
                    logger.info(f"Overpass found {len(elements)} results from {endpoint}")
                    break
        except Exception as e:
            logger.warning(f"Overpass endpoint {endpoint} failed: {type(e).__name__}: {e}")
            continue
    if True:

            results = []
            for el in elements[:8]:
                tags = el.get("tags", {})
                name = tags.get("name") or tags.get("name:en")
                if not name:
                    continue
                # Get coordinates (nodes have lat/lon directly, ways have center)
                if el["type"] == "node":
                    elat, elng = el.get("lat"), el.get("lon")
                else:
                    center = el.get("center", {})
                    elat, elng = center.get("lat"), center.get("lon")
                if not elat or not elng:
                    continue

                addr_parts = filter(None, [
                    tags.get("addr:street"),
                    tags.get("addr:suburb") or tags.get("addr:city"),
                ])
                results.append({
                    "place_id": f"osm_{el['type'][0]}{el['id']}",
                    "osm_id": el["id"],
                    "osm_type": el["type"],
                    "name": name,
                    "address": ", ".join(addr_parts) or "",
                    "lat": float(elat),
                    "lng": float(elng),
                    "type": tags.get("amenity") or tags.get("tourism") or tags.get("leisure"),
                    "category": place_type,
                    "website": tags.get("website") or tags.get("contact:website"),
                    "phone": tags.get("phone") or tags.get("contact:phone"),
                    "opening_hours": tags.get("opening_hours"),
                    "cuisine": tags.get("cuisine"),
                })
            return results


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
            data = resp.json()
            raw = data if isinstance(data, list) else []
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
                data = resp.json()
                raw = data if isinstance(data, list) else []
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
        # Strip natural language filler before sending to Nominatim
        import re as _re
        FILLER = r'^(find|search|show|get|look for|where is|where are|i want|i need|looking for|cari|dimana|ada)\s+'
        clean_query = _re.sub(FILLER, '', query, flags=_re.IGNORECASE).strip()
        result["search_query"] = clean_query

        # Geocode city first so Overpass can search by coordinates
        city_coords = None
        if city:
            city_coords = await geocode_city(city)
        logger.info(f"DEBUG city={city} city_coords={city_coords} ptype={ptype} clean_query={clean_query}")

        # If no city detected, try to extract from query itself
        if not city_coords:
            # Try extracting city from clean_query (e.g. "ramen in Jakarta")
            city_match = re.search(r'(?:in|near|di)\s+([A-Z][a-zA-Z ]{2,20})', clean_query)
            if city_match:
                city_coords = await geocode_city(city_match.group(1).strip())

        # Last resort: use default map center (Jakarta area)
        if not city_coords:
            city_coords = {"lat": -6.2088, "lng": 106.8456}  # Jakarta center

        # Try Overpass first (better for restaurants/POIs), fallback to Nominatim
        places = await search_places_overpass(clean_query, ptype, city_coords)
        if not places:
            places = await search_places_nominatim(clean_query, ptype, city)
        result["places"] = places

        if places:
            result["map_center"] = {"lat": places[0]["lat"], "lng": places[0]["lng"]}
        elif city_coords:
            result["map_center"] = city_coords
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
