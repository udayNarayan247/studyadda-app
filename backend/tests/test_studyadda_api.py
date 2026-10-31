"""StudyAdda backend tests: catalog, auth, tests, bookmarks, admin, guest."""
import io
import pytest
import requests

# -------- Catalog --------
class TestCatalog:
    def test_categories(self, api, base_url):
        r = api.get(f"{base_url}/api/catalog/categories")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        ids = {c["category_id"] for c in data}
        assert {"bank", "ssc", "railway"}.issubset(ids)

    def test_exams_bank(self, api, base_url):
        r = api.get(f"{base_url}/api/catalog/exams", params={"category_id": "bank"})
        assert r.status_code == 200
        data = r.json()
        assert any(e["exam_id"] == "ibps-po" for e in data)
        assert all(e["category_id"] == "bank" for e in data)

    def test_subjects(self, api, base_url):
        r = api.get(f"{base_url}/api/catalog/subjects")
        assert r.status_code == 200
        ids = {s["subject_id"] for s in r.json()}
        assert "quant" in ids

    def test_chapters_quant(self, api, base_url):
        r = api.get(f"{base_url}/api/catalog/chapters", params={"subject_id": "quant"})
        assert r.status_code == 200
        data = r.json()
        assert any(c["chapter_id"] == "percentage" for c in data)


