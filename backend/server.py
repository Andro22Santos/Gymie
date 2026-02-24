import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import jwt as pyjwt
import bcrypt

from ai_service import generate_ai_response, generate_reminder_message
from agents import orchestrate_response, analyze_meal_photo, get_agents_info, classify_intent

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


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
    yield
    app.state.mongo_client.close()


app = FastAPI(title="Shape Inexplicavel API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    content: str
    mode: Optional[str] = "companion"

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


# ── Auth Endpoints ───────────────────────────────────────────

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
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
async def login(req: LoginRequest):
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


# ── Profile / Onboarding ────────────────────────────────────

@app.get("/api/me")
async def get_me(user=Depends(get_current_user)):
    db = get_db()
    u = await db.users.find_one({"_id": user["user_id"]})
    profile = await db.user_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    return {
        "user_id": u["_id"],
        "name": u["name"],
        "email": u["email"],
        "profile": profile,
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
async def send_message(thread_id: str, req: ChatMessageCreate, user=Depends(get_current_user)):
    db = get_db()
    uid = user["user_id"]

    # Save user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id,
        "user_id": uid,
        "role": "user",
        "content": req.content,
        "mode": req.mode or "companion",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat_messages.insert_one(user_msg)
    del user_msg["_id"]

    # Build context for AI
    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
    user_doc = await db.users.find_one({"_id": uid})
    date = today_str()
    meals = await db.meals.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    water_logs = await db.water_logs.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    reminders = await db.reminders.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(50)
    checkin = await db.daily_checkins.find_one({"user_id": uid, "date": date}, {"_id": 0})
    memory_facts = await db.memory_facts.find({"user_id": uid}, {"_id": 0}).to_list(20)
    workout_sessions_today = await db.workout_sessions.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(5)

    recent_messages = await db.chat_messages.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    recent_messages.reverse()

    context = {
        "user_name": user_doc.get("name", "Soldado") if user_doc else "Soldado",
        "profile": profile,
        "memory_facts": memory_facts,
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
    if req.mode:
        mode = req.mode
    else:
        mode = "companion"

    # Generate AI response
    try:
        ai_result = await generate_ai_response(
            api_key=EMERGENT_LLM_KEY,
            user_message=req.content,
            context=context,
            persona_style=persona_style,
            mode=mode,
            thread_id=thread_id,
        )
        ai_text = ai_result.get("message_text", "Desculpe, nao consegui processar sua mensagem.")
    except Exception as e:
        ai_text = f"Sistema temporariamente indisponivel. Tente novamente em instantes."
        print(f"AI Error: {e}")

    # Save AI message
    ai_msg = {
        "id": str(uuid.uuid4()),
        "thread_id": thread_id,
        "user_id": uid,
        "role": "assistant",
        "content": ai_text,
        "mode": mode,
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
    today = today_str()

    # Weight trend
    metrics = await db.body_metrics.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    latest_weight = metrics[0]["weight"] if metrics else None
    weight_change = None
    if len(metrics) >= 2:
        weight_change = round(metrics[0]["weight"] - metrics[-1]["weight"], 1)

    # Workouts this week
    week_sessions = await db.workout_sessions.find(
        {"user_id": uid, "date": {"$gte": week_ago}, "status": "completed"}, {"_id": 0}
    ).to_list(20)
    workouts_this_week = len(week_sessions)

    # Water average (last 7 days)
    water_pipeline = [
        {"$match": {"user_id": uid, "date": {"$gte": week_ago}}},
        {"$group": {"_id": "$date", "total": {"$sum": "$amount_ml"}}},
    ]
    water_daily = await db.water_logs.aggregate(water_pipeline).to_list(7)
    avg_water = round(sum(d["total"] for d in water_daily) / max(len(water_daily), 1)) if water_daily else 0

    # Meals consistency
    meals_pipeline = [
        {"$match": {"user_id": uid, "date": {"$gte": week_ago}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
    ]
    meals_daily = await db.meals.aggregate(meals_pipeline).to_list(7)
    days_with_meals = len(meals_daily)

    # Checkin consistency
    checkins = await db.daily_checkins.find({"user_id": uid, "date": {"$gte": week_ago}}, {"_id": 0}).to_list(7)
    checkin_days = len(checkins)
    avg_energy = round(sum(c.get("energy_level", 0) for c in checkins) / max(len(checkins), 1), 1) if checkins else 0
    avg_sleep = round(sum(c.get("sleep_quality", 0) for c in checkins) / max(len(checkins), 1), 1) if checkins else 0

    profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})

    return {
        "latest_weight": latest_weight,
        "weight_change": weight_change,
        "goal_weight": profile.get("goal_weight") if profile else None,
        "workouts_this_week": workouts_this_week,
        "training_days_target": len(profile.get("training_days", [])) if profile else 4,
        "avg_water_ml": avg_water,
        "water_goal_ml": profile.get("water_goal_ml", 2500) if profile else 2500,
        "days_with_meals": days_with_meals,
        "checkin_days": checkin_days,
        "avg_energy": avg_energy,
        "avg_sleep": avg_sleep,
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


# ── Photo Upload ─────────────────────────────────────────────

@app.post("/api/upload/photo")
async def upload_photo(user=Depends(get_current_user)):
    from fastapi import File, UploadFile
    return {"message": "Upload de foto disponivel em breve. Use photo_url no campo de refeicao."}


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
    return {"status": "operational", "app": "Shape Inexplicavel"}
