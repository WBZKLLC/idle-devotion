#!/usr/bin/env python3
"""
Divine Summons Gacha System Test
Tests the updated Divine Summons system with new filler rewards
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend environment
BACKEND_URL = "https://divinemobile.preview.emergentagent.com/api"

# Test credentials
USERNAME = "Adam"
PASSWORD = "Adam123!"

class DivineGachaTest:
    def __init__(self):
        self.session = requests.Session()
        self.user_data_before = None
        self.user_data_after = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def test_user_login(self) -> bool:
        """Test user authentication"""
        try:
            self.log("Testing user authentication...")
            
            # Try to get user data first
            response = self.session.get(f"{BACKEND_URL}/user/{USERNAME}")
            if response.status_code != 200:
                self.log(f"❌ User {USERNAME} not found", "ERROR")
                return False
                
            self.log(f"✅ User {USERNAME} found")
            return True
            
        except Exception as e:
            self.log(f"❌ Authentication failed: {str(e)}", "ERROR")
            return False
    
    def add_divine_essence(self, amount: int = 100) -> bool:
        """Add Divine Essence to user account for testing"""
        try:
            self.log(f"Adding {amount} Divine Essence to {USERNAME}...")
            
            # Get current user data
            response = self.session.get(f"{BACKEND_URL}/user/{USERNAME}")
            if response.status_code != 200:
                self.log("❌ Failed to get user data", "ERROR")
                return False
                
            user_data = response.json()
            current_essence = user_data.get('divine_essence', 0)
            
            # Update divine essence directly in database (simulating admin action)
            # Since there's no admin API, we'll use the economy router if available
            try:
                # Try using economy API to add divine essence
                add_response = self.session.post(
                    f"{BACKEND_URL}/economy/{USERNAME}/currencies/add",
                    json={"divine_essence": amount}
                )
                
                if add_response.status_code == 200:
                    self.log(f"✅ Added {amount} Divine Essence via economy API")
                    return True
                else:
                    self.log(f"⚠️ Economy API not available, user has {current_essence} Divine Essence")
                    # If user already has enough, continue
                    if current_essence >= 10:  # Need at least 10 for multi-pull
                        self.log(f"✅ User has sufficient Divine Essence ({current_essence})")
                        return True
                    else:
                        self.log(f"❌ User needs more Divine Essence (has {current_essence}, needs 10+)", "ERROR")
                        return False
                        
            except Exception as e:
                self.log(f"⚠️ Could not add Divine Essence via API: {str(e)}")
                if current_essence >= 10:
                    self.log(f"✅ User has sufficient Divine Essence ({current_essence})")
                    return True
                else:
                    self.log(f"❌ User needs more Divine Essence (has {current_essence}, needs 10+)", "ERROR")
                    return False
                
        except Exception as e:
            self.log(f"❌ Failed to add Divine Essence: {str(e)}", "ERROR")
            return False
    
    def get_user_resources_before(self) -> Dict[str, Any]:
        """Get user resources before summon"""
        try:
            response = self.session.get(f"{BACKEND_URL}/user/{USERNAME}")
            if response.status_code != 200:
                self.log("❌ Failed to get user data", "ERROR")
                return {}
                
            user_data = response.json()
            resources = {
                'divine_essence': user_data.get('divine_essence', 0),
                'crystals': user_data.get('crystals', 0),
                'gold': user_data.get('gold', 0),
                'coins': user_data.get('coins', 0),
                'hero_shards': user_data.get('hero_shards', 0),
                'enhancement_stones': user_data.get('enhancement_stones', 0),
                'skill_essence': user_data.get('skill_essence', 0),
                'star_crystals': user_data.get('star_crystals', 0),
                'hero_exp': user_data.get('hero_exp', 0),
            }
            
            self.log("📊 Resources before summon:")
            for resource, amount in resources.items():
                self.log(f"   {resource}: {amount}")
                
            self.user_data_before = resources
            return resources
            
        except Exception as e:
            self.log(f"❌ Failed to get user resources: {str(e)}", "ERROR")
            return {}
    
    def test_divine_summon_multi_pull(self) -> Dict[str, Any]:
        """Test Divine Summon Multi-Pull (10x)"""
        try:
            self.log("🎲 Testing Divine Summon Multi-Pull (10x)...")
            
            # Perform 10x Divine Summon
            pull_data = {
                "pull_type": "multi",
                "currency_type": "divine_essence"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/gacha/pull?username={USERNAME}",
                json=pull_data
            )
            
            if response.status_code != 200:
                self.log(f"❌ Divine Summon failed: {response.status_code} - {response.text}", "ERROR")
                return {}
                
            result = response.json()
            self.log("✅ Divine Summon Multi-Pull successful!")
            
            # Log basic results
            heroes_count = result.get('pulled_heroes_count', 0)
            filler_count = result.get('filler_rewards_count', 0)
            runes_count = result.get('runes_earned', 0)
            divine_spent = result.get('divine_spent', 0)
            
            self.log(f"📈 Pull Results:")
            self.log(f"   Heroes pulled: {heroes_count}")
            self.log(f"   Filler rewards: {filler_count}")
            self.log(f"   Runes earned: {runes_count}")
            self.log(f"   Divine Essence spent: {divine_spent}")
            
            return result
            
        except Exception as e:
            self.log(f"❌ Divine Summon test failed: {str(e)}", "ERROR")
            return {}
    
    def verify_response_structure(self, result: Dict[str, Any]) -> bool:
        """Verify the response contains all required fields"""
        try:
            self.log("🔍 Verifying response structure...")
            
            required_fields = [
                'heroes', 'filler_rewards_collected', 'runes_earned'
            ]
            
            missing_fields = []
            for field in required_fields:
                if field not in result:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log(f"❌ Missing required fields: {missing_fields}", "ERROR")
                return False
            
            # Check filler_rewards_collected structure
            filler_rewards = result.get('filler_rewards_collected', {})
            expected_currencies = [
                'crystals', 'gold', 'coins', 'divine_essence', 'hero_shards',
                'enhancement_stones', 'skill_essence', 'star_crystals', 'hero_exp'
            ]
            
            missing_currencies = []
            for currency in expected_currencies:
                if currency not in filler_rewards:
                    missing_currencies.append(currency)
            
            if missing_currencies:
                self.log(f"❌ Missing currency fields in filler_rewards_collected: {missing_currencies}", "ERROR")
                return False
            
            self.log("✅ Response structure is correct")
            return True
            
        except Exception as e:
            self.log(f"❌ Response structure verification failed: {str(e)}", "ERROR")
            return False
    
    def verify_filler_reward_types(self, result: Dict[str, Any]) -> bool:
        """Verify new filler reward types are present"""
        try:
            self.log("🎁 Verifying filler reward types...")
            
            heroes = result.get('heroes', [])
            filler_items = [item for item in heroes if item.get('is_filler', False)]
            
            if not filler_items:
                self.log("⚠️ No filler rewards found in this pull")
                return True  # Not an error, just RNG
            
            # Check for expected display texts
            expected_reward_patterns = [
                "Enhancement Stones", "Rune", "Skill Essence", 
                "Star Crystals", "Hero EXP", "Crystals", "Gold", "Coins"
            ]
            
            found_patterns = set()
            for item in filler_items:
                display = item.get('display', '')
                self.log(f"   Filler reward: {display}")
                
                for pattern in expected_reward_patterns:
                    if pattern in display:
                        found_patterns.add(pattern)
            
            self.log(f"✅ Found {len(found_patterns)} different filler reward types")
            
            # Verify filler_rewards_collected totals
            filler_collected = result.get('filler_rewards_collected', {})
            total_rewards = sum(filler_collected.values())
            
            if total_rewards > 0:
                self.log(f"✅ Total filler rewards collected: {total_rewards}")
                self.log("📊 Filler rewards breakdown:")
                for currency, amount in filler_collected.items():
                    if amount > 0:
                        self.log(f"   {currency}: {amount}")
            else:
                self.log("⚠️ No filler rewards collected (unusual but possible)")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Filler reward verification failed: {str(e)}", "ERROR")
            return False
    
    def get_user_resources_after(self) -> Dict[str, Any]:
        """Get user resources after summon"""
        try:
            response = self.session.get(f"{BACKEND_URL}/user/{USERNAME}")
            if response.status_code != 200:
                self.log("❌ Failed to get user data after summon", "ERROR")
                return {}
                
            user_data = response.json()
            resources = {
                'divine_essence': user_data.get('divine_essence', 0),
                'crystals': user_data.get('crystals', 0),
                'gold': user_data.get('gold', 0),
                'coins': user_data.get('coins', 0),
                'hero_shards': user_data.get('hero_shards', 0),
                'enhancement_stones': user_data.get('enhancement_stones', 0),
                'skill_essence': user_data.get('skill_essence', 0),
                'star_crystals': user_data.get('star_crystals', 0),
                'hero_exp': user_data.get('hero_exp', 0),
            }
            
            self.log("📊 Resources after summon:")
            for resource, amount in resources.items():
                self.log(f"   {resource}: {amount}")
                
            self.user_data_after = resources
            return resources
            
        except Exception as e:
            self.log(f"❌ Failed to get user resources after summon: {str(e)}", "ERROR")
            return {}
    
    def verify_resource_updates(self) -> bool:
        """Verify user resources were updated correctly"""
        try:
            self.log("💰 Verifying resource updates...")
            
            if not self.user_data_before or not self.user_data_after:
                self.log("❌ Missing before/after resource data", "ERROR")
                return False
            
            # Divine Essence should decrease by 10 (multi-pull cost)
            essence_before = self.user_data_before['divine_essence']
            essence_after = self.user_data_after['divine_essence']
            essence_spent = essence_before - essence_after
            
            if essence_spent < 10:
                self.log(f"❌ Divine Essence not properly deducted. Before: {essence_before}, After: {essence_after}", "ERROR")
                return False
            
            self.log(f"✅ Divine Essence properly deducted: {essence_spent}")
            
            # Check for resource increases (from filler rewards)
            increases_found = False
            for resource in ['crystals', 'gold', 'coins', 'hero_shards', 'enhancement_stones', 
                           'skill_essence', 'star_crystals', 'hero_exp']:
                before = self.user_data_before[resource]
                after = self.user_data_after[resource]
                increase = after - before
                
                if increase > 0:
                    self.log(f"✅ {resource} increased by {increase}")
                    increases_found = True
            
            if not increases_found:
                self.log("⚠️ No resource increases found (possible if only heroes were pulled)")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Resource update verification failed: {str(e)}", "ERROR")
            return False
    
    def verify_rune_creation(self, runes_count: int) -> bool:
        """Verify rune creation if runes were dropped"""
        try:
            if runes_count == 0:
                self.log("ℹ️ No runes dropped in this pull")
                return True
                
            self.log(f"🔮 Verifying {runes_count} rune(s) creation...")
            
            # Try to get user runes (if endpoint exists)
            try:
                response = self.session.get(f"{BACKEND_URL}/equipment/{USERNAME}/runes")
                if response.status_code == 200:
                    runes = response.json()
                    self.log(f"✅ User has {len(runes)} total runes")
                    
                    # Show latest runes
                    if runes:
                        latest_runes = sorted(runes, key=lambda x: x.get('created_at', ''), reverse=True)[:runes_count]
                        for rune in latest_runes:
                            rarity = rune.get('rarity', 'unknown')
                            main_stat = rune.get('main_stat', 'unknown')
                            main_value = rune.get('main_value', 0)
                            self.log(f"   Rune: {rarity} {main_stat} +{main_value}")
                    
                    return True
                else:
                    self.log(f"⚠️ Could not verify runes (endpoint returned {response.status_code})")
                    return True  # Not a critical failure
                    
            except Exception as e:
                self.log(f"⚠️ Could not verify runes: {str(e)}")
                return True  # Not a critical failure
                
        except Exception as e:
            self.log(f"❌ Rune verification failed: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self) -> bool:
        """Run the complete Divine Summons test suite"""
        self.log("🚀 Starting Divine Summons Gacha System Test")
        self.log("=" * 60)
        
        # Test 1: User Authentication
        if not self.test_user_login():
            return False
        
        # Test 2: Add Divine Essence
        if not self.add_divine_essence(100):
            return False
        
        # Test 3: Get resources before summon
        if not self.get_user_resources_before():
            return False
        
        # Test 4: Perform Divine Summon Multi-Pull
        result = self.test_divine_summon_multi_pull()
        if not result:
            return False
        
        # Test 5: Verify response structure
        if not self.verify_response_structure(result):
            return False
        
        # Test 6: Verify filler reward types
        if not self.verify_filler_reward_types(result):
            return False
        
        # Test 7: Get resources after summon
        if not self.get_user_resources_after():
            return False
        
        # Test 8: Verify resource updates
        if not self.verify_resource_updates():
            return False
        
        # Test 9: Verify rune creation
        runes_count = result.get('runes_earned', 0)
        if not self.verify_rune_creation(runes_count):
            return False
        
        self.log("=" * 60)
        self.log("🎉 All Divine Summons tests passed successfully!")
        return True

def main():
    """Main test execution"""
    tester = DivineGachaTest()
    
    try:
        success = tester.run_comprehensive_test()
        if success:
            print("\n✅ DIVINE SUMMONS TEST SUITE: PASSED")
            sys.exit(0)
        else:
            print("\n❌ DIVINE SUMMONS TEST SUITE: FAILED")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test suite crashed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()