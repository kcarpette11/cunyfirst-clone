# api/notifications.py - Notification endpoints
from fastapi import APIRouter, HTTPException
from models.request_models import MarkNotificationReadRequest
from database import get_conn

router = APIRouter()

@router.get("/api/notifications/{user_id}")
async def get_notifications(user_id: int):
    """Get all notifications for a user"""
    with get_conn() as conn:
        notifications = conn.execute("""
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,)).fetchall()
        
        return {"notifications": [dict(n) for n in notifications]}

@router.post("/api/notifications/read")
async def mark_notification_read(req: MarkNotificationReadRequest):
    """Mark a single notification as read"""
    with get_conn() as conn:
        conn.execute("""
            UPDATE notifications SET read = 1 WHERE id = ?
        """, (req.notificationId,))
        
        return {"success": True}

@router.post("/api/notifications/read-all/{user_id}")
async def mark_all_notifications_read(user_id: int):
    """Mark all notifications for a user as read"""
    with get_conn() as conn:
        conn.execute("""
            UPDATE notifications SET read = 1 WHERE user_id = ?
        """, (user_id,))
        
        return {"success": True}

@router.post("/api/notifications/create")
async def create_notification(user_id: int, message: str, type: str = "info"):
    """Create a new notification (internal use)"""
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO notifications (user_id, message, type, created_at)
            VALUES (?, ?, ?, datetime('now'))
        """, (user_id, message, type))
        
        return {"success": True}