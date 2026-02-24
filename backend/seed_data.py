"""Seed data for Gymie demo user."""
import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "shape_inexplicavel"


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Demo user
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw("demo123".encode(), bcrypt.gensalt()).decode()
    
    # Check if user exists
    existing = await db.users.find_one({"email": "demo@shape.com"})
    if existing:
        print("Demo user already exists, updating...")
        user_id = existing["_id"]
    else:
        user = {
            "_id": user_id,
            "email": "demo@shape.com",
            "name": "Demo User",
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        print(f"Created demo user: {user_id}")
    
    # Profile
    profile = {
        "user_id": user_id,
        "weight": 75,
        "height": 175,
        "goal": "emagrecer",
        "goal_weight": 70,
        "routine": {
            "wake_time": "07:00",
            "sleep_time": "23:00",
            "work_schedule": "08:00-18:00",
        },
        "training_days": ["segunda", "quarta", "sexta"],
        "water_goal_ml": 2500,
        "persona_style": "tactical",
        "reminder_times": ["08:00", "11:00", "12:00", "17:30", "21:15", "23:00"],
        "calorie_target": 2000,
        "protein_target": 150,
        "carb_target": 200,
        "fat_target": 65,
        "onboarding_completed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile},
        upsert=True,
    )
    print("Created/updated profile")
    
    # Meals for today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meals_data = [
        {"desc": "Ovos mexidos com pao integral", "type": "breakfast", "time": "07:30", "cal": 350, "prot": 20, "carb": 30, "fat": 18},
        {"desc": "Banana com pasta de amendoim", "type": "snack", "time": "10:00", "cal": 200, "prot": 6, "carb": 28, "fat": 9},
        {"desc": "Frango grelhado com arroz e salada", "type": "lunch", "time": "12:30", "cal": 550, "prot": 45, "carb": 50, "fat": 15},
    ]
    for m in meals_data:
        await db.meals.update_one(
            {"user_id": user_id, "date": today, "description": m["desc"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "date": today,
                "description": m["desc"],
                "meal_type": m["type"],
                "time": m["time"],
                "calories": m["cal"],
                "protein": m["prot"],
                "carbs": m["carb"],
                "fat": m["fat"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    print("Created meals")
    
    # Water logs
    for ml in [300, 250, 300, 200]:
        await db.water_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "date": today,
            "amount_ml": ml,
            "time": datetime.now(timezone.utc).strftime("%H:%M"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    print("Created water logs")
    
    # Reminders
    reminders = [
        {"label": "Treino", "time": "17:30"},
        {"label": "Jantar", "time": "19:00"},
        {"label": "Check-in noturno", "time": "22:00"},
    ]
    for r in reminders:
        await db.reminders.update_one(
            {"user_id": user_id, "date": today, "label": r["label"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "date": today,
                "label": r["label"],
                "scheduled_at": r["time"],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    print("Created reminders")
    
    # Check-ins for streak (past 6 days + today)
    for i in range(0, 7):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        await db.daily_checkins.update_one(
            {"user_id": user_id, "date": date},
            {"$set": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "date": date,
                "sleep_quality": 4,
                "energy_level": 4,
                "mood": "bom",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    print("Created check-ins (7 days streak)")
    
    # Workout plan
    workout_plan = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": "Peito e Triceps",
        "plan_type": "A",
        "exercises": [
            {"name": "Supino Reto", "sets": 4, "reps": "10", "weight_kg": 60, "rest_seconds": 90},
            {"name": "Supino Inclinado", "sets": 3, "reps": "12", "weight_kg": 40, "rest_seconds": 60},
            {"name": "Crucifixo", "sets": 3, "reps": "15", "weight_kg": 14, "rest_seconds": 60},
            {"name": "Triceps Pulley", "sets": 4, "reps": "12", "weight_kg": 25, "rest_seconds": 60},
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workout_plans.update_one(
        {"user_id": user_id, "plan_type": "A"},
        {"$set": workout_plan},
        upsert=True,
    )
    print("Created workout plan")
    
    # Body metrics
    for i in range(7):
        date = (datetime.now(timezone.utc) - timedelta(days=6-i)).strftime("%Y-%m-%d")
        weight = 75.5 - (i * 0.1)  # Slight weight loss trend
        await db.body_metrics.update_one(
            {"user_id": user_id, "date": date},
            {"$set": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "date": date,
                "weight": round(weight, 1),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    print("Created body metrics")
    
    # Memory facts
    facts = [
        {"fact": "Prefere treinar pela manha", "category": "preference"},
        {"fact": "Intolerancia a lactose", "category": "health"},
        {"fact": "Meta: perder 5kg ate marco", "category": "general"},
        {"fact": "Gosta de frango e ovos", "category": "preference"},
        {"fact": "Trabalha de casa", "category": "general"},
        {"fact": "Dorme tarde nos finais de semana", "category": "general"},
    ]
    for f in facts:
        await db.memory_facts.update_one(
            {"user_id": user_id, "fact": f["fact"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "fact": f["fact"],
                "category": f["category"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    print("Created memory facts")
    
    # Chat thread
    thread_id = str(uuid.uuid4())
    await db.chat_threads.update_one(
        {"user_id": user_id, "title": "Conversa principal"},
        {"$set": {
            "id": thread_id,
            "user_id": user_id,
            "mode": "companion",
            "title": "Conversa principal",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    print("Created chat thread")
    
    print("\n✅ Seed completed!")
    print(f"Login: demo@shape.com / demo123")


if __name__ == "__main__":
    asyncio.run(seed())
