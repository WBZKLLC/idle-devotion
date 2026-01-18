#!/usr/bin/env python3
"""
Backend Testing for Phase 3.50 PvE Battle Presentation Flow
Testing the backend APIs that support the battle presentation modals.

Test Focus:
1. Campaign battle APIs (stage completion)
2. Dungeon battle APIs (stage battles vs sweep)
3. Authentication with ADAM credentials
4. Battle result data structure validation
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://ecoaudit.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from review request
TEST_USERNAME = "ADAM"
TEST_PASSWORD = "=267+HA4i4=!Af7StuS6A=eX2V3b*S1=aQL?u?H5_w$qlGU__T*0ow$lJeB*Zo9I"

class BackendTester:
    def __init__(self):
        self.session = None
        self.auth_token = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str = "", data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    {details}")
        if not success and data:
            print(f"    Response: {json.dumps(data, indent=2)}")
    
    async def authenticate(self) -> bool:
        """Authenticate with ADAM credentials"""
        try:
            login_data = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            async with self.session.post(f"{API_BASE}/auth/login", json=login_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.auth_token = data.get("token") or data.get("access_token")
                    if self.auth_token:
                        self.log_result("Authentication", True, f"Successfully logged in as {TEST_USERNAME}")
                        return True
                    else:
                        self.log_result("Authentication", False, "No access token in response", data)
                        return False
                else:
                    error_data = await resp.text()
                    self.log_result("Authentication", False, f"Login failed with status {resp.status}", error_data)
                    return False
                    
        except Exception as e:
            self.log_result("Authentication", False, f"Login exception: {str(e)}")
            return False
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    async def test_campaign_apis(self):
        """Test Campaign APIs that support battle presentation flow"""
        print("\n🏰 Testing Campaign APIs...")
        
        # Test 1: Get campaign chapters
        try:
            async with self.session.get(
                f"{API_BASE}/campaign/chapters?username={TEST_USERNAME}",
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    chapters = data.get("chapters", [])
                    if chapters:
                        self.log_result("Campaign Chapters API", True, f"Retrieved {len(chapters)} chapters")
                    else:
                        self.log_result("Campaign Chapters API", False, "No chapters returned", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Campaign Chapters API", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Campaign Chapters API", False, f"Exception: {str(e)}")
        
        # Test 2: Get chapter detail (Chapter 1)
        try:
            async with self.session.get(
                f"{API_BASE}/campaign/chapter/1?username={TEST_USERNAME}",
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    stages = data.get("stages", [])
                    if stages:
                        self.log_result("Campaign Chapter Detail API", True, f"Chapter 1 has {len(stages)} stages")
                        return stages  # Return for stage testing
                    else:
                        self.log_result("Campaign Chapter Detail API", False, "No stages in chapter", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Campaign Chapter Detail API", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Campaign Chapter Detail API", False, f"Exception: {str(e)}")
        
        return []
    
    async def test_campaign_battle(self, stages: list):
        """Test campaign stage completion (battle flow)"""
        if not stages:
            self.log_result("Campaign Battle Test", False, "No stages available for testing")
            return
        
        # Find first unlocked stage
        unlocked_stage = None
        for stage in stages:
            if stage.get("unlocked", False):
                unlocked_stage = stage
                break
        
        if not unlocked_stage:
            self.log_result("Campaign Battle Test", False, "No unlocked stages found")
            return
        
        stage_num = unlocked_stage.get("stage_num", 1)
        
        # Test 3: Complete campaign stage (simulates battle)
        try:
            async with self.session.post(
                f"{API_BASE}/campaign/stage/1/{stage_num}/complete?username={TEST_USERNAME}&stars=3",
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("success"):
                        rewards = data.get("rewards", {})
                        self.log_result("Campaign Battle Complete", True, 
                                      f"Stage 1-{stage_num} completed with rewards: {list(rewards.keys())}")
                    else:
                        self.log_result("Campaign Battle Complete", False, "Battle not successful", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Campaign Battle Complete", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Campaign Battle Complete", False, f"Exception: {str(e)}")
    
    async def test_dungeon_apis(self):
        """Test Dungeon/Stage APIs that support battle presentation flow"""
        print("\n⚔️ Testing Dungeon APIs...")
        
        # Test 4: Get stages info
        try:
            async with self.session.get(f"{API_BASE}/stages/info") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    exp_stages = data.get("exp_stages", {})
                    gold_stages = data.get("gold_stages", {})
                    equipment_dungeons = data.get("equipment_dungeons", {})
                    
                    if exp_stages and gold_stages and equipment_dungeons:
                        self.log_result("Dungeon Stages Info API", True, 
                                      f"Retrieved {len(exp_stages)} EXP, {len(gold_stages)} Gold, {len(equipment_dungeons)} Equipment stages")
                    else:
                        self.log_result("Dungeon Stages Info API", False, "Missing stage data", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Dungeon Stages Info API", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Dungeon Stages Info API", False, f"Exception: {str(e)}")
        
        # Test 5: Get user stage progress
        try:
            async with self.session.get(
                f"{API_BASE}/stages/{TEST_USERNAME}/progress",
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    exp_progress = data.get("exp_stage", 0)
                    gold_progress = data.get("gold_stage", 0)
                    self.log_result("Dungeon Progress API", True, 
                                  f"EXP progress: {exp_progress}, Gold progress: {gold_progress}")
                    return data
                else:
                    error_data = await resp.text()
                    self.log_result("Dungeon Progress API", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Dungeon Progress API", False, f"Exception: {str(e)}")
        
        return {}
    
    async def test_dungeon_battle(self):
        """Test dungeon battle (not sweep) - should trigger presentation modal"""
        print("\n⚡ Testing Dungeon Battle Flow...")
        
        # Test 6: Battle EXP Stage 1 (should show presentation modal)
        try:
            battle_data = {
                "stage_id": 1,
                "team_ids": []  # Use default team
            }
            
            async with self.session.post(
                f"{API_BASE}/stages/{TEST_USERNAME}/exp/1",
                json=battle_data,
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    victory = data.get("victory")
                    rewards = data.get("rewards", {})
                    stamina_used = data.get("stamina_used", 0)
                    
                    if victory is not None:
                        result_text = "Victory" if victory else "Defeat"
                        self.log_result("Dungeon EXP Battle", True, 
                                      f"{result_text} - Stamina used: {stamina_used}, Rewards: {list(rewards.keys())}")
                    else:
                        self.log_result("Dungeon EXP Battle", False, "No victory status returned", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Dungeon EXP Battle", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Dungeon EXP Battle", False, f"Exception: {str(e)}")
        
        # Test 7: Battle Gold Stage 1 (should show presentation modal)
        try:
            battle_data = {
                "stage_id": 1,
                "team_ids": []
            }
            
            async with self.session.post(
                f"{API_BASE}/stages/{TEST_USERNAME}/gold/1",
                json=battle_data,
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    victory = data.get("victory")
                    rewards = data.get("rewards", {})
                    
                    if victory is not None:
                        result_text = "Victory" if victory else "Defeat"
                        self.log_result("Dungeon Gold Battle", True, 
                                      f"{result_text} - Rewards: {list(rewards.keys())}")
                    else:
                        self.log_result("Dungeon Gold Battle", False, "No victory status returned", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Dungeon Gold Battle", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Dungeon Gold Battle", False, f"Exception: {str(e)}")
    
    async def test_dungeon_sweep(self):
        """Test dungeon sweep - should NOT show presentation modal"""
        print("\n🔄 Testing Dungeon Sweep Flow...")
        
        # Test 8: Sweep EXP Stage (should skip presentation modal)
        try:
            sweep_data = {
                "stage_id": 1,
                "count": 1
            }
            
            async with self.session.post(
                f"{API_BASE}/stages/{TEST_USERNAME}/sweep/exp/1",
                json=sweep_data,
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    success = data.get("success")
                    sweeps = data.get("sweeps", 0)
                    total_rewards = data.get("total_rewards", {})
                    
                    if success:
                        self.log_result("Dungeon EXP Sweep", True, 
                                      f"Swept {sweeps} times - Rewards: {list(total_rewards.keys())}")
                    else:
                        self.log_result("Dungeon EXP Sweep", False, "Sweep not successful", data)
                elif resp.status == 400:
                    # Expected if stage not cleared yet
                    error_data = await resp.text()
                    if "Must clear stage manually first" in error_data:
                        self.log_result("Dungeon EXP Sweep", True, "Correctly requires manual clear first")
                    else:
                        self.log_result("Dungeon EXP Sweep", False, f"Unexpected 400 error: {error_data}")
                else:
                    error_data = await resp.text()
                    self.log_result("Dungeon EXP Sweep", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Dungeon EXP Sweep", False, f"Exception: {str(e)}")
    
    async def test_battle_data_structure(self):
        """Test that battle APIs return proper data structure for presentation modals"""
        print("\n📊 Testing Battle Data Structure...")
        
        # Test 9: Verify battle response contains required fields for presentation
        try:
            battle_data = {"stage_id": 1, "team_ids": []}
            
            async with self.session.post(
                f"{API_BASE}/stages/{TEST_USERNAME}/exp/1",
                json=battle_data,
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    # Check required fields for battle presentation
                    required_fields = ["victory", "stage_name", "rewards", "stamina_used"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        # Check rewards structure
                        rewards = data.get("rewards", {})
                        if isinstance(rewards, dict):
                            self.log_result("Battle Data Structure", True, 
                                          f"All required fields present. Rewards: {list(rewards.keys())}")
                        else:
                            self.log_result("Battle Data Structure", False, "Rewards not a dictionary", data)
                    else:
                        self.log_result("Battle Data Structure", False, 
                                      f"Missing required fields: {missing_fields}", data)
                else:
                    error_data = await resp.text()
                    self.log_result("Battle Data Structure", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("Battle Data Structure", False, f"Exception: {str(e)}")
    
    async def test_user_status(self):
        """Test user status for timer functionality"""
        print("\n⏰ Testing User Status for Timer...")
        
        # Test 10: Get user profile (for timer data)
        try:
            async with self.session.get(
                f"{API_BASE}/user/{TEST_USERNAME}",
                headers=self.get_auth_headers()
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    
                    # Check for timer-related fields
                    stamina = data.get("stamina")
                    last_login = data.get("last_login")
                    
                    if stamina is not None:
                        self.log_result("User Status API", True, 
                                      f"Stamina: {stamina}, Last login: {last_login}")
                    else:
                        self.log_result("User Status API", False, "Missing stamina field", data)
                else:
                    error_data = await resp.text()
                    self.log_result("User Status API", False, f"Status {resp.status}", error_data)
        except Exception as e:
            self.log_result("User Status API", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all backend tests for battle presentation flow"""
        print("🚀 Starting Backend Tests for Phase 3.50 PvE Battle Presentation Flow")
        print(f"Backend URL: {API_BASE}")
        print(f"Test User: {TEST_USERNAME}")
        print("=" * 80)
        
        # Authenticate first
        if not await self.authenticate():
            print("❌ Authentication failed - cannot proceed with tests")
            return
        
        # Run all test suites
        stages = await self.test_campaign_apis()
        await self.test_campaign_battle(stages)
        await self.test_dungeon_apis()
        await self.test_dungeon_battle()
        await self.test_dungeon_sweep()
        await self.test_battle_data_structure()
        await self.test_user_status()
        
        # Summary
        print("\n" + "=" * 80)
        print("📋 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 BATTLE PRESENTATION FLOW BACKEND STATUS:")
        
        # Check critical APIs for battle presentation
        critical_apis = [
            "Campaign Chapters API",
            "Campaign Chapter Detail API", 
            "Dungeon Stages Info API",
            "Dungeon EXP Battle",
            "Dungeon Gold Battle",
            "Battle Data Structure"
        ]
        
        critical_passed = sum(1 for result in self.test_results 
                            if result["test"] in critical_apis and result["success"])
        
        if critical_passed == len(critical_apis):
            print("✅ All critical battle presentation APIs are working")
        else:
            print(f"⚠️ {len(critical_apis) - critical_passed} critical APIs have issues")
        
        return passed_tests, failed_tests

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())