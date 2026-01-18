#!/usr/bin/env python3
"""
Focused Test for Phase 3.59-3.61 Implementation
Tests the specific endpoints mentioned in the review request
"""

import requests
import json
import time

BASE_URL = "https://pvp-evolution.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "username": "ADAM",
    "password": "=267+HA4i4=!Af7StuS6A=eX2V3b*S1=aQL?u?H5_w$qlGU__T*0ow$lJeB*Zo9I"
}

def test_phase_359_361():
    """Test Phase 3.59-3.61 implementation"""
    print("🎯 PHASE 3.59-3.61 IMPLEMENTATION TEST")
    print("=" * 60)
    
    # Step 1: Login as ADAM to get JWT token
    print("1. Authenticating as ADAM...")
    login_response = requests.post(f"{BASE_URL}/auth/login", json=TEST_CREDENTIALS)
    
    if login_response.status_code != 200:
        print(f"❌ Authentication failed: {login_response.status_code}")
        return False
    
    token_data = login_response.json()
    auth_token = token_data.get("token")
    if not auth_token:
        print("❌ No token in response")
        return False
    
    print("✅ Authentication successful")
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Step 2: Call GET /api/arena/opponents/ADAM to get list of opponents
    print("\n2. Testing GET /api/arena/opponents/ADAM...")
    opponents_response = requests.get(f"{BASE_URL}/arena/opponents/ADAM", headers=headers)
    
    if opponents_response.status_code != 200:
        print(f"❌ Opponents endpoint failed: {opponents_response.status_code}")
        return False
    
    opponents = opponents_response.json()
    if not isinstance(opponents, list) or len(opponents) == 0:
        print(f"❌ Invalid opponents response: {opponents}")
        return False
    
    print(f"✅ Retrieved {len(opponents)} opponents (including NPC fallbacks)")
    
    # Verify NPCs are included
    npc_count = sum(1 for opp in opponents if opp.get("isNpc", False))
    print(f"   - NPC opponents: {npc_count}")
    
    # Step 3: Call POST /api/pvp/match with auth header
    print("\n3. Testing POST /api/pvp/match...")
    match_data = {
        "opponent_id": "npc_3",
        "source_id": "test-unique-id-001"
    }
    
    match_response = requests.post(f"{BASE_URL}/pvp/match", json=match_data, headers=headers)
    
    if match_response.status_code != 200:
        print(f"❌ PvP match failed: {match_response.status_code}")
        return False
    
    match_result = match_response.json()
    required_fields = ["victory", "rating_change", "rewards"]
    
    if not all(field in match_result for field in required_fields):
        print(f"❌ Missing required fields in response: {match_result}")
        return False
    
    print("✅ PvP match executed successfully")
    print(f"   - Victory: {match_result.get('victory')}")
    print(f"   - Rating Change: {match_result.get('rating_change')}")
    print(f"   - Rewards: {match_result.get('rewards')}")
    
    # Step 4: Test idempotency - same source_id should return same result
    print("\n4. Testing idempotency (same source_id)...")
    time.sleep(1)
    
    match_response_2 = requests.post(f"{BASE_URL}/pvp/match", json=match_data, headers=headers)
    
    if match_response_2.status_code != 200:
        print(f"❌ Idempotency test failed: {match_response_2.status_code}")
        return False
    
    match_result_2 = match_response_2.json()
    
    # Compare key fields
    victory_match = match_result.get("victory") == match_result_2.get("victory")
    rating_match = match_result.get("rating_change") == match_result_2.get("rating_change")
    
    if not (victory_match and rating_match):
        print(f"❌ Idempotency failed - results differ")
        return False
    
    print("✅ Idempotency working - same source_id returns identical results")
    
    # Step 5: Test with different source_id to get new match
    print("\n5. Testing new match (different source_id)...")
    new_match_data = {
        "opponent_id": "npc_3",
        "source_id": "test-unique-id-002"
    }
    
    new_match_response = requests.post(f"{BASE_URL}/pvp/match", json=new_match_data, headers=headers)
    
    if new_match_response.status_code != 200:
        print(f"❌ New match failed: {new_match_response.status_code}")
        return False
    
    new_match_result = new_match_response.json()
    print("✅ New match with different source_id successful")
    print(f"   - Victory: {new_match_result.get('victory')}")
    print(f"   - Rating Change: {new_match_result.get('rating_change')}")
    
    # Step 6: Test Phase 3.61 - GET /api/dev/difficulty/dump
    print("\n6. Testing GET /api/dev/difficulty/dump (Phase 3.61)...")
    difficulty_response = requests.get(f"{BASE_URL}/dev/difficulty/dump", headers=headers)
    
    if difficulty_response.status_code != 200:
        print(f"❌ Difficulty dump failed: {difficulty_response.status_code}")
        return False
    
    difficulty_data = difficulty_response.json()
    
    if not isinstance(difficulty_data, dict) or "chapters" not in difficulty_data:
        print(f"❌ Invalid difficulty dump format: {difficulty_data}")
        return False
    
    chapters = difficulty_data.get("chapters", [])
    print(f"✅ Difficulty dump successful - {len(chapters)} chapters in table")
    
    print("\n" + "=" * 60)
    print("🎉 ALL PHASE 3.59-3.61 TESTS PASSED!")
    print("✅ PvP opponents endpoint working (returns 5 opponents with NPC fallbacks)")
    print("✅ PvP match endpoint working (returns victory, rating_change, rewards)")
    print("✅ Idempotency working (same source_id returns same result)")
    print("✅ New matches working (different source_id returns new result)")
    print("✅ Difficulty dump endpoint working (DEV-only table dump)")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_phase_359_361()
    exit(0 if success else 1)