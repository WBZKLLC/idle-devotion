#!/usr/bin/env python3
"""
Comprehensive Divine Heroes Backend API Testing Suite
Tests all endpoints mentioned in the review request
"""

import requests
import json
import time
import random
import string
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://darkmode-overhaul.preview.emergentagent.com/api"

class ComprehensiveGachaGameTester:
    def __init__(self):
        self.test_username = f"TestHero_{random.randint(1000, 9999)}"
        self.session = requests.Session()
        self.test_results = []
        self.user_data = None
        self.user_heroes = []
        
    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        
    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            response = requests.request(method, url, timeout=30, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
            return None
    
    def test_user_registration_and_authentication(self):
        """Test user registration & authentication endpoints"""
        print("\n🔧 Testing User Registration & Authentication...")
        
        # 1. Register new user
        response = self.make_request("POST", f"/user/register", params={"username": self.test_username})
        
        if response and response.status_code == 200:
            data = response.json()
            self.user_data = data
            if data.get("username") == self.test_username and data.get("crystals") == 300:
                self.log_test("User Registration", True, f"User {self.test_username} registered with 300 crystals")
            else:
                self.log_test("User Registration", False, "Invalid registration response")
                return False
        else:
            self.log_test("User Registration", False, f"Registration failed: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Get user profile
        response = self.make_request("GET", f"/user/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["username", "crystals", "coins", "gold", "pity_counter"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("Get User Profile", True, f"Profile retrieved with all required fields")
            else:
                self.log_test("Get User Profile", False, f"Missing fields: {missing_fields}")
                return False
        else:
            self.log_test("Get User Profile", False, f"Failed to get profile: {response.status_code if response else 'No response'}")
            return False
        
        # 3. Daily login
        response = self.make_request("POST", f"/user/{self.test_username}/login")
        
        if response and response.status_code == 200:
            data = response.json()
            if "coins" in data and "gold" in data and data.get("coins", 0) > 0:
                self.log_test("Daily Login", True, f"Login rewards: {data.get('coins')} coins, {data.get('gold')} gold")
            else:
                self.log_test("Daily Login", False, "Invalid login reward response")
                return False
        else:
            self.log_test("Daily Login", False, f"Login failed: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_gacha_system(self):
        """Test gacha system endpoints"""
        print("\n🔧 Testing Gacha System...")
        
        # 1. Get all available heroes
        response = self.make_request("GET", "/heroes")
        
        if response and response.status_code == 200:
            heroes = response.json()
            if isinstance(heroes, list) and len(heroes) > 0:
                self.log_test("Get Heroes", True, f"Retrieved {len(heroes)} heroes from pool")
            else:
                self.log_test("Get Heroes", False, "No heroes returned")
                return False
        else:
            self.log_test("Get Heroes", False, f"Failed to get heroes: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Single pull with crystals
        pull_data = {"pull_type": "single", "currency_type": "crystals"}
        response = self.make_request("POST", f"/gacha/pull", params={"username": self.test_username}, json=pull_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "heroes" in data and len(data["heroes"]) == 1 and "new_pity_counter" in data:
                self.log_test("Single Pull (Crystals)", True, f"Pulled 1 hero, pity: {data.get('new_pity_counter')}")
            else:
                self.log_test("Single Pull (Crystals)", False, "Invalid pull response")
                return False
        else:
            self.log_test("Single Pull (Crystals)", False, f"Pull failed: {response.status_code if response else 'No response'}")
            return False
        
        # 3. Single pull with coins
        pull_data = {"pull_type": "single", "currency_type": "coins"}
        response = self.make_request("POST", f"/gacha/pull", params={"username": self.test_username}, json=pull_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "heroes" in data and len(data["heroes"]) == 1:
                self.log_test("Single Pull (Coins)", True, f"Pulled 1 hero with coins")
            else:
                self.log_test("Single Pull (Coins)", False, "Invalid coin pull response")
                return False
        else:
            self.log_test("Single Pull (Coins)", False, f"Coin pull failed: {response.status_code if response else 'No response'}")
            return False
        
        # 4. Multi pull with coins (should work since user has 10000+ coins)
        pull_data = {"pull_type": "multi", "currency_type": "coins"}
        response = self.make_request("POST", f"/gacha/pull", params={"username": self.test_username}, json=pull_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if "heroes" in data and len(data["heroes"]) == 10:
                self.log_test("Multi Pull (Coins)", True, f"Pulled 10 heroes with coins")
            else:
                self.log_test("Multi Pull (Coins)", False, f"Expected 10 heroes, got {len(data.get('heroes', []))}")
                return False
        else:
            self.log_test("Multi Pull (Coins)", False, f"Multi coin pull failed: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_hero_management(self):
        """Test hero management endpoints"""
        print("\n🔧 Testing Hero Management...")
        
        # 1. Get user's heroes
        response = self.make_request("GET", f"/user/{self.test_username}/heroes")
        
        if response and response.status_code == 200:
            heroes = response.json()
            self.user_heroes = heroes
            if isinstance(heroes, list) and len(heroes) > 0:
                self.log_test("Get User Heroes", True, f"Retrieved {len(heroes)} user heroes")
            else:
                self.log_test("Get User Heroes", False, "No user heroes found")
                return False
        else:
            self.log_test("Get User Heroes", False, f"Failed to get user heroes: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Try to upgrade hero (will likely fail due to insufficient duplicates, which is expected)
        if self.user_heroes:
            hero_id = self.user_heroes[0]["id"]
            response = self.make_request("POST", f"/user/{self.test_username}/heroes/{hero_id}/upgrade")
            
            if response and response.status_code == 200:
                data = response.json()
                self.log_test("Hero Upgrade", True, f"Hero upgraded to rank {data.get('rank')}")
            elif response and response.status_code == 400:
                self.log_test("Hero Upgrade", True, "Upgrade correctly rejected (insufficient duplicates)")
            else:
                self.log_test("Hero Upgrade", False, f"Unexpected upgrade response: {response.status_code if response else 'No response'}")
                return False
        
        return True
    
    def test_vip_system(self):
        """Test VIP system endpoints"""
        print("\n🔧 Testing VIP System...")
        
        # 1. Get VIP info
        response = self.make_request("GET", f"/vip/info/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ["current_vip_level", "total_spent", "current_idle_hours"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                self.log_test("VIP Info", True, f"VIP Level: {data.get('current_vip_level')}, Idle Hours: {data.get('current_idle_hours')}")
            else:
                self.log_test("VIP Info", False, f"Missing VIP fields: {missing_fields}")
                return False
        else:
            self.log_test("VIP Info", False, f"Failed to get VIP info: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Get VIP comparison
        response = self.make_request("GET", f"/vip/comparison/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "current_vip" in data and "tiers" in data:
                self.log_test("VIP Comparison", True, "VIP comparison data retrieved")
            else:
                self.log_test("VIP Comparison", False, "Invalid VIP comparison response")
                return False
        else:
            self.log_test("VIP Comparison", False, f"Failed to get VIP comparison: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_store_system(self):
        """Test store system endpoints"""
        print("\n🔧 Testing Store System...")
        
        # 1. Get crystal packages
        response = self.make_request("GET", "/store/crystal-packages")
        
        if response and response.status_code == 200:
            data = response.json()
            if "packages" in data and len(data["packages"]) > 0:
                self.log_test("Crystal Packages", True, f"Retrieved {len(data['packages'])} crystal packages")
            else:
                self.log_test("Crystal Packages", False, "No crystal packages found")
                return False
        else:
            self.log_test("Crystal Packages", False, f"Failed to get packages: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Purchase crystals (simulated)
        response = self.make_request("POST", "/store/purchase-crystals", params={"username": self.test_username, "package_id": "starter"})
        
        if response and response.status_code == 200:
            data = response.json()
            if "crystals_received" in data:
                self.log_test("Purchase Crystals", True, f"Purchased {data.get('crystals_received')} crystals")
            else:
                self.log_test("Purchase Crystals", False, "Invalid purchase response")
                return False
        else:
            self.log_test("Purchase Crystals", False, f"Purchase failed: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_idle_system(self):
        """Test idle system endpoints"""
        print("\n🔧 Testing Idle System...")
        
        # 1. Get idle status
        response = self.make_request("GET", f"/idle/status/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "is_collecting" in data and "gold_pending" in data:
                self.log_test("Idle Status", True, f"Idle collecting: {data.get('is_collecting')}, Pending: {data.get('gold_pending')} gold")
            else:
                self.log_test("Idle Status", False, "Invalid idle status response")
                return False
        else:
            self.log_test("Idle Status", False, f"Failed to get idle status: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Claim idle rewards
        response = self.make_request("POST", "/idle/claim", params={"username": self.test_username})
        
        if response and response.status_code == 200:
            data = response.json()
            if "gold_earned" in data:
                self.log_test("Idle Claim", True, f"Claimed {data.get('gold_earned')} gold")
            else:
                self.log_test("Idle Claim", False, "Invalid idle claim response")
                return False
        else:
            self.log_test("Idle Claim", False, f"Failed to claim idle rewards: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_leaderboards(self):
        """Test leaderboard endpoints"""
        print("\n🔧 Testing Leaderboards...")
        
        leaderboard_types = ["cr", "arena", "abyss"]
        
        for lb_type in leaderboard_types:
            response = self.make_request("GET", f"/leaderboard/{lb_type}", params={"limit": 10})
            
            if response and response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test(f"Leaderboard {lb_type.upper()}", True, f"Retrieved {len(data)} entries")
                else:
                    self.log_test(f"Leaderboard {lb_type.upper()}", False, "Invalid leaderboard response format")
                    return False
            else:
                self.log_test(f"Leaderboard {lb_type.upper()}", False, f"Failed to get leaderboard: {response.status_code if response else 'No response'}")
                return False
        
        return True
    
    def test_abyss_mode(self):
        """Test abyss mode endpoints"""
        print("\n🔧 Testing Abyss Mode...")
        
        # 1. Get abyss progress
        response = self.make_request("GET", f"/abyss/progress/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "current_level" in data:
                self.log_test("Abyss Progress", True, f"Current abyss level: {data.get('current_level')}")
            else:
                self.log_test("Abyss Progress", False, "Invalid abyss progress response")
                return False
        else:
            self.log_test("Abyss Progress", False, f"Failed to get abyss progress: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Battle abyss level
        battle_data = {"team_ids": []}
        response = self.make_request("POST", f"/abyss/battle/{self.test_username}/1", json=battle_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Abyss Battle", True, "Abyss battle completed")
        else:
            self.log_test("Abyss Battle", False, f"Abyss battle failed: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_arena_system(self):
        """Test arena system endpoints"""
        print("\n🔧 Testing Arena System...")
        
        # 1. Get arena record
        response = self.make_request("GET", f"/arena/record/{self.test_username}")
        
        if response and response.status_code == 200:
            data = response.json()
            if "rating" in data:
                self.log_test("Arena Record", True, f"Arena rating: {data.get('rating')}")
            else:
                self.log_test("Arena Record", False, "Invalid arena record response")
                return False
        else:
            self.log_test("Arena Record", False, f"Failed to get arena record: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Arena battle
        battle_data = {"team_id": "default"}
        response = self.make_request("POST", f"/arena/battle/{self.test_username}", json=battle_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Arena Battle", True, "Arena battle completed")
        else:
            self.log_test("Arena Battle", False, f"Arena battle failed: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def test_character_rating(self):
        """Test character rating endpoint"""
        print("\n🔧 Testing Character Rating...")
        
        response = self.make_request("GET", f"/user/{self.test_username}/cr")
        
        if response and response.status_code == 200:
            data = response.json()
            if "cr" in data and "hero_count" in data:
                self.log_test("Character Rating", True, f"CR: {data.get('cr')}, Heroes: {data.get('hero_count')}")
            else:
                self.log_test("Character Rating", False, "Invalid CR response")
                return False
        else:
            self.log_test("Character Rating", False, f"Failed to get CR: {response.status_code if response else 'No response'}")
            return False
        
        return True
    
    def run_all_tests(self):
        """Run all comprehensive backend tests"""
        print(f"🚀 Starting Comprehensive Divine Heroes Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {self.test_username}")
        print("=" * 80)
        
        # Test sequence based on review request
        test_functions = [
            self.test_user_registration_and_authentication,
            self.test_gacha_system,
            self.test_hero_management,
            self.test_vip_system,
            self.test_store_system,
            self.test_idle_system,
            self.test_leaderboards,
            self.test_abyss_mode,
            self.test_arena_system,
            self.test_character_rating
        ]
        
        for test_func in test_functions:
            try:
                test_func()
                time.sleep(0.5)  # Small delay between test groups
            except Exception as e:
                self.log_test(test_func.__name__, False, f"Exception: {str(e)}")
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
        
        return passed == total

if __name__ == "__main__":
    tester = ComprehensiveGachaGameTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All comprehensive tests passed!")
    else:
        print("\n⚠️  Some tests failed - check logs above")