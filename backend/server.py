import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from contextlib import asynccontextmanager
from urllib.parse import quote_plus

from fastapi import FastAPI, HTTPException, Depends, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import jwt as pyjwt
import bcrypt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ai_service import generate_ai_response, generate_reminder_message
from agents import orchestrate_response, analyze_meal_photo, get_agents_info, classify_intent
from push_notifications import (
    push_service, PushToken, NotificationPayload,
    send_reminder_notification, send_checkin_notification,
    send_water_reminder, send_workout_reminder
)

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_ENV = (os.environ.get("APP_ENV") or "development").strip().lower()
STRIPE_CHECKOUT_URL_PRO = os.environ.get("STRIPE_CHECKOUT_URL_PRO", "")
STRIPE_CHECKOUT_URL_ELITE = os.environ.get("STRIPE_CHECKOUT_URL_ELITE", "")
STRIPE_PORTAL_URL = os.environ.get("STRIPE_PORTAL_URL", "")


def parse_cors_origins() -> List[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if origins:
        return origins
    if APP_ENV == "production":
        # Placeholder explícito para evitar wildcard em produção.
        return ["https://seu-frontend.emergent.sh"]
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


CORS_ORIGINS = parse_cors_origins()

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.mongo_client = AsyncIOMotorClient(MONGO_URL)
    app.state.db = app.state.mongo_client[DB_NAME]
    db = app.state.db
    await db.users.create_index("email", unique=True)
    await db.user_profiles.create_index("user_id", unique=True)
    await db.meals.create_index([("user_id", 1), ("date", 1)])
    await db.water_logs.create_index([("user_id", 1), ("date", 1)])
    await db.reminders.create_index([("user_id", 1), ("date", 1), ("scheduled_at", 1)])
    await db.chat_threads.create_index("user_id")
    await db.chat_messages.create_index("thread_id")
    await db.daily_checkins.create_index([("user_id", 1), ("date", 1)])
    await db.workout_plans.create_index("user_id")
    await db.workout_sessions.create_index([("user_id", 1), ("date", 1)])
    await db.body_metrics.create_index([("user_id", 1), ("date", 1)])
    await db.memory_facts.create_index("user_id")
    await db.weekly_summaries.create_index([("user_id", 1), ("week", -1)])
    await db.agent_insights.create_index([("user_id", 1), ("created_at", -1)])
    yield
    app.state.mongo_client.close()


app = FastAPI(title="Gymie API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    return app.state.db


# ── Auth Helpers ──────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: str, name: str) -> str:
    payload = {
        "user_id": user_id,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido")


def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def today_str():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


PLAN_CATALOG: Dict[str, dict] = {
    "free": {
        "id": "free",
        "name": "Free",
        "price_label": "R$ 0",
        "description": "Base para iniciar no Gymie.",
        "features": ["chat", "manual_meals", "manual_workout_plans", "progress_tracking"],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_label": "R$ 29/m",
        "description": "IA para treino e nutricao.",
        "features": [
            "chat",
            "manual_meals",
            "manual_workout_plans",
            "progress_tracking",
            "ai_workout_builder",
            "ai_meal_photo_analysis",
            "pantry_memory",
            "pwa_install",
        ],
    },
    "elite": {
        "id": "elite",
        "name": "Elite",
        "price_label": "R$ 59/m",
        "description": "Plano completo com recursos em tempo real.",
        "features": [
            "chat",
            "manual_meals",
            "manual_workout_plans",
            "progress_tracking",
            "ai_workout_builder",
            "ai_meal_photo_analysis",
            "pantry_memory",
            "pwa_install",
            "realtime_features",
        ],
    },
}


def normalize_plan(plan: Optional[str]) -> str:
    value = (plan or "").strip().lower()
    return value if value in PLAN_CATALOG else "free"


def normalize_subscription_status(status: Optional[str]) -> str:
    allowed = {"inactive", "active", "trialing", "past_due", "canceled"}
    value = (status or "").strip().lower()
    return value if value in allowed else "inactive"


def with_profile_defaults(profile: Optional[dict]) -> dict:
    base = {
        "weight": None,
        "height": None,
        "goal": None,
        "goal_weight": None,
        "routine": {},
        "training_days": [],
        "water_goal_ml": 2500,
        "persona_style": "tactical",
        "reminder_times": ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"],
        "calorie_target": 2000,
        "protein_target": 150,
        "carb_target": 200,
        "fat_target": 65,
        "onboarding_completed": False,
        "subscription_plan": "free",
        "subscription_status": "inactive",
        "stripe_customer_id": None,
    }
    merged = {**base, **(profile or {})}
    merged["subscription_plan"] = normalize_plan(merged.get("subscription_plan"))
    merged["subscription_status"] = normalize_subscription_status(merged.get("subscription_status"))
    return merged


def has_feature_access(profile: Optional[dict], feature: str) -> bool:
    plan = normalize_plan((profile or {}).get("subscription_plan"))
    return feature in PLAN_CATALOG[plan]["features"]


# ── Pydantic Models ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ProfileUpdate(BaseModel):
    weight: Optional[float] = None
    height: Optional[float] = None
    goal: Optional[str] = None
    goal_weight: Optional[float] = None
    routine: Optional[dict] = None
    training_days: Optional[List[str]] = None
    water_goal_ml: Optional[int] = None
    persona_style: Optional[str] = None
    reminder_times: Optional[List[str]] = None
    calorie_target: Optional[int] = None
    protein_target: Optional[int] = None
    carb_target: Optional[int] = None
    fat_target: Optional[int] = None
    onboarding_completed: Optional[bool] = None

class MealCreate(BaseModel):
    description: str
    meal_type: str = "snack"
    calories: Optional[float] = 0
    protein: Optional[float] = 0
    carbs: Optional[float] = 0
    fat: Optional[float] = 0
    time: Optional[str] = None
    photo_url: Optional[str] = None

class WaterCreate(BaseModel):
    amount_ml: int

class CheckinCreate(BaseModel):
    sleep_quality: Optional[int] = None
    energy_level: Optional[int] = None
    mood: Optional[str] = None
    notes: Optional[str] = None

class ChatMessageCreate(BaseModel):
    content: Optional[str] = ""
    mode: Optional[str] = "companion"
    image_base64: Optional[str] = None
    audio_base64: Optional[str] = None

class ReminderAction(BaseModel):
    action: str  # completed, snoozed, skipped

class ExerciseInput(BaseModel):
    name: str
    sets: int = 3
    reps: str = "12"
    weight_kg: Optional[float] = None
    rest_seconds: Optional[int] = 60
    notes: Optional[str] = None

class WorkoutPlanCreate(BaseModel):
    name: str
    plan_type: str = "A"
    exercises: List[dict] = []

class WorkoutSessionStart(BaseModel):
    plan_id: str

class WorkoutSessionUpdate(BaseModel):
    exercises: Optional[List[dict]] = None
    notes: Optional[str] = None

class BodyMetricCreate(BaseModel):
    weight: float
    body_fat_pct: Optional[float] = None
    notes: Optional[str] = None

class MemoryFactCreate(BaseModel):
    fact: str
    category: Optional[str] = "general"


class BillingCheckoutCreate(BaseModel):
    plan: str


# ── Auth Endpoints ───────────────────────────────────────────

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, req: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado")
    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "email": req.email.lower(),
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    profile = {
        "user_id": user_id,
        "weight": None, "height": None, "goal": None, "goal_weight": None,
        "routine": {}, "training_days": [], "water_goal_ml": 2500,
        "persona_style": "tactical", "reminder_times": ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"],
        "calorie_target": 2000, "protein_target": 150, "carb_target": 200, "fat_target": 65,
        "onboarding_completed": False,
        "subscription_plan": "free",
        "subscription_status": "inactive",
        "stripe_customer_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_profiles.insert_one(profile)
    access_token = create_access_token(user_id, req.name)
    refresh_token = create_refresh_token(user_id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user_id,
        "name": req.name,
        "onboarding_completed": False,
    }


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    profile = await db.user_profiles.find_one({"user_id": user["_id"]})
    access_token = create_access_token(user["_id"], user["name"])
    refresh_token = create_refresh_token(user["_id"])
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user["_id"],
        "name": user["name"],
        "onboarding_completed": profile.get("onboarding_completed", False) if profile else False,
    }


@app.post("/api/auth/refresh")
async def refresh_token(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalido")
        db = get_db()
        user = await db.users.find_one({"_id": payload["user_id"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
        access_token = create_access_token(user["_id"], user["name"])
        return {"access_token": access_token, "token_type": "bearer"}
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido")


@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    return {"message": "Se o email existir, enviaremos instrucoes de recuperacao."}


# ── Google OAuth (Emergent Auth) ──────────────────────────────
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

import httpx

class GoogleSessionRequest(BaseModel):
    session_id: str

@app.post("/api/auth/google/session")
async def process_google_session(req: GoogleSessionRequest):
    """
    Exchange session_id from Emergent Auth for user data.
    Creates/updates user in database and returns JWT token.
    """
    try:
        # Call Emergent Auth to get user data from session_id
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": req.session_id},
                timeout=10.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Sessao invalida ou expirada")
            
            data = response.json()
        
        email = data.get("email", "").lower()
        name = data.get("name", "")
        picture = data.get("picture", "")
        google_id = data.get("id", "")
        emergent_session_token = data.get("session_token", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email nao encontrado na sessao")
        
        db = get_db()
        
        # Check if user exists by email
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            # Update existing user with Google info
            user_id = existing_user["_id"]
            await db.users.update_one(
                {"_id": user_id},
                {"$set": {
                    "name": name or existing_user.get("name", ""),
                    "picture": picture,
                    "google_id": google_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user = {
                "_id": user_id,
                "email": email,
                "name": name or "Usuário",
                "picture": picture,
                "google_id": google_id,
                "password_hash": None,  # No password for Google users
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user)
            
            # Create profile for new user
            profile = {
                "user_id": user_id,
                "weight": None, "height": None, "goal": None, "goal_weight": None,
                "routine": {}, "training_days": [], "water_goal_ml": 2500,
                "persona_style": "tactical",
                "reminder_times": ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"],
                "calorie_target": 2000, "protein_target": 150, "carb_target": 200, "fat_target": 65,
                "onboarding_completed": False,
                "subscription_plan": "free",
                "subscription_status": "inactive",
                "stripe_customer_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.user_profiles.insert_one(profile)
        
        # Store Emergent session token
        await db.google_sessions.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "session_token": emergent_session_token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        
        # Get profile to check onboarding status
        profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
        
        # Generate JWT tokens
        user_doc = await db.users.find_one({"_id": user_id})
        access_token = create_access_token(user_id, user_doc.get("name", ""))
        refresh_token = create_refresh_token(user_id)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user_id,
            "name": user_doc.get("name", ""),
            "email": email,
            "picture": picture,
            "onboarding_completed": profile.get("onboarding_completed", False) if profile else False,
        }
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Erro ao validar sessao: {str(e)}")


# ── Profile / Onboarding ────────────────────────────────────

@app.get("/api/me")
async def get_me(user=Depends(get_current_user)):
    db = get_db()
    u = await db.users.find_one({"_id": user["user_id"]})
    profile = with_profile_defaults(await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}))
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    plan = normalize_plan(profile.get("subscription_plan"))
    return {
        "user_id": u["_id"],
        "name": u["name"],
        "email": u["email"],
        "profile": profile,
        "billing": {
            "plan": plan,
            "status": profile.get("subscription_status", "inactive"),
            "features": PLAN_CATALOG[plan]["features"],
        },
    }


@app.put("/api/me/profile")
async def update_profile(req: ProfileUpdate, user=Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": update_data},
        upsert=True,
    )
    if req.name is not None if hasattr(req, 'name') else False:
        await db.users.update_one({"_id": user["user_id"]}, {"$set": {"name": req.name}})
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"message": "Perfil atualizado", "profile": profile}


@app.post("/api/onboarding/complete")
async def complete_onboarding(req: ProfileUpdate, user=Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    update_data["onboarding_completed"] = True
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": update_data},
        upsert=True,
    )
    # Create default reminders
    reminder_times = update_data.get("reminder_times", ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"])
    date = today_str()
    reminder_types = {
        "08:00": {"type": "meal", "label": "Cafe da manha"},
        "11:00": {"type": "meal", "label": "Lanche da manha"},
        "12:00": {"type": "meal", "label": "Almoco"},
        "17:30": {"type": "workout", "label": "Treino"},
        "21:15": {"type": "meal", "label": "Jantar"},
        "23:00": {"type": "checkin", "label": "Check-in noturno"},
    }
    for t in reminder_times:
        rt = reminder_types.get(t, {"type": "general", "label": "Lembrete"})
        await db.reminders.update_one(
            {"user_id": user["user_id"], "date": date, "scheduled_at": t},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user["user_id"],
                "date": date,
                "scheduled_at": t,
                "type": rt["type"],
                "label": rt["label"],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"message": "Onboarding concluido", "profile": profile}


# ── Dashboard ────────────────────────────────────────────────

@app.get("/api/dashboard/today")
async def get_dashboard(user=Depends(get_current_user)):
    db = get_db()
    date = today_str()
    uid = user["user_id"]

    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    meals = await db.meals.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    water_logs = await db.water_logs.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    reminders = await db.reminders.find({"user_id": uid, "date": date}, {"_id": 0}).sort("scheduled_at", 1).to_list(50)
    checkin = await db.daily_checkins.find_one({"user_id": uid, "date": date}, {"_id": 0})

    total_cal = sum(m.get("calories", 0) for m in meals)
    total_protein = sum(m.get("protein", 0) for m in meals)
    total_carbs = sum(m.get("carbs", 0) for m in meals)
    total_fat = sum(m.get("fat", 0) for m in meals)
    total_water = sum(w.get("amount_ml", 0) for w in water_logs)
    water_goal = profile.get("water_goal_ml", 2500) if profile else 2500

    now_str = datetime.now(timezone.utc).strftime("%H:%M")
    next_mission = None
    for r in reminders:
        if r.get("status") == "pending" and r.get("scheduled_at", "") >= now_str:
            next_mission = r
            break
    if not next_mission and reminders:
        pending = [r for r in reminders if r.get("status") == "pending"]
        if pending:
            next_mission = pending[0]

    return {
        "date": date,
        "name": user.get("name", "Soldado"),
        "next_mission": next_mission,
        "macros": {
            "calories": {"current": total_cal, "target": profile.get("calorie_target", 2000) if profile else 2000},
            "protein": {"current": total_protein, "target": profile.get("protein_target", 150) if profile else 150},
            "carbs": {"current": total_carbs, "target": profile.get("carb_target", 200) if profile else 200},
            "fat": {"current": total_fat, "target": profile.get("fat_target", 65) if profile else 65},
        },
        "water": {"current_ml": total_water, "goal_ml": water_goal},
        "meals_count": len(meals),
        "reminders": reminders,
        "checkin": checkin,
        "persona_style": profile.get("persona_style", "tactical") if profile else "tactical",
    }


# ── Meals ────────────────────────────────────────────────────

@app.get("/api/meals")
async def get_meals(date: str = Query(default=None), user=Depends(get_current_user)):
    db = get_db()
    d = date or today_str()
    meals = await db.meals.find({"user_id": user["user_id"], "date": d}, {"_id": 0}).sort("time", 1).to_list(100)
    return {"date": d, "meals": meals}


@app.post("/api/meals")
async def create_meal(req: MealCreate, user=Depends(get_current_user)):
    db = get_db()
    meal = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "date": today_str(),
        "description": req.description,
        "meal_type": req.meal_type,
        "calories": req.calories or 0,
        "protein": req.protein or 0,
        "carbs": req.carbs or 0,
        "fat": req.fat or 0,
        "time": req.time or datetime.now(timezone.utc).strftime("%H:%M"),
        "photo_url": req.photo_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.meals.insert_one(meal)
    del meal["_id"]
    return meal


@app.put("/api/meals/{meal_id}")
async def update_meal(meal_id: str, req: MealCreate, user=Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.meals.update_one(
        {"id": meal_id, "user_id": user["user_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Refeicao nao encontrada")
    meal = await db.meals.find_one({"id": meal_id}, {"_id": 0})
    return meal


@app.delete("/api/meals/{meal_id}")
async def delete_meal(meal_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.meals.delete_one({"id": meal_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Refeicao nao encontrada")
    return {"message": "Refeicao removida"}


# ── Water ────────────────────────────────────────────────────

@app.get("/api/water")
async def get_water(date: str = Query(default=None), user=Depends(get_current_user)):
    db = get_db()
    d = date or today_str()
    logs = await db.water_logs.find({"user_id": user["user_id"], "date": d}, {"_id": 0}).sort("time", -1).to_list(100)
    total = sum(w.get("amount_ml", 0) for w in logs)
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    goal = profile.get("water_goal_ml", 2500) if profile else 2500
    return {"date": d, "logs": logs, "total_ml": total, "goal_ml": goal}


@app.post("/api/water")
async def add_water(req: WaterCreate, user=Depends(get_current_user)):
    db = get_db()
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "date": today_str(),
        "amount_ml": req.amount_ml,
        "time": datetime.now(timezone.utc).strftime("%H:%M"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.water_logs.insert_one(log)
    del log["_id"]
    return log


@app.delete("/api/water/{log_id}")
async def delete_water(log_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.water_logs.delete_one({"id": log_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registro nao encontrado")
    return {"message": "Registro removido"}


# ── Reminders ────────────────────────────────────────────────

@app.get("/api/reminders")
async def get_reminders(date: str = Query(default=None), user=Depends(get_current_user)):
    db = get_db()
    d = date or today_str()
    reminders = await db.reminders.find(
        {"user_id": user["user_id"], "date": d}, {"_id": 0}
    ).sort("scheduled_at", 1).to_list(50)
    return {"date": d, "reminders": reminders}


@app.post("/api/reminders/{reminder_id}/action")
async def reminder_action(reminder_id: str, req: ReminderAction, user=Depends(get_current_user)):
    db = get_db()
    update = {"status": req.action, "actioned_at": datetime.now(timezone.utc).isoformat()}
    if req.action == "snoozed":
        reminder = await db.reminders.find_one({"id": reminder_id, "user_id": user["user_id"]})
        if reminder:
            h, m = reminder.get("scheduled_at", "00:00").split(":")
            new_time = f"{int(h):02d}:{int(m)+15:02d}" if int(m) + 15 < 60 else f"{int(h)+1:02d}:{(int(m)+15-60):02d}"
            update["scheduled_at"] = new_time
            update["status"] = "pending"
    result = await db.reminders.update_one(
        {"id": reminder_id, "user_id": user["user_id"]},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lembrete nao encontrado")
    updated = await db.reminders.find_one({"id": reminder_id}, {"_id": 0})
    return updated


@app.post("/api/reminders/rebuild")
async def rebuild_reminders(user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]
    date = today_str()
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    if not profile:
        return {"message": "Perfil nao encontrado"}
    reminder_times = profile.get("reminder_times", ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"])
    reminder_types = {
        "08:00": {"type": "meal", "label": "Cafe da manha"},
        "11:00": {"type": "meal", "label": "Lanche da manha"},
        "12:00": {"type": "meal", "label": "Almoco"},
        "17:30": {"type": "workout", "label": "Treino"},
        "21:15": {"type": "meal", "label": "Jantar"},
        "23:00": {"type": "checkin", "label": "Check-in noturno"},
    }
    created = 0
    for t in reminder_times:
        rt = reminder_types.get(t, {"type": "general", "label": "Lembrete"})
        result = await db.reminders.update_one(
            {"user_id": uid, "date": date, "scheduled_at": t},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": uid, "date": date, "scheduled_at": t,
                "type": rt["type"], "label": rt["label"],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        if result.upserted_id:
            created += 1
    return {"message": f"{created} lembretes criados", "date": date}


# ── Check-ins ────────────────────────────────────────────────

@app.get("/api/checkins")
async def get_checkins(date: str = Query(default=None), user=Depends(get_current_user)):
    db = get_db()
    d = date or today_str()
    checkin = await db.daily_checkins.find_one({"user_id": user["user_id"], "date": d}, {"_id": 0})
    return {"date": d, "checkin": checkin}


@app.post("/api/checkins")
async def create_checkin(req: CheckinCreate, user=Depends(get_current_user)):
    db = get_db()
    date = today_str()
    checkin_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "date": date,
        "sleep_quality": req.sleep_quality,
        "energy_level": req.energy_level,
        "mood": req.mood,
        "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.daily_checkins.update_one(
        {"user_id": user["user_id"], "date": date},
        {"$set": checkin_data},
        upsert=True,
    )
    return checkin_data


@app.get("/api/streak")
async def get_streak(user=Depends(get_current_user)):
    """
    Calculate the current streak (consecutive days with check-ins).
    Returns current streak, longest streak, and total check-ins.
    """
    db = get_db()
    uid = user["user_id"]
    
    # Get all check-ins sorted by date descending
    checkins = await db.daily_checkins.find(
        {"user_id": uid}, {"_id": 0, "date": 1}
    ).sort("date", -1).to_list(365)
    
    if not checkins:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_checkins": 0,
            "streak_active": False,
            "last_checkin": None,
        }
    
    # Convert to set of dates for O(1) lookup
    checkin_dates = set(c["date"] for c in checkins)
    today = today_str()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Check if streak is active (checked in today or yesterday)
    streak_active = today in checkin_dates or yesterday in checkin_dates
    
    # Calculate current streak
    current_streak = 0
    check_date = datetime.now(timezone.utc).date()
    
    # If no check-in today, start from yesterday
    if today not in checkin_dates:
        check_date = check_date - timedelta(days=1)
    
    while check_date.strftime("%Y-%m-%d") in checkin_dates:
        current_streak += 1
        check_date = check_date - timedelta(days=1)
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 0
    sorted_dates = sorted(checkin_dates, reverse=True)
    
    for i, date_str in enumerate(sorted_dates):
        if i == 0:
            temp_streak = 1
        else:
            prev_date = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d").date()
            curr_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            if (prev_date - curr_date).days == 1:
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
    longest_streak = max(longest_streak, temp_streak)
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_checkins": len(checkins),
        "streak_active": streak_active,
        "last_checkin": checkins[0]["date"] if checkins else None,
    }


# ── Chat ─────────────────────────────────────────────────────

@app.get("/api/chat/threads")
async def get_threads(user=Depends(get_current_user)):
    db = get_db()
    threads = await db.chat_threads.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(20)
    return {"threads": threads}


@app.post("/api/chat/threads")
async def create_thread(user=Depends(get_current_user)):
    db = get_db()
    thread = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "mode": "companion",
        "title": "Nova conversa",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_threads.insert_one(thread)
    del thread["_id"]
    return thread


@app.get("/api/chat/threads/{thread_id}/messages")
async def get_messages(thread_id: str, user=Depends(get_current_user)):
    db = get_db()
    messages = await db.chat_messages.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"thread_id": thread_id, "messages": messages}


@app.post("/api/chat/threads/{thread_id}/messages")
@limiter.limit("30/minute")
async def send_message(request: Request, thread_id: str, req: ChatMessageCreate, user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]
    content = (req.content or "").strip()
    mode = req.mode or "companion"
    has_image = bool(req.image_base64)
    has_audio = bool(req.audio_base64)

    if not content and not has_image and not has_audio:
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    # Save user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id,
        "user_id": uid,
        "role": "user",
        "content": content,
        "mode": mode,
        "image_base64": req.image_base64 if has_image else None,
        "has_audio": has_audio,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(user_msg)
    del user_msg["_id"]

    # Build shared context for all agents
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    user_doc = await db.users.find_one({"_id": uid})
    date = today_str()
    meals = await db.meals.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    water_logs = await db.water_logs.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    reminders = await db.reminders.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    checkin = await db.daily_checkins.find_one({"user_id": uid, "date": date}, {"_id": 0})
    memory_facts = await db.memory_facts.find({"user_id": uid}, {"_id": 0}).to_list(20)
    workout_sessions_today = await db.workout_sessions.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(5)
    agent_insights = await db.agent_insights.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(15)
    workout_plans = await db.workout_plans.find({"user_id": uid}, {"_id": 0}).to_list(10)
    weight_history = await db.body_metrics.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(7)

    recent_messages = await db.chat_messages.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    recent_messages.reverse()

    context = {
        "user_name": user_doc.get("name", "Soldado") if user_doc else "Soldado",
        "profile": profile,
        "memory_facts": memory_facts,
        "agent_insights": agent_insights,
        "workout_plans": workout_plans,
        "weight_history": [{"date": m["date"], "weight": m["weight"]} for m in weight_history],
        "today": {
            "date": date,
            "meals": meals,
            "total_calories": sum(m.get("calories", 0) for m in meals),
            "total_protein": sum(m.get("protein", 0) for m in meals),
            "total_water_ml": sum(w.get("amount_ml", 0) for w in water_logs),
            "water_goal_ml": profile.get("water_goal_ml", 2500) if profile else 2500,
            "reminders": reminders,
            "checkin": checkin,
            "workout_sessions": workout_sessions_today,
        },
        "recent_messages": recent_messages[-10:],
    }

    persona_style = profile.get("persona_style", "tactical") if profile else "tactical"
    ai_input = content
    if has_image:
        if ai_input:
            ai_input += "\n\n[O usuario anexou uma imagem.]"
        else:
            ai_input = "O usuario anexou uma imagem e quer analise orientada ao contexto."
    if has_audio:
        if ai_input:
            ai_input += "\n\n[O usuario tambem enviou audio.]"
        else:
            ai_input = "O usuario enviou um audio sem transcricao. Peca um resumo curto em texto e ofereca ajuda."

    # Route through multi-agent orchestrator
    try:
        ai_result = await orchestrate_response(
            api_key=EMERGENT_LLM_KEY,
            user_message=ai_input,
            context=context,
            persona_style=persona_style,
            mode=mode,
            thread_id=thread_id,
            db=db,
            user_id=uid,
        )
        ai_text = ai_result.get("message_text", "Desculpe, nao consegui processar sua mensagem.")
        agent_info = {
            "agent_id": ai_result.get("agent_id"),
            "agent_name": ai_result.get("agent_name"),
            "agent_code": ai_result.get("agent_code"),
            "agent_color": ai_result.get("agent_color"),
        }
    except Exception as e:
        ai_text = "Sistema temporariamente indisponivel. Tente novamente em instantes."
        agent_info = {"agent_id": "companion", "agent_name": "Gymie", "agent_code": "COMP", "agent_color": "#00E04B"}
        print(f"AI Error: {e}")

    # Save AI message with agent metadata
    ai_msg = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id,
        "user_id": uid,
        "role": "assistant",
        "content": ai_text,
        "mode": mode,
        "agent_id": agent_info.get("agent_id"),
        "agent_name": agent_info.get("agent_name"),
        "agent_code": agent_info.get("agent_code"),
        "agent_color": agent_info.get("agent_color"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(ai_msg)
    del ai_msg["_id"]

    # Update thread
    await db.chat_threads.update_one(
        {"id": thread_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat(), "mode": mode}},
    )

    return {"user_message": user_msg, "ai_message": ai_msg}


# ── Settings ─────────────────────────────────────────────────

@app.get("/api/settings/persona")
async def get_persona(user=Depends(get_current_user)):
    db = get_db()
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "persona_style": profile.get("persona_style", "tactical") if profile else "tactical",
        "available_styles": [
            {"id": "tactical", "name": "Tatico", "description": "Estilo militar com humor leve. Missoes, radio do QG, vitorias operacionais."},
            {"id": "coach", "name": "Coach Parceiro", "description": "Motivador e acolhedor. Foco em progresso e celebracao."},
            {"id": "direct", "name": "Direto", "description": "Objetivo e pratico. Sem rodeios, foco total em resultados."},
            {"id": "neutral", "name": "Neutro", "description": "Tom equilibrado e informativo. Profissional e claro."},
        ],
    }


@app.put("/api/settings/persona")
async def update_persona(req: dict, user=Depends(get_current_user)):
    db = get_db()
    style = req.get("persona_style", "tactical")
    await db.user_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"persona_style": style}},
    )
    return {"message": "Persona atualizada", "persona_style": style}


# ── Workout Plans ────────────────────────────────────────────

@app.get("/api/billing/plans")
async def get_billing_plans(user=Depends(get_current_user)):
    db = get_db()
    profile = with_profile_defaults(await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}))
    current_plan = normalize_plan(profile.get("subscription_plan"))
    status = profile.get("subscription_status", "inactive")
    plans = []
    for plan in PLAN_CATALOG.values():
        plans.append({
            **plan,
            "current": plan["id"] == current_plan,
            "checkout_enabled": plan["id"] in {"pro", "elite"},
        })
    return {
        "plans": plans,
        "current_plan": current_plan,
        "current_status": status,
    }


@app.get("/api/billing/status")
async def get_billing_status(user=Depends(get_current_user)):
    db = get_db()
    profile = with_profile_defaults(await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}))
    plan = normalize_plan(profile.get("subscription_plan"))
    return {
        "plan": plan,
        "status": profile.get("subscription_status", "inactive"),
        "features": PLAN_CATALOG[plan]["features"],
    }


@app.post("/api/billing/checkout")
async def create_billing_checkout(req: BillingCheckoutCreate, user=Depends(get_current_user)):
    plan = normalize_plan(req.plan)
    if plan not in {"pro", "elite"}:
        raise HTTPException(status_code=400, detail="Plano invalido para checkout")

    checkout_url = STRIPE_CHECKOUT_URL_PRO if plan == "pro" else STRIPE_CHECKOUT_URL_ELITE
    if not checkout_url:
        raise HTTPException(status_code=400, detail="Checkout Stripe nao configurado no servidor")

    uid = quote_plus(user["user_id"])
    separator = "&" if "?" in checkout_url else "?"
    full_checkout_url = f"{checkout_url}{separator}client_reference_id={uid}&plan={plan}"

    db = get_db()
    await db.user_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "billing_pending_plan": plan,
            "billing_checkout_requested_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    return {"checkout_url": full_checkout_url, "plan": plan}


@app.get("/api/billing/portal")
async def get_billing_portal(user=Depends(get_current_user)):
    if not STRIPE_PORTAL_URL:
        raise HTTPException(status_code=400, detail="Portal Stripe nao configurado no servidor")
    uid = quote_plus(user["user_id"])
    separator = "&" if "?" in STRIPE_PORTAL_URL else "?"
    return {"portal_url": f"{STRIPE_PORTAL_URL}{separator}client_reference_id={uid}"}


@app.get("/api/workout-plans")
async def get_workout_plans(user=Depends(get_current_user)):
    db = get_db()
    plans = await db.workout_plans.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(20)
    return {"plans": plans}


@app.post("/api/workout-plans")
async def create_workout_plan(req: WorkoutPlanCreate, user=Depends(get_current_user)):
    db = get_db()
    plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": req.name,
        "plan_type": req.plan_type,
        "exercises": req.exercises,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workout_plans.insert_one(plan)
    del plan["_id"]
    return plan


@app.put("/api/workout-plans/{plan_id}")
async def update_workout_plan(plan_id: str, req: WorkoutPlanCreate, user=Depends(get_current_user)):
    db = get_db()
    update_data = {"name": req.name, "plan_type": req.plan_type, "exercises": req.exercises, "updated_at": datetime.now(timezone.utc).isoformat()}
    result = await db.workout_plans.update_one({"id": plan_id, "user_id": user["user_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    plan = await db.workout_plans.find_one({"id": plan_id}, {"_id": 0})
    return plan


@app.delete("/api/workout-plans/{plan_id}")
async def delete_workout_plan(plan_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.workout_plans.delete_one({"id": plan_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    return {"message": "Plano removido"}


# ── Workout Sessions ─────────────────────────────────────────

@app.get("/api/workout-sessions")
async def get_workout_sessions(date: str = Query(default=None), user=Depends(get_current_user)):
    db = get_db()
    query = {"user_id": user["user_id"]}
    if date:
        query["date"] = date
    sessions = await db.workout_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"sessions": sessions}


@app.post("/api/workout-sessions")
async def start_workout_session(req: WorkoutSessionStart, user=Depends(get_current_user)):
    db = get_db()
    plan = await db.workout_plans.find_one({"id": req.plan_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    session_exercises = []
    for ex in plan.get("exercises", []):
        sets_list = []
        for s in range(ex.get("sets", 3)):
            sets_list.append({"set_number": s + 1, "reps": 0, "weight_kg": ex.get("weight_kg", 0) or 0, "completed": False})
        session_exercises.append({
            "name": ex["name"],
            "target_sets": ex.get("sets", 3),
            "target_reps": ex.get("reps", "12"),
            "rest_seconds": ex.get("rest_seconds", 60),
            "sets": sets_list,
        })
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "plan_id": req.plan_id,
        "plan_name": plan["name"],
        "plan_type": plan.get("plan_type", "A"),
        "date": today_str(),
        "status": "active",
        "exercises": session_exercises,
        "notes": "",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workout_sessions.insert_one(session)
    del session["_id"]
    return session


@app.put("/api/workout-sessions/{session_id}")
async def update_workout_session(session_id: str, req: WorkoutSessionUpdate, user=Depends(get_current_user)):
    db = get_db()
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.exercises is not None:
        update_data["exercises"] = req.exercises
    if req.notes is not None:
        update_data["notes"] = req.notes
    result = await db.workout_sessions.update_one({"id": session_id, "user_id": user["user_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    session = await db.workout_sessions.find_one({"id": session_id}, {"_id": 0})
    return session


@app.post("/api/workout-sessions/{session_id}/complete")
async def complete_workout_session(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.workout_sessions.update_one(
        {"id": session_id, "user_id": user["user_id"]},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    session = await db.workout_sessions.find_one({"id": session_id}, {"_id": 0})
    return session


# ── Body Metrics ─────────────────────────────────────────────

@app.get("/api/body-metrics")
async def get_body_metrics(user=Depends(get_current_user)):
    db = get_db()
    metrics = await db.body_metrics.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(90)
    return {"metrics": metrics}


@app.post("/api/body-metrics")
async def create_body_metric(req: BodyMetricCreate, user=Depends(get_current_user)):
    db = get_db()
    date = today_str()
    metric = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "date": date,
        "weight": req.weight,
        "body_fat_pct": req.body_fat_pct,
        "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.body_metrics.update_one(
        {"user_id": user["user_id"], "date": date},
        {"$set": metric},
        upsert=True,
    )
    return metric


# ── Progress ─────────────────────────────────────────────────

@app.get("/api/progress/summary")
async def get_progress_summary(user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    today = today_str()

    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    cal_target = profile.get("calorie_target", 2000) if profile else 2000
    prot_target = profile.get("protein_target", 150) if profile else 150
    water_goal = profile.get("water_goal_ml", 2500) if profile else 2500

    # Weight trend
    metrics = await db.body_metrics.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    current_weight = metrics[0]["weight"] if metrics else None
    weight_change = None
    if len(metrics) >= 2:
        weight_change = round(metrics[0]["weight"] - metrics[-1]["weight"], 1)

    # Workouts this week
    week_sessions = await db.workout_sessions.find(
        {"user_id": uid, "date": {"$gte": week_ago}, "status": "completed"}, {"_id": 0}
    ).to_list(20)

    # Workouts last 30d
    month_sessions = await db.workout_sessions.find(
        {"user_id": uid, "date": {"$gte": month_ago}, "status": "completed"}, {"_id": 0}
    ).to_list(50)
    workout_count_30d = len(month_sessions)

    # Workout frequency by day of week (Mon→Sun)
    day_names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    day_counts = [0] * 7
    for s in month_sessions:
        try:
            d = datetime.strptime(s.get("date", ""), "%Y-%m-%d")
            day_counts[d.weekday() % 7 + 1 if d.weekday() < 6 else 0] += 1
        except ValueError:
            pass
    workout_by_day = [{"day": day_names[i], "count": day_counts[i]} for i in [1, 2, 3, 4, 5, 6, 0]]

    # Water average (last 7 days)
    water_pipeline = [
        {"$match": {"user_id": uid, "date": {"$gte": week_ago}}},
        {"$group": {"_id": "$date", "total": {"$sum": "$amount_ml"}}},
    ]
    water_daily = await db.water_logs.aggregate(water_pipeline).to_list(7)
    avg_water = round(sum(d["total"] for d in water_daily) / max(len(water_daily), 1)) if water_daily else 0
    water_adherence_pct = round((avg_water / water_goal) * 100) if water_goal > 0 else 0

    # Meals: avg weekly calories and protein
    meals_week = await db.meals.find({"user_id": uid, "date": {"$gte": week_ago}}, {"_id": 0}).to_list(200)
    meal_dates = {}
    for m in meals_week:
        d = m.get("date", "")
        if d not in meal_dates:
            meal_dates[d] = {"cal": 0, "prot": 0}
        meal_dates[d]["cal"] += m.get("calories", 0)
        meal_dates[d]["prot"] += m.get("protein", 0)
    n_days = max(len(meal_dates), 1)
    avg_weekly_calories = round(sum(v["cal"] for v in meal_dates.values()) / n_days)
    avg_weekly_protein = round(sum(v["prot"] for v in meal_dates.values()) / n_days)

    # Checkin consistency (last 7 days → consistency_bar Mon→Sun)
    checkins_week = await db.daily_checkins.find({"user_id": uid, "date": {"$gte": week_ago}}, {"_id": 0}).to_list(7)
    checkin_dates = {c["date"] for c in checkins_week}
    consistency_bar = []
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        consistency_bar.append(1 if d in checkin_dates else 0)

    # Checkin count last 30d
    checkin_count_30d = await db.daily_checkins.count_documents({"user_id": uid, "date": {"$gte": month_ago}})

    avg_energy = round(sum(c.get("energy_level", 0) for c in checkins_week) / max(len(checkins_week), 1), 1) if checkins_week else 0
    avg_sleep = round(sum(c.get("sleep_quality", 0) for c in checkins_week) / max(len(checkins_week), 1), 1) if checkins_week else 0

    return {
        # Frontend-expected field names
        "current_weight": current_weight,
        "weight_change": weight_change,
        "goal_weight": profile.get("goal_weight") if profile else None,
        "weekly_stats": {
            "workouts": len(week_sessions),
            "avg_water_ml": avg_water,
            "avg_sleep": avg_sleep,
            "avg_energy": avg_energy,
        },
        "avg_weekly_calories": avg_weekly_calories,
        "avg_weekly_protein": avg_weekly_protein,
        "water_adherence_pct": water_adherence_pct,
        "workout_count_30d": workout_count_30d,
        "checkin_count_30d": checkin_count_30d,
        "workout_by_day": workout_by_day,
        "consistency_bar": consistency_bar,
        "calorie_target": cal_target,
        "protein_target": prot_target,
        "weight_history": [{"date": m["date"], "weight": m["weight"]} for m in reversed(metrics[:30])],
    }


@app.get("/api/progress/weight")
async def get_weight_history(user=Depends(get_current_user)):
    db = get_db()
    metrics = await db.body_metrics.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(90)
    return {"metrics": metrics}


# ── Weekly Summary ───────────────────────────────────────────

@app.post("/api/progress/weekly-summary")
async def generate_weekly_summary(user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    week_key = now.strftime("%Y-W%W")

    # Gather week data
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    user_doc = await db.users.find_one({"_id": uid})
    name = user_doc.get("name", "Soldado") if user_doc else "Soldado"
    persona_style = profile.get("persona_style", "tactical") if profile else "tactical"

    meals = await db.meals.find({"user_id": uid, "date": {"$gte": week_start}}, {"_id": 0}).to_list(200)
    water_logs = await db.water_logs.find({"user_id": uid, "date": {"$gte": week_start}}, {"_id": 0}).to_list(200)
    sessions = await db.workout_sessions.find({"user_id": uid, "date": {"$gte": week_start}, "status": "completed"}, {"_id": 0}).to_list(20)
    checkins = await db.daily_checkins.find({"user_id": uid, "date": {"$gte": week_start}}, {"_id": 0}).to_list(7)
    metrics = await db.body_metrics.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(14)
    facts = await db.memory_facts.find({"user_id": uid}, {"_id": 0}).to_list(20)

    # Build summary data
    total_meals = len(meals)
    avg_cal = round(sum(m.get("calories", 0) for m in meals) / max(total_meals, 1))
    avg_protein = round(sum(m.get("protein", 0) for m in meals) / max(total_meals, 1))
    total_water_days = {}
    for w in water_logs:
        d = w.get("date", "")
        total_water_days[d] = total_water_days.get(d, 0) + w.get("amount_ml", 0)
    avg_water = round(sum(total_water_days.values()) / max(len(total_water_days), 1))
    workouts_count = len(sessions)
    workout_types = [s.get("plan_type", "?") for s in sessions]

    weight_start = metrics[-1]["weight"] if len(metrics) > 1 else None
    weight_end = metrics[0]["weight"] if metrics else None
    weight_change = round(weight_end - weight_start, 1) if weight_start and weight_end else None

    avg_sleep = round(sum(c.get("sleep_quality", 0) for c in checkins) / max(len(checkins), 1), 1) if checkins else None
    avg_energy = round(sum(c.get("energy_level", 0) for c in checkins) / max(len(checkins), 1), 1) if checkins else None

    facts_text = "\n".join([f"- {f.get('fact', '')}" for f in facts[:10]]) if facts else "Nenhum fato registrado."

    context_for_ai = f"""DADOS DA SEMANA ({week_start} a {now.strftime('%Y-%m-%d')}):
Nome: {name}
Objetivo: {profile.get('goal', 'N/A') if profile else 'N/A'}
Peso: {weight_end}kg (variacao: {weight_change}kg) | Meta: {profile.get('goal_weight', 'N/A') if profile else 'N/A'}kg
Refeicoes: {total_meals} registros | Media {avg_cal} kcal, {avg_protein}g proteina por refeicao
Agua: media {avg_water}ml/dia | Meta: {profile.get('water_goal_ml', 2500) if profile else 2500}ml
Treinos: {workouts_count} sessoes ({', '.join(workout_types) if workout_types else 'nenhum'})
Sono medio: {avg_sleep}/5 | Energia media: {avg_energy}/5
Check-ins: {len(checkins)} de 7 dias
Fatos sobre o usuario:\n{facts_text}"""

    try:
        from ai_service import generate_ai_response
        result = await generate_ai_response(
            api_key=EMERGENT_LLM_KEY,
            user_message=f"Gere um RESUMO SEMANAL detalhado para o usuario. Analise os dados, destaque vitorias, aponte areas de melhoria e de 3 acoes praticas para a proxima semana. Seja motivador mas honesto. Maximo 4 paragrafos.\n\nDados:\n{context_for_ai}",
            context={"user_name": name, "profile": profile, "today": {}, "recent_messages": []},
            persona_style=persona_style,
            mode="companion",
            thread_id=f"weekly-{week_key}",
        )
        summary_text = result.get("message_text", "Erro ao gerar resumo.")
    except Exception as e:
        summary_text = f"Nao foi possivel gerar o resumo automatico. Dados da semana: {workouts_count} treinos, {total_meals} refeicoes, media {avg_water}ml agua/dia."
        print(f"Weekly summary AI error: {e}")

    summary_doc = {
        "user_id": uid,
        "week": week_key,
        "date_range": {"start": week_start, "end": now.strftime("%Y-%m-%d")},
        "summary_text": summary_text,
        "persona_style": persona_style,
        "stats": {
            "meals": total_meals, "avg_calories": avg_cal, "avg_protein": avg_protein,
            "avg_water_ml": avg_water, "workouts": workouts_count, "workout_types": workout_types,
            "weight_start": weight_start, "weight_end": weight_end, "weight_change": weight_change,
            "avg_sleep": avg_sleep, "avg_energy": avg_energy, "checkin_days": len(checkins),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.weekly_summaries.update_one(
        {"user_id": uid, "week": week_key},
        {"$set": summary_doc},
        upsert=True,
    )
    return summary_doc


@app.get("/api/progress/weekly-summary")
async def get_weekly_summary(user=Depends(get_current_user)):
    db = get_db()
    summaries = await db.weekly_summaries.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("week", -1).to_list(4)
    return {"summaries": summaries}


# ── Exercise History ─────────────────────────────────────────

@app.get("/api/progress/exercise-history")
async def get_exercise_history(exercise_name: str = Query(...), user=Depends(get_current_user)):
    db = get_db()
    sessions = await db.workout_sessions.find(
        {"user_id": user["user_id"], "status": "completed"}, {"_id": 0}
    ).sort("date", 1).to_list(100)

    history = []
    for s in sessions:
        for ex in s.get("exercises", []):
            if ex.get("name", "").lower() == exercise_name.lower():
                completed_sets = [st for st in ex.get("sets", []) if st.get("completed")]
                if completed_sets:
                    max_weight = max(st.get("weight_kg", 0) for st in completed_sets)
                    total_reps = sum(st.get("reps", 0) for st in completed_sets)
                    total_volume = sum(st.get("weight_kg", 0) * st.get("reps", 0) for st in completed_sets)
                    history.append({
                        "date": s.get("date"),
                        "max_weight": max_weight,
                        "total_reps": total_reps,
                        "total_volume": round(total_volume),
                        "sets_completed": len(completed_sets),
                    })
    return {"exercise_name": exercise_name, "history": history}


# ── Memory Facts ─────────────────────────────────────────────

@app.get("/api/memory/facts")
async def get_memory_facts(user=Depends(get_current_user)):
    db = get_db()
    facts = await db.memory_facts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"facts": facts}


@app.post("/api/memory/facts")
async def create_memory_fact(req: MemoryFactCreate, user=Depends(get_current_user)):
    db = get_db()
    fact = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "fact": req.fact,
        "category": req.category or "general",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.memory_facts.insert_one(fact)
    del fact["_id"]
    return fact


@app.delete("/api/memory/facts/{fact_id}")
async def delete_memory_fact(fact_id: str, user=Depends(get_current_user)):
    db = get_db()
    result = await db.memory_facts.delete_one({"id": fact_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fato nao encontrado")
    return {"message": "Fato removido"}


# ── Multi-Agent System ───────────────────────────────────────

@app.get("/api/agents")
async def get_available_agents():
    return {"agents": get_agents_info()}


@app.get("/api/agents/insights")
async def get_agent_insights(user=Depends(get_current_user)):
    """
    Returns agent insights + actionable insights based on current day state.
    Actionable insights are practical, context-aware suggestions.
    """
    db = get_db()
    uid = user["user_id"]
    date = today_str()
    
    # Get raw agent insights
    raw_insights = await db.agent_insights.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("created_at", -1).to_list(15)
    
    # Build actionable insights from current state
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    meals = await db.meals.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    water_logs = await db.water_logs.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    reminders = await db.reminders.find({"user_id": uid, "date": date, "status": "pending"}, {"_id": 0}).to_list(10)
    sessions = await db.workout_sessions.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(5)
    checkin = await db.daily_checkins.find_one({"user_id": uid, "date": date}, {"_id": 0})
    
    actionable = []
    now_hour = datetime.now(timezone.utc).hour
    
    # Water check
    total_water = sum(w.get("amount_ml", 0) for w in water_logs)
    water_goal = profile.get("water_goal_ml", 2500) if profile else 2500
    water_pct = (total_water / water_goal * 100) if water_goal > 0 else 0
    if water_pct < 40 and now_hour >= 12:
        actionable.append({
            "type": "water",
            "priority": "high",
            "icon": "droplet",
            "message": f"Agua em {int(water_pct)}% da meta. Beba mais agua!",
            "action": "add_water",
            "color": "#00F0FF",
        })
    
    # Calories/protein check
    total_cal = sum(m.get("calories", 0) for m in meals)
    total_protein = sum(m.get("protein", 0) for m in meals)
    cal_target = profile.get("calorie_target", 2000) if profile else 2000
    prot_target = profile.get("protein_target", 150) if profile else 150
    
    if now_hour >= 18 and total_protein < prot_target * 0.6:
        deficit = prot_target - total_protein
        actionable.append({
            "type": "nutrition",
            "priority": "high",
            "icon": "utensils",
            "message": f"Faltam {int(deficit)}g de proteina hoje. Capriche no jantar!",
            "action": "add_meal",
            "color": "#FF9500",
        })
    elif now_hour >= 14 and total_cal < cal_target * 0.4:
        actionable.append({
            "type": "nutrition",
            "priority": "medium",
            "icon": "utensils",
            "message": f"Poucas calorias ate agora ({int(total_cal)}kcal). Nao pule refeicoes!",
            "action": "add_meal",
            "color": "#FF9500",
        })
    
    # Workout check
    training_days = profile.get("training_days", []) if profile else []
    weekday = datetime.now(timezone.utc).strftime("%A").lower()
    weekday_pt = {"monday": "segunda", "tuesday": "terca", "wednesday": "quarta", "thursday": "quinta", "friday": "sexta", "saturday": "sabado", "sunday": "domingo"}.get(weekday, "")
    
    has_workout_today = any(s.get("status") in ["active", "completed"] for s in sessions)
    if weekday_pt in training_days and not has_workout_today and now_hour >= 10:
        actionable.append({
            "type": "workout",
            "priority": "medium",
            "icon": "dumbbell",
            "message": "Hoje e dia de treino! Ja iniciou?",
            "action": "start_workout",
            "color": "#A855F7",
        })
    
    # Pending reminders
    pending_count = len(reminders)
    if pending_count > 0:
        next_reminder = reminders[0] if reminders else None
        if next_reminder:
            actionable.append({
                "type": "reminder",
                "priority": "low",
                "icon": "target",
                "message": f"Proxima missao: {next_reminder.get('label', 'Lembrete')} as {next_reminder.get('scheduled_at', '?')}",
                "action": "view_reminders",
                "color": "#D4FF00",
            })
    
    # Check-in reminder
    if not checkin and now_hour >= 20:
        actionable.append({
            "type": "checkin",
            "priority": "low",
            "icon": "smile",
            "message": "Faca seu check-in noturno: sono, energia, humor.",
            "action": "do_checkin",
            "color": "#D4FF00",
        })
    
    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actionable.sort(key=lambda x: priority_order.get(x.get("priority", "low"), 2))
    
    return {
        "raw_insights": raw_insights,
        "actionable": actionable[:5],  # Max 5 actionable insights
        "context_summary": {
            "water_pct": round(water_pct),
            "calories_pct": round((total_cal / cal_target * 100) if cal_target > 0 else 0),
            "protein_pct": round((total_protein / prot_target * 100) if prot_target > 0 else 0),
            "meals_count": len(meals),
            "has_checkin": checkin is not None,
            "has_workout": has_workout_today,
        }
    }


class MealAnalyzeRequest(BaseModel):
    description: str
    photo_base64: Optional[str] = None

@app.post("/api/meals/analyze")
@limiter.limit("20/minute")
async def analyze_meal(request: Request, req: MealAnalyzeRequest, user=Depends(get_current_user)):
    """
    Photo/text analysis of a meal - estimates macros using AI.
    
    Standardized Response Contract:
    {
        "success": bool,
        "analysis_text": str,         # Human-readable analysis
        "estimated_macros": {
            "calories": int,
            "protein": int,
            "carbs": int,
            "fat": int,
            "fiber": int,             # Optional
            "description": str        # Cleaned description
        },
        "confidence": str,            # "high" | "medium" | "low"
        "suggestions": [str],         # Actionable tips
        "agent_name": str,
        "agent_code": str,
        "analyzed_at": str            # ISO timestamp
    }
    """
    try:
        db = get_db()
        profile = with_profile_defaults(await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}))
        if not has_feature_access(profile, "ai_meal_photo_analysis"):
            raise HTTPException(status_code=402, detail="Feature disponivel apenas para plano Pro ou Elite")
        persona_style = profile.get("persona_style", "tactical") if profile else "tactical"

        result = await analyze_meal_photo(
            api_key=EMERGENT_LLM_KEY,
            description=req.description,
            photo_base64=req.photo_base64,
            persona_style=persona_style,
        )
        
        # Standardized response
        estimated = result.get("estimated_macros", {})
        return {
            "success": True,
            "analysis_text": result.get("analysis_text", "Analise concluida."),
            "estimated_macros": {
                "calories": estimated.get("calories", 0),
                "protein": estimated.get("protein", 0),
                "carbs": estimated.get("carbs", 0),
                "fat": estimated.get("fat", 0),
                "fiber": estimated.get("fiber", 0),
                "description": estimated.get("description", req.description),
            },
            "confidence": "medium",  # Can be enhanced with AI confidence scoring
            "suggestions": [],
            "agent_name": result.get("agent_name", "Foto"),
            "agent_code": result.get("agent_code", "FOTO"),
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Meal analysis error: {e}")
        return {
            "success": False,
            "analysis_text": "Nao foi possivel analisar a refeicao automaticamente.",
            "estimated_macros": {
                "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0,
                "description": req.description
            },
            "confidence": "low",
            "suggestions": ["Tente descrever a refeicao com mais detalhes."],
            "agent_name": "Foto",
            "agent_code": "FOTO",
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }


@app.get("/api/agents/classify")
async def classify_message(message: str = Query(...)):
    agent_id = classify_intent(message)
    agents_info = {a["id"]: a for a in get_agents_info()}
    agent = agents_info.get(agent_id, agents_info.get("companion"))
    return {"agent_id": agent_id, "agent": agent}


@app.get("/api/agents/debug")
async def get_agent_debug(user=Depends(get_current_user)):
    """
    Debug endpoint for orchestration validation (dev mode).
    Returns current context state, last decisions, and system health.
    """
    db = get_db()
    uid = user["user_id"]
    date = today_str()
    
    # Get last messages with agent info
    last_messages = await db.chat_messages.find(
        {"user_id": uid, "role": "assistant"}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    
    # Get context summary
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    memory_facts = await db.memory_facts.find({"user_id": uid}, {"_id": 0}).to_list(10)
    agent_insights = await db.agent_insights.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    # Build debug info
    recent_decisions = []
    for msg in last_messages:
        recent_decisions.append({
            "timestamp": msg.get("created_at", "?")[:19],
            "mode_selected": msg.get("mode", "companion"),
            "agent_routed": msg.get("agent_code", "?"),
            "agent_name": msg.get("agent_name", "?"),
            "message_preview": msg.get("content", "")[:80] + "..." if len(msg.get("content", "")) > 80 else msg.get("content", ""),
        })
    
    context_loaded = {
        "profile_loaded": profile is not None,
        "persona_style": profile.get("persona_style", "tactical") if profile else "tactical",
        "memory_facts_count": len(memory_facts),
        "agent_insights_count": len(agent_insights),
        "training_days": profile.get("training_days", []) if profile else [],
        "calorie_target": profile.get("calorie_target", 2000) if profile else 2000,
        "protein_target": profile.get("protein_target", 150) if profile else 150,
        "water_goal_ml": profile.get("water_goal_ml", 2500) if profile else 2500,
    }
    
    agents_available = get_agents_info()
    
    return {
        "orchestration_status": "operational",
        "context_loaded": context_loaded,
        "recent_decisions": recent_decisions,
        "agents_available": [{"code": a["code"], "name": a["name"], "color": a["color"]} for a in agents_available],
        "memory_facts_sample": [f.get("fact", "")[:50] for f in memory_facts[:3]],
        "last_insights": [{"agent": i.get("agent"), "insight": i.get("insight", "")[:50]} for i in agent_insights[:3]],
        "fallback_agent": "companion",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Seed Data ────────────────────────────────────────────────

@app.post("/api/seed")
async def seed_data():
    db = get_db()
    existing = await db.users.find_one({"email": "demo@shape.com"})
    if existing:
        return {"message": "Seed ja existe", "user_id": existing["_id"]}

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "email": "demo@shape.com",
        "name": "Soldado Demo",
        "password_hash": hash_password("demo123"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)

    profile = {
        "user_id": user_id,
        "weight": 85.0, "height": 178, "goal": "Emagrecimento", "goal_weight": 75.0,
        "routine": {
            "wake_up": "07:00", "work_start": "09:00", "lunch": "12:00",
            "work_end": "18:00", "workout": "17:30", "dinner": "21:00", "sleep": "23:30",
        },
        "training_days": ["segunda", "terca", "quinta", "sexta"],
        "water_goal_ml": 3000,
        "persona_style": "tactical",
        "reminder_times": ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"],
        "calorie_target": 1800, "protein_target": 160, "carb_target": 180, "fat_target": 55,
        "onboarding_completed": True,
        "subscription_plan": "pro",
        "subscription_status": "active",
        "stripe_customer_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_profiles.insert_one(profile)

    date = today_str()
    meals = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "description": "Banana + Whey Protein", "meal_type": "breakfast", "calories": 350, "protein": 35, "carbs": 40, "fat": 5, "time": "08:15", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "description": "YoPro + Maca", "meal_type": "snack", "calories": 220, "protein": 20, "carbs": 30, "fat": 3, "time": "11:00", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "description": "Frango grelhado + arroz integral + salada", "meal_type": "lunch", "calories": 550, "protein": 45, "carbs": 55, "fat": 12, "time": "12:30", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    if meals:
        await db.meals.insert_many(meals)

    water_logs = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "amount_ml": 500, "time": "07:30", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "amount_ml": 300, "time": "10:00", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "amount_ml": 500, "time": "13:00", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.water_logs.insert_many(water_logs)

    reminders_data = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "08:00", "type": "meal", "label": "Cafe da manha", "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "11:00", "type": "meal", "label": "Lanche da manha", "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "12:00", "type": "meal", "label": "Almoco", "status": "completed", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "17:30", "type": "workout", "label": "Treino", "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "21:15", "type": "meal", "label": "Jantar", "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "date": date, "scheduled_at": "23:00", "type": "checkin", "label": "Check-in noturno", "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.reminders.insert_many(reminders_data)

    checkin = {
        "id": str(uuid.uuid4()),
        "user_id": user_id, "date": date,
        "sleep_quality": 3, "energy_level": 4, "mood": "focado",
        "notes": "Dormi bem, dia produtivo.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.daily_checkins.insert_one(checkin)

    thread = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "mode": "companion",
        "title": "Canal Principal",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_threads.insert_one(thread)

    # Memory Facts
    memory_facts = [
        {"id": str(uuid.uuid4()), "user_id": user_id, "fact": "Maior dificuldade com alimentacao a noite, tende a comer carboidrato pesado", "category": "nutrition", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "fact": "Transito longo no final do dia, chega cansado para treinar", "category": "routine", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "fact": "Treina melhor no meio-dia quando possivel", "category": "workout", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "fact": "Prefere lembretes firmes e diretos", "category": "preferences", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "user_id": user_id, "fact": "Gosta de banana + whey como pre-treino rapido", "category": "nutrition", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.memory_facts.insert_many(memory_facts)

    # Workout Plans ABC
    plans = [
        {
            "id": str(uuid.uuid4()), "user_id": user_id, "name": "Treino A - Peito + Triceps", "plan_type": "A",
            "exercises": [
                {"name": "Supino reto", "sets": 4, "reps": "10", "weight_kg": 60, "rest_seconds": 90, "notes": ""},
                {"name": "Supino inclinado", "sets": 3, "reps": "12", "weight_kg": 50, "rest_seconds": 75, "notes": ""},
                {"name": "Crucifixo", "sets": 3, "reps": "12", "weight_kg": 16, "rest_seconds": 60, "notes": "Halteres"},
                {"name": "Triceps testa", "sets": 3, "reps": "12", "weight_kg": 25, "rest_seconds": 60, "notes": ""},
                {"name": "Triceps corda", "sets": 3, "reps": "15", "weight_kg": 20, "rest_seconds": 60, "notes": "Polia"},
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()), "user_id": user_id, "name": "Treino B - Costas + Biceps", "plan_type": "B",
            "exercises": [
                {"name": "Puxada frontal", "sets": 4, "reps": "10", "weight_kg": 55, "rest_seconds": 90, "notes": ""},
                {"name": "Remada curvada", "sets": 3, "reps": "10", "weight_kg": 50, "rest_seconds": 75, "notes": "Barra"},
                {"name": "Remada baixa", "sets": 3, "reps": "12", "weight_kg": 45, "rest_seconds": 60, "notes": "Polia"},
                {"name": "Rosca direta", "sets": 3, "reps": "12", "weight_kg": 28, "rest_seconds": 60, "notes": ""},
                {"name": "Rosca martelo", "sets": 3, "reps": "12", "weight_kg": 14, "rest_seconds": 60, "notes": "Halteres"},
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": str(uuid.uuid4()), "user_id": user_id, "name": "Treino C - Pernas + Ombros", "plan_type": "C",
            "exercises": [
                {"name": "Agachamento livre", "sets": 4, "reps": "10", "weight_kg": 80, "rest_seconds": 120, "notes": ""},
                {"name": "Leg press 45", "sets": 3, "reps": "12", "weight_kg": 180, "rest_seconds": 90, "notes": ""},
                {"name": "Stiff", "sets": 3, "reps": "12", "weight_kg": 40, "rest_seconds": 75, "notes": ""},
                {"name": "Desenvolvimento", "sets": 3, "reps": "12", "weight_kg": 24, "rest_seconds": 60, "notes": "Halteres"},
                {"name": "Elevacao lateral", "sets": 3, "reps": "15", "weight_kg": 10, "rest_seconds": 60, "notes": ""},
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    await db.workout_plans.insert_many(plans)

    # Body metrics (last 14 days)
    body_metrics = []
    for i in range(14, 0, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        w = 85.0 - (i * 0.15) + (0.1 if i % 3 == 0 else -0.05)
        body_metrics.append({
            "id": str(uuid.uuid4()), "user_id": user_id, "date": d,
            "weight": round(w, 1), "body_fat_pct": None, "notes": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.body_metrics.insert_many(body_metrics)

    # Completed workout sessions (last week)
    completed_sessions = []
    for i, plan in enumerate(plans[:2]):
        d = (datetime.now(timezone.utc) - timedelta(days=3 + i * 2)).strftime("%Y-%m-%d")
        session_exercises = []
        for ex in plan["exercises"]:
            sets_list = [{"set_number": s + 1, "reps": int(ex["reps"]), "weight_kg": ex.get("weight_kg", 0), "completed": True} for s in range(ex["sets"])]
            session_exercises.append({"name": ex["name"], "target_sets": ex["sets"], "target_reps": ex["reps"], "rest_seconds": ex.get("rest_seconds", 60), "sets": sets_list})
        completed_sessions.append({
            "id": str(uuid.uuid4()), "user_id": user_id, "plan_id": plan["id"], "plan_name": plan["name"],
            "plan_type": plan["plan_type"], "date": d, "status": "completed", "exercises": session_exercises,
            "notes": "", "started_at": datetime.now(timezone.utc).isoformat(), "completed_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.workout_sessions.insert_many(completed_sessions)

    return {"message": "Seed criado com sucesso", "user_id": user_id, "email": "demo@shape.com", "password": "demo123"}


@app.get("/api/health")
async def health():
    return {"status": "operational", "app": "Gymie"}


# ── Push Notifications ────────────────────────────────────────

class PushTokenRequest(BaseModel):
    token: str
    platform: str = "web"
    device_id: Optional[str] = None

@app.post("/api/push/register")
async def register_push_token(req: PushTokenRequest, user=Depends(get_current_user)):
    """Register a push notification token for the current user."""
    result = await push_service.register_token(
        user["user_id"],
        PushToken(token=req.token, platform=req.platform, device_id=req.device_id)
    )
    return result

@app.delete("/api/push/unregister")
async def unregister_push_token(token: str = Query(...), user=Depends(get_current_user)):
    """Remove a push notification token."""
    result = await push_service.unregister_token(user["user_id"], token)
    return result

@app.get("/api/push/tokens")
async def get_push_tokens(user=Depends(get_current_user)):
    """Get all registered push tokens for the current user."""
    tokens = await push_service.get_user_tokens(user["user_id"])
    return {"tokens": tokens}

@app.get("/api/push/log")
async def get_notification_log(user=Depends(get_current_user)):
    """Get notification history for debugging (dev mode)."""
    logs = await push_service.get_notification_log(user["user_id"], limit=20)
    return {"notifications": logs}

@app.post("/api/push/test")
async def test_push_notification(user=Depends(get_current_user)):
    """Send a test notification to the current user."""
    result = await push_service.send_notification(
        user["user_id"],
        NotificationPayload(
            title="🔔 Teste do Gymie",
            body="Se você está vendo isso, as notificações estão funcionando!",
            notification_type="test",
        )
    )
    return {"success": result.success, "message_id": result.message_id}


# ── Achievements System ────────────────────────────────────────

# Achievement definitions
ACHIEVEMENTS = [
    # Streak achievements
    {"id": "streak_3", "name": "Primeira Faísca", "desc": "3 dias de check-in seguidos", "icon": "🔥", "category": "streak", "condition": {"streak": 3}},
    {"id": "streak_7", "name": "Primeira Semana", "desc": "7 dias de check-in seguidos", "icon": "🔥", "category": "streak", "condition": {"streak": 7}},
    {"id": "streak_14", "name": "Duas Semanas de Foco", "desc": "14 dias de check-in seguidos", "icon": "⚡", "category": "streak", "condition": {"streak": 14}},
    {"id": "streak_30", "name": "Mês de Ferro", "desc": "30 dias de check-in seguidos", "icon": "💪", "category": "streak", "condition": {"streak": 30}},
    {"id": "streak_60", "name": "Imparável", "desc": "60 dias de check-in seguidos", "icon": "🏆", "category": "streak", "condition": {"streak": 60}},
    {"id": "streak_100", "name": "Centurião", "desc": "100 dias de check-in seguidos", "icon": "👑", "category": "streak", "condition": {"streak": 100}},
    
    # Meals achievements
    {"id": "meals_10", "name": "Primeiros Registros", "desc": "10 refeições registradas", "icon": "🍽️", "category": "meals", "condition": {"meals": 10}},
    {"id": "meals_50", "name": "Diário Alimentar", "desc": "50 refeições registradas", "icon": "📝", "category": "meals", "condition": {"meals": 50}},
    {"id": "meals_100", "name": "Nutrição em Dia", "desc": "100 refeições registradas", "icon": "🎯", "category": "meals", "condition": {"meals": 100}},
    {"id": "meals_500", "name": "Mestre da Alimentação", "desc": "500 refeições registradas", "icon": "🏅", "category": "meals", "condition": {"meals": 500}},
    
    # Workout achievements
    {"id": "workouts_5", "name": "Iniciante", "desc": "5 treinos concluídos", "icon": "🏋️", "category": "workouts", "condition": {"workouts": 5}},
    {"id": "workouts_20", "name": "Frequentador", "desc": "20 treinos concluídos", "icon": "💪", "category": "workouts", "condition": {"workouts": 20}},
    {"id": "workouts_50", "name": "Dedicado", "desc": "50 treinos concluídos", "icon": "⭐", "category": "workouts", "condition": {"workouts": 50}},
    {"id": "workouts_100", "name": "Atleta", "desc": "100 treinos concluídos", "icon": "🏆", "category": "workouts", "condition": {"workouts": 100}},
    
    # Water achievements
    {"id": "water_7", "name": "Hidratado", "desc": "Meta de água 7 dias seguidos", "icon": "💧", "category": "water", "condition": {"water_goal_days": 7}},
    {"id": "water_30", "name": "Fonte de Energia", "desc": "Meta de água 30 dias seguidos", "icon": "🌊", "category": "water", "condition": {"water_goal_days": 30}},
    
    # Special achievements
    {"id": "first_chat", "name": "Primeiro Contato", "desc": "Primeira conversa com Gymie", "icon": "💬", "category": "special", "condition": {"chats": 1}},
    {"id": "weekly_summary", "name": "Reflexivo", "desc": "Gerou primeiro resumo semanal", "icon": "📊", "category": "special", "condition": {"weekly_summaries": 1}},
    {"id": "weight_logged", "name": "Na Balança", "desc": "Registrou peso pela primeira vez", "icon": "⚖️", "category": "special", "condition": {"weight_logs": 1}},
]


@app.get("/api/achievements")
async def get_achievements(user=Depends(get_current_user)):
    """
    Get all achievements with unlock status for the user.
    Calculates progress and unlocks achievements dynamically.
    """
    db = get_db()
    uid = user["user_id"]
    
    # Get user stats
    checkins = await db.daily_checkins.find({"user_id": uid}, {"_id": 0, "date": 1}).to_list(500)
    meals_count = await db.meals.count_documents({"user_id": uid})
    workouts_count = await db.workout_sessions.count_documents({"user_id": uid, "status": "completed"})
    water_logs = await db.water_logs.find({"user_id": uid}, {"_id": 0, "date": 1, "amount_ml": 1}).to_list(1000)
    chats_count = await db.chat_messages.count_documents({"user_id": uid, "role": "user"})
    summaries_count = await db.weekly_summaries.count_documents({"user_id": uid})
    weight_count = await db.body_metrics.count_documents({"user_id": uid})
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0, "water_goal_ml": 1})
    water_goal = profile.get("water_goal_ml", 2500) if profile else 2500
    
    # Calculate streak
    checkin_dates = set(c["date"] for c in checkins)
    current_streak = 0
    check_date = datetime.now(timezone.utc).date()
    today = today_str()
    if today not in checkin_dates:
        check_date = check_date - timedelta(days=1)
    while check_date.strftime("%Y-%m-%d") in checkin_dates:
        current_streak += 1
        check_date = check_date - timedelta(days=1)
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 0
    sorted_dates = sorted(checkin_dates, reverse=True)
    for i, date_str in enumerate(sorted_dates):
        if i == 0:
            temp_streak = 1
        else:
            prev_date = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d").date()
            curr_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            if (prev_date - curr_date).days == 1:
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
    longest_streak = max(longest_streak, temp_streak, current_streak)
    
    # Calculate water goal days streak
    water_by_date = {}
    for w in water_logs:
        d = w.get("date", "")
        water_by_date[d] = water_by_date.get(d, 0) + w.get("amount_ml", 0)
    water_goal_streak = 0
    check_date = datetime.now(timezone.utc).date()
    while True:
        date_str = check_date.strftime("%Y-%m-%d")
        if water_by_date.get(date_str, 0) >= water_goal:
            water_goal_streak += 1
            check_date = check_date - timedelta(days=1)
        else:
            break
    
    # User stats summary
    stats = {
        "streak": longest_streak,
        "meals": meals_count,
        "workouts": workouts_count,
        "water_goal_days": water_goal_streak,
        "chats": chats_count,
        "weekly_summaries": summaries_count,
        "weight_logs": weight_count,
    }
    
    # Get already unlocked achievements
    unlocked = await db.user_achievements.find({"user_id": uid}, {"_id": 0}).to_list(100)
    unlocked_ids = {a["achievement_id"]: a for a in unlocked}
    
    # Check and unlock achievements
    achievements_result = []
    newly_unlocked = []
    
    for ach in ACHIEVEMENTS:
        condition = ach["condition"]
        is_unlocked = ach["id"] in unlocked_ids
        progress = 0
        target = 0
        
        # Calculate progress
        if "streak" in condition:
            target = condition["streak"]
            progress = min(longest_streak, target)
            should_unlock = longest_streak >= target
        elif "meals" in condition:
            target = condition["meals"]
            progress = min(meals_count, target)
            should_unlock = meals_count >= target
        elif "workouts" in condition:
            target = condition["workouts"]
            progress = min(workouts_count, target)
            should_unlock = workouts_count >= target
        elif "water_goal_days" in condition:
            target = condition["water_goal_days"]
            progress = min(water_goal_streak, target)
            should_unlock = water_goal_streak >= target
        elif "chats" in condition:
            target = condition["chats"]
            progress = min(chats_count, target)
            should_unlock = chats_count >= target
        elif "weekly_summaries" in condition:
            target = condition["weekly_summaries"]
            progress = min(summaries_count, target)
            should_unlock = summaries_count >= target
        elif "weight_logs" in condition:
            target = condition["weight_logs"]
            progress = min(weight_count, target)
            should_unlock = weight_count >= target
        else:
            should_unlock = False
        
        # Unlock if not already unlocked
        if should_unlock and not is_unlocked:
            unlock_data = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "achievement_id": ach["id"],
                "unlocked_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.user_achievements.insert_one(unlock_data)
            is_unlocked = True
            newly_unlocked.append(ach)
        
        achievements_result.append({
            "id": ach["id"],
            "name": ach["name"],
            "description": ach["desc"],
            "icon": ach["icon"],
            "category": ach["category"],
            "unlocked": is_unlocked,
            "progress": progress,
            "target": target,
            "unlocked_at": unlocked_ids.get(ach["id"], {}).get("unlocked_at") if is_unlocked else None,
        })
    
    # Sort: unlocked first, then by category
    achievements_result.sort(key=lambda x: (not x["unlocked"], x["category"], x["target"]))
    
    unlocked_count = len([a for a in achievements_result if a["unlocked"]])
    
    return {
        "achievements": achievements_result,
        "stats": {
            "total": len(ACHIEVEMENTS),
            "unlocked": unlocked_count,
            "percentage": round(unlocked_count / len(ACHIEVEMENTS) * 100),
        },
        "newly_unlocked": [{"id": a["id"], "name": a["name"], "icon": a["icon"]} for a in newly_unlocked],
        "user_stats": stats,
    }


# ── Data Export ────────────────────────────────────────────────

from fastapi.responses import StreamingResponse
import csv
import io
import json as json_lib

@app.get("/api/export/meals")
async def export_meals(
    format: str = Query("csv", enum=["csv", "json"]),
    days: int = Query(30, ge=1, le=365),
    user=Depends(get_current_user)
):
    """Export meal history as CSV or JSON."""
    db = get_db()
    uid = user["user_id"]
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    meals = await db.meals.find(
        {"user_id": uid, "date": {"$gte": start_date}},
        {"_id": 0, "user_id": 0}
    ).sort("date", -1).to_list(1000)
    
    if format == "json":
        return {"meals": meals, "count": len(meals), "days": days}
    
    # CSV format
    output = io.StringIO()
    if meals:
        fieldnames = ["date", "time", "meal_type", "description", "calories", "protein", "carbs", "fat"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for m in meals:
            writer.writerow(m)
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gymie_meals_{days}d.csv"}
    )


@app.get("/api/export/workouts")
async def export_workouts(
    format: str = Query("csv", enum=["csv", "json"]),
    days: int = Query(30, ge=1, le=365),
    user=Depends(get_current_user)
):
    """Export workout history as CSV or JSON."""
    db = get_db()
    uid = user["user_id"]
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    sessions = await db.workout_sessions.find(
        {"user_id": uid, "date": {"$gte": start_date}, "status": "completed"},
        {"_id": 0, "user_id": 0}
    ).sort("date", -1).to_list(500)
    
    if format == "json":
        return {"workouts": sessions, "count": len(sessions), "days": days}
    
    # CSV format - flatten exercises
    output = io.StringIO()
    fieldnames = ["date", "plan_name", "plan_type", "exercise", "sets", "total_reps", "max_weight"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for s in sessions:
        for ex in s.get("exercises", []):
            completed_sets = [st for st in ex.get("sets", []) if st.get("completed")]
            total_reps = sum(st.get("reps", 0) for st in completed_sets)
            max_weight = max((st.get("weight_kg", 0) for st in completed_sets), default=0)
            writer.writerow({
                "date": s.get("date"),
                "plan_name": s.get("plan_name"),
                "plan_type": s.get("plan_type"),
                "exercise": ex.get("name"),
                "sets": len(completed_sets),
                "total_reps": total_reps,
                "max_weight": max_weight,
            })
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gymie_workouts_{days}d.csv"}
    )


@app.get("/api/export/progress")
async def export_progress(
    format: str = Query("csv", enum=["csv", "json"]),
    days: int = Query(30, ge=1, le=365),
    user=Depends(get_current_user)
):
    """Export progress data (weight, water, checkins) as CSV or JSON."""
    db = get_db()
    uid = user["user_id"]
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    # Get all data
    metrics = await db.body_metrics.find(
        {"user_id": uid, "date": {"$gte": start_date}},
        {"_id": 0, "user_id": 0}
    ).sort("date", -1).to_list(365)
    
    water_logs = await db.water_logs.find(
        {"user_id": uid, "date": {"$gte": start_date}},
        {"_id": 0, "user_id": 0}
    ).to_list(2000)
    
    checkins = await db.daily_checkins.find(
        {"user_id": uid, "date": {"$gte": start_date}},
        {"_id": 0, "user_id": 0}
    ).sort("date", -1).to_list(365)
    
    # Aggregate water by date
    water_by_date = {}
    for w in water_logs:
        d = w.get("date", "")
        water_by_date[d] = water_by_date.get(d, 0) + w.get("amount_ml", 0)
    
    if format == "json":
        return {
            "weight_history": metrics,
            "water_by_date": [{"date": k, "total_ml": v} for k, v in sorted(water_by_date.items(), reverse=True)],
            "checkins": checkins,
            "days": days,
        }
    
    # CSV format - daily summary
    output = io.StringIO()
    fieldnames = ["date", "weight_kg", "water_ml", "sleep_quality", "energy_level", "mood"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    # Build date index
    weight_by_date = {m["date"]: m.get("weight") for m in metrics}
    checkin_by_date = {c["date"]: c for c in checkins}
    
    all_dates = set(weight_by_date.keys()) | set(water_by_date.keys()) | set(checkin_by_date.keys())
    for d in sorted(all_dates, reverse=True):
        checkin = checkin_by_date.get(d, {})
        writer.writerow({
            "date": d,
            "weight_kg": weight_by_date.get(d, ""),
            "water_ml": water_by_date.get(d, ""),
            "sleep_quality": checkin.get("sleep_quality", ""),
            "energy_level": checkin.get("energy_level", ""),
            "mood": checkin.get("mood", ""),
        })
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gymie_progress_{days}d.csv"}
    )
