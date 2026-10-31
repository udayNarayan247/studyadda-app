# Iteration 2: Store-readiness features (Delete Account, Privacy page) + $sample regression
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

_benv = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or _benv.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _benv.get("DB_NAME")


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture
def throwaway_user(db):
    """Create a TEST_ throwaway user with session, test_session and bookmark (not the shared 456 account)."""
    uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
    token = f"TEST_tok_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)
    db.users.insert_one({"user_id": uid, "email": f"{uid}@test.dev", "name": "TEST Del", "role": "student", "language": "en", "created_at": now})
    db.user_sessions.insert_one({"session_token": token, "user_id": uid, "created_at": now, "expires_at": now + timedelta(days=1)})
    db.test_sessions.insert_one({"session_id": f"TEST_ts_{uid}", "user_id": uid, "question_ids": [], "status": "in_progress"})
    db.bookmarks.insert_one({"user_id": uid, "question_id": "TEST_q", "created_at": now})
    yield uid, token
    for col in ("users", "user_sessions", "test_sessions", "bookmarks"):
        db[col].delete_many({"user_id": uid})


# ---- Delete account ----
class TestDeleteAccount:
    def test_delete_without_auth_401(self, base_url):
        r = requests.delete(f"{base_url}/api/auth/account")
        assert r.status_code == 401

    def test_delete_invalid_token_401(self, base_url):
        r = requests.delete(f"{base_url}/api/auth/account", headers={"Authorization": "Bearer nope_invalid"})
        assert r.status_code == 401

    def test_delete_removes_everything(self, base_url, db, throwaway_user):
        uid, token = throwaway_user
        h = {"Authorization": f"Bearer {token}"}
        assert requests.get(f"{base_url}/api/auth/me", headers=h).status_code == 200
        r = requests.delete(f"{base_url}/api/auth/account", headers=h)
        assert r.status_code == 200 and r.json() == {"ok": True}
        assert db.users.count_documents({"user_id": uid}) == 0
        assert db.user_sessions.count_documents({"user_id": uid}) == 0
        assert db.test_sessions.count_documents({"user_id": uid}) == 0
        assert db.bookmarks.count_documents({"user_id": uid}) == 0
        assert requests.get(f"{base_url}/api/auth/me", headers=h).status_code == 401
        # second delete with same token -> 401
        assert requests.delete(f"{base_url}/api/auth/account", headers=h).status_code == 401

    def test_protected_accounts_intact(self, db):
        assert db.users.count_documents({"user_id": {"$in": ["user_testadmin01", "user_teststud01"]}}) == 2


# ---- Privacy page ----
class TestPrivacy:
    def test_privacy_html(self, base_url):
        r = requests.get(f"{base_url}/api/privacy")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "Privacy Policy" in r.text and "Delete Account" in r.text


# ---- $sample regression ----
class TestSampling:
    @pytest.mark.parametrize("payload", [
        {"mode": "chapter", "chapter_ids": ["percentage"], "question_count": 5, "duration_minutes": 5},
        {"mode": "mixed", "chapter_ids": ["percentage", "profit-loss", "average", "si-ci"], "question_count": 10, "duration_minutes": 10},
        {"mode": "mock", "exam_id": "ibps-po", "question_count": 10, "duration_minutes": 10},
    ])
    def test_start_counts_no_dupes(self, student_api, base_url, payload):
        r = student_api.post(f"{base_url}/api/tests/start", json=payload)
        assert r.status_code == 200, r.text
        ids = r.json()["question_ids"]
        assert 1 <= len(ids) <= payload["question_count"]
        assert len(ids) == len(set(ids))

    def test_start_count_exact_when_pool_large(self, student_api, admin_api, base_url):
        # count available pool for 4 chapters to check exactness
        pool = admin_api.get(f"{base_url}/api/questions", params={"limit": 500}).json()
        chs = {"percentage", "profit-loss", "average", "si-ci"}
        avail = len([q for q in pool if q.get("chapter_id") in chs and q.get("published", True)])
        n = min(10, avail)
        r = student_api.post(f"{base_url}/api/tests/start", json={"mode": "mixed", "chapter_ids": list(chs), "question_count": 10, "duration_minutes": 10})
        assert len(r.json()["question_ids"]) == n, f"avail={avail}"

    def test_guest_start_no_dupes(self, base_url):
        r = requests.post(f"{base_url}/api/guest/start", json={"mode": "chapter", "chapter_ids": ["percentage"], "question_count": 5})
        assert r.status_code == 200, r.text
        qs = r.json()["questions"]
        ids = [q["question_id"] for q in qs]
        assert 1 <= len(ids) <= 5 and len(ids) == len(set(ids))
        assert all(q["chapter_id"] == "percentage" for q in qs)
        assert all("_id" not in q for q in qs)

    def test_questions_limit_cap(self, admin_api, base_url):
        r = admin_api.get(f"{base_url}/api/questions", params={"limit": 9999})
        assert r.status_code == 200
        assert len(r.json()) <= 500
