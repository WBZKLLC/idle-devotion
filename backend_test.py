#!/usr/bin/env python3
"""
Backend API Testing for Launch Banner and Journey Systems
=========================================================

This script tests the NEW Launch Banner and Journey APIs as requested.

Test Requirements:
1. Launch Banner APIs:
   - GET /api/launch-banner/hero - Should return featured hero "Aethon, The Celestial Blade"
   - GET /api/launch-banner/status/Adam - Should return banner status with pity counter, time remaining
   - GET /api/launch-banner/bundles/Adam - Should return available bundles
   - POST /api/launch-banner/pull/Adam - Single pull (requires crystals/gems)
   - POST /api/launch-banner/pull/Adam?multi=true - Multi pull (10x)

2. Journey APIs:
   - GET /api/journey/Adam - Should return 7-day journey data with days 1-7, milestones, and login rewards
   - POST /api/journey/Adam/claim-login?day=1 - Claim day 1 login reward (if not already claimed)

Authentication: username=Adam, password=Adam123!
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://endpoint-shield-1.preview.emergentagent.com/api"
USERNAME = "Adam"
PASSWORD = "Adam123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(title):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")

def print_test(test_name):
    print(f"\n{Colors.BOLD}{Colors.BLUE}🧪 Testing: {test_name}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.PURPLE}ℹ️  {message}{Colors.END}")

def authenticate():
    """Authenticate and get JWT token"""
    print_test("User Authentication")
    
    # Try to login first
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            print_success(f"Login successful for user: {USERNAME}")
            print_info(f"Token received: {token[:20]}...")
            return token
        elif response.status_code == 401:
            print_warning("Login failed - user may not exist or wrong password")
            return None
        else:
            print_error(f"Login failed with status {response.status_code}: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_error(f"Authentication request failed: {e}")
        return None

def test_launch_banner_hero():
    """Test GET /api/launch-banner/hero"""
    print_test("Launch Banner - Featured Hero")
    
    try:
        response = requests.get(f"{BACKEND_URL}/launch-banner/hero", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            hero = data.get("hero", {})
            hero_name = hero.get("name", "Unknown")
            
            if hero_name == "Aethon, The Celestial Blade":
                print_success(f"✅ Featured hero correct: {hero_name}")
                print_info(f"Hero details: {hero.get('rarity', 'Unknown')} {hero.get('element', 'Unknown')} {hero.get('hero_class', 'Unknown')}")
                return True
            else:
                print_error(f"❌ Wrong featured hero. Expected: 'Aethon, The Celestial Blade', Got: '{hero_name}'")
                return False
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_launch_banner_status(token):
    """Test GET /api/launch-banner/status/Adam"""
    print_test("Launch Banner - User Status")
    
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    try:
        response = requests.get(f"{BACKEND_URL}/launch-banner/status/{USERNAME}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            banner = data.get("banner", {})
            user_progress = data.get("user_progress", {})
            time_remaining = data.get("time_remaining", {})
            
            print_success("✅ Banner status retrieved successfully")
            print_info(f"Banner name: {banner.get('name', 'Unknown')}")
            print_info(f"Pity counter: {user_progress.get('pity_counter', 0)}")
            print_info(f"Total pulls: {user_progress.get('total_pulls', 0)}")
            print_info(f"Has featured hero: {user_progress.get('has_featured_hero', False)}")
            print_info(f"Banner active: {time_remaining.get('is_active', False)}")
            
            # Verify featured hero in banner
            featured_hero = banner.get("featured_hero", {})
            if featured_hero.get("name") == "Aethon, The Celestial Blade":
                print_success("✅ Featured hero in banner status is correct")
                return True
            else:
                print_error(f"❌ Featured hero in banner status incorrect: {featured_hero.get('name')}")
                return False
                
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_launch_banner_bundles(token):
    """Test GET /api/launch-banner/bundles/Adam"""
    print_test("Launch Banner - Available Bundles")
    
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    try:
        response = requests.get(f"{BACKEND_URL}/launch-banner/bundles/{USERNAME}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            bundles = data.get("bundles", [])
            all_bundles = data.get("all_bundles", [])
            
            print_success("✅ Bundles retrieved successfully")
            print_info(f"Available bundles: {len(bundles)}")
            print_info(f"Total bundles: {len(all_bundles)}")
            
            if bundles:
                for bundle in bundles[:3]:  # Show first 3
                    print_info(f"Bundle: {bundle.get('name', 'Unknown')} - ${bundle.get('price_usd', 0)}")
            
            return True
                
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_launch_banner_pull_single(token):
    """Test POST /api/launch-banner/pull/Adam (single pull)"""
    print_test("Launch Banner - Single Pull")
    
    if not token:
        print_error("❌ No authentication token available")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # First check user's current crystals/gems
        user_response = requests.get(f"{BACKEND_URL}/user/{USERNAME}", headers=headers, timeout=10)
        if user_response.status_code == 200:
            user_data = user_response.json()
            crystals = user_data.get("crystals", 0)
            gems = user_data.get("gems", 0)
            print_info(f"User crystals: {crystals}, gems: {gems}")
            
            # Check if user has enough currency for a pull
            if crystals < 100 and gems < 100:
                print_warning("⚠️ User may not have enough crystals/gems for pull")
        
        response = requests.post(f"{BACKEND_URL}/launch-banner/pull/{USERNAME}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            cost = data.get("cost", 0)
            new_pity = data.get("new_pity", 0)
            
            print_success("✅ Single pull successful")
            print_info(f"Cost: {cost} crystals")
            print_info(f"New pity counter: {new_pity}")
            print_info(f"Results count: {len(results)}")
            
            if results:
                for result in results:
                    hero = result.get("hero", {})
                    print_info(f"Pulled: {hero.get('name', 'Unknown')} ({hero.get('rarity', 'Unknown')})")
            
            return True
                
        elif response.status_code == 400:
            error_detail = response.json().get("detail", "Unknown error")
            if "Insufficient" in error_detail:
                print_warning(f"⚠️ Expected error - insufficient currency: {error_detail}")
                return True  # This is expected behavior
            else:
                print_error(f"❌ Unexpected error: {error_detail}")
                return False
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_launch_banner_pull_multi(token):
    """Test POST /api/launch-banner/pull/Adam?multi=true (multi pull)"""
    print_test("Launch Banner - Multi Pull (10x)")
    
    if not token:
        print_error("❌ No authentication token available")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(f"{BACKEND_URL}/launch-banner/pull/{USERNAME}?multi=true", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            cost = data.get("cost", 0)
            new_pity = data.get("new_pity", 0)
            
            print_success("✅ Multi pull successful")
            print_info(f"Cost: {cost} crystals")
            print_info(f"New pity counter: {new_pity}")
            print_info(f"Results count: {len(results)}")
            
            if results:
                for i, result in enumerate(results[:3]):  # Show first 3
                    hero = result.get("hero", {})
                    print_info(f"Pull {i+1}: {hero.get('name', 'Unknown')} ({hero.get('rarity', 'Unknown')})")
            
            return True
                
        elif response.status_code == 400:
            error_detail = response.json().get("detail", "Unknown error")
            if "Insufficient" in error_detail:
                print_warning(f"⚠️ Expected error - insufficient currency: {error_detail}")
                return True  # This is expected behavior
            else:
                print_error(f"❌ Unexpected error: {error_detail}")
                return False
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_journey_data(token):
    """Test GET /api/journey/Adam"""
    print_test("Journey - 7-Day Journey Data")
    
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    try:
        response = requests.get(f"{BACKEND_URL}/journey/{USERNAME}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            account_age = data.get("account_age_days", 0)
            current_day = data.get("current_day", 0)
            days = data.get("days", {})
            
            print_success("✅ Journey data retrieved successfully")
            print_info(f"Account age: {account_age} days")
            print_info(f"Current day: {current_day}")
            print_info(f"Days configured: {len(days)}")
            
            # Verify all 7 days are present
            if len(days) == 7:
                print_success("✅ All 7 days present in journey data")
                
                # Check structure of each day
                for day_num in range(1, 8):
                    day_data = days.get(str(day_num), {})
                    if day_data:
                        print_info(f"Day {day_num}: Unlocked={day_data.get('is_unlocked', False)}, Current={day_data.get('is_current', False)}, Login Claimed={day_data.get('login_claimed', False)}")
                
                return True
            else:
                print_error(f"❌ Expected 7 days, got {len(days)}")
                return False
                
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def test_journey_claim_login(token):
    """Test POST /api/journey/Adam/claim-login?day=1"""
    print_test("Journey - Claim Day 1 Login Reward")
    
    if not token:
        print_error("❌ No authentication token available")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.post(f"{BACKEND_URL}/journey/{USERNAME}/claim-login?day=1", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = data.get("success", False)
            day = data.get("day", 0)
            rewards = data.get("rewards", {})
            
            print_success("✅ Day 1 login reward claimed successfully")
            print_info(f"Day: {day}")
            print_info(f"Success: {success}")
            print_info(f"Rewards: {rewards}")
            
            return True
                
        elif response.status_code == 400:
            error_detail = response.json().get("detail", "Unknown error")
            if "Already claimed" in error_detail:
                print_warning(f"⚠️ Expected behavior - reward already claimed: {error_detail}")
                return True  # This is expected if already claimed
            elif "not yet unlocked" in error_detail:
                print_warning(f"⚠️ Day not yet unlocked: {error_detail}")
                return True  # This is expected for new accounts
            else:
                print_error(f"❌ Unexpected error: {error_detail}")
                return False
        else:
            print_error(f"❌ Request failed with status {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print_error(f"❌ Request failed: {e}")
        return False

def main():
    """Main testing function"""
    print_header("LAUNCH BANNER & JOURNEY API TESTING")
    print_info(f"Backend URL: {BACKEND_URL}")
    print_info(f"Test User: {USERNAME}")
    print_info(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track test results
    test_results = []
    
    # 1. Authentication
    token = authenticate()
    test_results.append(("Authentication", token is not None))
    
    # 2. Launch Banner Tests
    print_header("LAUNCH BANNER API TESTS")
    
    # Test featured hero endpoint
    result = test_launch_banner_hero()
    test_results.append(("Launch Banner - Featured Hero", result))
    
    # Test banner status
    result = test_launch_banner_status(token)
    test_results.append(("Launch Banner - Status", result))
    
    # Test bundles
    result = test_launch_banner_bundles(token)
    test_results.append(("Launch Banner - Bundles", result))
    
    # Test single pull
    result = test_launch_banner_pull_single(token)
    test_results.append(("Launch Banner - Single Pull", result))
    
    # Test multi pull
    result = test_launch_banner_pull_multi(token)
    test_results.append(("Launch Banner - Multi Pull", result))
    
    # 3. Journey Tests
    print_header("JOURNEY API TESTS")
    
    # Test journey data
    result = test_journey_data(token)
    test_results.append(("Journey - 7-Day Data", result))
    
    # Test login claim
    result = test_journey_claim_login(token)
    test_results.append(("Journey - Claim Login", result))
    
    # 4. Summary
    print_header("TEST SUMMARY")
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        if result:
            print_success(f"✅ {test_name}")
            passed += 1
        else:
            print_error(f"❌ {test_name}")
    
    print(f"\n{Colors.BOLD}Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%){Colors.END}")
    
    if passed == total:
        print_success("🎉 ALL TESTS PASSED! Launch Banner and Journey APIs are working correctly.")
        return 0
    else:
        print_error(f"⚠️ {total - passed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)