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

    recent_messages = await db.chat_messages.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    recent_messages.reverse()

    context = {
        "user_name": user_doc.get("name", "Soldado") if user_doc else "Soldado",
        "profile": profile,
        "today": {
            "date": date,
            "meals": meals,
            "total_calories": sum(m.get("calories", 0) for m in meals),
            "total_protein": sum(m.get("protein", 0) for m in meals),
            "total_water_ml": sum(w.get("amount_ml", 0) for w in water_logs),
            "water_goal_ml": profile.get("water_goal_ml", 2500) if profile else 2500,
            "reminders": reminders,
            "checkin": checkin,
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

    return {"message": "Seed criado com sucesso", "user_id": user_id, "email": "demo@shape.com", "password": "demo123"}


@app.get("/api/health")
async def health():
    return {"status": "operational", "app": "Shape Inexplicavel"}
