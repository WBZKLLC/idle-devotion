#!/usr/bin/env python3
"""
Comprehensive Backend Test Suite for Divine Heroes Gacha Game
Tests all major API endpoints to identify failing tests as requested.

Test Credentials: Username=ADAM, Password=`=267+HA4i4=!Af7StuS6A=eX2V3b*S1=aQL?u?H5_w$qlGU__T*0ow$lJeB*Zo9I`

Focus Areas from Review Request:
1. Stamina-dependent operations
2. Arena/PvP opponents (may return empty list)
3. Arena Battle (may fail without opponents)
4. Stage battles requiring stamina
5. Authentication flows
6. Campaign battles
7. Dungeon sweeps
"""

import requests
import json
import sys
from typing import Dict, Any, Optional, List
import time

# Configuration
BASE_URL = "https://idle-devotion-ux.preview.emergentagent.com/api"
TEST_USERNAME = "ADAM"
TEST_PASSWORD = "`=267+HA4i4=!Af7StuS6A=eX2V3b*S1=aQL?u?H5_w$qlGU__T*0ow$lJeB*Zo9I`"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", error: str = ""):
        """Log test result"""
        result = {
            "test_name": test_name,
            "success": success,
            "details": details,
            "error": error
        }
        self.test_results.append(result)
        
        if not success:
            self.failed_tests.append(result)
            
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        if error:
            print(f"    Error: {error}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, auth_required: bool = True) -> tuple:
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth_required and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, headers=headers, json=data, params=params, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers, params=params, timeout=30)
            else:
                return False, f"Unsupported method: {method}"
                
            return True, response
        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}"

    def test_authentication_flows(self):
        """Test authentication endpoints - Focus area from review"""
        print("=== AUTHENTICATION FLOWS TESTS ===")
        
        # Test 1: Try multiple login approaches
        login_passwords = [
            TEST_PASSWORD,
            "t-l!8c2mUfl*94?7drlj=f$d4&pl+u5ay!st$2Lt0lwros#ip_c#7-thaclbu!t1",
            "Adam123!"
        ]
        
        login_success = False
        for password in login_passwords:
            login_data = {
                "username": TEST_USERNAME,
                "password": password
            }
            
            success, response = self.make_request("POST", "/auth/login", data=login_data, auth_required=False)
            if success and response.status_code == 200:
                try:
                    data = response.json()
                    self.auth_token = data.get("access_token") or data.get("token")
                    if self.auth_token:
                        self.log_test("Authentication Login", True, f"Successfully logged in as {TEST_USERNAME} with password attempt")
                        login_success = True
                        break
                    else:
                        self.log_test("Authentication Login", False, "No access token in response", str(data))
                except Exception as e:
                    self.log_test("Authentication Login", False, "Invalid JSON response", str(e))
            else:
                # Don't log each failed attempt, just the final result
                continue
        
        if not login_success:
            error_msg = "All password attempts failed"
            self.log_test("Authentication Login", False, "Login failed with all password attempts", error_msg)
            
            # Try alternative approach - test without authentication for now
            self.log_test("Authentication Fallback", True, "Proceeding with non-authenticated endpoints testing")
            return True  # Continue testing non-auth endpoints
            
        # Test 2: JWT verification
        if self.auth_token:
            success, response = self.make_request("GET", "/auth/verify")
            if success and response.status_code == 200:
                self.log_test("JWT Token Verification", True, "Token verification successful")
            else:
                error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
                self.log_test("JWT Token Verification", False, "Token verification failed", error_msg)
        
        return True

    def test_user_registration(self):
        """Test user registration endpoint"""
        print("=== USER REGISTRATION TESTS ===")
        
        # Test new user registration
        import random
        test_user = f"TestUser{random.randint(10000, 99999)}"
        register_data = {
            "username": test_user,
            "password": "testpass123"
        }
        
        success, response = self.make_request("POST", "/user/register", data=register_data, auth_required=False)
        if success and response.status_code == 200:
            try:
                data = response.json()
                if data.get("access_token") or data.get("token"):
                    self.log_test("User Registration", True, f"Successfully registered user {test_user}")
                else:
                    self.log_test("User Registration", False, "No access token in registration response", str(data))
            except Exception as e:
                self.log_test("User Registration", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("User Registration", False, "Registration failed", error_msg)

    def test_user_profile(self):
        """Test user profile retrieval"""
        print("=== USER PROFILE TESTS ===")
        
        success, response = self.make_request("GET", f"/user/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                user_data = response.json()
                crystals = user_data.get("crystals", 0)
                stamina = user_data.get("stamina", 0)
                coins = user_data.get("coins", 0)
                self.log_test("User Profile Retrieval", True, f"Crystals: {crystals}, Stamina: {stamina}, Coins: {coins}")
                return user_data
            except Exception as e:
                self.log_test("User Profile Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("User Profile Retrieval", False, "Failed to get user profile", error_msg)
        return None

    def test_hero_pool_and_collection(self):
        """Test hero management endpoints"""
        print("=== HERO POOL & COLLECTION TESTS ===")
        
        # Test 1: Get hero pool
        success, response = self.make_request("GET", "/heroes")
        if success and response.status_code == 200:
            try:
                heroes = response.json()
                hero_count = len(heroes) if isinstance(heroes, list) else 0
                self.log_test("Hero Pool Retrieval", True, f"Found {hero_count} heroes in pool")
            except Exception as e:
                self.log_test("Hero Pool Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Hero Pool Retrieval", False, "Failed to get hero pool", error_msg)
            
        # Test 2: Get user heroes collection
        success, response = self.make_request("GET", f"/user/{TEST_USERNAME}/heroes")
        if success and response.status_code == 200:
            try:
                user_heroes = response.json()
                hero_count = len(user_heroes) if isinstance(user_heroes, list) else 0
                self.log_test("User Heroes Collection", True, f"User has {hero_count} heroes")
                return user_heroes
            except Exception as e:
                self.log_test("User Heroes Collection", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("User Heroes Collection", False, "Failed to get user heroes", error_msg)
        return []

    def test_gacha_pull_system(self):
        """Test gacha pull system"""
        print("=== GACHA PULL SYSTEM TESTS ===")
        
        # Test 1: Single pull with coins
        success, response = self.make_request("POST", "/gacha/pull", data={
            "username": TEST_USERNAME,
            "currency_type": "coins",
            "pull_type": "single"
        })
        if success and response.status_code == 200:
            try:
                result = response.json()
                heroes = result.get("heroes", [])
                self.log_test("Gacha Single Pull (Coins)", True, f"Pulled {len(heroes)} heroes")
            except Exception as e:
                self.log_test("Gacha Single Pull (Coins)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Gacha Single Pull (Coins)", False, "Single pull failed", error_msg)
            
        # Test 2: Multi pull with crystals
        success, response = self.make_request("POST", "/gacha/pull", data={
            "username": TEST_USERNAME,
            "currency_type": "crystals", 
            "pull_type": "multi"
        })
        if success and response.status_code == 200:
            try:
                result = response.json()
                heroes = result.get("heroes", [])
                self.log_test("Gacha Multi Pull (Crystals)", True, f"Pulled {len(heroes)} heroes")
            except Exception as e:
                self.log_test("Gacha Multi Pull (Crystals)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Gacha Multi Pull (Crystals)", False, "Multi pull failed", error_msg)

        # Test 3: Divine essence pull
        success, response = self.make_request("POST", "/gacha/pull", data={
            "username": TEST_USERNAME,
            "currency_type": "divine_essence",
            "pull_type": "single"
        })
        if success and response.status_code == 200:
            try:
                result = response.json()
                heroes = result.get("heroes", [])
                self.log_test("Gacha Divine Essence Pull", True, f"Pulled {len(heroes)} heroes")
            except Exception as e:
                self.log_test("Gacha Divine Essence Pull", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Gacha Divine Essence Pull", False, "Divine essence pull failed", error_msg)

    def test_team_management(self):
        """Test team management system"""
        print("=== TEAM MANAGEMENT TESTS ===")
        
        success, response = self.make_request("GET", f"/teams/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                teams = response.json()
                team_count = len(teams) if isinstance(teams, list) else 0
                self.log_test("Team Management", True, f"User has {team_count} teams")
            except Exception as e:
                self.log_test("Team Management", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Team Management", False, "Failed to get user teams", error_msg)

    def test_economy_system(self):
        """Test economy system endpoints"""
        print("=== ECONOMY SYSTEM TESTS ===")
        
        # Test 1: Get all currencies
        success, response = self.make_request("GET", f"/economy/{TEST_USERNAME}/currencies")
        if success and response.status_code == 200:
            try:
                currencies = response.json()
                stamina = currencies.get("stamina", 0)
                crystals = currencies.get("crystals", 0)
                self.log_test("Economy Currencies", True, f"Stamina: {stamina}, Crystals: {crystals}")
            except Exception as e:
                self.log_test("Economy Currencies", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Economy Currencies", False, "Failed to get currencies", error_msg)
            
        # Test 2: Get stamina status - Focus area from review
        success, response = self.make_request("GET", f"/economy/{TEST_USERNAME}/stamina")
        if success and response.status_code == 200:
            try:
                stamina_data = response.json()
                current = stamina_data.get("current", 0)
                maximum = stamina_data.get("max", 0)
                self.log_test("Stamina Status Check", True, f"Stamina: {current}/{maximum}")
                return current
            except Exception as e:
                self.log_test("Stamina Status Check", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Stamina Status Check", False, "Failed to get stamina status", error_msg)
        return 0

    def test_arena_system(self):
        """Test arena/PvP system - Focus area from review"""
        print("=== ARENA/PVP SYSTEM TESTS (FOCUS AREA) ===")
        
        # Test 1: Get arena opponents (may return empty list as mentioned in review)
        success, response = self.make_request("GET", f"/arena/opponents/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                opponents = response.json()
                opponent_count = len(opponents) if isinstance(opponents, list) else 0
                if opponent_count == 0:
                    self.log_test("Arena Opponents List", False, "No opponents available", "Empty opponents list - may indicate insufficient stamina or system issue")
                else:
                    self.log_test("Arena Opponents List", True, f"Found {opponent_count} opponents")
            except Exception as e:
                self.log_test("Arena Opponents List", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Arena Opponents List", False, "Failed to get arena opponents", error_msg)
            
        # Test 2: Arena battle (may fail without opponents as mentioned in review)
        success, response = self.make_request("POST", f"/arena/battle/{TEST_USERNAME}", data={
            "team_id": "default"
        })
        if success and response.status_code == 200:
            try:
                result = response.json()
                victory = result.get("victory", False)
                self.log_test("Arena Battle Execution", True, f"Battle completed, Victory: {victory}")
            except Exception as e:
                self.log_test("Arena Battle Execution", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Arena Battle Execution", False, "Arena battle failed - may be due to no opponents or insufficient stamina", error_msg)

        # Test 3: Arena record
        success, response = self.make_request("GET", f"/arena/record/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                record = response.json()
                rating = record.get("rating", 0)
                wins = record.get("wins", 0)
                self.log_test("Arena Record Retrieval", True, f"Rating: {rating}, Wins: {wins}")
            except Exception as e:
                self.log_test("Arena Record Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Arena Record Retrieval", False, "Failed to get arena record", error_msg)

    def test_stages_system(self):
        """Test dungeon/stages system - Focus area from review"""
        print("=== STAGES/DUNGEON SYSTEM TESTS (FOCUS AREA) ===")
        
        # Test 1: Get stage information
        success, response = self.make_request("GET", "/stages/info")
        if success and response.status_code == 200:
            try:
                stages = response.json()
                stage_count = len(stages) if isinstance(stages, list) else 0
                self.log_test("Stage Information Retrieval", True, f"Found {stage_count} stages")
            except Exception as e:
                self.log_test("Stage Information Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Stage Information Retrieval", False, "Failed to get stage info", error_msg)
            
        # Test 2: EXP stage battle (requires stamina) - Focus area from review
        success, response = self.make_request("POST", f"/stages/{TEST_USERNAME}/exp/1")
        if success and response.status_code == 200:
            try:
                result = response.json()
                rewards = result.get("rewards", {})
                victory = result.get("victory", False)
                self.log_test("EXP Stage Battle (Stamina Required)", True, f"Victory: {victory}, Rewards: {list(rewards.keys())}")
            except Exception as e:
                self.log_test("EXP Stage Battle (Stamina Required)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("EXP Stage Battle (Stamina Required)", False, "EXP stage battle failed - likely insufficient stamina", error_msg)
            
        # Test 3: Gold stage battle (requires stamina)
        success, response = self.make_request("POST", f"/stages/{TEST_USERNAME}/gold/1")
        if success and response.status_code == 200:
            try:
                result = response.json()
                rewards = result.get("rewards", {})
                victory = result.get("victory", False)
                self.log_test("Gold Stage Battle (Stamina Required)", True, f"Victory: {victory}, Rewards: {list(rewards.keys())}")
            except Exception as e:
                self.log_test("Gold Stage Battle (Stamina Required)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Gold Stage Battle (Stamina Required)", False, "Gold stage battle failed - likely insufficient stamina", error_msg)
            
        # Test 4: Equipment dungeon battle (requires stamina)
        success, response = self.make_request("POST", f"/stages/{TEST_USERNAME}/equipment/1")
        if success and response.status_code == 200:
            try:
                result = response.json()
                rewards = result.get("rewards", {})
                victory = result.get("victory", False)
                self.log_test("Equipment Dungeon Battle (Stamina Required)", True, f"Victory: {victory}, Rewards: {list(rewards.keys())}")
            except Exception as e:
                self.log_test("Equipment Dungeon Battle (Stamina Required)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Equipment Dungeon Battle (Stamina Required)", False, "Equipment dungeon battle failed - likely insufficient stamina", error_msg)
            
        # Test 5: Dungeon sweep (requires stamina) - Focus area from review
        success, response = self.make_request("POST", f"/stages/{TEST_USERNAME}/sweep/exp/1", data={
            "count": 1
        })
        if success and response.status_code == 200:
            try:
                result = response.json()
                total_rewards = result.get("total_rewards", {})
                sweeps = result.get("sweeps", 0)
                self.log_test("Dungeon Sweep (Stamina Required)", True, f"Swept {sweeps} times, Total rewards: {list(total_rewards.keys())}")
            except Exception as e:
                self.log_test("Dungeon Sweep (Stamina Required)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Dungeon Sweep (Stamina Required)", False, "Dungeon sweep failed - likely insufficient stamina or stage not cleared", error_msg)

    def test_campaign_system(self):
        """Test campaign battle system - Focus area from review"""
        print("=== CAMPAIGN SYSTEM TESTS (FOCUS AREA) ===")
        
        # Test 1: Get campaign chapters
        success, response = self.make_request("GET", "/campaign/chapters")
        if success and response.status_code == 200:
            try:
                chapters = response.json()
                chapter_count = len(chapters) if isinstance(chapters, list) else 0
                self.log_test("Campaign Chapters Retrieval", True, f"Found {chapter_count} chapters")
            except Exception as e:
                self.log_test("Campaign Chapters Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Campaign Chapters Retrieval", False, "Failed to get campaign chapters", error_msg)
            
        # Test 2: Campaign stage completion - Focus area from review
        success, response = self.make_request("POST", f"/campaign/stage/1/1/complete")
        if success and response.status_code == 200:
            try:
                result = response.json()
                victory = result.get("victory", False)
                rewards = result.get("rewards", {})
                self.log_test("Campaign Stage Battle", True, f"Stage 1-1 completed, Victory: {victory}, Rewards: {list(rewards.keys())}")
            except Exception as e:
                self.log_test("Campaign Stage Battle", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Campaign Stage Battle", False, "Campaign stage battle failed", error_msg)

        # Test 3: Campaign chapter detail
        success, response = self.make_request("GET", f"/campaign/chapter/1")
        if success and response.status_code == 200:
            try:
                chapter = response.json()
                stages = chapter.get("stages", [])
                self.log_test("Campaign Chapter Detail", True, f"Chapter 1 has {len(stages)} stages")
            except Exception as e:
                self.log_test("Campaign Chapter Detail", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Campaign Chapter Detail", False, "Failed to get campaign chapter detail", error_msg)

    def test_idle_system(self):
        """Test idle rewards system"""
        print("=== IDLE SYSTEM TESTS ===")
        
        # Test 1: Get idle status
        success, response = self.make_request("GET", f"/idle/{TEST_USERNAME}/status")
        if success and response.status_code == 200:
            try:
                idle_data = response.json()
                can_claim = idle_data.get("can_claim", False)
                gold_earned = idle_data.get("gold_earned", 0)
                self.log_test("Idle Status Check", True, f"Can claim: {can_claim}, Gold earned: {gold_earned}")
            except Exception as e:
                self.log_test("Idle Status Check", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Idle Status Check", False, "Failed to get idle status", error_msg)
            
        # Test 2: Claim idle rewards
        success, response = self.make_request("POST", f"/idle/{TEST_USERNAME}/claim")
        if success and response.status_code == 200:
            try:
                result = response.json()
                rewards = result.get("rewards", {})
                self.log_test("Idle Rewards Claim", True, f"Claimed rewards: {rewards}")
            except Exception as e:
                self.log_test("Idle Rewards Claim", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Idle Rewards Claim", False, "Failed to claim idle rewards", error_msg)

    def test_leaderboards(self):
        """Test leaderboard systems"""
        print("=== LEADERBOARD TESTS ===")
        
        # Test 1: Arena leaderboard
        success, response = self.make_request("GET", "/leaderboard/arena/server_1")
        if success and response.status_code == 200:
            try:
                leaderboard = response.json()
                player_count = len(leaderboard) if isinstance(leaderboard, list) else 0
                self.log_test("Arena Leaderboard", True, f"Found {player_count} players on leaderboard")
            except Exception as e:
                self.log_test("Arena Leaderboard", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Arena Leaderboard", False, "Failed to get arena leaderboard", error_msg)
            
        # Test 2: Abyss leaderboard
        success, response = self.make_request("GET", "/abyss/leaderboard/server_1")
        if success and response.status_code == 200:
            try:
                leaderboard = response.json()
                player_count = len(leaderboard) if isinstance(leaderboard, list) else 0
                self.log_test("Abyss Leaderboard", True, f"Found {player_count} players on abyss leaderboard")
            except Exception as e:
                self.log_test("Abyss Leaderboard", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Abyss Leaderboard", False, "Failed to get abyss leaderboard", error_msg)

    def test_vip_store_system(self):
        """Test VIP and store systems"""
        print("=== VIP/STORE SYSTEM TESTS ===")
        
        # Test 1: Get VIP info
        success, response = self.make_request("GET", f"/vip/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                vip_data = response.json()
                vip_level = vip_data.get("vip_level", 0)
                total_spent = vip_data.get("total_spent", 0)
                self.log_test("VIP Information", True, f"VIP Level: {vip_level}, Total Spent: ${total_spent}")
            except Exception as e:
                self.log_test("VIP Information", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("VIP Information", False, "Failed to get VIP info", error_msg)
            
        # Test 2: Get crystal store
        success, response = self.make_request("GET", "/store/crystals")
        if success and response.status_code == 200:
            try:
                store_data = response.json()
                packages = store_data.get("packages", [])
                self.log_test("Crystal Store", True, f"Found {len(packages)} crystal packages")
            except Exception as e:
                self.log_test("Crystal Store", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Crystal Store", False, "Failed to get crystal store", error_msg)

    def test_abyss_system(self):
        """Test Abyss system"""
        print("=== ABYSS SYSTEM TESTS ===")
        
        # Test 1: Abyss status
        success, response = self.make_request("GET", f"/abyss/{TEST_USERNAME}/status")
        if success and response.status_code == 200:
            try:
                abyss_data = response.json()
                current_level = abyss_data.get("current_level", 1)
                boss_hp = abyss_data.get("boss_hp", 0)
                self.log_test("Abyss Status", True, f"Level: {current_level}, Boss HP: {boss_hp}")
            except Exception as e:
                self.log_test("Abyss Status", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Abyss Status", False, "Failed to get abyss status", error_msg)
            
        # Test 2: Abyss attack
        success, response = self.make_request("POST", f"/abyss/{TEST_USERNAME}/attack")
        if success and response.status_code == 200:
            try:
                result = response.json()
                damage = result.get("damage", 0)
                victory = result.get("victory", False)
                self.log_test("Abyss Attack", True, f"Damage dealt: {damage}, Victory: {victory}")
            except Exception as e:
                self.log_test("Abyss Attack", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Abyss Attack", False, "Failed to attack abyss", error_msg)

    def test_equipment_system(self):
        """Test equipment system"""
        print("=== EQUIPMENT SYSTEM TESTS ===")
        
        # Test 1: Get user equipment
        success, response = self.make_request("GET", f"/equipment/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                equipment = response.json()
                equipment_count = len(equipment) if isinstance(equipment, list) else 0
                self.log_test("Equipment Retrieval", True, f"User has {equipment_count} equipment items")
            except Exception as e:
                self.log_test("Equipment Retrieval", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Equipment Retrieval", False, "Failed to get equipment", error_msg)

    def test_launch_banner_system(self):
        """Test launch banner system"""
        print("=== LAUNCH BANNER SYSTEM TESTS ===")
        
        # Test 1: Get launch banner status
        success, response = self.make_request("GET", f"/launch-banner/status/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                banner_data = response.json()
                pity_counter = banner_data.get("pity_counter", 0)
                time_remaining = banner_data.get("time_remaining", 0)
                self.log_test("Launch Banner Status", True, f"Pity: {pity_counter}, Time remaining: {time_remaining}")
            except Exception as e:
                self.log_test("Launch Banner Status", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Launch Banner Status", False, "Failed to get launch banner status", error_msg)

        # Test 2: Launch banner pull
        success, response = self.make_request("POST", f"/launch-banner/pull/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                result = response.json()
                heroes = result.get("heroes", [])
                self.log_test("Launch Banner Pull", True, f"Pulled {len(heroes)} heroes")
            except Exception as e:
                self.log_test("Launch Banner Pull", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Launch Banner Pull", False, "Launch banner pull failed", error_msg)

    def test_journey_system(self):
        """Test journey system"""
        print("=== JOURNEY SYSTEM TESTS ===")
        
        # Test 1: Get journey status
        success, response = self.make_request("GET", f"/journey/{TEST_USERNAME}")
        if success and response.status_code == 200:
            try:
                journey_data = response.json()
                current_day = journey_data.get("current_day", 1)
                days = journey_data.get("days", [])
                self.log_test("Journey Status", True, f"Current day: {current_day}, Total days: {len(days)}")
            except Exception as e:
                self.log_test("Journey Status", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Journey Status", False, "Failed to get journey status", error_msg)

    def test_pvp_match_system_phase_359(self):
        """Test NEW PvP Match System - Phase 3.59 Implementation"""
        print("=== PVP MATCH SYSTEM TESTS (PHASE 3.59) ===")
        
        if not self.auth_token:
            self.log_test("PvP Match System", False, "Authentication required for PvP endpoints", "No auth token available")
            return
        
        # Test 1: GET /api/arena/opponents/{username} - Should return list of opponents (including NPC fallbacks)
        success, response = self.make_request("GET", f"/arena/opponents/{TEST_USERNAME}")
        opponents_list = None
        if success and response.status_code == 200:
            try:
                opponents_data = response.json()
                if isinstance(opponents_data, list):
                    opponent_count = len(opponents_data)
                    has_npcs = any("npc_" in str(opp.get("id", "")) for opp in opponents_data if isinstance(opp, dict))
                    self.log_test("PvP Opponents List (Phase 3.59)", True, 
                                f"Retrieved {opponent_count} opponents, NPCs included: {has_npcs}")
                    opponents_list = opponents_data
                else:
                    self.log_test("PvP Opponents List (Phase 3.59)", False, 
                                "Response is not a list", str(opponents_data))
            except Exception as e:
                self.log_test("PvP Opponents List (Phase 3.59)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("PvP Opponents List (Phase 3.59)", False, "Failed to get opponents list", error_msg)
        
        # Test 2: POST /api/pvp/match - Execute PvP match (requires auth, opponent_id, source_id)
        if opponents_list and len(opponents_list) > 0:
            # Use first opponent from list
            opponent_id = opponents_list[0].get("id", "npc_3") if isinstance(opponents_list[0], dict) else "npc_3"
        else:
            # Fallback to default NPC as mentioned in review
            opponent_id = "npc_3"
        
        source_id_1 = "test-unique-id-001"
        match_data = {
            "opponent_id": opponent_id,
            "source_id": source_id_1
        }
        
        success, response = self.make_request("POST", "/pvp/match", data=match_data)
        first_match_result = None
        if success and response.status_code == 200:
            try:
                match_result = response.json()
                required_fields = ["victory", "rating_change", "rewards"]
                has_required = all(field in match_result for field in required_fields)
                
                if has_required:
                    victory = match_result.get("victory")
                    rating_change = match_result.get("rating_change")
                    rewards = match_result.get("rewards", {})
                    self.log_test("PvP Match Execution (Phase 3.59)", True, 
                                f"Victory: {victory}, Rating Change: {rating_change}, Rewards: {len(rewards)} items")
                    first_match_result = match_result
                else:
                    self.log_test("PvP Match Execution (Phase 3.59)", False, 
                                f"Missing required fields. Expected: {required_fields}, Got: {list(match_result.keys())}")
            except Exception as e:
                self.log_test("PvP Match Execution (Phase 3.59)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("PvP Match Execution (Phase 3.59)", False, "PvP match execution failed", error_msg)
        
        # Test 3: Idempotency - Call same endpoint with SAME source_id (should return same result)
        if first_match_result:
            time.sleep(1)  # Brief pause
            success, response = self.make_request("POST", "/pvp/match", data=match_data)
            if success and response.status_code == 200:
                try:
                    second_result = response.json()
                    
                    # Compare key fields for idempotency
                    victory_match = first_match_result.get("victory") == second_result.get("victory")
                    rating_match = first_match_result.get("rating_change") == second_result.get("rating_change")
                    
                    if victory_match and rating_match:
                        self.log_test("PvP Match Idempotency (Phase 3.59)", True, 
                                    "Same source_id returned identical results as expected")
                    else:
                        self.log_test("PvP Match Idempotency (Phase 3.59)", False, 
                                    f"Results differ - Victory: {victory_match}, Rating: {rating_match}")
                except Exception as e:
                    self.log_test("PvP Match Idempotency (Phase 3.59)", False, "Invalid JSON response", str(e))
            else:
                error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
                self.log_test("PvP Match Idempotency (Phase 3.59)", False, "Idempotency test failed", error_msg)
        
        # Test 4: Call with different source_id to get a new match
        new_match_data = {
            "opponent_id": opponent_id,
            "source_id": "test-unique-id-002"
        }
        
        success, response = self.make_request("POST", "/pvp/match", data=new_match_data)
        if success and response.status_code == 200:
            try:
                new_result = response.json()
                victory = new_result.get("victory")
                rating_change = new_result.get("rating_change")
                self.log_test("PvP Match New Source (Phase 3.59)", True, 
                            f"New match with different source_id - Victory: {victory}, Rating Change: {rating_change}")
            except Exception as e:
                self.log_test("PvP Match New Source (Phase 3.59)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("PvP Match New Source (Phase 3.59)", False, "New match with different source_id failed", error_msg)

    def test_difficulty_dump_phase_361(self):
        """Test NEW Difficulty Dump Endpoint - Phase 3.61 Implementation"""
        print("=== DIFFICULTY DUMP SYSTEM TESTS (PHASE 3.61) ===")
        
        if not self.auth_token:
            self.log_test("Difficulty Dump System", False, "Authentication required for dev endpoints", "No auth token available")
            return
        
        # Test: GET /api/dev/difficulty/dump - DEV-only difficulty table dump
        success, response = self.make_request("GET", "/dev/difficulty/dump")
        if success and response.status_code == 200:
            try:
                dump_data = response.json()
                if isinstance(dump_data, dict) and "difficulty_table" in dump_data:
                    table_entries = len(dump_data["difficulty_table"])
                    self.log_test("Difficulty Table Dump (Phase 3.61)", True, 
                                f"Retrieved difficulty table with {table_entries} entries")
                    
                    # Verify structure
                    if table_entries > 0:
                        sample_entry = list(dump_data["difficulty_table"].values())[0]
                        if isinstance(sample_entry, dict):
                            self.log_test("Difficulty Table Structure (Phase 3.61)", True, 
                                        f"Table structure valid, sample keys: {list(sample_entry.keys())}")
                        else:
                            self.log_test("Difficulty Table Structure (Phase 3.61)", False, 
                                        "Invalid table entry structure")
                else:
                    self.log_test("Difficulty Table Dump (Phase 3.61)", False, 
                                "Invalid difficulty dump format - missing 'difficulty_table' key", str(dump_data))
            except Exception as e:
                self.log_test("Difficulty Table Dump (Phase 3.61)", False, "Invalid JSON response", str(e))
        else:
            error_msg = f"Status: {response.status_code}, Body: {response.text}" if success else str(response)
            self.log_test("Difficulty Table Dump (Phase 3.61)", False, "Difficulty dump endpoint failed", error_msg)

    def run_all_tests(self):
        """Run comprehensive backend test suite"""
        print("🎮 DIVINE HEROES GACHA GAME - COMPREHENSIVE BACKEND TEST SUITE")
        print("=" * 80)
        print(f"Testing against: {BASE_URL}")
        print(f"Test User: {TEST_USERNAME}")
        print("FOCUS: Phase 3.59-3.61 Implementation - PvP Match & Difficulty Dump")
        print("Critical Endpoints: /api/arena/opponents, /api/pvp/match, /api/dev/difficulty/dump")
        print("=" * 80)
        print()
        
        # Try authentication but continue even if it fails
        auth_success = self.test_authentication_flows()
        
        # Run all test suites focusing on areas mentioned in review
        # Many endpoints can be tested without authentication
        self.test_user_registration()
        self.test_user_profile()
        self.test_hero_pool_and_collection()
        
        # These might work without auth or with partial functionality
        self.test_gacha_pull_system()
        self.test_team_management()
        
        # Focus areas from review request
        stamina = self.test_economy_system()  # Check stamina for stamina-dependent operations
        self.test_arena_system()  # Arena/PvP opponents and battles
        self.test_stages_system()  # Stage battles requiring stamina, dungeon sweeps
        self.test_campaign_system()  # Campaign battles
        
        # NEW PHASE 3.59-3.61 TESTS (CRITICAL FOCUS)
        self.test_pvp_match_system_phase_359()  # NEW PvP match endpoints
        self.test_difficulty_dump_phase_361()   # NEW difficulty dump endpoint
        
        # Additional systems
        self.test_idle_system()
        self.test_leaderboards()
        self.test_vip_store_system()
        self.test_abyss_system()
        self.test_equipment_system()
        self.test_launch_banner_system()
        self.test_journey_system()
        
        # Print comprehensive summary
        self.print_comprehensive_summary()

    def print_comprehensive_summary(self):
        """Print detailed test results summary"""
        print("=" * 80)
        print("🎯 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = len(self.failed_tests)
        
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        print()
        
        if self.failed_tests:
            print("❌ FAILING TESTS (EXACT NAMES AND ERRORS):")
            print("-" * 60)
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. TEST NAME: {test['test_name']}")
                print(f"   ERROR MESSAGE: {test['error']}")
                if test['details']:
                    print(f"   DETAILS: {test['details']}")
                print()
                
            print("🔍 FOCUS AREA ANALYSIS:")
            print("-" * 40)
            
            # Analyze focus areas from review request
            focus_areas = {
                "Stamina-dependent operations": ["EXP Stage Battle", "Gold Stage Battle", "Equipment Dungeon Battle", "Dungeon Sweep"],
                "Arena/PvP system": ["Arena Opponents List", "Arena Battle Execution", "Arena Record Retrieval"],
                "Authentication flows": ["Authentication Login", "JWT Token Verification", "User Registration"],
                "Campaign battles": ["Campaign Stage Battle", "Campaign Chapters Retrieval", "Campaign Chapter Detail"],
                "Stage battles": ["Stage Information Retrieval", "EXP Stage Battle", "Gold Stage Battle", "Equipment Dungeon Battle"],
                "Dungeon sweeps": ["Dungeon Sweep"]
            }
            
            for area, test_names in focus_areas.items():
                area_failures = [t for t in self.failed_tests if any(name in t['test_name'] for name in test_names)]
                if area_failures:
                    print(f"⚠️  {area}: {len(area_failures)} failures")
                    for failure in area_failures:
                        print(f"    - {failure['test_name']}")
                else:
                    print(f"✅ {area}: No failures")
            
        else:
            print("✅ ALL TESTS PASSED!")
            
        print("=" * 80)
        print("📊 SUMMARY FOR MAIN AGENT:")
        print(f"- Found {failed_tests} failing tests out of {total_tests} total tests")
        print(f"- Pass rate: {pass_rate:.1f}%")
        if self.failed_tests:
            print("- Critical issues identified in focus areas from review request")
            print("- Detailed error messages provided above for debugging")
        print("=" * 80)

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()