from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.notifications.models import Notification
from src.modules.notifications.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).all()
    return notifications

@router.post("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")
    
    notification.is_read = True
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "success"}
