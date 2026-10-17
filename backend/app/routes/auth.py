"""Admin website sign-in with bearer tokens."""

from fastapi import APIRouter, HTTPException
from app.database import Database
from app.models import Admin, AdminLogin, AdminSession
from app.security import (
    BearerToken,
    CurrentAdmin,
    authenticate_admin,
    end_admin_session,
    start_admin_session,
)

router = APIRouter(prefix="/auth", tags=["admin auth"])


@router.post("/login", response_model=AdminSession)
def login(body: AdminLogin, database: Database):
    admin = authenticate_admin(database, body.identifier, body.password)
    if admin is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return AdminSession(access_token=start_admin_session(database, admin), user=admin)


@router.get("/me", response_model=Admin)
def me(admin: CurrentAdmin):
    return admin


@router.post("/logout", status_code=204)
def logout(_admin: CurrentAdmin, token: BearerToken, database: Database):
    if token is not None:
        end_admin_session(database, token.credentials)
