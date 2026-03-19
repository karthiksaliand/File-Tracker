from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

TAHSILDAR_LOCATIONS = [
    "Mangaluru", "Bantwal", "Mulki", "Moodabidri",
    "Puttur", "Sulya", "Kadaba", "Ullala", "Belthangady"
]

DEPARTMENTS = ["tahsildar", "sp", "forest"]

# ==================== MODELS ====================

class LoginRequest(BaseModel):
    username: str
    password: str

class FileCreateRequest(BaseModel):
    file_no: str
    year: str
    description: str
    tahsildar_location: str
    departments: List[str] = ["tahsildar", "sp", "forest"]
    priority: str = "normal"  # "normal" or "high"

class FileEditRequest(BaseModel):
    file_no: Optional[str] = None
    year: Optional[str] = None
    description: Optional[str] = None
    tahsildar_location: Optional[str] = None
    priority: Optional[str] = None

class AdminFileEditRequest(BaseModel):
    file_no: Optional[str] = None
    year: Optional[str] = None
    description: Optional[str] = None
    tahsildar_location: Optional[str] = None
    status: Optional[str] = None
    is_locked: Optional[bool] = None
    dc_decision: Optional[str] = None
    dc_remark: Optional[str] = None
    adc_remark: Optional[str] = None
    adc_decision: Optional[str] = None
    priority: Optional[str] = None
    departments: Optional[List[str]] = None

class ApprovalRequest(BaseModel):
    decision: str
    remark: str = ""

class ADCRemarkRequest(BaseModel):
    remark: str

class ADCDecisionRequest(BaseModel):
    decision: str
    remark: str = ""

class DCDecisionRequest(BaseModel):
    decision: str
    remark: str = ""

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str
    display_name: str
    department: str = ""

