"""
Auth Router - User registration, authentication, and password management
Extracted from server.py for better modularity
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
import re
import hashlib
import bcrypt
import jwt
import os

from dotenv import load_dotenv
load_dotenv()

# Create router
router = APIRouter(prefix="/api", tags=["auth"])

# Rate limiter for auth endpoints
limiter = Limiter(key_func=get_remote_address)

# JWT Configuration - MUST set JWT_SECRET in production environment
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    import secrets
    JWT_SECRET = secrets.token_hex(32)
    print("⚠️  WARNING: JWT_SECRET not set in environment. Using random secret (sessions will not persist across restarts)")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30


# Request models
class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


# Helper functions
def hash_password(password: str) -> str:
    """Hash password using bcrypt (secure for passwords)"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        # Handle both old SHA256 hashes (for migration) and new bcrypt hashes
        if len(hashed_password) == 64:  # SHA256 hex digest length
            # Legacy SHA256 hash - verify and encourage re-hash on next login
            return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
        # Bcrypt hash
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def convert_objectid(doc):
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [convert_objectid(d) for d in doc]
    if isinstance(doc, dict):
        return {k: (str(v) if k == "_id" else convert_objectid(v)) for k, v in doc.items()}
    return doc


# Database will be set from main server
db = None


def set_database(database):
    """Set the database instance from main server"""
    global db
    db = database


async def get_current_user(authorization: str = None):
    """Get current user from JWT token in Authorization header"""
    if not authorization:
        return None
    
    try:
        # Handle "Bearer <token>" format
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
        
        payload = decode_token(token)
        if not payload:
            return None
        
        username = payload.get("sub")
        if not username:
            return None
        
        user = await db.users.find_one({"username": username})
        return user
    except Exception:
        return None


@router.post("/user/register")
@limiter.limit("5/minute")  # Max 5 registration attempts per minute per IP
async def register_user(request: Request, body: RegisterRequest):
    """Register a new user with password (rate limited)"""
    # Import User model here to avoid circular imports
    from server import User
    
    username = body.username.strip()
    password = body.password
    
    # Validate username
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(username) > 20:
        raise HTTPException(status_code=400, detail="Username must be less than 20 characters")
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, and underscores")
    
    # Validate password
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if username exists
    existing = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user with hashed password
    user = User(
        username=username,
        password_hash=hash_password(password)
    )
    await db.users.insert_one(user.dict())
    
    # Create JWT token
    token = create_access_token(data={"sub": username})
    
    user_dict = user.dict()
    del user_dict["password_hash"]  # Don't send password hash to client
    
    return {
        "user": user_dict,
        "token": token,
        "message": "Account created successfully"
    }


@router.post("/auth/login")
async def auth_login(request: LoginRequest):
    """Authenticate user with password and return JWT token"""
    username = request.username.strip()
    password = request.password
    
    # Validate username format to prevent NoSQL injection
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Find user (case-insensitive)
    user = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Check if user has a password set
    if not user.get("password_hash"):
        # Legacy user without password - require password setup
        raise HTTPException(
            status_code=403, 
            detail="This account requires a password. Please set a password to continue."
        )
    
    # Verify password
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create JWT token
    token = create_access_token(data={"sub": user["username"]})
    
    # Return user data without password hash
    user_data = convert_objectid(user.copy())
    if "password_hash" in user_data:
        del user_data["password_hash"]
    
    return {
        "user": user_data,
        "token": token,
        "message": "Login successful"
    }


@router.post("/auth/set-password")
async def set_password(username: str, new_password: str):
    """Set password for a legacy account (users without passwords)"""
    # Validate username format to prevent NoSQL injection
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise HTTPException(status_code=404, detail="User not found")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account already has a password")
    
    # Set the password
    await db.users.update_one(
        {"username": user["username"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    # Create JWT token
    token = create_access_token(data={"sub": user["username"]})
    
    return {
        "message": "Password set successfully",
        "token": token
    }


@router.get("/auth/verify")
async def verify_auth(current_user: dict = Depends(get_current_user)):
    """Verify JWT token is valid and return user data"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_data = convert_objectid(current_user.copy())
    if "password_hash" in user_data:
        del user_data["password_hash"]
    
    return {"valid": True, "user": user_data}
