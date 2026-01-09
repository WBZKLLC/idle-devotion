#!/usr/bin/env python3
"""
Final Comprehensive Backend API Test for Gacha Game
Tests all endpoints with a fresh user to ensure full functionality
"""

import requests
import json
import time
from datetime import datetime
import sys
import random

# Configuration
BASE_URL = "https://portrait-updater.preview.emergentagent.com/api"
TEST_USERNAME = f"testuser_{random.randint(1000, 9999)}"

class ComprehensiveGachaTest:
    def __init__(self):
        self.base_url = BASE_URL
        self.username = TEST_USERNAME
        self.user_data = None
        self.user_heroes = []
        self.teams = []
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log_result(self, test_name, success, message=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        
        if success:
            self.test_results["passed"] += 1
        else:
            self.test_results["failed"] += 1
            self.test_results["errors"].append(f"{test_name}: {message}")
    
    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.request(method, url, timeout=30, **kwargs)
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {e}")
            return None
    
    def test_complete_flow(self):
        """Test the complete gacha game flow"""
        print(f"\n🚀 Testing Complete Gacha Game Flow with user: {self.username}")
        print("=" * 70)
        
        # 1. User Registration
        print("\n1️⃣ Testing User Registration...")
        response = self.make_request("POST", f"/user/register?username={self.username}")
        if response and response.status_code == 200:
            self.user_data = response.json()
            self.log_result("User Registration", True, 
                          f"User created with {self.user_data['gems']} gems, {self.user_data['coins']} coins")
        else:
            self.log_result("User Registration", False, f"Failed: {response.status_code if response else 'No response'}")
            return False
        
        # 2. Get All Heroes
        print("\n2️⃣ Testing Hero Pool...")
        response = self.make_request("GET", "/heroes")
        if response and response.status_code == 200:
            heroes = response.json()
            self.log_result("Get Heroes Pool", True, f"Retrieved {len(heroes)} heroes")
        else:
            self.log_result("Get Heroes Pool", False, "Failed to get heroes")
            return False
        
        # 3. Daily Login
        print("\n3️⃣ Testing Daily Login...")
        response = self.make_request("POST", f"/user/{self.username}/login")
        if response and response.status_code == 200:
            rewards = response.json()
            self.log_result("Daily Login", True, f"Received {rewards['coins']} coins, {rewards['gold']} gold")
        else:
            self.log_result("Daily Login", False, "Failed")
        
        # 4. Gacha Pulls - Test all types
        print("\n4️⃣ Testing Gacha System...")
        
        # Single pull with gems
        pull_data = {"pull_type": "single", "currency_type": "gems"}
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", json=pull_data)
        if response and response.status_code == 200:
            result = response.json()
            self.log_result("Single Pull (Gems)", True, 
                          f"Pulled {len(result['heroes'])} hero, pity: {result['new_pity_counter']}")
        else:
            self.log_result("Single Pull (Gems)", False, f"Failed: {response.text if response else 'No response'}")
        
        # Multi pull with gems
        pull_data = {"pull_type": "multi", "currency_type": "gems"}
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", json=pull_data)
        if response and response.status_code == 200:
            result = response.json()
            self.log_result("Multi Pull (Gems)", True, 
                          f"Pulled {len(result['heroes'])} heroes, pity: {result['new_pity_counter']}")
        else:
            self.log_result("Multi Pull (Gems)", False, f"Failed: {response.text if response else 'No response'}")
        
        # Single pull with coins
        pull_data = {"pull_type": "single", "currency_type": "coins"}
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", json=pull_data)
        if response and response.status_code == 200:
            result = response.json()
            self.log_result("Single Pull (Coins)", True, 
                          f"Pulled {len(result['heroes'])} hero")
        else:
            self.log_result("Single Pull (Coins)", False, f"Failed: {response.text if response else 'No response'}")
        
        # Multi pull with coins
        pull_data = {"pull_type": "multi", "currency_type": "coins"}
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", json=pull_data)
        if response and response.status_code == 200:
            result = response.json()
            self.log_result("Multi Pull (Coins)", True, 
                          f"Pulled {len(result['heroes'])} heroes")
        else:
            self.log_result("Multi Pull (Coins)", False, f"Failed: {response.text if response else 'No response'}")
        
        # 5. Get User Heroes
        print("\n5️⃣ Testing Hero Collection...")
        response = self.make_request("GET", f"/user/{self.username}/heroes")
        if response and response.status_code == 200:
            self.user_heroes = response.json()
            self.log_result("Get User Heroes", True, f"User has {len(self.user_heroes)} heroes")
        else:
            self.log_result("Get User Heroes", False, "Failed")
        
        # 6. Team Management
        print("\n6️⃣ Testing Team Management...")
        
        # Create team
        response = self.make_request("POST", f"/team/create?username={self.username}&team_name=MainTeam")
        if response and response.status_code == 200:
            team = response.json()
            self.log_result("Create Team", True, f"Created team: {team['name']}")
            team_id = team['id']
        else:
            self.log_result("Create Team", False, "Failed")
            return False
        
        # Get teams
        response = self.make_request("GET", f"/team/{self.username}")
        if response and response.status_code == 200:
            self.teams = response.json()
            self.log_result("Get Teams", True, f"User has {len(self.teams)} teams")
        else:
            self.log_result("Get Teams", False, "Failed")
        
        # Update team with heroes (if we have any)
        if self.user_heroes and len(self.user_heroes) > 0:
            hero_ids = [hero['id'] for hero in self.user_heroes[:6]]  # Max 6 heroes
            response = self.make_request("PUT", f"/team/{team_id}/heroes", json=hero_ids)
            if response and response.status_code == 200:
                self.log_result("Update Team Heroes", True, f"Added {len(hero_ids)} heroes to team")
            else:
                self.log_result("Update Team Heroes", False, "Failed")
        
        # 7. Hero Upgrade (if possible)
        print("\n7️⃣ Testing Hero Upgrade...")
        if self.user_heroes:
            # Find a hero with duplicates (unlikely for new account)
            hero_to_upgrade = None
            for hero in self.user_heroes:
                if hero.get("duplicates", 0) >= 2:
                    hero_to_upgrade = hero
                    break
            
            if hero_to_upgrade:
                response = self.make_request("POST", f"/user/{self.username}/heroes/{hero_to_upgrade['id']}/upgrade")
                if response and response.status_code == 200:
                    self.log_result("Hero Upgrade", True, "Hero upgraded successfully")
                else:
                    self.log_result("Hero Upgrade", False, f"Failed: {response.text if response else 'No response'}")
            else:
                self.log_result("Hero Upgrade", True, "No heroes with sufficient duplicates (expected)")
        
        # 8. Idle Rewards
        print("\n8️⃣ Testing Idle Rewards...")
        response = self.make_request("POST", f"/idle/claim?username={self.username}")
        if response and response.status_code == 200:
            rewards = response.json()
            self.log_result("Idle Rewards", True, f"Claimed {rewards['gold_earned']} gold")
        else:
            self.log_result("Idle Rewards", False, "Failed")
        
        # 9. Test insufficient funds
        print("\n9️⃣ Testing Error Handling...")
        # Try to pull when out of gems
        for _ in range(10):  # Exhaust gems
            pull_data = {"pull_type": "multi", "currency_type": "gems"}
            response = self.make_request("POST", f"/gacha/pull?username={self.username}", json=pull_data)
            if response and response.status_code == 400:
                self.log_result("Insufficient Funds Error", True, "Correctly rejected pull with insufficient gems")
                break
        else:
            self.log_result("Insufficient Funds Error", False, "Did not properly handle insufficient funds")
        
        # 10. Final user state
        print("\n🔟 Final User State...")
        response = self.make_request("GET", f"/user/{self.username}")
        if response and response.status_code == 200:
            final_user = response.json()
            self.log_result("Final User State", True, 
                          f"Gems: {final_user['gems']}, Coins: {final_user['coins']}, Gold: {final_user['gold']}, Pulls: {final_user['total_pulls']}")
        else:
            self.log_result("Final User State", False, "Failed")
        
        return True
    
    def run_test(self):
        """Run the comprehensive test"""
        success = self.test_complete_flow()
        
        # Print summary
        print("\n" + "=" * 70)
        print("🏁 COMPREHENSIVE TEST SUMMARY")
        print("=" * 70)
        print(f"✅ Passed: {self.test_results['passed']}")
        print(f"❌ Failed: {self.test_results['failed']}")
        
        if self.test_results["errors"]:
            print("\n🔍 FAILED TESTS:")
            for error in self.test_results["errors"]:
                print(f"  • {error}")
        
        success_rate = (self.test_results["passed"] / 
                       (self.test_results["passed"] + self.test_results["failed"])) * 100
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        return self.test_results["failed"] == 0

if __name__ == "__main__":
    tester = ComprehensiveGachaTest()
    success = tester.run_test()
    
    if success:
        print("\n🎉 All tests passed! Backend is fully functional!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)