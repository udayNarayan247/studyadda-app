from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne
import os
import io
import random as _random
import asyncio
import jwt
import csv
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


# ============================================================================
# MODELS
# ============================================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "student"  # student | admin
    language: str = "en"   # en | hi
    created_at: datetime

class SessionIdInput(BaseModel):
    session_id: str

class AuthResponse(BaseModel):
    session_token: str
    user: User

class ExamCategory(BaseModel):
    category_id: str
    name: str
    name_hi: str
    description: str
    description_hi: str
    icon: str
    order: int = 0

class Exam(BaseModel):
    exam_id: str
    category_id: str
    name: str
    name_hi: str
    description: str
    description_hi: str
    order: int = 0

class Subject(BaseModel):
    subject_id: str
    name: str
    name_hi: str
    order: int = 0

class Chapter(BaseModel):
    chapter_id: str
    subject_id: str
    name: str
    name_hi: str
    order: int = 0

class Option(BaseModel):
    key: str  # A B C D
    text: str
    text_hi: str

class Question(BaseModel):
    question_id: str
    exam_id: Optional[str] = None
    subject_id: str
    chapter_id: str
    year: Optional[int] = None
    shift: Optional[str] = None
    paper: Optional[str] = None
    text: str
    text_hi: str
    options: List[Option]
    correct: str  # A/B/C/D
    solution: str
    solution_hi: str
    difficulty: str = "medium"  # easy|medium|hard
    source: Optional[str] = None
    verified: bool = False
    published: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuestionCreate(BaseModel):
    exam_id: Optional[str] = None
    subject_id: str
    chapter_id: str
    year: Optional[int] = None
    shift: Optional[str] = None
    paper: Optional[str] = None
    text: str
    text_hi: str
    options: List[Option]
    correct: str
    solution: str
    solution_hi: str
    difficulty: str = "medium"
    source: Optional[str] = None
    verified: bool = False
    published: bool = True

class TestConfig(BaseModel):
    mode: str  # "chapter" | "mixed" | "mock" | "custom"
    exam_id: Optional[str] = None
    subject_ids: List[str] = []
    chapter_ids: List[str] = []
    years: List[int] = []
    exclude_ids: List[str] = []  # guest-only: previously seen question ids, oldest first
    question_count: int = 20
    duration_minutes: int = 20
    marks_per_correct: float = 1.0
    marks_per_wrong: float = 0.25

class TestSession(BaseModel):
    session_id: str
    user_id: str
    config: TestConfig
    question_ids: List[str]
    answers: Dict[str, str] = {}   # qid -> selected key
    marked_for_review: List[str] = []
    status: str = "ongoing"  # ongoing | submitted
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    correct_count: Optional[int] = None
    wrong_count: Optional[int] = None
    unattempted: Optional[int] = None
    accuracy: Optional[float] = None
    time_taken_seconds: Optional[int] = None

class SubmitTestInput(BaseModel):
    answers: Dict[str, str]
    marked_for_review: List[str] = []
    time_taken_seconds: int = 0


# ============================================================================
# AUTH
# ============================================================================
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.replace("Bearer ", "").strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)

async def require_admin(authorization: Optional[str] = Header(None)) -> User:
    user = await get_current_user(authorization)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@api_router.post("/auth/session", response_model=AuthResponse)
async def create_session(payload: SessionIdInput):
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = r.json()
    email = data.get("email", "").lower()
    name = data.get("name", email.split("@")[0] if email else "User")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Incomplete auth data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if existing:
        user_id = existing["user_id"]
        role = existing.get("role", "student")
        if email in ADMIN_EMAILS and role != "admin":
            role = "admin"
            await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
        user_doc = {**existing, "name": name, "picture": picture, "role": role}
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email in ADMIN_EMAILS else "student"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "language": "en",
            "created_at": now,
        }
        await db.users.insert_one(dict(user_doc))

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=7),
    })
    user_doc.pop("_id", None)
    return AuthResponse(session_token=session_token, user=User(**user_doc))


class AppleAuthInput(BaseModel):
    identity_token: str
    full_name: Optional[str] = None
    email: Optional[str] = None


APPLE_ISSUER = "https://appleid.apple.com"
_apple_jwks = jwt.PyJWKClient("https://appleid.apple.com/auth/keys", cache_keys=True)


def _verify_apple_token(token: str) -> dict:
    audiences = [a.strip() for a in os.environ["APPLE_AUDIENCES"].split(",") if a.strip()]
    signing_key = _apple_jwks.get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, algorithms=["RS256"], audience=audiences, issuer=APPLE_ISSUER)


@api_router.post("/auth/apple", response_model=AuthResponse)
async def apple_sign_in(payload: AppleAuthInput):
    try:
        claims = await asyncio.to_thread(_verify_apple_token, payload.identity_token)
    except Exception as e:
        logger.info("Apple token rejected: %s", e)
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    apple_sub = claims["sub"]
    # Only trust an email Apple itself verified inside the signed token; never the client-sent one
    verified = str(claims.get("email_verified", "")).lower() == "true"
    token_email = (claims.get("email") or "").lower() if verified else None
    now = datetime.now(timezone.utc)

    existing = await db.users.find_one({"apple_sub": apple_sub}, {"_id": 0})
    if not existing and token_email:
        # Same person already signed in with Google using this email: link accounts
        existing = await db.users.find_one({"email": token_email}, {"_id": 0})
        if existing:
            await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {"apple_sub": apple_sub}})

    if existing:
        user_doc = existing
        if token_email in ADMIN_EMAILS and user_doc.get("role") != "admin":
            user_doc["role"] = "admin"
            await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"role": "admin"}})
    else:
        email = token_email or f"apple_{apple_sub[:16]}@privaterelay.studyadda"
        name = (payload.full_name or "").strip() or (token_email.split("@")[0] if token_email else "Student")
        user_doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": name,
            "picture": None,
            "role": "admin" if token_email in ADMIN_EMAILS else "student",
            "language": "en",
            "apple_sub": apple_sub,
            "created_at": now,
        }
        await db.users.insert_one(dict(user_doc))

    session_token = f"apl_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_doc["user_id"],
        "created_at": now,
        "expires_at": now + timedelta(days=7),
    })
    user_doc.pop("_id", None)
    return AuthResponse(session_token=session_token, user=User(**user_doc))


