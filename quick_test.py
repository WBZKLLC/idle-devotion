#!/usr/bin/env python3
"""
Quick Backend API Status Check
"""

import requests
import json

BASE_URL = "https://divinemobile.preview.emergentagent.com/api"
TEST_USERNAME = "testplayer"

def test_endpoint(method, endpoint, **kwargs):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    try:
        response = requests.request(method, url, timeout=10, **kwargs)
        return response.status_code, response.text[:200]
    except Exception as e:
        return None, str(e)

print("🔍 Quick Backend API Status Check")
print("=" * 50)

# Test basic endpoints
endpoints = [
    ("GET", "/", {}),
    ("POST", f"/user/register?username=testuser2", {}),
    ("GET", f"/user/{TEST_USERNAME}", {}),
    ("POST", f"/user/{TEST_USERNAME}/login", {}),
    ("GET", "/heroes", {}),
    ("GET", f"/user/{TEST_USERNAME}/heroes", {}),
    ("POST", f"/gacha/pull?username={TEST_USERNAME}", {"json": {"pull_type": "single", "currency_type": "gems"}}),
    ("POST", f"/team/create?username={TEST_USERNAME}&team_name=TestTeam2", {}),
    ("GET", f"/team/{TEST_USERNAME}", {}),
    ("POST", f"/idle/claim?username={TEST_USERNAME}", {})
]

for method, endpoint, kwargs in endpoints:
    status, response = test_endpoint(method, endpoint, **kwargs)
    status_icon = "✅" if status == 200 else "❌" if status else "💥"
    print(f"{status_icon} {method} {endpoint}: {status} - {response}")

print("\n🔍 Analysis:")
print("- 520 errors indicate ObjectId serialization issues in backend")
print("- Some endpoints work (registration, login, idle) - these don't return MongoDB docs")
print("- Endpoints that return MongoDB docs fail (get user, heroes, teams)")