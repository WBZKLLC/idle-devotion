#!/usr/bin/env python3
"""
Backend API Testing Suite for Economy and Equipment Systems
Tests the new Economy and Equipment system APIs as requested.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://male-heroes-game.preview.emergentagent.com/api"
USERNAME = "Adam"
PASSWORD = "Adam123!"

class APITester:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if response_data and not success:
            print(f"    Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def authenticate(self) -> bool:
        """Authenticate user and get token"""
        try:
            # Try login first
            login_data = {"username": self.username, "password": self.password}
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                self.user_data = data.get("user")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_test("User Authentication", True, f"Logged in as {self.username}")
                return True
            else:
                self.log_test("User Authentication", False, f"Login failed: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Authentication", False, f"Authentication error: {str(e)}")
            return False
    
    def test_economy_currencies(self) -> bool:
        """Test Suite 1: Economy System - Currency balances"""
        try:
            response = self.session.get(f"{self.base_url}/economy/{self.username}/currencies")
            
            if response.status_code == 200:
                currencies = response.json()
                expected_currencies = [
                    "gold", "coins", "crystals", "divine_essence", "soul_dust", 
                    "skill_essence", "star_crystals", "divine_gems", "guild_coins", 
                    "pvp_medals", "enhancement_stones", "hero_shards", "stamina"
                ]
                
                missing_currencies = [c for c in expected_currencies if c not in currencies]
                if missing_currencies:
                    self.log_test("GET /api/economy/currencies", False, 
                                f"Missing currencies: {missing_currencies}", currencies)
                    return False
                
                self.log_test("GET /api/economy/currencies", True, 
                            f"All {len(currencies)} currencies retrieved successfully", currencies)
                return True
            else:
                self.log_test("GET /api/economy/currencies", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/economy/currencies", False, f"Exception: {str(e)}")
            return False
    
    def test_economy_stamina(self) -> bool:
        """Test Suite 1: Economy System - Stamina status"""
        try:
            response = self.session.get(f"{self.base_url}/economy/{self.username}/stamina")
            
            if response.status_code == 200:
                stamina_data = response.json()
                required_fields = ["stamina", "max", "time_to_next"]
                
                missing_fields = [f for f in required_fields if f not in stamina_data]
                if missing_fields:
                    self.log_test("GET /api/economy/stamina", False, 
                                f"Missing fields: {missing_fields}", stamina_data)
                    return False
                
                stamina = stamina_data.get("stamina", 0)
                max_stamina = stamina_data.get("max", 0)
                
                if max_stamina != 100:
                    self.log_test("GET /api/economy/stamina", False, 
                                f"Expected max stamina 100, got {max_stamina}", stamina_data)
                    return False
                
                self.log_test("GET /api/economy/stamina", True, 
                            f"Stamina: {stamina}/{max_stamina}", stamina_data)
                return True
            else:
                self.log_test("GET /api/economy/stamina", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/economy/stamina", False, f"Exception: {str(e)}")
            return False
    
    def test_add_soul_dust(self) -> bool:
        """Test Suite 1: Economy System - Add Soul Dust"""
        try:
            params = {"currency": "soul_dust", "amount": 5000}
            response = self.session.post(f"{self.base_url}/economy/{self.username}/currencies/add", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/economy/currencies/add (Soul Dust)", False, 
                                "Success flag not true", result)
                    return False
                
                if result.get("currency") != "soul_dust" or result.get("added") != 5000:
                    self.log_test("POST /api/economy/currencies/add (Soul Dust)", False, 
                                "Incorrect currency or amount", result)
                    return False
                
                self.log_test("POST /api/economy/currencies/add (Soul Dust)", True, 
                            f"Added 5000 Soul Dust, new balance: {result.get('new_balance')}", result)
                return True
            else:
                self.log_test("POST /api/economy/currencies/add (Soul Dust)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/economy/currencies/add (Soul Dust)", False, f"Exception: {str(e)}")
            return False
    
    def test_add_enhancement_stones(self) -> bool:
        """Test Suite 1: Economy System - Add Enhancement Stones"""
        try:
            params = {"currency": "enhancement_stones", "amount": 100}
            response = self.session.post(f"{self.base_url}/economy/{self.username}/currencies/add", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/economy/currencies/add (Enhancement Stones)", False, 
                                "Success flag not true", result)
                    return False
                
                if result.get("currency") != "enhancement_stones" or result.get("added") != 100:
                    self.log_test("POST /api/economy/currencies/add (Enhancement Stones)", False, 
                                "Incorrect currency or amount", result)
                    return False
                
                self.log_test("POST /api/economy/currencies/add (Enhancement Stones)", True, 
                            f"Added 100 Enhancement Stones, new balance: {result.get('new_balance')}", result)
                return True
            else:
                self.log_test("POST /api/economy/currencies/add (Enhancement Stones)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/economy/currencies/add (Enhancement Stones)", False, f"Exception: {str(e)}")
            return False
    
    def test_get_equipment(self) -> bool:
        """Test Suite 2: Equipment System - Get all equipment"""
        try:
            response = self.session.get(f"{self.base_url}/equipment/{self.username}")
            
            if response.status_code == 200:
                equipment_list = response.json()
                
                if not isinstance(equipment_list, list):
                    self.log_test("GET /api/equipment", False, 
                                "Response is not a list", equipment_list)
                    return False
                
                self.log_test("GET /api/equipment", True, 
                            f"Retrieved {len(equipment_list)} equipment items", 
                            f"Count: {len(equipment_list)}")
                return True
            else:
                self.log_test("GET /api/equipment", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/equipment", False, f"Exception: {str(e)}")
            return False
    
    def test_craft_epic_helmet(self) -> bool:
        """Test Suite 2: Equipment System - Craft epic warrior helmet"""
        try:
            params = {"slot": "helmet", "rarity": "epic", "set_id": "warrior"}
            response = self.session.post(f"{self.base_url}/equipment/{self.username}/craft", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/equipment/craft (Epic Helmet)", False, 
                                "Success flag not true", result)
                    return False
                
                equipment = result.get("equipment", {})
                if (equipment.get("slot") != "helmet" or 
                    equipment.get("rarity") != "epic" or 
                    equipment.get("set_id") != "warrior"):
                    self.log_test("POST /api/equipment/craft (Epic Helmet)", False, 
                                "Equipment properties don't match request", result)
                    return False
                
                self.log_test("POST /api/equipment/craft (Epic Helmet)", True, 
                            f"Crafted {equipment.get('name')}", equipment)
                return True
            else:
                self.log_test("POST /api/equipment/craft (Epic Helmet)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/equipment/craft (Epic Helmet)", False, f"Exception: {str(e)}")
            return False
    
    def test_craft_rare_chestplate(self) -> bool:
        """Test Suite 2: Equipment System - Craft rare warrior chestplate"""
        try:
            params = {"slot": "chestplate", "rarity": "rare", "set_id": "warrior"}
            response = self.session.post(f"{self.base_url}/equipment/{self.username}/craft", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/equipment/craft (Rare Chestplate)", False, 
                                "Success flag not true", result)
                    return False
                
                equipment = result.get("equipment", {})
                if (equipment.get("slot") != "chestplate" or 
                    equipment.get("rarity") != "rare" or 
                    equipment.get("set_id") != "warrior"):
                    self.log_test("POST /api/equipment/craft (Rare Chestplate)", False, 
                                "Equipment properties don't match request", result)
                    return False
                
                self.log_test("POST /api/equipment/craft (Rare Chestplate)", True, 
                            f"Crafted {equipment.get('name')}", equipment)
                return True
            else:
                self.log_test("POST /api/equipment/craft (Rare Chestplate)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/equipment/craft (Rare Chestplate)", False, f"Exception: {str(e)}")
            return False
    
    def test_craft_power_rune(self) -> bool:
        """Test Suite 2: Equipment System - Craft a Power Rune"""
        try:
            params = {"rune_type": "power", "rarity": "rare"}
            response = self.session.post(f"{self.base_url}/equipment/{self.username}/craft-rune", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/equipment/craft-rune (Power Rune)", False, 
                                "Success flag not true", result)
                    return False
                
                rune = result.get("rune", {})
                if (rune.get("rune_type") != "power" or 
                    rune.get("rarity") != "rare"):
                    self.log_test("POST /api/equipment/craft-rune (Power Rune)", False, 
                                "Rune properties don't match request", result)
                    return False
                
                self.log_test("POST /api/equipment/craft-rune (Power Rune)", True, 
                            f"Crafted {rune.get('name')}", rune)
                return True
            else:
                self.log_test("POST /api/equipment/craft-rune (Power Rune)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/equipment/craft-rune (Power Rune)", False, f"Exception: {str(e)}")
            return False
    
    def test_get_runes(self) -> bool:
        """Test Suite 2: Equipment System - Get all runes"""
        try:
            response = self.session.get(f"{self.base_url}/equipment/{self.username}/runes")
            
            if response.status_code == 200:
                runes_list = response.json()
                
                if not isinstance(runes_list, list):
                    self.log_test("GET /api/equipment/runes", False, 
                                "Response is not a list", runes_list)
                    return False
                
                self.log_test("GET /api/equipment/runes", True, 
                            f"Retrieved {len(runes_list)} runes", 
                            f"Count: {len(runes_list)}")
                return True
            else:
                self.log_test("GET /api/equipment/runes", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("GET /api/equipment/runes", False, f"Exception: {str(e)}")
            return False
    
    def test_enhance_equipment(self) -> bool:
        """Test Suite 3: Equipment Enhancement - Enhance equipment by 1 level"""
        try:
            # First get equipment list to find an equipment ID
            equipment_response = self.session.get(f"{self.base_url}/equipment/{self.username}")
            if equipment_response.status_code != 200:
                self.log_test("POST /api/equipment/enhance", False, 
                            "Could not retrieve equipment list for testing")
                return False
            
            equipment_list = equipment_response.json()
            if not equipment_list:
                self.log_test("POST /api/equipment/enhance", False, 
                            "No equipment available for enhancement testing")
                return False
            
            # Use the first equipment item
            equipment_id = equipment_list[0].get("id")
            if not equipment_id:
                self.log_test("POST /api/equipment/enhance", False, 
                            "Equipment ID not found")
                return False
            
            # Test enhancement
            enhance_data = {"equipment_id": equipment_id, "levels": 1}
            response = self.session.post(f"{self.base_url}/equipment/{self.username}/enhance", json=enhance_data)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/equipment/enhance", False, 
                                "Success flag not true", result)
                    return False
                
                new_level = result.get("new_level")
                if not new_level or new_level <= 1:
                    self.log_test("POST /api/equipment/enhance", False, 
                                f"Invalid new level: {new_level}", result)
                    return False
                
                self.log_test("POST /api/equipment/enhance", True, 
                            f"Enhanced equipment to level {new_level}", result)
                return True
            else:
                self.log_test("POST /api/equipment/enhance", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/equipment/enhance", False, f"Exception: {str(e)}")
            return False
    
    def test_hero_level_up(self) -> bool:
        """Test Suite 4: Hero Leveling - Level up hero 5 times"""
        try:
            # First get user heroes to find a hero ID
            heroes_response = self.session.get(f"{self.base_url}/user/{self.username}/heroes")
            if heroes_response.status_code != 200:
                self.log_test("POST /api/economy/hero/level-up", False, 
                            "Could not retrieve heroes list for testing")
                return False
            
            heroes_list = heroes_response.json()
            if not heroes_list:
                self.log_test("POST /api/economy/hero/level-up", False, 
                            "No heroes available for level up testing")
                return False
            
            # Use the first hero
            hero_id = heroes_list[0].get("id")
            if not hero_id:
                self.log_test("POST /api/economy/hero/level-up", False, 
                            "Hero ID not found")
                return False
            
            # Test hero level up
            params = {"levels": 5}
            response = self.session.post(f"{self.base_url}/economy/{self.username}/hero/{hero_id}/level-up", params=params)
            
            if response.status_code == 200:
                result = response.json()
                
                if not result.get("success"):
                    self.log_test("POST /api/economy/hero/level-up", False, 
                                "Success flag not true", result)
                    return False
                
                new_level = result.get("new_level")
                if not new_level:
                    self.log_test("POST /api/economy/hero/level-up", False, 
                                f"Invalid new level: {new_level}", result)
                    return False
                
                self.log_test("POST /api/economy/hero/level-up", True, 
                            f"Leveled up hero to level {new_level}", result)
                return True
            else:
                self.log_test("POST /api/economy/hero/level-up", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("POST /api/economy/hero/level-up", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all test suites"""
        print("=" * 80)
        print("BACKEND API TESTING - ECONOMY AND EQUIPMENT SYSTEMS")
        print("=" * 80)
        print()
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Test Suite 1: Economy System
        print("🔹 TEST SUITE 1: ECONOMY SYSTEM")
        print("-" * 40)
        economy_tests = [
            self.test_economy_currencies(),
            self.test_economy_stamina(),
            self.test_add_soul_dust(),
            self.test_add_enhancement_stones()
        ]
        
        # Test Suite 2: Equipment System
        print("🔹 TEST SUITE 2: EQUIPMENT SYSTEM")
        print("-" * 40)
        equipment_tests = [
            self.test_get_equipment(),
            self.test_craft_epic_helmet(),
            self.test_craft_rare_chestplate(),
            self.test_craft_power_rune(),
            self.test_get_runes()
        ]
        
        # Test Suite 3: Equipment Enhancement
        print("🔹 TEST SUITE 3: EQUIPMENT ENHANCEMENT")
        print("-" * 40)
        enhancement_tests = [
            self.test_enhance_equipment()
        ]
        
        # Test Suite 4: Hero Leveling
        print("🔹 TEST SUITE 4: HERO LEVELING (ECONOMY)")
        print("-" * 40)
        hero_tests = [
            self.test_hero_level_up()
        ]
        
        # Summary
        all_tests = economy_tests + equipment_tests + enhancement_tests + hero_tests
        passed = sum(all_tests)
        total = len(all_tests)
        
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Economy and Equipment systems are working correctly.")
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Please review the failed tests above.")
        
        return passed == total

def main():
    """Main test execution"""
    tester = APITester(BASE_URL, USERNAME, PASSWORD)
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()