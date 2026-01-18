#!/usr/bin/env python3
"""
Detailed Abyss API Investigation
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://gameguard-5.preview.emergentagent.com/api"
USERNAME = "Adam"
PASSWORD = "Adam123!"

def authenticate():
    """Get authentication token"""
    session = requests.Session()
    
    # Login
    login_data = {"username": USERNAME, "password": PASSWORD}
    response = session.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        result = response.json()
        token = result.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    return None

def investigate_abyss_endpoints():
    """Investigate Abyss endpoints in detail"""
    session = authenticate()
    if not session:
        print("❌ Authentication failed")
        return
    
    print("🔍 DETAILED ABYSS ENDPOINT INVESTIGATION")
    print("=" * 60)
    
    # Test Status endpoint
    print("\n1. Testing Abyss Status:")
    response = session.get(f"{BASE_URL}/abyss/{USERNAME}/status")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response Data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error: {response.text}")
    
    # Test Attack endpoint
    print("\n2. Testing Abyss Attack:")
    response = session.post(f"{BASE_URL}/abyss/{USERNAME}/attack")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response Data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error: {response.text}")
    
    # Test Records endpoint
    print("\n3. Testing Abyss Records:")
    response = session.get(f"{BASE_URL}/abyss/{USERNAME}/records")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response Data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error: {response.text}")
    
    # Test Leaderboard endpoint
    print("\n4. Testing Abyss Leaderboard:")
    response = session.get(f"{BASE_URL}/abyss/leaderboard/server_1")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response Data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    investigate_abyss_endpoints()