import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dhanbad-pyq-practice.preview.emergentagent.com").rstrip("/")

ADMIN_TOKEN = "test_admin_token_123"
STUDENT_TOKEN = "test_student_token_123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def admin_api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN_TOKEN}"})
    return s


@pytest.fixture
def student_api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {STUDENT_TOKEN}"})
    return s