class UserEditRequest(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None

class PasswordResetRequest(BaseModel):
    new_password: str

# ==================== AUTH HELPERS ====================

def create_token(user_id: str, role: str, department: str):
    payload = {
        "user_id": user_id,
        "role": role,
        "department": department,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user or not user.get("is_active"):
            raise HTTPException(status_code=401, detail="Invalid user")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request):
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def log_audit(user_id, user_name, user_role, action, file_id="", file_number="", details=""):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "user_role": user_role,
        "action": action,
        "file_id": file_id,
        "file_number": file_number,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# ==================== SEED DATA ====================

async def seed_default_users():
    count = await db.users.count_documents({})
    if count > 0:
        return

    default_users = [
        {"username": "admin", "password": "admin123", "role": "admin", "display_name": "System Admin", "department": "Administration"},
        {"username": "caseworker", "password": "case123", "role": "case_worker", "display_name": "Case Worker", "department": "Filing"},
        {"username": "tah_mangaluru", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Mangaluru", "department": "Mangaluru"},
        {"username": "tah_bantwal", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Bantwal", "department": "Bantwal"},
        {"username": "tah_mulki", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Mulki", "department": "Mulki"},
        {"username": "tah_moodabidri", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Moodabidri", "department": "Moodabidri"},
        {"username": "tah_puttur", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Puttur", "department": "Puttur"},
        {"username": "tah_sulya", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Sulya", "department": "Sulya"},
        {"username": "tah_kadaba", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Kadaba", "department": "Kadaba"},
        {"username": "tah_ullala", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Ullala", "department": "Ullala"},
        {"username": "tah_belthangady", "password": "tah123", "role": "tahsildar", "display_name": "Tahsildar - Belthangady", "department": "Belthangady"},
        {"username": "forest", "password": "forest123", "role": "forest_officer", "display_name": "Forest Officer (DFO/DCF)", "department": "Forest"},
        {"username": "sp", "password": "sp123", "role": "sp", "display_name": "Superintendent of Police", "department": "Police"},
        {"username": "adc", "password": "adc123", "role": "adc", "display_name": "Assistant Commissioner", "department": "Revenue"},
        {"username": "dc", "password": "dc123", "role": "dc", "display_name": "Deputy Commissioner", "department": "Revenue"},
    ]

    for u in default_users:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": u["username"],
            "password_hash": hash_password(u["password"]),
            "role": u["role"],
            "display_name": u["display_name"],
            "department": u["department"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    logger.info("Seeded %d default users", len(default_users))

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"username": req.username}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_token(user["id"], user["role"], user["department"])
    await log_audit(user["id"], user["display_name"], user["role"], "login", details="User logged in")

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "display_name": user["display_name"],
            "department": user["department"]
        }
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "display_name": user["display_name"],
        "department": user["department"],
        "is_active": user["is_active"]
    }

@api_router.post("/auth/logout")
async def auth_logout(user=Depends(get_current_user)):
    await log_audit(user["id"], user["display_name"], user["role"], "logout", details="User logged out")
    return {"message": "Logged out successfully"}

# ==================== FILE ROUTES ====================

async def generate_file_number(file_no: str, year: str):
    return f"DK/FILE/{year}/{file_no}"

@api_router.post("/files")
async def create_file(req: FileCreateRequest, user=Depends(get_current_user)):
    if user["role"] not in ["case_worker", "admin"]:
        raise HTTPException(status_code=403, detail="Only case workers or admin can create files")

    if req.tahsildar_location not in TAHSILDAR_LOCATIONS:
        raise HTTPException(status_code=400, detail="Invalid tahsildar location")

    if req.priority not in ["normal", "high"]:
        raise HTTPException(status_code=400, detail="Priority must be normal or high")

    # Validate departments
    valid_depts = {"tahsildar", "sp", "forest"}
    selected_depts = [d for d in req.departments if d in valid_depts]
    if not selected_depts:
        selected_depts = list(valid_depts)

    file_number = await generate_file_number(req.file_no, req.year)
    file_doc = {
        "id": str(uuid.uuid4()),
        "file_number": file_number,
        "file_no": req.file_no,
        "year": req.year,
        "description": req.description,
        "tahsildar_location": req.tahsildar_location,
        "departments": selected_depts,
        "priority": req.priority,
        "status": "draft",
        "is_locked": False,
        "created_by": user["id"],
        "created_by_name": user["display_name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "submitted_at": None,
        "deadline": None,
        "dc_decision": None,
        "dc_remark": "",
        "dc_decided_at": None,
        "dc_decided_by": None,
        "adc_decision": None,
        "adc_remark": "",
        "adc_remark_at": None,
        "adc_remark_by": None,
    }
    await db.files.insert_one(file_doc)
    await log_audit(user["id"], user["display_name"], user["role"], "create_file", file_doc["id"], file_number, f"Created file {file_number} [priority: {req.priority}]")

    file_doc.pop("_id", None)
    return file_doc

@api_router.get("/files")
async def list_files(user=Depends(get_current_user), status: Optional[str] = None, search: Optional[str] = None, priority: Optional[str] = None, limit: int = 100, skip: int = 0):
    query = {}
    role = user["role"]
    dept = user["department"]

    if role == "case_worker":
        query["created_by"] = user["id"]
    elif role == "tahsildar":
        query["tahsildar_location"] = dept
        query["status"] = {"$ne": "draft"}
    elif role == "sp":
        query["status"] = {"$ne": "draft"}
        query["departments"] = "sp"
    elif role == "forest_officer":
        query["status"] = {"$ne": "draft"}
        query["departments"] = "forest"

    if status and status != "all":
        query["status"] = status

    if priority and priority != "all":
        query["priority"] = priority

    if search:
        query["$or"] = [
            {"file_number": {"$regex": search, "$options": "i"}},
            {"file_no": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    projection = {"_id": 0, "id": 1, "file_number": 1, "file_no": 1, "year": 1,
                  "description": 1, "tahsildar_location": 1, "status": 1, "priority": 1,
                  "departments": 1,
                  "is_locked": 1, "created_by": 1, "created_by_name": 1, "created_at": 1,
                  "submitted_at": 1, "deadline": 1, "dc_decision": 1, "adc_decision": 1}
    files = await db.files.find(query, projection).sort("created_at", -1).skip(skip).limit(min(limit, 200)).to_list(min(limit, 200))

    # Batch fetch all approvals for non-draft files
    non_draft_ids = [f["id"] for f in files if f.get("status") != "draft"]
    approvals_by_file = {}
    if non_draft_ids:
        all_approvals = await db.approvals.find({"file_id": {"$in": non_draft_ids}}, {"_id": 0}).to_list(len(non_draft_ids) * 4)
        for appr in all_approvals:
            if appr["file_id"] not in approvals_by_file:
                approvals_by_file[appr["file_id"]] = []
            approvals_by_file[appr["file_id"]].append(appr)

    for f in files:
        if f.get("status") != "draft":
            file_approvals = approvals_by_file.get(f["id"], [])
            f["approvals_summary"] = {
                a["department"]: {"decision": a["decision"], "department_detail": a.get("department_detail", "")}
                for a in file_approvals
            }
        else:
            f["approvals_summary"] = {}

    return files

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, user=Depends(get_current_user)):
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    approvals = await db.approvals.find({"file_id": file_id}, {"_id": 0}).to_list(10)
    file_doc["approvals"] = approvals

    audits = await db.audit_logs.find({"file_id": file_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    file_doc["audit_log"] = audits

    return file_doc

@api_router.put("/files/{file_id}")
async def edit_file(file_id: str, req: FileEditRequest, user=Depends(get_current_user)):
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    if user["role"] == "case_worker":
        if file_doc["is_locked"]:
            raise HTTPException(status_code=403, detail="File is locked after submission")
        if file_doc["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your file")
    elif user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No edit permission")

    updates = {}
    for field in ["file_no", "year", "description", "tahsildar_location", "priority"]:
        val = getattr(req, field)
        if val is not None:
            updates[field] = val

    if "file_no" in updates or "year" in updates:
        new_file_no = updates.get("file_no", file_doc.get("file_no", ""))
        new_year = updates.get("year", file_doc.get("year", ""))
        updates["file_number"] = f"DK/FILE/{new_year}/{new_file_no}"

    if updates:
        await db.files.update_one({"id": file_id}, {"$set": updates})
        await log_audit(user["id"], user["display_name"], user["role"], "edit_file", file_id, file_doc["file_number"], f"Edited: {', '.join(updates.keys())}")

    updated = await db.files.find_one({"id": file_id}, {"_id": 0})
    return updated

@api_router.post("/files/{file_id}/submit")
async def submit_file(file_id: str, user=Depends(get_current_user)):
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    if file_doc["status"] != "draft":
        raise HTTPException(status_code=400, detail="File already submitted")
    if user["role"] == "case_worker" and file_doc["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your file")
    elif user["role"] not in ["case_worker", "admin"]:
        raise HTTPException(status_code=403, detail="No permission")

    now = datetime.now(timezone.utc).isoformat()
    deadline = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    await db.files.update_one({"id": file_id}, {"$set": {
        "status": "submitted",
        "is_locked": True,
        "submitted_at": now,
        "deadline": deadline,
    }})

    # Create approvals only for selected departments
    selected_depts = file_doc.get("departments", ["tahsildar", "sp", "forest"])
    approvals = []
    notifs = []

    if "tahsildar" in selected_depts:
        approvals.append({
            "id": str(uuid.uuid4()), "file_id": file_id,
            "department": "tahsildar", "department_detail": file_doc["tahsildar_location"],
            "decision": None, "remark": "", "decided_by": None, "decided_at": None,
            "is_locked": False, "last_reminder_at": now, "created_at": now,
        })
        notifs.append({
            "id": str(uuid.uuid4()), "target_role": "tahsildar", "target_department": file_doc["tahsildar_location"],
            "file_id": file_id, "file_number": file_doc["file_number"], "type": "new_file",
            "title": "New File Assigned", "message": f"File {file_doc['file_number']} assigned for your review.", "is_read": False, "created_at": now
        })

    if "sp" in selected_depts:
        approvals.append({
            "id": str(uuid.uuid4()), "file_id": file_id,
            "department": "sp", "department_detail": "Police",
            "decision": None, "remark": "", "decided_by": None, "decided_at": None,
            "is_locked": False, "last_reminder_at": now, "created_at": now,
        })
        notifs.append({
            "id": str(uuid.uuid4()), "target_role": "sp", "target_department": "",
            "file_id": file_id, "file_number": file_doc["file_number"], "type": "new_file",
            "title": "New File for Review", "message": f"File {file_doc['file_number']} requires SP review.", "is_read": False, "created_at": now
        })

    if "forest" in selected_depts:
        approvals.append({
            "id": str(uuid.uuid4()), "file_id": file_id,
            "department": "forest", "department_detail": "Forest",
            "decision": None, "remark": "", "decided_by": None, "decided_at": None,
            "is_locked": False, "last_reminder_at": now, "created_at": now,
        })
        notifs.append({
            "id": str(uuid.uuid4()), "target_role": "forest_officer", "target_department": "",
            "file_id": file_id, "file_number": file_doc["file_number"], "type": "new_file",
            "title": "New File for Review", "message": f"File {file_doc['file_number']} requires Forest review.", "is_read": False, "created_at": now
        })

    # Always notify ADC
    notifs.append({
        "id": str(uuid.uuid4()), "target_role": "adc", "target_department": "",
        "file_id": file_id, "file_number": file_doc["file_number"], "type": "new_file",
        "title": "New File Created", "message": f"File {file_doc['file_number']} submitted for review.", "is_read": False, "created_at": now
    })

    if approvals:
        await db.approvals.insert_many(approvals)
    if notifs:
        await db.notifications.insert_many(notifs)

    await log_audit(user["id"], user["display_name"], user["role"], "submit_file", file_id, file_doc["file_number"], f"File submitted to depts: {', '.join(selected_depts)}")

    updated = await db.files.find_one({"id": file_id}, {"_id": 0})
    return updated

# ==================== APPROVAL ROUTES ====================

@api_router.post("/files/{file_id}/approval")
async def submit_approval(file_id: str, req: ApprovalRequest, user=Depends(get_current_user)):
    if req.decision not in ["approve", "reject", "na"]:
        raise HTTPException(status_code=400, detail="Decision must be approve, reject, or na")

    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    dept_map = {"tahsildar": "tahsildar", "sp": "sp", "forest_officer": "forest"}
    if user["role"] not in dept_map and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No approval permission")

    dept = dept_map.get(user["role"])
    query = {"file_id": file_id, "department": dept}
    if user["role"] == "tahsildar":
        query["department_detail"] = user["department"]

    approval = await db.approvals.find_one(query, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="No approval record found")
    if approval["is_locked"]:
        raise HTTPException(status_code=400, detail="Approval already submitted")

    # Forest can use na, others cannot
    if req.decision == "na" and user["role"] != "forest_officer" and user["role"] != "admin":
        raise HTTPException(status_code=400, detail="Only Forest department can use N/A")

    now = datetime.now(timezone.utc).isoformat()
    await db.approvals.update_one({"id": approval["id"]}, {"$set": {
        "decision": req.decision, "remark": req.remark,
        "decided_by": user["id"], "decided_at": now, "is_locked": True,
    }})

    await log_audit(user["id"], user["display_name"], user["role"], "submit_approval", file_id, file_doc["file_number"], f"{dept} decision: {req.decision}")

    all_approvals = await db.approvals.find({"file_id": file_id}, {"_id": 0}).to_list(10)
    if all(a["decision"] is not None for a in all_approvals):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "target_role": "dc", "target_department": "",
            "file_id": file_id, "file_number": file_doc["file_number"],
            "type": "all_approvals_complete", "title": "All Departments Responded",
            "message": f"All reviews complete for {file_doc['file_number']}. Awaiting your decision.",
            "is_read": False, "created_at": now,
        })

    return {"message": "Approval submitted successfully"}

# ==================== ADC ROUTES ====================

@api_router.post("/files/{file_id}/adc-remark")
async def add_adc_remark(file_id: str, req: ADCRemarkRequest, user=Depends(get_current_user)):
    if user["role"] not in ["adc", "admin"]:
        raise HTTPException(status_code=403, detail="Only ADC can add remarks")

    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.files.update_one({"id": file_id}, {"$set": {
        "adc_remark": req.remark, "adc_remark_at": now, "adc_remark_by": user["id"],
    }})

    await log_audit(user["id"], user["display_name"], user["role"], "adc_remark", file_id, file_doc["file_number"], "ADC remark added")
    return {"message": "Remark added successfully"}

@api_router.post("/files/{file_id}/adc-decision")
async def adc_decision(file_id: str, req: ADCDecisionRequest, user=Depends(get_current_user)):
    if user["role"] not in ["adc", "admin"]:
        raise HTTPException(status_code=403, detail="Only ADC can make decisions")
    if req.decision not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Decision must be approve or reject")

    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.files.update_one({"id": file_id}, {"$set": {
        "adc_decision": req.decision, "adc_remark": req.remark,
        "adc_remark_at": now, "adc_remark_by": user["id"],
    }})

    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "target_role": "dc", "target_department": "",
        "file_id": file_id, "file_number": file_doc["file_number"],
        "type": "adc_decision", "title": f"ADC Decision: {req.decision.upper()}",
        "message": f"ADC has {req.decision}d file {file_doc['file_number']}.",
        "is_read": False, "created_at": now,
    })

    await log_audit(user["id"], user["display_name"], user["role"], "adc_decision", file_id, file_doc["file_number"], f"ADC {req.decision}d the file")
    return {"message": f"ADC decision recorded: {req.decision}"}

# ==================== DC ROUTES ====================

@api_router.post("/files/{file_id}/dc-decision")
async def dc_decision(file_id: str, req: DCDecisionRequest, user=Depends(get_current_user)):
    if user["role"] not in ["dc", "admin"]:
        raise HTTPException(status_code=403, detail="Only DC can make final decisions")
    if req.decision not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="Decision must be accept or reject")

    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "dc_approved" if req.decision == "accept" else "dc_rejected"

    await db.files.update_one({"id": file_id}, {"$set": {
        "dc_decision": req.decision, "dc_remark": req.remark,
        "dc_decided_at": now, "dc_decided_by": user["id"], "status": new_status,
    }})

    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "target_role": "all", "target_department": "",
        "file_id": file_id, "file_number": file_doc["file_number"],
        "type": "dc_decision", "title": f"DC Decision: {req.decision.upper()}",
        "message": f"File {file_doc['file_number']} has been {req.decision}ed by DC.",
        "is_read": False, "created_at": now,
    })

    await log_audit(user["id"], user["display_name"], user["role"], "dc_decision", file_id, file_doc["file_number"], f"DC {req.decision}ed the file")
    return {"message": f"File {req.decision}ed successfully"}

# ==================== NOTIFICATION ROUTES ====================

def build_notif_query(role, dept, read_filter=None):
    if role == "admin":
        q = {}
    elif role == "tahsildar":
        q = {"$or": [
            {"target_role": role, "target_department": dept},
            {"target_role": "all"},
        ]}
    else:
        q = {"$or": [{"target_role": role}, {"target_role": "all"}]}
    if read_filter is not None:
        q["is_read"] = read_filter
    return q

@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user), limit: int = 50, skip: int = 0):
    q = build_notif_query(user["role"], user["department"])
    projection = {"_id": 0, "id": 1, "target_role": 1, "target_department": 1, "file_id": 1,
                  "file_number": 1, "type": 1, "title": 1, "message": 1, "is_read": 1, "created_at": 1}
    return await db.notifications.find(q, projection).sort("created_at", -1).skip(skip).limit(min(limit, 200)).to_list(min(limit, 200))

@api_router.get("/notifications/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    q = build_notif_query(user["role"], user["department"], read_filter=False)
    return {"count": await db.notifications.count_documents(q)}

@api_router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id}, {"$set": {"is_read": True}})
    return {"message": "Marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    q = build_notif_query(user["role"], user["department"])
    await db.notifications.update_many(q, {"$set": {"is_read": True}})
    return {"message": "All marked as read"}

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/users")
async def list_users(user=Depends(require_admin), limit: int = 100, skip: int = 0):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).skip(skip).limit(min(limit, 200)).to_list(min(limit, 200))

@api_router.post("/admin/users")
async def create_user(req: UserCreateRequest, user=Depends(require_admin)):
    if await db.users.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password_hash": hash_password(req.password),
        "role": req.role,
        "display_name": req.display_name,
        "department": req.department,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    await log_audit(user["id"], user["display_name"], user["role"], "create_user", details=f"Created user: {req.username}")

    return {"id": new_user["id"], "username": req.username, "role": req.role, "display_name": req.display_name, "department": req.department, "is_active": True}

@api_router.put("/admin/users/{user_id}")
async def edit_user(user_id: str, req: UserEditRequest, user=Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if req.username is not None:
        # Check username uniqueness
        existing = await db.users.find_one({"username": req.username, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        updates["username"] = req.username
    if req.display_name is not None:
        updates["display_name"] = req.display_name
    if req.department is not None:
        updates["department"] = req.department
    if req.role is not None:
        updates["role"] = req.role

    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
        await log_audit(user["id"], user["display_name"], user["role"], "edit_user", details=f"Edited user {target['username']}: {', '.join(updates.keys())}")

    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_password(user_id: str, req: PasswordResetRequest, user=Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await log_audit(user["id"], user["display_name"], user["role"], "reset_password", details=f"Reset password for: {target['username']}")
    return {"message": "Password reset successfully"}

@api_router.post("/admin/users/{user_id}/toggle-active")
async def toggle_active(user_id: str, user=Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = not target["is_active"]
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    await log_audit(user["id"], user["display_name"], user["role"], "toggle_user", details=f"{'Activated' if new_status else 'Deactivated'}: {target['username']}")
    return {"message": f"User {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await db.users.delete_one({"id": user_id})
    await log_audit(user["id"], user["display_name"], user["role"], "delete_user", details=f"Deleted user: {target['username']}")
    return {"message": f"User {target['username']} deleted"}

# ==================== ADMIN PLACEHOLDER CONFIG ====================

@api_router.get("/admin/config")
async def get_config(user=Depends(require_admin)):
    config = await db.app_config.find_one({"key": "placeholders"}, {"_id": 0})
    if not config:
        default_config = {
            "key": "placeholders",
            "tahsildar_locations": TAHSILDAR_LOCATIONS,
            "department_labels": {"tahsildar": "Tahsildar", "sp": "SP (Police)", "forest": "Forest Department"},
            "role_labels": {"admin": "System Admin", "case_worker": "Case Worker", "tahsildar": "Tahsildar",
                           "sp": "Superintendent of Police", "forest_officer": "Forest Officer",
                           "adc": "Assistant Commissioner (ADC)", "dc": "Deputy Commissioner (DC)"},
        }
        await db.app_config.insert_one(dict(default_config))
        return default_config
    return config

@api_router.put("/admin/config")
async def update_config(request: Request, user=Depends(require_admin)):
    body = await request.json()
    updates = {}
    if "tahsildar_locations" in body:
        updates["tahsildar_locations"] = body["tahsildar_locations"]
    if "department_labels" in body:
        updates["department_labels"] = body["department_labels"]
    if "role_labels" in body:
        updates["role_labels"] = body["role_labels"]

    if updates:
        await db.app_config.update_one({"key": "placeholders"}, {"$set": updates}, upsert=True)
        await log_audit(user["id"], user["display_name"], user["role"], "update_config", details=f"Updated config: {', '.join(updates.keys())}")

    config = await db.app_config.find_one({"key": "placeholders"}, {"_id": 0})
    return config

@api_router.get("/admin/audit-logs")
async def get_audit_logs(user=Depends(require_admin), limit: int = 100, skip: int = 0):
    return await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(min(limit, 500)).to_list(min(limit, 500))

@api_router.get("/admin/analytics")
async def get_analytics(user=Depends(get_current_user)):
    total = await db.files.count_documents({})
    draft = await db.files.count_documents({"status": "draft"})
    submitted = await db.files.count_documents({"status": "submitted"})
    approved = await db.files.count_documents({"status": "dc_approved"})
    rejected = await db.files.count_documents({"status": "dc_rejected"})
    delayed = await db.files.count_documents({"status": "delayed"})
    high_priority = await db.files.count_documents({"priority": "high", "status": {"$nin": ["dc_approved", "dc_rejected"]}})

    dept_pending = {}
    for dept in ["tahsildar", "sp", "forest"]:
        dept_pending[dept] = await db.approvals.count_documents({"department": dept, "decision": None})

    # Overdue files count
    now = datetime.now(timezone.utc).isoformat()
    overdue = await db.files.count_documents({"status": "submitted", "deadline": {"$lt": now}})

    return {
        "total": total, "draft": draft, "submitted": submitted,
        "approved": approved, "rejected": rejected, "delayed": delayed,
        "high_priority": high_priority, "overdue": overdue,
        "department_pending": dept_pending,
    }

# ==================== ADMIN FILE MANAGEMENT ====================

@api_router.put("/admin/files/{file_id}")
async def admin_full_edit_file(file_id: str, req: AdminFileEditRequest, user=Depends(require_admin)):
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    updates = {}
    for field in ["file_no", "year", "description", "tahsildar_location", "status", "dc_decision", "dc_remark", "adc_remark", "adc_decision", "priority"]:
        val = getattr(req, field, None)
        if val is not None:
            updates[field] = val

    if req.is_locked is not None:
        updates["is_locked"] = req.is_locked
    if req.departments is not None:
        updates["departments"] = req.departments

    if "file_no" in updates or "year" in updates:
        new_file_no = updates.get("file_no", file_doc.get("file_no", ""))
        new_year = updates.get("year", file_doc.get("year", ""))
        updates["file_number"] = f"DK/FILE/{new_year}/{new_file_no}"

    if updates:
        await db.files.update_one({"id": file_id}, {"$set": updates})
        await log_audit(user["id"], user["display_name"], user["role"], "admin_edit_file", file_id, file_doc["file_number"], f"Admin modified: {', '.join(updates.keys())}")

    updated = await db.files.find_one({"id": file_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/files/{file_id}")
async def admin_delete_file(file_id: str, user=Depends(require_admin)):
    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    await db.files.delete_one({"id": file_id})
    await db.approvals.delete_many({"file_id": file_id})
    await db.notifications.delete_many({"file_id": file_id})

    await log_audit(user["id"], user["display_name"], user["role"], "admin_delete_file", file_id, file_doc["file_number"], f"Deleted file {file_doc['file_number']}")
    return {"message": f"File {file_doc['file_number']} deleted successfully"}

@api_router.put("/admin/files/{file_id}/approval/{approval_id}")
async def admin_override_approval(file_id: str, approval_id: str, req: ApprovalRequest, user=Depends(require_admin)):
    approval = await db.approvals.find_one({"id": approval_id, "file_id": file_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.approvals.update_one({"id": approval_id}, {"$set": {
        "decision": req.decision, "remark": req.remark,
        "decided_by": user["id"], "decided_at": now, "is_locked": True,
    }})

    file_doc = await db.files.find_one({"id": file_id}, {"_id": 0})
    fn = file_doc["file_number"] if file_doc else ""
    await log_audit(user["id"], user["display_name"], user["role"], "admin_override_approval", file_id, fn, f"Admin overrode {approval['department']} approval to {req.decision}")
    return {"message": "Approval overridden successfully"}

@api_router.get("/admin/credentials")
async def get_credentials(user=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {
        "note": "Default passwords - admin:admin123, caseworker:case123, tahsildars:tah123, forest:forest123, sp:sp123, adc:adc123, dc:dc123",
        "users": users
    }

# ==================== BACKGROUND TASKS ====================

async def reminder_and_escalation_task():
    while True:
        try:
            await asyncio.sleep(300)
            now = datetime.now(timezone.utc)

            submitted_files = await db.files.find(
                {"status": "submitted"},
                {"_id": 0, "id": 1, "file_number": 1, "deadline": 1, "tahsildar_location": 1}
            ).to_list(500)

            for file_doc in submitted_files:
                if not file_doc.get("deadline"):
                    continue
                deadline_str = file_doc["deadline"]
                if deadline_str[-1] == 'Z':
                    deadline_str = deadline_str.replace('Z', '+00:00')
                deadline = datetime.fromisoformat(deadline_str).replace(tzinfo=timezone.utc)

                if now > deadline:
                    await db.files.update_one({"id": file_doc["id"]}, {"$set": {"status": "delayed"}})
                    for role in ["admin", "adc", "dc"]:
                        await db.notifications.insert_one({
                            "id": str(uuid.uuid4()), "target_role": role, "target_department": "",
                            "file_id": file_doc["id"], "file_number": file_doc["file_number"],
                            "type": "escalation", "title": "DEADLINE CROSSED",
                            "message": f"File {file_doc['file_number']} crossed the 30-day deadline.",
                            "is_read": False, "created_at": now.isoformat(),
                        })
                    await log_audit("system", "System", "system", "deadline_escalation", file_doc["id"], file_doc["file_number"], "30-day deadline crossed")
                    continue

                pending = await db.approvals.find({"file_id": file_doc["id"], "decision": None}, {"_id": 0}).to_list(10)
                for appr in pending:
                    last_r_str = appr["last_reminder_at"]
                    if last_r_str[-1] == 'Z':
                        last_r_str = last_r_str.replace('Z', '+00:00')
                    last_r = datetime.fromisoformat(last_r_str).replace(tzinfo=timezone.utc)
                    if (now - last_r).total_seconds() >= 2 * 86400:
                        target_role = "forest_officer" if appr["department"] == "forest" else appr["department"]
                        await db.notifications.insert_one({
                            "id": str(uuid.uuid4()), "target_role": target_role,
                            "target_department": appr.get("department_detail", ""),
                            "file_id": file_doc["id"], "file_number": file_doc["file_number"],
                            "type": "reminder", "title": "Reminder: Pending Review",
                            "message": f"File {file_doc['file_number']} awaits your review.",
                            "is_read": False, "created_at": now.isoformat(),
                        })
                        await db.approvals.update_one({"id": appr["id"]}, {"$set": {"last_reminder_at": now.isoformat()}})

        except Exception as e:
            logger.error(f"Reminder task error: {e}")

# ==================== APP EVENTS ====================

@app.on_event("startup")
async def startup():
    await seed_default_users()
    asyncio.create_task(reminder_and_escalation_task())
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
