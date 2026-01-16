#!/usr/bin/env python3
"""
Backend API Testing Script for Abyss System
Tests the Abyss endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://cinema-loading.preview.emergentagent.com/api"
USERNAME = "Adam"
PASSWORD = "Adam123!"
SERVER_ID = "server_1"

class AbyssAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_data = None
        
    def log(self, message, level="INFO"):
        """Log messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def authenticate(self):
        """Authenticate user and get JWT token"""
        self.log("Starting authentication...")
        
        # First try to register the user (in case they don't exist)
        register_data = {
            "username": USERNAME,
            "password": PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/user/register", json=register_data)
            if response.status_code == 200:
                self.log("User registered successfully")
                result = response.json()
                self.token = result.get("token")
                self.user_data = result.get("user")
            elif response.status_code == 400 and "already exists" in response.text:
                self.log("User already exists, proceeding to login")
            else:
                self.log(f"Registration failed: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            self.log(f"Registration error: {str(e)}", "ERROR")
        
        # Login to get token
        if not self.token:
            login_data = {
                "username": USERNAME,
                "password": PASSWORD
            }
            
            try:
                response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
                if response.status_code == 200:
                    result = response.json()
                    self.token = result.get("token")
                    self.user_data = result.get("user")
                    self.log("Login successful")
                else:
                    self.log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
                    return False
            except Exception as e:
                self.log(f"Login error: {str(e)}", "ERROR")
                return False
        
        # Set authorization header
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.log(f"Authentication successful for user: {USERNAME}")
            return True
        else:
            self.log("Failed to obtain authentication token", "ERROR")
            return False
    
    def test_abyss_status(self):
        """Test GET /api/abyss/{username}/status"""
        self.log("Testing Abyss Status endpoint...")
        
        try:
            response = self.session.get(f"{BASE_URL}/abyss/{USERNAME}/status")
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Abyss Status endpoint working")
                self.log(f"   Current Level: {data.get('current_level', 'N/A')}")
                self.log(f"   Highest Cleared: {data.get('highest_cleared', 'N/A')}")
                self.log(f"   Total Levels: {data.get('total_levels', 'N/A')}")
                
                if data.get('current_boss'):
                    boss = data['current_boss']
                    self.log(f"   Current Boss: {boss.get('name', 'N/A')} (Level {boss.get('level', 'N/A')})")
                    self.log(f"   Boss HP: {boss.get('hp', 'N/A')}")
                    self.log(f"   Boss ATK: {boss.get('atk', 'N/A')}")
                
                return True, data
            else:
                self.log(f"❌ Abyss Status failed: {response.status_code} - {response.text}", "ERROR")
                return False, None
                
        except Exception as e:
            self.log(f"❌ Abyss Status error: {str(e)}", "ERROR")
            return False, None
    
    def test_abyss_attack(self):
        """Test POST /api/abyss/{username}/attack"""
        self.log("Testing Abyss Attack endpoint...")
        
        try:
            response = self.session.post(f"{BASE_URL}/abyss/{USERNAME}/attack")
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Abyss Attack endpoint working")
                self.log(f"   Victory: {data.get('victory', 'N/A')}")
                self.log(f"   Damage Dealt: {data.get('damage_dealt', 'N/A')}")
                self.log(f"   Boss HP Remaining: {data.get('boss_hp_remaining', 'N/A')}")
                
                if data.get('victory'):
                    self.log("   🎉 Boss defeated!")
                    if data.get('rewards'):
                        rewards = data['rewards']
                        self.log(f"   Rewards: {rewards}")
                    if data.get('next_level'):
                        self.log(f"   Next Level: {data['next_level']}")
                else:
                    self.log("   Boss still alive, continue attacking!")
                
                return True, data
            else:
                self.log(f"❌ Abyss Attack failed: {response.status_code} - {response.text}", "ERROR")
                return False, None
                
        except Exception as e:
            self.log(f"❌ Abyss Attack error: {str(e)}", "ERROR")
            return False, None
    
    def test_abyss_records(self):
        """Test GET /api/abyss/{username}/records"""
        self.log("Testing Abyss Records endpoint...")
        
        try:
            response = self.session.get(f"{BASE_URL}/abyss/{USERNAME}/records")
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Abyss Records endpoint working")
                self.log(f"   Total Cleared: {data.get('total_cleared', 'N/A')}")
                
                if data.get('clear_history'):
                    history = data['clear_history']
                    self.log(f"   Clear History: {len(history)} records")
                    # Show first few records
                    for i, record in enumerate(history[:3]):
                        self.log(f"     Record {i+1}: Level {record.get('level', 'N/A')} - {record.get('timestamp', 'N/A')}")
                else:
                    self.log("   No clear history found")
                
                return True, data
            else:
                self.log(f"❌ Abyss Records failed: {response.status_code} - {response.text}", "ERROR")
                return False, None
                
        except Exception as e:
            self.log(f"❌ Abyss Records error: {str(e)}", "ERROR")
            return False, None
    
    def test_abyss_leaderboard(self):
        """Test GET /api/abyss/leaderboard/{server_id}"""
        self.log(f"Testing Abyss Leaderboard endpoint for server: {SERVER_ID}...")
        
        try:
            response = self.session.get(f"{BASE_URL}/abyss/leaderboard/{SERVER_ID}")
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Abyss Leaderboard endpoint working")
                
                if data.get('leaderboard'):
                    leaderboard = data['leaderboard']
                    self.log(f"   Leaderboard entries: {len(leaderboard)}")
                    
                    # Show top 3 players
                    for i, player in enumerate(leaderboard[:3]):
                        rank = i + 1
                        username = player.get('username', 'N/A')
                        highest_cleared = player.get('highest_cleared', 'N/A')
                        self.log(f"     #{rank}: {username} - Level {highest_cleared}")
                else:
                    self.log("   No leaderboard data found")
                
                if data.get('first_clears'):
                    first_clears = data['first_clears']
                    self.log(f"   First clear records: {len(first_clears)}")
                
                return True, data
            else:
                self.log(f"❌ Abyss Leaderboard failed: {response.status_code} - {response.text}", "ERROR")
                return False, None
                
        except Exception as e:
            self.log(f"❌ Abyss Leaderboard error: {str(e)}", "ERROR")
            return False, None
    
    def test_progress_updates(self):
        """Test that progress updates correctly after attacks"""
        self.log("Testing progress updates after attacks...")
        
        # Get initial status
        success, initial_status = self.test_abyss_status()
        if not success:
            return False
        
        initial_level = initial_status.get('current_level', 1)
        initial_cleared = initial_status.get('highest_cleared', 0)
        
        # Perform attack
        success, attack_result = self.test_abyss_attack()
        if not success:
            return False
        
        # Get status after attack
        success, updated_status = self.test_abyss_status()
        if not success:
            return False
        
        # Check if progress updated correctly
        if attack_result.get('victory'):
            expected_cleared = initial_cleared + 1
            actual_cleared = updated_status.get('highest_cleared', 0)
            
            if actual_cleared >= expected_cleared:
                self.log("✅ Progress updated correctly after victory")
                return True
            else:
                self.log(f"❌ Progress not updated correctly. Expected: {expected_cleared}, Got: {actual_cleared}", "ERROR")
                return False
        else:
            # Boss not defeated, level should remain the same
            current_level = updated_status.get('current_level', 1)
            if current_level == initial_level:
                self.log("✅ Progress correctly maintained (boss not defeated)")
                return True
            else:
                self.log(f"❌ Progress incorrectly changed when boss not defeated", "ERROR")
                return False
    
    def run_all_tests(self):
        """Run all Abyss endpoint tests"""
        self.log("=" * 60)
        self.log("STARTING ABYSS SYSTEM BACKEND TESTS")
        self.log("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            self.log("Authentication failed, cannot proceed with tests", "ERROR")
            return False
        
        test_results = {}
        
        # Test individual endpoints
        self.log("\n" + "=" * 40)
        self.log("TESTING INDIVIDUAL ENDPOINTS")
        self.log("=" * 40)
        
        test_results['status'] = self.test_abyss_status()[0]
        test_results['attack'] = self.test_abyss_attack()[0]
        test_results['records'] = self.test_abyss_records()[0]
        test_results['leaderboard'] = self.test_abyss_leaderboard()[0]
        
        # Test progress updates
        self.log("\n" + "=" * 40)
        self.log("TESTING PROGRESS UPDATES")
        self.log("=" * 40)
        
        test_results['progress_updates'] = self.test_progress_updates()
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        passed = sum(test_results.values())
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.upper()}: {status}")
        
        self.log(f"\nOVERALL: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL ABYSS TESTS PASSED!", "SUCCESS")
            return True
        else:
            self.log(f"⚠️  {total-passed} tests failed", "WARNING")
            return False

def main():
    """Main test execution"""
    tester = AbyssAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ All Abyss system tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some Abyss system tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()