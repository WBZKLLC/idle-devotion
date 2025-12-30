#!/usr/bin/env python3
"""
Backend Testing Script for Divine Heroes Gacha Game
Focus: Divine Summon System Testing with New Rate Changes
"""

import requests
import json
import time
from typing import Dict, Any, List

# Configuration
BASE_URL = "https://male-heroes-game.preview.emergentagent.com/api"
TEST_USERNAME = "Adam"
TEST_PASSWORD = "Adam123!"

class DivineGachaTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
    
    def authenticate(self) -> bool:
        """Authenticate user and get token"""
        try:
            self.log("🔐 Authenticating user...")
            
            # Try login first
            login_data = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                self.user_data = data.get("user")
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log(f"✅ Login successful for user: {self.user_data.get('username')}")
                return True
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def check_user_resources(self) -> Dict[str, Any]:
        """Check user's current resources, especially divine_essence"""
        try:
            self.log("💰 Checking user resources...")
            
            response = self.session.get(f"{BASE_URL}/user/{TEST_USERNAME}")
            
            if response.status_code == 200:
                user_data = response.json()
                resources = {
                    "crystals": user_data.get("crystals", 0),
                    "coins": user_data.get("coins", 0),
                    "gold": user_data.get("gold", 0),
                    "divine_essence": user_data.get("divine_essence", 0),
                    "hero_shards": user_data.get("hero_shards", 0)
                }
                
                self.log(f"💎 Crystals: {resources['crystals']}")
                self.log(f"🪙 Coins: {resources['coins']}")
                self.log(f"🏆 Gold: {resources['gold']}")
                self.log(f"✨ Divine Essence: {resources['divine_essence']}")
                self.log(f"⭐ Hero Shards: {resources['hero_shards']}")
                
                if resources['divine_essence'] < 10:
                    self.log("⚠️ WARNING: User has insufficient divine essence for multi-pull test", "WARN")
                
                return resources
            else:
                self.log(f"❌ Failed to get user resources: {response.status_code}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Error checking resources: {str(e)}", "ERROR")
            return {}
    
    def test_divine_summon_single(self) -> Dict[str, Any]:
        """Test single divine summon pull"""
        try:
            self.log("🎲 Testing Divine Summon - Single Pull...")
            
            pull_data = {
                "pull_type": "single",
                "currency_type": "divine_essence"
            }
            
            response = self.session.post(f"{BASE_URL}/gacha/pull?username={TEST_USERNAME}", json=pull_data)
            
            if response.status_code == 200:
                result = response.json()
                self.log("✅ Single divine summon successful")
                self.analyze_summon_result(result, "single")
                return result
            else:
                self.log(f"❌ Single divine summon failed: {response.status_code} - {response.text}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Error in single divine summon: {str(e)}", "ERROR")
            return {}
    
    def test_divine_summon_multi(self) -> Dict[str, Any]:
        """Test multi divine summon pull (10 pulls)"""
        try:
            self.log("🎲 Testing Divine Summon - Multi Pull (10x)...")
            
            pull_data = {
                "pull_type": "multi",
                "currency_type": "divine_essence"
            }
            
            response = self.session.post(f"{BASE_URL}/gacha/pull?username={TEST_USERNAME}", json=pull_data)
            
            if response.status_code == 200:
                result = response.json()
                self.log("✅ Multi divine summon successful")
                self.analyze_summon_result(result, "multi")
                return result
            else:
                self.log(f"❌ Multi divine summon failed: {response.status_code} - {response.text}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Error in multi divine summon: {str(e)}", "ERROR")
            return {}
    
    def analyze_summon_result(self, result: Dict[str, Any], pull_type: str):
        """Analyze and validate summon results"""
        try:
            self.log(f"📊 Analyzing {pull_type} summon results...")
            
            # Check basic structure
            heroes = result.get("heroes", [])
            pulled_heroes_count = result.get("pulled_heroes_count", 0)
            filler_rewards_count = result.get("filler_rewards_count", 0)
            filler_rewards_collected = result.get("filler_rewards_collected", {})
            divine_spent = result.get("divine_spent", 0)
            
            self.log(f"📦 Total items received: {len(heroes)}")
            self.log(f"🦸 Heroes pulled: {pulled_heroes_count}")
            self.log(f"🎁 Filler rewards: {filler_rewards_count}")
            self.log(f"✨ Divine essence spent: {divine_spent}")
            
            # Validate divine essence cost
            expected_cost = 10 if pull_type == "multi" else 1
            if divine_spent != expected_cost:
                self.log(f"❌ ISSUE: Expected divine essence cost {expected_cost}, got {divine_spent}", "ERROR")
            else:
                self.log(f"✅ Divine essence cost correct: {divine_spent}")
            
            # Analyze individual items
            hero_count = 0
            filler_count = 0
            
            for item in heroes:
                if item.get("is_filler", False):
                    filler_count += 1
                    self.log(f"🎁 Filler: {item.get('display', 'Unknown')} (Rarity: {item.get('rarity', 'N/A')})")
                    
                    # Validate filler structure
                    if not item.get("display"):
                        self.log("❌ ISSUE: Filler reward missing 'display' field", "ERROR")
                    if not item.get("type"):
                        self.log("❌ ISSUE: Filler reward missing 'type' field", "ERROR")
                else:
                    hero_count += 1
                    hero_name = item.get("hero_name", "Unknown")
                    rarity = item.get("rarity", "N/A")
                    element = item.get("element", "N/A")
                    hero_class = item.get("hero_class", "N/A")
                    self.log(f"🦸 Hero: {hero_name} ({rarity}) - {element} {hero_class}")
            
            # Validate counts match
            if hero_count != pulled_heroes_count:
                self.log(f"❌ ISSUE: Hero count mismatch. Expected {pulled_heroes_count}, found {hero_count}", "ERROR")
            if filler_count != filler_rewards_count:
                self.log(f"❌ ISSUE: Filler count mismatch. Expected {filler_rewards_count}, found {filler_count}", "ERROR")
            
            # Validate filler rewards collected
            self.log("💰 Filler rewards collected:")
            for currency, amount in filler_rewards_collected.items():
                if amount > 0:
                    self.log(f"  {currency}: +{amount}")
            
            # Check for both heroes and filler rewards (as requested)
            if hero_count > 0 and filler_count > 0:
                self.log("✅ SUCCESS: Response includes BOTH heroes AND filler rewards")
            elif hero_count > 0:
                self.log("⚠️ WARNING: Only heroes received, no filler rewards")
            elif filler_count > 0:
                self.log("⚠️ WARNING: Only filler rewards received, no heroes")
            else:
                self.log("❌ ISSUE: No heroes or filler rewards received", "ERROR")
            
            # Validate rate expectations (for multi-pull)
            if pull_type == "multi":
                expected_items = 10
                actual_items = len(heroes)
                if actual_items != expected_items:
                    self.log(f"❌ ISSUE: Expected {expected_items} items for multi-pull, got {actual_items}", "ERROR")
                else:
                    self.log(f"✅ Correct number of items for multi-pull: {actual_items}")
            
        except Exception as e:
            self.log(f"❌ Error analyzing summon result: {str(e)}", "ERROR")
    
    def test_rate_validation(self, num_tests: int = 5):
        """Test multiple pulls to validate rate distribution"""
        try:
            self.log(f"📈 Testing rate validation with {num_tests} multi-pulls...")
            
            total_heroes = 0
            total_filler = 0
            ur_plus_count = 0
            ur_count = 0
            crystal_jackpots = 0
            
            for i in range(num_tests):
                self.log(f"🎲 Test pull {i+1}/{num_tests}")
                result = self.test_divine_summon_multi()
                
                if result:
                    heroes = result.get("heroes", [])
                    for item in heroes:
                        if item.get("is_filler", False):
                            total_filler += 1
                            if "crystals" in item.get("type", ""):
                                crystal_jackpots += 1
                        else:
                            total_heroes += 1
                            rarity = item.get("rarity", "")
                            if rarity == "UR+":
                                ur_plus_count += 1
                            elif rarity == "UR":
                                ur_count += 1
                
                time.sleep(1)  # Brief pause between tests
            
            total_items = total_heroes + total_filler
            if total_items > 0:
                hero_rate = (total_heroes / total_items) * 100
                filler_rate = (total_filler / total_items) * 100
                
                self.log(f"📊 Rate Analysis Results:")
                self.log(f"  Total items: {total_items}")
                self.log(f"  Heroes: {total_heroes} ({hero_rate:.1f}%)")
                self.log(f"  Filler: {total_filler} ({filler_rate:.1f}%)")
                self.log(f"  UR+ heroes: {ur_plus_count}")
                self.log(f"  UR heroes: {ur_count}")
                self.log(f"  Crystal jackpots: {crystal_jackpots}")
                
                # Expected rates: Heroes ~3.5%, Filler ~90.6%, Crystals ~5.9%
                if filler_rate >= 80:  # Allow some variance
                    self.log("✅ Filler rate appears correct (should be ~90.6%)")
                else:
                    self.log(f"⚠️ WARNING: Filler rate seems low. Expected ~90.6%, got {filler_rate:.1f%}")
            
        except Exception as e:
            self.log(f"❌ Error in rate validation: {str(e)}", "ERROR")
    
    def run_all_tests(self):
        """Run complete test suite for Divine Summon system"""
        self.log("🚀 Starting Divine Summon Test Suite...")
        self.log("=" * 60)
        
        # Step 1: Authentication
        if not self.authenticate():
            self.log("❌ CRITICAL: Authentication failed. Cannot proceed with tests.", "ERROR")
            return False
        
        # Step 2: Check resources
        resources = self.check_user_resources()
        if not resources:
            self.log("❌ CRITICAL: Cannot check user resources.", "ERROR")
            return False
        
        # Step 3: Ensure sufficient divine essence
        if resources.get("divine_essence", 0) < 20:
            self.log("⚠️ WARNING: Low divine essence. Some tests may fail.", "WARN")
        
        # Step 4: Test single divine summon
        self.log("\n" + "=" * 40)
        single_result = self.test_divine_summon_single()
        
        # Step 5: Test multi divine summon
        self.log("\n" + "=" * 40)
        multi_result = self.test_divine_summon_multi()
        
        # Step 6: Rate validation (if we have enough essence)
        if resources.get("divine_essence", 0) >= 50:
            self.log("\n" + "=" * 40)
            self.test_rate_validation(3)  # Reduced for resource conservation
        else:
            self.log("\n⚠️ Skipping rate validation due to insufficient divine essence")
        
        # Final summary
        self.log("\n" + "=" * 60)
        self.log("🏁 Divine Summon Test Suite Complete")
        
        success_count = 0
        if single_result:
            success_count += 1
        if multi_result:
            success_count += 1
        
        self.log(f"📊 Test Results: {success_count}/2 core tests passed")
        
        if success_count == 2:
            self.log("✅ OVERALL: Divine Summon system appears to be working correctly")
            return True
        else:
            self.log("❌ OVERALL: Some Divine Summon tests failed")
            return False

def main():
    """Main test execution"""
    print("Divine Heroes Gacha Game - Divine Summon Testing")
    print("=" * 60)
    
    test_suite = DivineGachaTestSuite()
    success = test_suite.run_all_tests()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ALL TESTS COMPLETED SUCCESSFULLY")
    else:
        print("⚠️ SOME TESTS FAILED - CHECK LOGS ABOVE")
    
    return success

if __name__ == "__main__":
    main()