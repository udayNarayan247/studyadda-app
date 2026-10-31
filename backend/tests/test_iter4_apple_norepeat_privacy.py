# Iteration 4: Apple auth rejection, no-repeat question selection (student + guest), delete account cleanup, privacy content
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
_benv = dotenv_values("/app/backend/.env")
mdb = MongoClient(_benv["MONGO_URL"])[_benv["DB_NAME"]]

STUDENT_TOKEN = "test_student_token_123"
STUDENT_UID = "user_teststud01"
DEL_TOKEN = "test_delete_token_456"
DEL_UID = "user_deltest02"


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def recreate_delete_user():
    now = datetime.now(timezone.utc)
    mdb.users.update_one({"user_id": DEL_UID}, {"$set": {"user_id": DEL_UID, "email": "delete2.test@studyadda.dev",
                         "name": "Delete Test", "picture": None, "role": "student", "language": "en", "created_at": now}}, upsert=True)
    mdb.user_sessions.update_one({"session_token": DEL_TOKEN}, {"$set": {"session_token": DEL_TOKEN, "user_id": DEL_UID,
                                 "created_at": now, "expires_at": now + timedelta(days=30)}}, upsert=True)


# ---- Apple auth ----
class TestAppleAuth:
    @pytest.mark.parametrize("tok", ["garbage", "a.b.c",
                                     "eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJzdWIiOiJ4In0.c2ln"])
    def test_invalid_token_401(self, tok):
        r = requests.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": tok})
        assert r.status_code == 401, r.text
        assert "Invalid Apple" in r.json()["detail"]

    def test_missing_token_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/apple", json={})
        assert r.status_code == 422


# ---- No-repeat for logged-in student ----
class TestStudentNoRepeat:
    def test_custom_quant_no_repeat(self):
        pool = mdb.questions.count_documents({"published": True, "subject_id": "quant"})
        assert pool == 10, f"expected 10 quant questions, got {pool}"
        mdb.seen_questions.delete_many({"user_id": STUDENT_UID})
        tests = []
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/tests/start", headers=H(STUDENT_TOKEN),
                              json={"mode": "custom", "subject_ids": ["quant"], "question_count": 3})
            assert r.status_code == 200, r.text
            ids = r.json()["question_ids"]
            assert len(ids) == 3 and len(set(ids)) == 3
            tests.append(ids)
        allids = [i for t in tests for i in t]
        assert len(set(allids)) == 9, f"overlap among first 3 tests: {tests}"
        assert mdb.seen_questions.count_documents({"user_id": STUDENT_UID}) == 9
        all_quant = set(mdb.questions.distinct("question_id", {"published": True, "subject_id": "quant"}))
        remaining = all_quant - set(allids)
        assert len(remaining) == 1
        r = requests.post(f"{BASE_URL}/api/tests/start", headers=H(STUDENT_TOKEN),
                          json={"mode": "custom", "subject_ids": ["quant"], "question_count": 3})
        assert r.status_code == 200
        t4 = r.json()["question_ids"]
        assert len(t4) == 3 and len(set(t4)) == 3
        assert remaining.issubset(set(t4)), f"test4 {t4} missing unseen {remaining}"
        others = set(t4) - remaining
        assert others.issubset(set(tests[0])), f"refill not from oldest test1 {tests[0]}: {t4}"
        assert mdb.seen_questions.count_documents({"user_id": STUDENT_UID}) == 10
        # cleanup
        mdb.seen_questions.delete_many({"user_id": STUDENT_UID})


# ---- Guest exclude_ids ----
class TestGuestExclude:
    def test_guest_exclude(self):
        all_quant = mdb.questions.distinct("question_id", {"published": True, "subject_id": "quant"})
        seen = all_quant[:7]
        r = requests.post(f"{BASE_URL}/api/guest/start",
                          json={"mode": "custom", "subject_ids": ["quant"], "question_count": 5, "exclude_ids": seen})
        assert r.status_code == 200, r.text
        ids = [q["question_id"] for q in r.json()["questions"]]
        assert len(ids) == 5 and len(set(ids)) == 5
        unseen = set(all_quant) - set(seen)
        assert unseen.issubset(set(ids))
        assert set(ids) - unseen == set(seen[:2]), f"refill should be oldest 2 of exclude list: {ids}"
        assert "_id" not in r.json()["questions"][0]

    def test_guest_chapter_small_pool(self):
        r = requests.post(f"{BASE_URL}/api/guest/start",
                          json={"mode": "chapter", "subject_ids": ["quant"], "chapter_ids": ["percentage"], "question_count": 10})
        assert r.status_code == 200, r.text
        ids = [q["question_id"] for q in r.json()["questions"]]
        assert len(ids) == len(set(ids)) and 1 <= len(ids) <= 10
        r2 = requests.post(f"{BASE_URL}/api/guest/start",
                           json={"mode": "chapter", "subject_ids": ["quant"], "chapter_ids": ["percentage"],
                                 "question_count": 10, "exclude_ids": ids})
        ids2 = [q["question_id"] for q in r2.json()["questions"]]
        assert r2.status_code == 200 and len(ids2) == len(set(ids2)) and set(ids2) == set(ids)


# ---- Delete account removes seen_questions ----
class TestDeleteAccountSeen:
    def test_delete_removes_seen(self):
        recreate_delete_user()
        r = requests.post(f"{BASE_URL}/api/tests/start", headers=H(DEL_TOKEN),
                          json={"mode": "custom", "subject_ids": ["quant"], "question_count": 3})
        assert r.status_code == 200, r.text
        assert mdb.seen_questions.count_documents({"user_id": DEL_UID}) == 3
        r = requests.delete(f"{BASE_URL}/api/auth/account", headers=H(DEL_TOKEN))
        assert r.status_code == 200 and r.json()["ok"] is True
        assert mdb.seen_questions.count_documents({"user_id": DEL_UID}) == 0
        assert mdb.users.count_documents({"user_id": DEL_UID}) == 0
        assert mdb.test_sessions.count_documents({"user_id": DEL_UID}) == 0
        assert requests.get(f"{BASE_URL}/api/auth/me", headers=H(DEL_TOKEN)).status_code == 401
        recreate_delete_user()


# ---- Privacy ----
class TestPrivacy:
    def test_privacy_content(self):
        r = requests.get(f"{BASE_URL}/api/privacy")
        assert r.status_code == 200
        t = r.text
        assert "Effective date:</b> 31 October 2026" in t or "Effective date: 31 October 2026" in t
        assert "un2085@gmail.com" in t
        assert "Apple" in t
        import re
        assert re.search(r"\d{5}[\s-]?\d{5}|\+91", t), "no phone number found"
