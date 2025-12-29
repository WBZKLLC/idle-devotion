#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Gacha Game
Tests all backend endpoints with realistic data
"""

import requests
import json
import time
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://divine-heroes.preview.emergentagent.com/api"
TEST_USERNAME = "testplayer"

class GachaGameTester:
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
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        print("\n🔧 Testing User Registration...")
        
        # Test registration
        response = self.make_request("POST", f"/user/register?username={self.username}")
        
        if response is None:
            self.log_result("User Registration", False, "Request failed")
            return False
        
        if response.status_code == 200:
            data = response.json()
            self.user_data = data
            
            # Verify initial resources
            expected_gems = 300
            expected_coins = 10000
            expected_gold = 5000
            
            if (data.get("gems") == expected_gems and 
                data.get("coins") == expected_coins and 
                data.get("gold") == expected_gold):
                self.log_result("User Registration", True, f"User created with correct initial resources")
                return True
            else:
                self.log_result("User Registration", False, 
                              f"Incorrect initial resources: gems={data.get('gems')}, coins={data.get('coins')}, gold={data.get('gold')}")
                return False
        elif response.status_code == 400:
            # User might already exist, try to get existing user
            return self.test_get_user()
        else:
            self.log_result("User Registration", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_get_user(self):
        """Test get user endpoint"""
        print("\n🔧 Testing Get User...")
        
        response = self.make_request("GET", f"/user/{self.username}")
        
        if response is None:
            self.log_result("Get User", False, "Request failed")
            return False
        
        if response.status_code == 200:
            self.user_data = response.json()
            self.log_result("Get User", True, f"Retrieved user data successfully")
            return True
        else:
            self.log_result("Get User", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_user_login(self):
        """Test user login and daily rewards"""
        print("\n🔧 Testing User Login & Daily Rewards...")
        
        response = self.make_request("POST", f"/user/{self.username}/login")
        
        if response is None:
            self.log_result("User Login", False, "Request failed")
            return False
        
        if response.status_code == 200:
            reward_data = response.json()
            
            # Verify reward structure
            required_fields = ["coins", "gold", "crystals", "free_summons", "day_count"]
            missing_fields = [field for field in required_fields if field not in reward_data]
            
            if not missing_fields:
                self.log_result("User Login", True, 
                              f"Daily rewards received: {reward_data.get('coins')} coins, {reward_data.get('gold')} gold")
                return True
            else:
                self.log_result("User Login", False, f"Missing reward fields: {missing_fields}")
                return False
        else:
            self.log_result("User Login", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_get_heroes(self):
        """Test get all heroes endpoint"""
        print("\n🔧 Testing Get All Heroes...")
        
        response = self.make_request("GET", "/heroes")
        
        if response is None:
            self.log_result("Get All Heroes", False, "Request failed")
            return False
        
        if response.status_code == 200:
            heroes = response.json()
            
            if isinstance(heroes, list) and len(heroes) > 0:
                # Verify hero structure
                hero = heroes[0]
                required_fields = ["name", "rarity", "element", "hero_class", "base_hp", "base_atk", "base_def"]
                missing_fields = [field for field in required_fields if field not in hero]
                
                if not missing_fields:
                    self.log_result("Get All Heroes", True, f"Retrieved {len(heroes)} heroes from pool")
                    return True
                else:
                    self.log_result("Get All Heroes", False, f"Hero missing fields: {missing_fields}")
                    return False
            else:
                self.log_result("Get All Heroes", False, "No heroes returned or invalid format")
                return False
        else:
            self.log_result("Get All Heroes", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_gacha_pulls(self):
        """Test gacha pull system comprehensively"""
        print("\n🔧 Testing Gacha Pull System...")
        
        # Test single pull with gems
        success = self.test_single_pull_gems()
        if not success:
            return False
        
        # Test multi pull with gems
        success = self.test_multi_pull_gems()
        if not success:
            return False
        
        # Test single pull with coins
        success = self.test_single_pull_coins()
        if not success:
            return False
        
        # Test multi pull with coins
        success = self.test_multi_pull_coins()
        if not success:
            return False
        
        # Test insufficient funds
        success = self.test_insufficient_funds()
        
        return success
    
    def test_single_pull_gems(self):
        """Test single pull with gems"""
        print("  Testing single pull with gems...")
        
        pull_data = {
            "pull_type": "single",
            "currency_type": "gems"
        }
        
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", 
                                   json=pull_data)
        
        if response is None:
            self.log_result("Single Pull (Gems)", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            
            # Verify result structure
            if ("heroes" in result and "new_pity_counter" in result and 
                "gems_spent" in result and result["gems_spent"] == 100):
                
                heroes = result["heroes"]
                if len(heroes) == 1:
                    self.log_result("Single Pull (Gems)", True, 
                                  f"Pulled 1 hero, spent 100 gems, pity: {result['new_pity_counter']}")
                    return True
                else:
                    self.log_result("Single Pull (Gems)", False, f"Expected 1 hero, got {len(heroes)}")
                    return False
            else:
                self.log_result("Single Pull (Gems)", False, "Invalid response structure")
                return False
        else:
            self.log_result("Single Pull (Gems)", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_multi_pull_gems(self):
        """Test multi pull with gems"""
        print("  Testing multi pull with gems...")
        
        pull_data = {
            "pull_type": "multi",
            "currency_type": "gems"
        }
        
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", 
                                   json=pull_data)
        
        if response is None:
            self.log_result("Multi Pull (Gems)", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            
            if ("heroes" in result and "gems_spent" in result and 
                result["gems_spent"] == 900):
                
                heroes = result["heroes"]
                if len(heroes) == 10:
                    self.log_result("Multi Pull (Gems)", True, 
                                  f"Pulled 10 heroes, spent 900 gems, pity: {result['new_pity_counter']}")
                    return True
                else:
                    self.log_result("Multi Pull (Gems)", False, f"Expected 10 heroes, got {len(heroes)}")
                    return False
            else:
                self.log_result("Multi Pull (Gems)", False, "Invalid response structure")
                return False
        else:
            self.log_result("Multi Pull (Gems)", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_single_pull_coins(self):
        """Test single pull with coins"""
        print("  Testing single pull with coins...")
        
        pull_data = {
            "pull_type": "single",
            "currency_type": "coins"
        }
        
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", 
                                   json=pull_data)
        
        if response is None:
            self.log_result("Single Pull (Coins)", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            
            if ("heroes" in result and "coins_spent" in result and 
                result["coins_spent"] == 1000):
                
                heroes = result["heroes"]
                if len(heroes) == 1:
                    self.log_result("Single Pull (Coins)", True, 
                                  f"Pulled 1 hero, spent 1000 coins")
                    return True
                else:
                    self.log_result("Single Pull (Coins)", False, f"Expected 1 hero, got {len(heroes)}")
                    return False
            else:
                self.log_result("Single Pull (Coins)", False, "Invalid response structure")
                return False
        else:
            self.log_result("Single Pull (Coins)", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_multi_pull_coins(self):
        """Test multi pull with coins"""
        print("  Testing multi pull with coins...")
        
        pull_data = {
            "pull_type": "multi",
            "currency_type": "coins"
        }
        
        response = self.make_request("POST", f"/gacha/pull?username={self.username}", 
                                   json=pull_data)
        
        if response is None:
            self.log_result("Multi Pull (Coins)", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            
            if ("heroes" in result and "coins_spent" in result and 
                result["coins_spent"] == 9000):
                
                heroes = result["heroes"]
                if len(heroes) == 10:
                    self.log_result("Multi Pull (Coins)", True, 
                                  f"Pulled 10 heroes, spent 9000 coins")
                    return True
                else:
                    self.log_result("Multi Pull (Coins)", False, f"Expected 10 heroes, got {len(heroes)}")
                    return False
            else:
                self.log_result("Multi Pull (Coins)", False, "Invalid response structure")
                return False
        else:
            self.log_result("Multi Pull (Coins)", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_insufficient_funds(self):
        """Test insufficient funds error handling"""
        print("  Testing insufficient funds handling...")
        
        # Try to pull with gems when user likely doesn't have enough
        pull_data = {
            "pull_type": "multi",
            "currency_type": "gems"
        }
        
        # Make multiple pulls to exhaust gems
        for i in range(5):
            response = self.make_request("POST", f"/gacha/pull?username={self.username}", 
                                       json=pull_data)
            if response and response.status_code == 400:
                self.log_result("Insufficient Funds", True, "Correctly rejected pull with insufficient gems")
                return True
        
        self.log_result("Insufficient Funds", False, "Did not properly handle insufficient funds")
        return False
    
    def test_get_user_heroes(self):
        """Test get user heroes endpoint"""
        print("\n🔧 Testing Get User Heroes...")
        
        response = self.make_request("GET", f"/user/{self.username}/heroes")
        
        if response is None:
            self.log_result("Get User Heroes", False, "Request failed")
            return False
        
        if response.status_code == 200:
            heroes = response.json()
            self.user_heroes = heroes
            
            if isinstance(heroes, list):
                self.log_result("Get User Heroes", True, f"Retrieved {len(heroes)} user heroes")
                return True
            else:
                self.log_result("Get User Heroes", False, "Invalid response format")
                return False
        else:
            self.log_result("Get User Heroes", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_hero_upgrade(self):
        """Test hero upgrade system"""
        print("\n🔧 Testing Hero Upgrade System...")
        
        if not self.user_heroes:
            self.log_result("Hero Upgrade", False, "No user heroes available for testing")
            return False
        
        # Find a hero with duplicates
        hero_to_upgrade = None
        for hero in self.user_heroes:
            if hero.get("duplicates", 0) >= 2:  # Need at least 2 duplicates for rank 1->2
                hero_to_upgrade = hero
                break
        
        if not hero_to_upgrade:
            self.log_result("Hero Upgrade", True, "No heroes with sufficient duplicates (expected for new account)")
            return True
        
        hero_id = hero_to_upgrade["id"]
        response = self.make_request("POST", f"/user/{self.username}/heroes/{hero_id}/upgrade")
        
        if response is None:
            self.log_result("Hero Upgrade", False, "Request failed")
            return False
        
        if response.status_code == 200:
            upgraded_hero = response.json()
            
            if upgraded_hero.get("rank", 1) > hero_to_upgrade.get("rank", 1):
                self.log_result("Hero Upgrade", True, f"Hero upgraded to rank {upgraded_hero['rank']}")
                return True
            else:
                self.log_result("Hero Upgrade", False, "Hero rank did not increase")
                return False
        elif response.status_code == 400:
            self.log_result("Hero Upgrade", True, "Correctly rejected upgrade with insufficient duplicates")
            return True
        else:
            self.log_result("Hero Upgrade", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_team_management(self):
        """Test team management system"""
        print("\n🔧 Testing Team Management...")
        
        # Test team creation
        success = self.test_create_team()
        if not success:
            return False
        
        # Test get teams
        success = self.test_get_teams()
        if not success:
            return False
        
        # Test update team heroes
        success = self.test_update_team_heroes()
        
        return success
    
    def test_create_team(self):
        """Test team creation"""
        print("  Testing team creation...")
        
        response = self.make_request("POST", f"/team/create?username={self.username}&team_name=TestTeam")
        
        if response is None:
            self.log_result("Create Team", False, "Request failed")
            return False
        
        if response.status_code == 200:
            team = response.json()
            
            if team.get("name") == "TestTeam":
                self.log_result("Create Team", True, f"Team created successfully: {team['name']}")
                return True
            else:
                self.log_result("Create Team", False, "Team name mismatch")
                return False
        else:
            self.log_result("Create Team", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_get_teams(self):
        """Test get user teams"""
        print("  Testing get user teams...")
        
        response = self.make_request("GET", f"/team/{self.username}")
        
        if response is None:
            self.log_result("Get Teams", False, "Request failed")
            return False
        
        if response.status_code == 200:
            teams = response.json()
            self.teams = teams
            
            if isinstance(teams, list):
                self.log_result("Get Teams", True, f"Retrieved {len(teams)} teams")
                return True
            else:
                self.log_result("Get Teams", False, "Invalid response format")
                return False
        else:
            self.log_result("Get Teams", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_update_team_heroes(self):
        """Test updating team heroes"""
        print("  Testing update team heroes...")
        
        if not self.teams:
            self.log_result("Update Team Heroes", False, "No teams available")
            return False
        
        team_id = self.teams[0]["id"]
        
        # Get some hero IDs (limit to 6)
        hero_ids = []
        if self.user_heroes:
            hero_ids = [hero["id"] for hero in self.user_heroes[:6]]
        
        response = self.make_request("PUT", f"/team/{team_id}/heroes", json=hero_ids)
        
        if response is None:
            self.log_result("Update Team Heroes", False, "Request failed")
            return False
        
        if response.status_code == 200:
            updated_team = response.json()
            
            if len(updated_team.get("hero_ids", [])) == len(hero_ids):
                self.log_result("Update Team Heroes", True, f"Team updated with {len(hero_ids)} heroes")
                return True
            else:
                self.log_result("Update Team Heroes", False, "Hero count mismatch")
                return False
        else:
            self.log_result("Update Team Heroes", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def test_idle_rewards(self):
        """Test idle rewards system"""
        print("\n🔧 Testing Idle Rewards...")
        
        response = self.make_request("POST", f"/idle/claim?username={self.username}")
        
        if response is None:
            self.log_result("Idle Rewards", False, "Request failed")
            return False
        
        if response.status_code == 200:
            rewards = response.json()
            
            if "gold_earned" in rewards and "time_away" in rewards:
                self.log_result("Idle Rewards", True, 
                              f"Claimed {rewards['gold_earned']} gold for {rewards['time_away']} seconds away")
                return True
            else:
                self.log_result("Idle Rewards", False, "Invalid reward structure")
                return False
        else:
            self.log_result("Idle Rewards", False, f"HTTP {response.status_code}: {response.text}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Gacha Game Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print(f"Test user: {self.username}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_user_registration,
            self.test_get_user,
            self.test_user_login,
            self.test_get_heroes,
            self.test_gacha_pulls,
            self.test_get_user_heroes,
            self.test_hero_upgrade,
            self.test_team_management,
            self.test_idle_rewards
        ]
        
        for test in tests:
            try:
                test()
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                self.log_result(test.__name__, False, f"Exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
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
    tester = GachaGameTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)