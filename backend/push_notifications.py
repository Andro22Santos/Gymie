"""
Push Notifications Service
==========================

This module provides the architecture for push notifications.
Currently using a mock implementation. 

TODO: To enable real push notifications:
1. Create a Firebase project at https://console.firebase.google.com/
2. Generate a service account key (Project Settings > Service Accounts)
3. Set the FIREBASE_CREDENTIALS_PATH env var to the JSON key file path
4. Install firebase-admin: pip install firebase-admin
5. Uncomment the FCM implementation below

Notification Types:
- reminder: Scheduled habit reminders
- checkin: Daily check-in prompts
- achievement: Progress milestones
- water: Hydration reminders
- meal: Meal logging reminders
- workout: Workout day reminders
- ai_insight: AI-generated insights
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

# TODO: Uncomment when Firebase is configured
# import firebase_admin
# from firebase_admin import credentials, messaging


class PushToken(BaseModel):
    token: str
    platform: str = "web"  # web | ios | android
    device_id: Optional[str] = None


class NotificationPayload(BaseModel):
    title: str
    body: str
    notification_type: str = "general"
    data: Optional[dict] = None
    image_url: Optional[str] = None
    action_url: Optional[str] = None


class NotificationResult(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


# In-memory store for demo (replace with DB in production)
_push_tokens = {}
_notification_log = []


class PushNotificationService:
    """
    Push Notification Service with mock implementation.
    Can be extended to use FCM, APNs, or other providers.
    """
    
    def __init__(self):
        self.initialized = False
        self._init_fcm()
    
    def _init_fcm(self):
        """
        Initialize Firebase Cloud Messaging.
        Currently mocked - uncomment FCM code when credentials are available.
        """
        # TODO: Uncomment when Firebase is configured
        # cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        # if cred_path and os.path.exists(cred_path):
        #     cred = credentials.Certificate(cred_path)
        #     firebase_admin.initialize_app(cred)
        #     self.initialized = True
        #     print("Firebase initialized successfully")
        # else:
        #     print("Firebase credentials not found - using mock implementation")
        
        self.initialized = False  # Mock mode
        print("Push Notifications: Mock mode (FCM not configured)")
    
    async def register_token(self, user_id: str, token: PushToken) -> dict:
        """Register a push notification token for a user."""
        if user_id not in _push_tokens:
            _push_tokens[user_id] = []
        
        # Remove existing token for same device
        _push_tokens[user_id] = [
            t for t in _push_tokens[user_id] 
            if t.get("device_id") != token.device_id
        ]
        
        token_data = {
            "id": str(uuid.uuid4()),
            "token": token.token,
            "platform": token.platform,
            "device_id": token.device_id or str(uuid.uuid4()),
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        _push_tokens[user_id].append(token_data)
        
        return {"success": True, "token_id": token_data["id"]}
    
    async def unregister_token(self, user_id: str, token: str) -> dict:
        """Remove a push notification token."""
        if user_id in _push_tokens:
            _push_tokens[user_id] = [
                t for t in _push_tokens[user_id] if t.get("token") != token
            ]
        return {"success": True}
    
    async def get_user_tokens(self, user_id: str) -> List[dict]:
        """Get all registered tokens for a user."""
        return _push_tokens.get(user_id, [])
    
    async def send_notification(
        self, 
        user_id: str, 
        payload: NotificationPayload
    ) -> NotificationResult:
        """
        Send a push notification to a user.
        Currently mocked - logs notification instead of sending.
        """
        tokens = await self.get_user_tokens(user_id)
        
        if not tokens:
            return NotificationResult(
                success=False, 
                error="No tokens registered for user"
            )
        
        # Mock implementation - log notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": payload.title,
            "body": payload.body,
            "type": payload.notification_type,
            "data": payload.data,
            "status": "sent" if self.initialized else "mocked",
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "tokens_targeted": len(tokens),
        }
        _notification_log.append(notification)
        
        # TODO: Uncomment when Firebase is configured
        # if self.initialized:
        #     for token_info in tokens:
        #         try:
        #             message = messaging.Message(
        #                 notification=messaging.Notification(
        #                     title=payload.title,
        #                     body=payload.body,
        #                     image=payload.image_url,
        #                 ),
        #                 data=payload.data or {},
        #                 token=token_info["token"],
        #             )
        #             response = messaging.send(message)
        #             notification["fcm_response"] = response
        #         except Exception as e:
        #             notification["error"] = str(e)
        
        print(f"[PUSH] {payload.notification_type}: {payload.title} -> {user_id}")
        
        return NotificationResult(
            success=True,
            message_id=notification["id"],
        )
    
    async def send_bulk_notification(
        self,
        user_ids: List[str],
        payload: NotificationPayload
    ) -> dict:
        """Send notification to multiple users."""
        results = {"sent": 0, "failed": 0, "errors": []}
        
        for user_id in user_ids:
            result = await self.send_notification(user_id, payload)
            if result.success:
                results["sent"] += 1
            else:
                results["failed"] += 1
                results["errors"].append({"user_id": user_id, "error": result.error})
        
        return results
    
    async def get_notification_log(
        self, 
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> List[dict]:
        """Get notification history (for debugging)."""
        logs = _notification_log
        if user_id:
            logs = [n for n in logs if n.get("user_id") == user_id]
        return sorted(logs, key=lambda x: x.get("sent_at", ""), reverse=True)[:limit]


# Singleton instance
push_service = PushNotificationService()


# Convenience functions for common notification types

async def send_reminder_notification(user_id: str, reminder_label: str, scheduled_time: str):
    """Send a habit reminder notification."""
    await push_service.send_notification(user_id, NotificationPayload(
        title="🎯 Missão do Gymie",
        body=f"{reminder_label} - {scheduled_time}",
        notification_type="reminder",
        data={"action": "view_reminder"},
        action_url="/",
    ))


async def send_checkin_notification(user_id: str):
    """Send daily check-in reminder."""
    await push_service.send_notification(user_id, NotificationPayload(
        title="📊 Check-in do dia",
        body="Como você está? Registre seu sono, energia e humor.",
        notification_type="checkin",
        data={"action": "do_checkin"},
        action_url="/",
    ))


async def send_water_reminder(user_id: str, current_ml: int, goal_ml: int):
    """Send hydration reminder."""
    pct = int(current_ml / goal_ml * 100) if goal_ml > 0 else 0
    await push_service.send_notification(user_id, NotificationPayload(
        title="💧 Hora de beber água",
        body=f"Você está em {pct}% da meta. Beba mais água!",
        notification_type="water",
        data={"action": "add_water", "current_ml": current_ml, "goal_ml": goal_ml},
        action_url="/",
    ))


async def send_workout_reminder(user_id: str, plan_name: str):
    """Send workout day reminder."""
    await push_service.send_notification(user_id, NotificationPayload(
        title="💪 Dia de treino!",
        body=f"Hoje é dia de {plan_name}. Bora treinar?",
        notification_type="workout",
        data={"action": "start_workout", "plan_name": plan_name},
        action_url="/workout",
    ))


async def send_achievement_notification(user_id: str, achievement: str, description: str):
    """Send achievement/milestone notification."""
    await push_service.send_notification(user_id, NotificationPayload(
        title="🏆 Conquista desbloqueada!",
        body=f"{achievement}: {description}",
        notification_type="achievement",
        data={"action": "view_achievement", "achievement": achievement},
        action_url="/progress",
    ))
