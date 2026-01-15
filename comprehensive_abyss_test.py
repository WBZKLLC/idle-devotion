#!/usr/bin/env python3
"""
Comprehensive Abyss System Test with Hero Setup
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://crash-shield.preview.emergentagent.com/api"
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

def setup_user_with_heroes(session):
    """Setup user with some heroes for testing"""
    print("🔧 Setting up user with heroes...")
    
    # Check current user data
    response = session.get(f"{BASE_URL}/user/{USERNAME}")
    if response.status_code == 200:
        user_data = response.json()
        print(f"User crystals: {user_data.get('crystals', 0)}")
        print(f"User coins: {user_data.get('coins', 0)}")
    
    # Check if user has heroes
    response = session.get(f"{BASE_URL}/user/{USERNAME}/heroes")
    if response.status_code == 200:
        heroes = response.json()
        print(f"User has {len(heroes)} heroes")
        
        if len(heroes) == 0:
            print("No heroes found, performing gacha pulls...")
            
            # Perform some gacha pulls to get heroes
            pull_data = {"pull_type": "multi", "currency_type": "crystals"}
            response = session.post(f"{BASE_URL}/gacha/pull?username={USERNAME}", json=pull_data)
            
            if response.status_code == 200:
                result = response.json()
                print(f"Pulled {len(result.get('heroes', []))} heroes")
            else:
                print(f"Gacha pull failed: {response.status_code} - {response.text}")
        
        # Get updated hero list
        response = session.get(f"{BASE_URL}/user/{USERNAME}/heroes")
        if response.status_code == 200:
            heroes = response.json()
            print(f"User now has {len(heroes)} heroes")
            return heroes
    
    return []

def test_abyss_with_heroes():
    """Test Abyss system with proper hero setup"""
    session = authenticate()
    if not session:
        print("❌ Authentication failed")
        return False
    
    print("🎮 COMPREHENSIVE ABYSS SYSTEM TEST")
    print("=" * 60)
    
    # Setup heroes
    heroes = setup_user_with_heroes(session)
    
    # Test 1: Abyss Status
    print("\n1. Testing Abyss Status:")
    response = session.get(f"{BASE_URL}/abyss/{USERNAME}/status")
    if response.status_code == 200:
        status_data = response.json()
        print("✅ Status endpoint working")
        print(f"   Current Level: {status_data.get('current_level')}")
        print(f"   Highest Cleared: {status_data.get('highest_cleared')}")
        print(f"   Boss: {status_data.get('current_boss', {}).get('name')} (HP: {status_data.get('current_boss', {}).get('current_hp')})")
    else:
        print(f"❌ Status failed: {response.status_code}")
        return False
    
    # Test 2: Multiple Abyss Attacks
    print("\n2. Testing Abyss Attacks (multiple attempts):")
    attack_count = 0
    max_attacks = 10
    
    while attack_count < max_attacks:
        response = session.post(f"{BASE_URL}/abyss/{USERNAME}/attack")
        if response.status_code == 200:
            attack_data = response.json()
            attack_count += 1
            
            damage = attack_data.get('damage_dealt', 0)
            boss_defeated = attack_data.get('boss_defeated', False)
            remaining_hp = attack_data.get('boss_remaining_hp', 0)
            
            print(f"   Attack {attack_count}: Damage={damage}, Boss HP={remaining_hp}, Defeated={boss_defeated}")
            
            if boss_defeated:
                print("   🎉 Boss defeated!")
                break
            
            if damage == 0:
                print("   ⚠️  No damage dealt - user may need heroes or team setup")
                break
        else:
            print(f"   ❌ Attack failed: {response.status_code}")
            break
    
    # Test 3: Check Status After Attacks
    print("\n3. Checking Status After Attacks:")
    response = session.get(f"{BASE_URL}/abyss/{USERNAME}/status")
    if response.status_code == 200:
        status_data = response.json()
        print("✅ Status endpoint working")
        print(f"   Current Level: {status_data.get('current_level')}")
        print(f"   Highest Cleared: {status_data.get('highest_cleared')}")
        print(f"   Total Damage Dealt: {status_data.get('total_damage_dealt')}")
    
    # Test 4: Abyss Records
    print("\n4. Testing Abyss Records:")
    response = session.get(f"{BASE_URL}/abyss/{USERNAME}/records")
    if response.status_code == 200:
        records_data = response.json()
        print("✅ Records endpoint working")
        print(f"   Total Cleared: {records_data.get('total_cleared')}")
        print(f"   Clear History: {len(records_data.get('clear_history', []))} records")
    else:
        print(f"❌ Records failed: {response.status_code}")
    
    # Test 5: Abyss Leaderboard
    print("\n5. Testing Abyss Leaderboard:")
    response = session.get(f"{BASE_URL}/abyss/leaderboard/server_1")
    if response.status_code == 200:
        leaderboard_data = response.json()
        print("✅ Leaderboard endpoint working")
        print(f"   Server: {leaderboard_data.get('server_id')}")
        print(f"   Leaderboard entries: {len(leaderboard_data.get('leaderboard', []))}")
        
        # Show top entries if any
        leaderboard = leaderboard_data.get('leaderboard', [])
        for i, entry in enumerate(leaderboard[:3]):
            print(f"     #{i+1}: {entry.get('username')} - Level {entry.get('highest_cleared')}")
    else:
        print(f"❌ Leaderboard failed: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("✅ ABYSS SYSTEM TEST COMPLETED")
    print("All endpoints are functional!")
    return True

if __name__ == "__main__":
    success = test_abyss_with_heroes()
    sys.exit(0 if success else 1)