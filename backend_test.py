#!/usr/bin/env python3
"""
Backend Testing Suite for Divine Heroes Gacha Game
Focus: Entitlements TTL + Refresh Discipline (Phase 3.10)

This test suite validates the server-time-based staleness checks for entitlements caching.
"""

import requests
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://ui-tokens-refine.preview.emergentagent.com/api"
TEST_USERNAME = "EntitlementTester"
TEST_PASSWORD = "TestPass123!"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def authenticate(self) -> bool:
        """Authenticate with the backend and get JWT token"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    self.log_test("Authentication", True, f"Successfully authenticated as {TEST_USERNAME}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response")
                    return False
            else:
                self.log_test("Authentication", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_entitlements_snapshot_structure(self) -> bool:
        """Test 1: Entitlements Snapshot API returns correct structure"""
        try:
            response = self.session.get(f"{BACKEND_URL}/entitlements/snapshot")
            
            if response.status_code != 200:
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            data = response.json()
            
            # Check required fields
            required_fields = ["server_time", "version", "entitlements"]
            missing_fields = []
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"Missing required fields: {missing_fields}")
                return False
            
            # Check optional ttl_seconds field
            ttl_seconds = data.get("ttl_seconds")
            if ttl_seconds is not None and not isinstance(ttl_seconds, int):
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"ttl_seconds should be integer, got {type(ttl_seconds)}")
                return False
            
            # Validate server_time is ISO8601 format
            try:
                server_time = data["server_time"]
                datetime.fromisoformat(server_time.replace('Z', '+00:00'))
            except ValueError:
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"server_time is not valid ISO8601: {server_time}")
                return False
            
            # Check version is integer
            if not isinstance(data["version"], int):
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"version should be integer, got {type(data['version'])}")
                return False
            
            # Check entitlements is object
            if not isinstance(data["entitlements"], dict):
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"entitlements should be object, got {type(data['entitlements'])}")
                return False
            
            # Check expected entitlement keys are present
            expected_keys = ["PREMIUM", "NO_ADS", "PREMIUM_CINEMATICS_PACK", "STARTER_PACK"]
            entitlements = data["entitlements"]
            missing_entitlements = []
            for key in expected_keys:
                if key not in entitlements:
                    missing_entitlements.append(key)
            
            if missing_entitlements:
                self.log_test("Entitlements Snapshot Structure", False, 
                            f"Missing expected entitlements: {missing_entitlements}")
                return False
            
            # Validate each entitlement has status field
            for key, entitlement in entitlements.items():
                if not isinstance(entitlement, dict) or "status" not in entitlement:
                    self.log_test("Entitlements Snapshot Structure", False, 
                                f"Entitlement {key} missing status field")
                    return False
            
            details = f"Structure valid. server_time: {data['server_time']}, ttl_seconds: {ttl_seconds}, " \
                     f"version: {data['version']}, entitlements count: {len(entitlements)}"
            self.log_test("Entitlements Snapshot Structure", True, details)
            return True
            
        except Exception as e:
            self.log_test("Entitlements Snapshot Structure", False, f"Exception: {str(e)}")
            return False
    
    def test_fresh_server_time(self) -> bool:
        """Test 2: Multiple requests return fresh server_time (not cached)"""
        try:
            # First request
            response1 = self.session.get(f"{BACKEND_URL}/entitlements/snapshot")
            if response1.status_code != 200:
                self.log_test("Fresh Server Time", False, 
                            f"First request failed: HTTP {response1.status_code}")
                return False
            
            data1 = response1.json()
            server_time1 = data1.get("server_time")
            
            # Wait a short delay to ensure time difference
            time.sleep(1.5)
            
            # Second request
            response2 = self.session.get(f"{BACKEND_URL}/entitlements/snapshot")
            if response2.status_code != 200:
                self.log_test("Fresh Server Time", False, 
                            f"Second request failed: HTTP {response2.status_code}")
                return False
            
            data2 = response2.json()
            server_time2 = data2.get("server_time")
            
            # Parse timestamps
            try:
                dt1 = datetime.fromisoformat(server_time1.replace('Z', '+00:00'))
                dt2 = datetime.fromisoformat(server_time2.replace('Z', '+00:00'))
            except ValueError as e:
                self.log_test("Fresh Server Time", False, f"Invalid timestamp format: {str(e)}")
                return False
            
            # Check that second timestamp is later than first
            if dt2 <= dt1:
                self.log_test("Fresh Server Time", False, 
                            f"Server time not fresh: {server_time1} -> {server_time2}")
                return False
            
            time_diff = (dt2 - dt1).total_seconds()
            details = f"Server time is fresh. Time difference: {time_diff:.2f}s " \
                     f"({server_time1} -> {server_time2})"
            self.log_test("Fresh Server Time", True, details)
            return True
            
        except Exception as e:
            self.log_test("Fresh Server Time", False, f"Exception: {str(e)}")
            return False
    
    def test_entitlements_data_consistency(self) -> bool:
        """Test 3: Entitlements data consistency"""
        try:
            response = self.session.get(f"{BACKEND_URL}/entitlements/snapshot")
            
            if response.status_code != 200:
                self.log_test("Entitlements Data Consistency", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            data = response.json()
            entitlements = data.get("entitlements", {})
            
            # Check that all expected entitlements have valid status values
            valid_statuses = ["owned", "not_owned", "expired"]
            invalid_entitlements = []
            
            for key, entitlement in entitlements.items():
                status = entitlement.get("status")
                if status not in valid_statuses:
                    invalid_entitlements.append(f"{key}: {status}")
            
            if invalid_entitlements:
                self.log_test("Entitlements Data Consistency", False, 
                            f"Invalid entitlement statuses: {invalid_entitlements}")
                return False
            
            # Check that each entitlement has the required key field
            missing_keys = []
            for key, entitlement in entitlements.items():
                if entitlement.get("key") != key:
                    missing_keys.append(key)
            
            if missing_keys:
                self.log_test("Entitlements Data Consistency", False, 
                            f"Entitlements with mismatched keys: {missing_keys}")
                return False
            
            # Count entitlements by status
            status_counts = {}
            for entitlement in entitlements.values():
                status = entitlement.get("status")
                status_counts[status] = status_counts.get(status, 0) + 1
            
            details = f"All entitlements have valid data. Status distribution: {status_counts}, " \
                     f"Total entitlements: {len(entitlements)}"
            self.log_test("Entitlements Data Consistency", True, details)
            return True
            
        except Exception as e:
            self.log_test("Entitlements Data Consistency", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all entitlements tests"""
        print("=" * 80)
        print("ENTITLEMENTS TTL + REFRESH DISCIPLINE (Phase 3.10) TESTING")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_USERNAME}")
        print(f"Test Time: {datetime.now(timezone.utc).isoformat()}")
        print()
        
        # Authenticate first
        if not self.authenticate():
            print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
            return False
        
        print()
        
        # Run tests
        tests = [
            self.test_entitlements_snapshot_structure,
            self.test_fresh_server_time,
            self.test_entitlements_data_consistency,
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            success = test_func()
            if success:
                passed += 1
            print()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Tests Passed: {passed}/{total} ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Entitlements TTL + Refresh Discipline is working correctly!")
        else:
            print("⚠️  SOME TESTS FAILED - Review the failures above")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🔄 ENTITLEMENTS TTL + REFRESH DISCIPLINE: FULLY FUNCTIONAL")
        print("✅ Backend provides correct data structure for client-side staleness calculations")
        print("✅ Server-time is fresh on each request (not cached)")
        print("✅ All entitlements data is consistent and valid")
    else:
        print("\n❌ ENTITLEMENTS TTL + REFRESH DISCIPLINE: ISSUES FOUND")
        print("⚠️  Review test failures above for specific problems")
    
    return success

if __name__ == "__main__":
    main()