@api_router.get("/auth/me", response_model=User)
async def me(authorization: Optional[str] = Header(None)):
    return await get_current_user(authorization)


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.delete("/auth/account")
async def delete_account(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    uid = user.user_id
    await db.bookmarks.delete_many({"user_id": uid})
    await db.seen_questions.delete_many({"user_id": uid})
    await db.test_sessions.delete_many({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


PRIVACY_HTML = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StudyAdda Dhanbad - Privacy Policy</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:auto;padding:24px;color:#0B152A;line-height:1.6}h2{color:#8A6D1C}</style></head><body>
<h1>StudyAdda Dhanbad - Privacy Policy</h1>
<p><b>Effective date:</b> 31 October 2026 &nbsp;|&nbsp; <b>Last updated:</b> 31 October 2026</p>
<p>StudyAdda Dhanbad ("we", "us") is a free exam practice app for Bank, SSC and Railway exam aspirants, published by StudyAdda Dhanbad, Room No. 421, 2nd Floor, Luby Circular Road City Centre, Near Bus Stand, Dhanbad - 826001, Jharkhand, India.</p>
<h2>Information we collect</h2>
<p>If you sign in with Google, we receive your name, email address and profile picture. If you sign in with Apple, we receive an Apple user identifier and, only if you choose to share them, your name and email (which may be an Apple private relay address). We store your language preference, test attempts, answers, scores, the questions you have already practised (so we can avoid repeating them) and bookmarked questions, so you can see your progress on any device. Guest tests are not stored on our servers; a list of practised question IDs is kept only on your device.</p>
<h2>How we use it</h2>
<p>Only to provide the app: sign-in, saving practice history, bookmarks and performance. We do not sell your data or use it for advertising.</p>
<h2>Sharing</h2>
<p>We do not share your personal data with third parties, except the sign-in provider (Google or Apple) used to log you in.</p>
<h2>Data retention and security</h2>
<p>Your data is kept while your account is active and is transmitted over encrypted HTTPS connections. Sign-in sessions expire after 7 days.</p>
<h2>Deleting your data</h2>
<p>You can delete your account any time from Profile &gt; Delete Account in the app. This permanently removes your profile, test history, practised-question history and bookmarks. You can also request deletion by email.</p>
<h2>Children</h2>
<p>The app is intended for students preparing for recruitment exams and is not directed at children under 13.</p>
<h2>Changes to this policy</h2>
<p>If we change this policy we will update the "Last updated" date above.</p>
<h2>Contact us</h2>
<p>Email: <a href="mailto:un2085@gmail.com">un2085@gmail.com</a><br>Phone: 9123494102, 8101698099<br>Address: Room No. 421, 2nd Floor, Luby Circular Road City Centre, Near Bus Stand, Dhanbad - 826001</p>
</body></html>"""


@api_router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse(PRIVACY_HTML)


@api_router.post("/auth/language")
async def set_language(payload: Dict[str, str], authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    lang = payload.get("language", "en")
    if lang not in ("en", "hi"):
        raise HTTPException(status_code=400, detail="invalid language")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"language": lang}})
    return {"ok": True, "language": lang}


# ============================================================================
# CATALOG
# ============================================================================
@api_router.get("/catalog/categories", response_model=List[ExamCategory])
async def get_categories():
    rows = await db.exam_categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return [ExamCategory(**r) for r in rows]

@api_router.get("/catalog/exams", response_model=List[Exam])
async def get_exams(category_id: Optional[str] = None):
    q = {"category_id": category_id} if category_id else {}
    rows = await db.exams.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Exam(**r) for r in rows]

@api_router.get("/catalog/subjects", response_model=List[Subject])
async def get_subjects():
    rows = await db.subjects.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return [Subject(**r) for r in rows]

@api_router.get("/catalog/chapters", response_model=List[Chapter])
async def get_chapters(subject_id: Optional[str] = None):
    q = {"subject_id": subject_id} if subject_id else {}
    rows = await db.chapters.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Chapter(**r) for r in rows]


# ============================================================================
# QUESTIONS (admin + read)
# ============================================================================
@api_router.get("/questions", response_model=List[Question])
async def list_questions(
    exam_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    year: Optional[int] = None,
    include_unpublished: bool = False,
    limit: int = 200,
):
    q: Dict[str, Any] = {}
    if exam_id: q["exam_id"] = exam_id
    if subject_id: q["subject_id"] = subject_id
    if chapter_id: q["chapter_id"] = chapter_id
    if year: q["year"] = year
    if not include_unpublished:
        q["published"] = True
    limit = max(1, min(limit, 500))
    rows = await db.questions.find(q, {"_id": 0}).limit(limit).to_list(limit)
    return [Question(**r) for r in rows]

@api_router.post("/admin/questions", response_model=Question)
async def admin_create_question(payload: QuestionCreate, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    qid = f"q_{uuid.uuid4().hex[:10]}"
    doc = Question(question_id=qid, **payload.dict()).dict()
    await db.questions.insert_one(dict(doc))
    doc.pop("_id", None)
    return Question(**doc)

@api_router.put("/admin/questions/{question_id}", response_model=Question)
async def admin_update_question(question_id: str, payload: QuestionCreate, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    update = payload.dict()
    await db.questions.update_one({"question_id": question_id}, {"$set": update})
    doc = await db.questions.find_one({"question_id": question_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return Question(**doc)

@api_router.delete("/admin/questions/{question_id}")
async def admin_delete_question(question_id: str, authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    await db.questions.delete_one({"question_id": question_id})
    return {"ok": True}

@api_router.post("/admin/questions/bulk-csv")
async def admin_bulk_upload_csv(file: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    """CSV columns: subject_id,chapter_id,exam_id,year,shift,paper,text,text_hi,
    optA,optA_hi,optB,optB_hi,optC,optC_hi,optD,optD_hi,correct,solution,solution_hi,difficulty,source,verified"""
    await require_admin(authorization)
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    inserted = 0
    errors: List[str] = []
    for i, row in enumerate(reader, start=2):
        try:
            options = [
                Option(key="A", text=row["optA"], text_hi=row.get("optA_hi", row["optA"])),
                Option(key="B", text=row["optB"], text_hi=row.get("optB_hi", row["optB"])),
                Option(key="C", text=row["optC"], text_hi=row.get("optC_hi", row["optC"])),
                Option(key="D", text=row["optD"], text_hi=row.get("optD_hi", row["optD"])),
            ]
            q = Question(
                question_id=f"q_{uuid.uuid4().hex[:10]}",
                exam_id=row.get("exam_id") or None,
                subject_id=row["subject_id"],
                chapter_id=row["chapter_id"],
                year=int(row["year"]) if row.get("year") else None,
                shift=row.get("shift") or None,
                paper=row.get("paper") or None,
                text=row["text"],
                text_hi=row.get("text_hi", row["text"]),
                options=options,
                correct=row["correct"].upper(),
                solution=row.get("solution", ""),
                solution_hi=row.get("solution_hi", row.get("solution", "")),
                difficulty=row.get("difficulty", "medium"),
                source=row.get("source") or None,
                verified=str(row.get("verified", "")).lower() in ("true", "1", "yes"),
                published=True,
            )
            await db.questions.insert_one(dict(q.dict()))
            inserted += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")
    return {"inserted": inserted, "errors": errors}


# ============================================================================
# TEST SESSIONS
# ============================================================================
async def _pick_once(q: Dict[str, Any], n: int, seen: List[str]) -> List[dict]:
    """Unseen questions first (random, no duplicates); if the pool runs out,
    top up with the questions the student saw longest ago."""
    match = {**q, "question_id": {"$nin": seen}} if seen else q
    sampled = await db.questions.aggregate(
        [{"$match": match}, {"$sample": {"size": n * 2}}, {"$project": {"_id": 0}}]
    ).to_list(n * 2)
    picked: List[dict] = []
    ids = set()
    for r in sampled:  # $sample can return the same doc twice
        if r["question_id"] not in ids:
            ids.add(r["question_id"])
            picked.append(r)
        if len(picked) == n:
            break
    if len(picked) < n and seen:
        in_scope = set(await db.questions.distinct("question_id", {**q, "question_id": {"$in": seen}}))
        refill_ids = [i for i in seen if i in in_scope and i not in ids][: n - len(picked)]
        if refill_ids:
            docs = await db.questions.find({"question_id": {"$in": refill_ids}}, {"_id": 0}).to_list(len(refill_ids))
            picked.extend(docs)
    _random.shuffle(picked)
    return picked


async def _sample_questions(q: Dict[str, Any], n: int, seen: Optional[List[str]] = None) -> List[dict]:
    n = max(1, min(n, 200))
    seen = seen or []
    rows = await _pick_once(q, n, seen)
    if not rows and "exam_id" in q:
        rows = await _pick_once({k: v for k, v in q.items() if k != "exam_id"}, n, seen)
    return rows


async def _seen_ids_oldest_first(user_id: str) -> List[str]:
    docs = await db.seen_questions.find({"user_id": user_id}, {"_id": 0, "question_id": 1}).sort("seen_at", 1).to_list(20000)
    return [d["question_id"] for d in docs]


async def _mark_seen(user_id: str, question_ids: List[str]):
    if not question_ids:
        return
    now = datetime.now(timezone.utc)
    await db.seen_questions.bulk_write([
        UpdateOne(
            {"user_id": user_id, "question_id": qid},
            {"$set": {"user_id": user_id, "question_id": qid, "seen_at": now}},
            upsert=True,
        )
        for qid in question_ids
    ], ordered=False)


@api_router.post("/tests/start", response_model=TestSession)
async def start_test(config: TestConfig, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)

    # Build query
    q: Dict[str, Any] = {"published": True}
    if config.exam_id and config.mode == "mock":
        q["exam_id"] = config.exam_id
    if config.subject_ids:
        q["subject_id"] = {"$in": config.subject_ids}
    if config.chapter_ids:
        q["chapter_id"] = {"$in": config.chapter_ids}
    if config.years:
        q["year"] = {"$in": config.years}

    seen = await _seen_ids_oldest_first(user.user_id)
    selected = await _sample_questions(q, config.question_count, seen)
    if not selected:
        raise HTTPException(status_code=400, detail="No questions found for your selection")
    await _mark_seen(user.user_id, [r["question_id"] for r in selected])

    sid = f"ts_{uuid.uuid4().hex[:12]}"
    doc = TestSession(
        session_id=sid,
        user_id=user.user_id,
        config=config,
        question_ids=[r["question_id"] for r in selected],
        started_at=datetime.now(timezone.utc),
    )
    await db.test_sessions.insert_one(dict(doc.dict()))
    return doc


@api_router.get("/tests/{session_id}")
async def get_test(session_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    ts = await db.test_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not ts or ts["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Not found")
    questions = await db.questions.find({"question_id": {"$in": ts["question_ids"]}}, {"_id": 0}).to_list(500)
    # keep order
    qmap = {q["question_id"]: q for q in questions}
    ordered = [qmap[qid] for qid in ts["question_ids"] if qid in qmap]
    return {"session": ts, "questions": ordered}


@api_router.post("/tests/{session_id}/submit")
async def submit_test(session_id: str, payload: SubmitTestInput, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    ts = await db.test_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not ts or ts["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Not found")
    if ts["status"] == "submitted":
        return ts

    questions = await db.questions.find({"question_id": {"$in": ts["question_ids"]}}, {"_id": 0}).to_list(500)
    qmap = {q["question_id"]: q for q in questions}

    cfg = ts["config"]
    correct = 0
    wrong = 0
    unattempted = 0
    chapter_stats: Dict[str, Dict[str, int]] = {}
    for qid in ts["question_ids"]:
        q = qmap.get(qid)
        if not q: 
            unattempted += 1
            continue
        chap = q["chapter_id"]
        chapter_stats.setdefault(chap, {"total": 0, "correct": 0, "wrong": 0, "skipped": 0})
        chapter_stats[chap]["total"] += 1
        ans = payload.answers.get(qid)
        if ans is None or ans == "":
            unattempted += 1
            chapter_stats[chap]["skipped"] += 1
        elif ans.upper() == q["correct"].upper():
            correct += 1
            chapter_stats[chap]["correct"] += 1
        else:
            wrong += 1
            chapter_stats[chap]["wrong"] += 1

    score = correct * cfg["marks_per_correct"] - wrong * cfg["marks_per_wrong"]
    attempted = correct + wrong
    accuracy = (correct / attempted * 100) if attempted > 0 else 0.0

    update = {
        "answers": payload.answers,
        "marked_for_review": payload.marked_for_review,
        "status": "submitted",
        "submitted_at": datetime.now(timezone.utc),
        "score": round(score, 2),
        "correct_count": correct,
        "wrong_count": wrong,
        "unattempted": unattempted,
        "accuracy": round(accuracy, 2),
        "time_taken_seconds": payload.time_taken_seconds,
        "chapter_stats": chapter_stats,
    }
    await db.test_sessions.update_one({"session_id": session_id}, {"$set": update})
    ts.update(update)
    return ts


@api_router.get("/tests")
async def list_my_tests(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    rows = await db.test_sessions.find({"user_id": user.user_id}, {"_id": 0}).sort("started_at", -1).to_list(200)
    return rows


# ============================================================================
# BOOKMARKS
# ============================================================================
@api_router.post("/bookmarks/{question_id}")
async def add_bookmark(question_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.bookmarks.update_one(
        {"user_id": user.user_id, "question_id": question_id},
        {"$set": {"user_id": user.user_id, "question_id": question_id, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}

@api_router.delete("/bookmarks/{question_id}")
async def remove_bookmark(question_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    await db.bookmarks.delete_one({"user_id": user.user_id, "question_id": question_id})
    return {"ok": True}

@api_router.get("/bookmarks")
async def list_bookmarks(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    rows = await db.bookmarks.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    qids = [r["question_id"] for r in rows]
    questions = await db.questions.find({"question_id": {"$in": qids}}, {"_id": 0}).to_list(500)
    return questions


# ============================================================================
# ADMIN STATS
# ============================================================================
@api_router.get("/admin/stats")
async def admin_stats(authorization: Optional[str] = Header(None)):
    await require_admin(authorization)
    return {
        "users": await db.users.count_documents({}),
        "questions": await db.questions.count_documents({}),
        "verified_questions": await db.questions.count_documents({"verified": True}),
        "tests_taken": await db.test_sessions.count_documents({"status": "submitted"}),
    }


# ============================================================================
# GUEST PRACTICE (no auth)
# ============================================================================
@api_router.post("/guest/start")
async def guest_start(config: TestConfig):
    q: Dict[str, Any] = {"published": True}
    if config.exam_id and config.mode == "mock":
        q["exam_id"] = config.exam_id
    if config.subject_ids:
        q["subject_id"] = {"$in": config.subject_ids}
    if config.chapter_ids:
        q["chapter_id"] = {"$in": config.chapter_ids}
    # Guests send the ids they've already seen (oldest first) from the device
    rows = await _sample_questions(q, config.question_count, config.exclude_ids[-5000:])
    if not rows:
        raise HTTPException(status_code=400, detail="No questions available")
    return {"questions": rows, "config": config.dict()}


# ============================================================================
# SEED
# ============================================================================
@api_router.post("/seed/run")
async def seed_run():
    # Only seed if empty
    if await db.exam_categories.count_documents({}) > 0:
        return {"status": "already_seeded"}

    categories = [
        {"category_id": "bank", "name": "Bank Exams", "name_hi": "बैंक परीक्षा", "description": "IBPS, SBI, RBI", "description_hi": "आईबीपीएस, एसबीआई, आरबीआई", "icon": "card-outline", "order": 1},
        {"category_id": "ssc", "name": "SSC Exams", "name_hi": "एसएससी परीक्षा", "description": "CGL, CHSL, MTS, CPO", "description_hi": "सीजीएल, सीएचएसएल, एमटीएस", "icon": "ribbon-outline", "order": 2},
        {"category_id": "railway", "name": "Railway Exams", "name_hi": "रेलवे परीक्षा", "description": "NTPC, Group D, ALP", "description_hi": "एनटीपीसी, ग्रुप डी, एएलपी", "icon": "train-outline", "order": 3},
    ]
    await db.exam_categories.insert_many([dict(c) for c in categories])

    exams = [
        ("bank", "ibps-po", "IBPS PO", "आईबीपीएस पीओ"),
        ("bank", "ibps-clerk", "IBPS Clerk", "आईबीपीएस क्लर्क"),
        ("bank", "sbi-po", "SBI PO", "एसबीआई पीओ"),
        ("bank", "sbi-clerk", "SBI Clerk", "एसबीआई क्लर्क"),
        ("bank", "ibps-rrb-po", "IBPS RRB PO", "आईबीपीएस आरआरबी पीओ"),
        ("bank", "ibps-rrb-clerk", "IBPS RRB Clerk", "आईबीपीएस आरआरबी क्लर्क"),
        ("bank", "rbi-assistant", "RBI Assistant", "आरबीआई असिस्टेंट"),
        ("ssc", "ssc-cgl", "SSC CGL", "एसएससी सीजीएल"),
        ("ssc", "ssc-chsl", "SSC CHSL", "एसएससी सीएचएसएल"),
        ("ssc", "ssc-cpo", "SSC CPO", "एसएससी सीपीओ"),
        ("ssc", "ssc-mts", "SSC MTS", "एसएससी एमटीएस"),
        ("ssc", "ssc-steno", "SSC Stenographer", "एसएससी स्टेनोग्राफर"),
        ("ssc", "ssc-selection-post", "SSC Selection Post", "एसएससी सिलेक्शन पोस्ट"),
        ("railway", "rrb-ntpc", "RRB NTPC", "आरआरबी एनटीपीसी"),
        ("railway", "rrb-group-d", "RRB Group D", "आरआरबी ग्रुप डी"),
        ("railway", "rrb-alp", "RRB ALP", "आरआरबी एएलपी"),
        ("railway", "rrb-tech", "RRB Technician", "आरआरबी टेक्नीशियन"),
    ]
    await db.exams.insert_many([
        {"exam_id": eid, "category_id": cid, "name": n, "name_hi": nh, "description": "", "description_hi": "", "order": i}
        for i, (cid, eid, n, nh) in enumerate(exams)
    ])

    subjects = [
        ("quant", "Quantitative Aptitude", "मात्रात्मक अभिक्षमता", 1),
        ("reasoning", "Reasoning", "रीजनिंग", 2),
        ("english", "English", "अंग्रेज़ी", 3),
        ("ga", "General Awareness", "सामान्य जागरूकता", 4),
        ("science", "General Science", "सामान्य विज्ञान", 5),
        ("computer", "Computer Awareness", "कंप्यूटर जागरूकता", 6),
    ]
    await db.subjects.insert_many([{"subject_id": s[0], "name": s[1], "name_hi": s[2], "order": s[3]} for s in subjects])

    chapters = [
        ("quant", "simplification", "Simplification", "सरलीकरण"),
        ("quant", "number-series", "Number Series", "संख्या श्रेणी"),
        ("quant", "quadratic", "Quadratic Equations", "द्विघात समीकरण"),
        ("quant", "percentage", "Percentage", "प्रतिशत"),
        ("quant", "profit-loss", "Profit and Loss", "लाभ और हानि"),
        ("quant", "si-ci", "SI and CI", "साधारण और चक्रवृद्धि ब्याज"),
        ("quant", "ratio", "Ratio and Proportion", "अनुपात और समानुपात"),
        ("quant", "average", "Average", "औसत"),
        ("quant", "mixture", "Mixture and Alligation", "मिश्रण और संधारण"),
        ("quant", "partnership", "Partnership", "साझेदारी"),
        ("quant", "time-work", "Time and Work", "समय और कार्य"),
        ("quant", "pipes", "Pipes and Cisterns", "पाइप और टंकी"),
        ("quant", "std", "Speed-Time-Distance", "गति-समय-दूरी"),
        ("quant", "boats", "Boats and Streams", "नाव और धारा"),
        ("quant", "trains", "Trains", "ट्रेन"),
        ("quant", "mensuration", "Mensuration", "क्षेत्रमिति"),
        ("quant", "geometry", "Geometry", "ज्यामिति"),
        ("quant", "di", "Data Interpretation", "डेटा व्याख्या"),
        ("quant", "probability", "Probability", "प्रायिकता"),
        ("quant", "pnc", "Permutation and Combination", "क्रमचय और संचय"),
        ("reasoning", "puzzle", "Puzzles", "पहेली"),
        ("reasoning", "seating", "Seating Arrangement", "बैठक व्यवस्था"),
        ("reasoning", "syllogism", "Syllogism", "न्यायवाक्य"),
        ("reasoning", "inequality", "Inequality", "असमानता"),
        ("reasoning", "blood-rel", "Blood Relations", "रक्त संबंध"),
        ("reasoning", "direction", "Direction Sense", "दिशा ज्ञान"),
        ("reasoning", "coding", "Coding-Decoding", "कोडिंग-डिकोडिंग"),
        ("reasoning", "ranking", "Order and Ranking", "क्रम और रैंकिंग"),
        ("reasoning", "alpha-series", "Alphanumeric Series", "अल्फान्यूमेरिक श्रेणी"),
        ("reasoning", "input-output", "Input-Output", "इनपुट-आउटपुट"),
        ("reasoning", "ds", "Data Sufficiency", "डेटा पर्याप्तता"),
        ("reasoning", "analogy", "Analogy", "सादृश्य"),
        ("reasoning", "classification", "Classification", "वर्गीकरण"),
        ("reasoning", "series-r", "Series", "श्रेणी"),
        ("english", "rc", "Reading Comprehension", "पठन बोध"),
        ("english", "cloze", "Cloze Test", "क्लोज़ टेस्ट"),
        ("english", "error", "Error Detection", "त्रुटि पहचान"),
        ("english", "sentence-improv", "Sentence Improvement", "वाक्य सुधार"),
        ("english", "fillers", "Fillers", "रिक्त स्थान"),
        ("english", "para-jumble", "Para Jumbles", "अनुच्छेद क्रम"),
        ("english", "phrase", "Phrase Replacement", "वाक्यांश प्रतिस्थापन"),
        ("english", "vocab", "Vocabulary", "शब्दावली"),
        ("ga", "current-affairs", "Current Affairs", "समसामयिक मामले"),
        ("ga", "polity", "Indian Polity", "भारतीय राजनीति"),
        ("ga", "history", "History", "इतिहास"),
        ("ga", "geography", "Geography", "भूगोल"),
        ("ga", "economy", "Economy", "अर्थव्यवस्था"),
        ("ga", "static-gk", "Static GK", "स्थैतिक जीके"),
        ("ga", "awards", "Awards", "पुरस्कार"),
        ("science", "physics", "Physics", "भौतिकी"),
        ("science", "chemistry", "Chemistry", "रसायन विज्ञान"),
        ("science", "biology", "Biology", "जीव विज्ञान"),
        ("computer", "fundamentals", "Fundamentals", "मूल बातें"),
        ("computer", "ms-office", "MS Office", "एमएस ऑफिस"),
        ("computer", "networking", "Networking", "नेटवर्किंग"),
    ]
    await db.chapters.insert_many([
        {"chapter_id": c[1], "subject_id": c[0], "name": c[2], "name_hi": c[3], "order": i}
        for i, c in enumerate(chapters)
    ])

    # Seed sample questions (marked unverified / Sample)
    sample = _build_sample_questions()
    await db.questions.insert_many([dict(q) for q in sample])

    return {"status": "seeded", "questions_inserted": len(sample)}


def _mk_opt(a, ah, b, bh, c, ch, d, dh):
    return [
        {"key": "A", "text": a, "text_hi": ah},
        {"key": "B", "text": b, "text_hi": bh},
        {"key": "C", "text": c, "text_hi": ch},
        {"key": "D", "text": d, "text_hi": dh},
    ]

def _q(subject_id, chapter_id, text, text_hi, options, correct, sol, sol_hi, year=2023, exam_id=None, difficulty="medium"):
    return {
        "question_id": f"q_{uuid.uuid4().hex[:10]}",
        "exam_id": exam_id,
        "subject_id": subject_id,
        "chapter_id": chapter_id,
        "year": year, "shift": None, "paper": None,
        "text": text, "text_hi": text_hi,
        "options": options, "correct": correct,
        "solution": sol, "solution_hi": sol_hi,
        "difficulty": difficulty,
        "source": "Sample / Unverified",
        "verified": False, "published": True,
        "created_at": datetime.now(timezone.utc),
    }

def _build_sample_questions():
    qs = []
    # Quant
    qs.append(_q("quant", "percentage",
        "What is 25% of 480?", "480 का 25% क्या है?",
        _mk_opt("100","100","120","120","125","125","130","130"), "B",
        "25% of 480 = 480 × 0.25 = 120", "480 × 0.25 = 120"))
    qs.append(_q("quant", "percentage",
        "If a number is increased by 20% and then decreased by 20%, net change is?",
        "यदि किसी संख्या को 20% बढ़ाकर फिर 20% घटाया जाए, तो शुद्ध परिवर्तन?",
        _mk_opt("0%","0%","-4%","-4%","+4%","+4%","-2%","-2%"), "B",
        "Net = +20% -20% - (20×20/100)% = -4%", "शुद्ध = -4%"))
    qs.append(_q("quant", "simplification",
        "Simplify: 24 + 6 × 2 - 10 ÷ 5", "सरल करें: 24 + 6 × 2 - 10 ÷ 5",
        _mk_opt("30","30","34","34","28","28","32","32"), "B",
        "24 + 12 - 2 = 34", "24 + 12 - 2 = 34"))
    qs.append(_q("quant", "profit-loss",
        "Cost price is 400, selling price is 500. Profit percent?",
        "क्रय मूल्य 400, विक्रय मूल्य 500 है। लाभ प्रतिशत?",
        _mk_opt("20%","20%","25%","25%","30%","30%","15%","15%"), "B",
        "Profit=100, %=100/400=25%", "लाभ=100, 100/400=25%"))
    qs.append(_q("quant", "average",
        "Average of 10, 20, 30, 40, 50 is?", "10, 20, 30, 40, 50 का औसत है?",
        _mk_opt("25","25","30","30","35","35","40","40"), "B",
        "Sum=150; 150/5=30", "योग=150; 150/5=30"))
    qs.append(_q("quant", "ratio",
        "A:B = 2:3, B:C = 4:5. Find A:B:C",
        "A:B = 2:3, B:C = 4:5. A:B:C ज्ञात करें",
        _mk_opt("8:12:15","8:12:15","2:3:5","2:3:5","4:6:10","4:6:10","8:15:20","8:15:20"), "A",
        "Multiply: A:B = 8:12, B:C = 12:15 → 8:12:15", "A:B:C = 8:12:15"))
    qs.append(_q("quant", "si-ci",
        "SI on Rs. 1000 at 10% p.a. for 2 years?",
        "1000 रु. पर 10% वार्षिक दर से 2 वर्ष का साधारण ब्याज?",
        _mk_opt("100","100","200","200","210","210","220","220"), "B",
        "SI=PRT/100=1000×10×2/100=200", "SI=200"))
    qs.append(_q("quant", "time-work",
        "A can do a work in 10 days, B in 15 days. Together they take?",
        "A 10 दिन में, B 15 दिन में एक कार्य करता है। साथ में?",
        _mk_opt("5 days","5 दिन","6 days","6 दिन","7 days","7 दिन","8 days","8 दिन"), "B",
        "1/10 + 1/15 = 1/6 → 6 days", "6 दिन"))
    qs.append(_q("quant", "std",
        "Speed 60 km/h, Time 2.5 hours. Distance?",
        "गति 60 किमी/घं, समय 2.5 घं। दूरी?",
        _mk_opt("120 km","120 किमी","150 km","150 किमी","100 km","100 किमी","90 km","90 किमी"), "B",
        "D=60×2.5=150 km", "दूरी=150 किमी"))
    qs.append(_q("quant", "number-series",
        "Find next: 2, 6, 12, 20, 30, ?", "अगला ज्ञात करें: 2, 6, 12, 20, 30, ?",
        _mk_opt("40","40","42","42","36","36","48","48"), "B",
        "Differences 4,6,8,10,12 → 30+12=42", "अंतर 4,6,8,10,12 → 42"))
    # Reasoning
    qs.append(_q("reasoning", "coding",
        "If CAT = 3-1-20 then DOG = ?", "यदि CAT = 3-1-20 तो DOG = ?",
        _mk_opt("4-15-7","4-15-7","4-14-7","4-14-7","3-15-7","3-15-7","4-15-8","4-15-8"), "A",
        "D=4, O=15, G=7", "D=4, O=15, G=7"))
    qs.append(_q("reasoning", "blood-rel",
        "A is father of B. B is sister of C. How is A related to C?",
        "A, B का पिता है। B, C की बहन है। A, C का क्या है?",
        _mk_opt("Mother","माता","Father","पिता","Brother","भाई","Uncle","चाचा"), "B",
        "A is father", "A पिता है"))
    qs.append(_q("reasoning", "direction",
        "Facing North, turn right then right. Now facing?",
        "उत्तर की ओर मुख, दाएँ फिर दाएँ मुड़ें। अब मुख?",
        _mk_opt("North","उत्तर","South","दक्षिण","East","पूर्व","West","पश्चिम"), "B",
        "North→East→South", "उत्तर→पूर्व→दक्षिण"))
    qs.append(_q("reasoning", "syllogism",
        "All cats are animals. All animals are living. Conclusion: All cats are living.",
        "सभी बिल्लियाँ पशु हैं। सभी पशु जीवित हैं। निष्कर्ष: सभी बिल्लियाँ जीवित हैं।",
        _mk_opt("True","सत्य","False","असत्य","Can't say","नहीं कह सकते","None","कोई नहीं"), "A",
        "Valid syllogism", "वैध न्यायवाक्य"))
    qs.append(_q("reasoning", "series-r",
        "Series: A, C, E, G, ?", "श्रेणी: A, C, E, G, ?",
        _mk_opt("H","H","I","I","J","J","K","K"), "B",
        "+2 each → I", "+2 → I"))
    qs.append(_q("reasoning", "ranking",
        "In a row of 20, Ram is 7th from left. His position from right?",
        "20 की पंक्ति में, राम बाएँ से 7वाँ है। दाएँ से स्थान?",
        _mk_opt("13","13","14","14","15","15","12","12"), "B",
        "20-7+1=14", "20-7+1=14"))
    qs.append(_q("reasoning", "inequality",
        "If A>B, B>C, then?", "यदि A>B, B>C, तब?",
        _mk_opt("A>C","A>C","A<C","A<C","A=C","A=C","Can't say","नहीं कह सकते"), "A",
        "Transitive", "संक्रमण"))
    # English
    qs.append(_q("english", "vocab",
        "Antonym of 'Benevolent'?", "'Benevolent' का विलोम?",
        _mk_opt("Kind","दयालु","Cruel","क्रूर","Generous","उदार","Friendly","मित्रवत"), "B",
        "Benevolent = kind; antonym = cruel", "विलोम = Cruel"))
    qs.append(_q("english", "error",
        "He don't like tea. — Error in?", "He don't like tea. — त्रुटि?",
        _mk_opt("He","He","don't","don't","like","like","tea","tea"), "B",
        "Should be 'doesn't'", "'doesn't' होना चाहिए"))
    qs.append(_q("english", "sentence-improv",
        "She is senior than me. — Correct form?", "She is senior than me. — सही रूप?",
        _mk_opt("senior from","senior from","senior to","senior to","senior than","senior than","more senior","more senior"), "B",
        "Senior takes 'to'", "'to' प्रयुक्त होता है"))
    qs.append(_q("english", "fillers",
        "She ___ to school every day.", "वह प्रतिदिन स्कूल ___।",
        _mk_opt("go","जाता","goes","जाती है","going","जा रहा","gone","गई"), "B",
        "Simple present with she", "सामान्य वर्तमान काल"))
    qs.append(_q("english", "vocab",
        "Synonym of 'Rapid'?", "'Rapid' का पर्यायवाची?",
        _mk_opt("Slow","धीमा","Fast","तेज","Steady","स्थिर","Lazy","आलसी"), "B",
        "Rapid = fast", "Rapid = तेज"))
    # GA
    qs.append(_q("ga", "polity",
        "Who is the head of state of India?", "भारत के राज्य प्रमुख कौन हैं?",
        _mk_opt("PM","प्रधानमंत्री","President","राष्ट्रपति","CJI","मुख्य न्यायाधीश","Speaker","स्पीकर"), "B",
        "President of India", "राष्ट्रपति"))
    qs.append(_q("ga", "history",
        "Who was the first PM of India?", "भारत के पहले प्रधानमंत्री?",
        _mk_opt("Gandhi","गांधी","Nehru","नेहरू","Patel","पटेल","Bose","बोस"), "B",
        "Jawaharlal Nehru", "जवाहरलाल नेहरू"))
    qs.append(_q("ga", "geography",
        "Longest river in India?", "भारत की सबसे लंबी नदी?",
        _mk_opt("Yamuna","यमुना","Ganga","गंगा","Godavari","गोदावरी","Krishna","कृष्णा"), "B",
        "Ganga ~2525 km", "गंगा"))
    qs.append(_q("ga", "static-gk",
        "Capital of Jharkhand?", "झारखंड की राजधानी?",
        _mk_opt("Dhanbad","धनबाद","Ranchi","रांची","Jamshedpur","जमशेदपुर","Bokaro","बोकारो"), "B",
        "Ranchi", "रांची"))
    qs.append(_q("ga", "economy",
        "Which bank is called the Banker's Bank of India?", "भारत का बैंकों का बैंक?",
        _mk_opt("SBI","एसबीआई","RBI","आरबीआई","PNB","पीएनबी","HDFC","एचडीएफसी"), "B",
        "RBI", "आरबीआई"))
    qs.append(_q("ga", "awards",
        "Highest civilian award in India?", "भारत का सर्वोच्च नागरिक पुरस्कार?",
        _mk_opt("Padma Vibhushan","पद्म विभूषण","Bharat Ratna","भारत रत्न","Padma Shri","पद्म श्री","Padma Bhushan","पद्म भूषण"), "B",
        "Bharat Ratna", "भारत रत्न"))
    # Science
    qs.append(_q("science", "physics",
        "SI unit of force?", "बल की एसआई इकाई?",
        _mk_opt("Joule","जूल","Newton","न्यूटन","Pascal","पास्कल","Watt","वाट"), "B",
        "Newton (N)", "न्यूटन"))
    qs.append(_q("science", "chemistry",
        "Chemical symbol for Gold?", "सोने का रासायनिक चिह्न?",
        _mk_opt("Go","Go","Au","Au","Ag","Ag","Gd","Gd"), "B",
        "Au (Latin Aurum)", "Au"))
    qs.append(_q("science", "biology",
        "Powerhouse of the cell?", "कोशिका का ऊर्जाघर?",
        _mk_opt("Nucleus","केन्द्रक","Mitochondria","माइटोकॉन्ड्रिया","Ribosome","राइबोसोम","Golgi","गोल्गी"), "B",
        "Mitochondria", "माइटोकॉन्ड्रिया"))
    # Computer
    qs.append(_q("computer", "fundamentals",
        "CPU stands for?", "CPU का पूर्ण रूप?",
        _mk_opt("Central Program Unit","Central Program Unit","Central Processing Unit","Central Processing Unit","Computer Program Unit","Computer Program Unit","Control Processing Unit","Control Processing Unit"), "B",
        "Central Processing Unit", "सेंट्रल प्रोसेसिंग यूनिट"))
    qs.append(_q("computer", "ms-office",
        "Shortcut to copy in MS Word?", "एमएस वर्ड में कॉपी का शॉर्टकट?",
        _mk_opt("Ctrl+V","Ctrl+V","Ctrl+C","Ctrl+C","Ctrl+X","Ctrl+X","Ctrl+Z","Ctrl+Z"), "B",
        "Ctrl+C copies", "Ctrl+C"))
    qs.append(_q("computer", "networking",
        "Full form of WWW?", "WWW का पूर्ण रूप?",
        _mk_opt("World Web Width","World Web Width","World Wide Web","World Wide Web","Web World Wide","Web World Wide","Wide World Web","Wide World Web"), "B",
        "World Wide Web", "वर्ल्ड वाइड वेब"))

    return qs


@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.questions.create_index([("subject_id", 1), ("chapter_id", 1)])
    await db.test_sessions.create_index([("user_id", 1), ("started_at", -1)])
    await db.seen_questions.create_index([("user_id", 1), ("question_id", 1)], unique=True)
    await db.seen_questions.create_index([("user_id", 1), ("seen_at", 1)])
    await db.users.create_index("apple_sub", unique=True, sparse=True)
    # Auto seed on startup
    if await db.exam_categories.count_documents({}) == 0:
        try:
            await seed_run()
        except Exception as e:
            logger.exception("Seed failed: %s", e)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