# -------- Auth --------
class TestAuth:
    def test_me_without_token(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer invalid_xxx"})
        assert r.status_code == 401

    def test_me_admin(self, admin_api, base_url):
        r = admin_api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        user = r.json()
        assert user["role"] == "admin"
        assert user["user_id"] == "user_testadmin01"

    def test_me_student(self, student_api, base_url):
        r = student_api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "student"


# -------- Tests sessions --------
class TestTestSessions:
    def test_start_chapter_mode(self, student_api, base_url):
        payload = {"mode": "chapter", "chapter_ids": ["percentage"], "question_count": 20, "duration_minutes": 20}
        r = student_api.post(f"{base_url}/api/tests/start", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert len(data["question_ids"]) >= 1
        TestTestSessions.chapter_sid = data["session_id"]

    def test_get_test(self, student_api, base_url):
        sid = TestTestSessions.chapter_sid
        r = student_api.get(f"{base_url}/api/tests/{sid}")
        assert r.status_code == 200
        body = r.json()
        assert "session" in body and "questions" in body
        assert len(body["questions"]) == len(body["session"]["question_ids"])

    def test_submit_test_scores(self, student_api, base_url):
        sid = TestTestSessions.chapter_sid
        tr = student_api.get(f"{base_url}/api/tests/{sid}")
        questions = tr.json()["questions"]
        # Answer first correct, rest wrong with 'A' (may be right or wrong)
        answers = {}
        correct_expected = 0
        wrong_expected = 0
        for i, q in enumerate(questions):
            if i == 0:
                answers[q["question_id"]] = q["correct"]
                correct_expected += 1
            else:
                pick = "A" if q["correct"] != "A" else "B"
                answers[q["question_id"]] = pick
                wrong_expected += 1
        r = student_api.post(f"{base_url}/api/tests/{sid}/submit", json={"answers": answers, "marked_for_review": [], "time_taken_seconds": 60})
        assert r.status_code == 200
        res = r.json()
        assert res["status"] == "submitted"
        assert res["correct_count"] == correct_expected
        assert res["wrong_count"] == wrong_expected
        expected_score = round(correct_expected * 1.0 - wrong_expected * 0.25, 2)
        assert res["score"] == expected_score
        assert "chapter_stats" in res

    def test_start_mixed_mode_4_chapters(self, student_api, base_url):
        payload = {"mode": "mixed", "chapter_ids": ["percentage", "profit-loss", "average", "si-ci"], "question_count": 20, "duration_minutes": 20}
        r = student_api.post(f"{base_url}/api/tests/start", json=payload)
        assert r.status_code == 200, r.text
        assert len(r.json()["question_ids"]) >= 1

    def test_start_mock_ibps_po(self, student_api, base_url):
        payload = {"mode": "mock", "exam_id": "ibps-po", "question_count": 20, "duration_minutes": 20}
        r = student_api.post(f"{base_url}/api/tests/start", json=payload)
        # might fallback (no exam-tagged questions); still returns 200 or 400
        assert r.status_code in (200, 400)

    def test_list_my_tests(self, student_api, base_url):
        r = student_api.get(f"{base_url}/api/tests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1


# -------- Bookmarks --------
class TestBookmarks:
    def test_bookmark_flow(self, student_api, base_url):
        qr = requests.get(f"{base_url}/api/questions", params={"subject_id": "quant", "limit": 1})
        assert qr.status_code == 200
        qid = qr.json()[0]["question_id"]
        # add
        r = student_api.post(f"{base_url}/api/bookmarks/{qid}")
        assert r.status_code == 200
        # list
        r = student_api.get(f"{base_url}/api/bookmarks")
        assert r.status_code == 200
        assert any(q["question_id"] == qid for q in r.json())
        # delete
        r = student_api.delete(f"{base_url}/api/bookmarks/{qid}")
        assert r.status_code == 200
        r = student_api.get(f"{base_url}/api/bookmarks")
        assert not any(q["question_id"] == qid for q in r.json())


# -------- Admin --------
class TestAdmin:
    def test_stats_admin(self, admin_api, base_url):
        r = admin_api.get(f"{base_url}/api/admin/stats")
        assert r.status_code == 200
        s = r.json()
        for k in ("users", "questions", "verified_questions", "tests_taken"):
            assert k in s

    def test_stats_student_forbidden(self, student_api, base_url):
        r = student_api.get(f"{base_url}/api/admin/stats")
        assert r.status_code == 403

    def test_admin_question_crud(self, admin_api, base_url):
        payload = {
            "subject_id": "quant", "chapter_id": "percentage",
            "text": "TEST_ What is 10% of 200?", "text_hi": "TEST_ 200 का 10%?",
            "options": [
                {"key": "A", "text": "10", "text_hi": "10"},
                {"key": "B", "text": "20", "text_hi": "20"},
                {"key": "C", "text": "30", "text_hi": "30"},
                {"key": "D", "text": "40", "text_hi": "40"},
            ],
            "correct": "B", "solution": "20", "solution_hi": "20",
            "difficulty": "easy", "verified": True, "published": True,
        }
        r = admin_api.post(f"{base_url}/api/admin/questions", json=payload)
        assert r.status_code == 200, r.text
        qid = r.json()["question_id"]
        # update
        payload["text"] = "TEST_ Updated 10% of 200?"
        r = admin_api.put(f"{base_url}/api/admin/questions/{qid}", json=payload)
        assert r.status_code == 200
        assert "Updated" in r.json()["text"]
        # delete
        r = admin_api.delete(f"{base_url}/api/admin/questions/{qid}")
        assert r.status_code == 200
        # verify gone
        r = requests.get(f"{base_url}/api/questions", params={"chapter_id": "percentage", "limit": 500})
        assert all(q["question_id"] != qid for q in r.json())

    def test_admin_create_as_student_forbidden(self, student_api, base_url):
        payload = {
            "subject_id": "quant", "chapter_id": "percentage",
            "text": "x", "text_hi": "x",
            "options": [{"key": k, "text": "x", "text_hi": "x"} for k in "ABCD"],
            "correct": "A", "solution": "", "solution_hi": "",
        }
        r = student_api.post(f"{base_url}/api/admin/questions", json=payload)
        assert r.status_code == 403

    def test_bulk_csv_upload(self, base_url):
        csv_text = (
            "subject_id,chapter_id,exam_id,year,shift,paper,text,text_hi,optA,optA_hi,optB,optB_hi,optC,optC_hi,optD,optD_hi,correct,solution,solution_hi,difficulty,source,verified\n"
            "quant,percentage,,2023,,,TEST_ 50% of 200,TEST_ 200 का 50%,80,80,100,100,120,120,140,140,B,100,100,easy,TEST,true\n"
        )
        files = {"file": ("test.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
        r = requests.post(
            f"{base_url}/api/admin/questions/bulk-csv",
            headers={"Authorization": "Bearer test_admin_token_123"},
            files=files,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["inserted"] == 1
        assert data["errors"] == []
        # cleanup: remove CSV-inserted TEST_ question so it doesn't leak into real quizzes
        admin_h = {"Authorization": "Bearer test_admin_token_123"}
        qs = requests.get(f"{base_url}/api/questions", params={"limit": 500}, headers=admin_h).json()
        for q in qs:
            if str(q.get("text", "")).startswith("TEST_"):
                requests.delete(f"{base_url}/api/admin/questions/{q['question_id']}", headers=admin_h)


# -------- Guest --------
class TestGuest:
    def test_guest_start_no_auth(self, base_url):
        payload = {"mode": "chapter", "chapter_ids": ["percentage"], "question_count": 10}
        r = requests.post(f"{base_url}/api/guest/start", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "questions" in data and len(data["questions"]) >= 1
        assert data["questions"][0]["chapter_id"] == "percentage"
