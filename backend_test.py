#!/usr/bin/env python3
"""
Backend API Testing for AuthEpoch Expansion (Phase 3.9)
Tests the backend endpoints that support the AuthEpoch system to prevent race conditions.

Test Focus:
1. Core Authentication Flow - login/logout endpoints work correctly
2. Gacha Endpoint - verify API responds correctly for authenticated requests  
3. Entitlements Endpoint - verify snapshot API works
4. User Profile - verify user data fetch works

Credentials: Adam/Adam123!
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://premium-gatekeeper.preview.emergentagent.com/api"

# Test credentials
TEST_USERNAME = "TestUser123"
TEST_PASSWORD = "testpass123"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.test_user_created = False
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def create_test_user(self) -> bool:
        """Create a test user for authentication testing"""
        try:
            url = f"{BACKEND_URL}/user/register"
            payload = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data:
                    self.test_user_created = True
                    self.log_test("User Creation", True, f"Test user {TEST_USERNAME} created successfully")
                    return True
                else:
                    self.log_test("User Creation", False, "No token in registration response")
                    return False
            elif response.status_code == 400 and "already exists" in response.text.lower():
                # User already exists, that's fine for testing
                self.test_user_created = True
                self.log_test("User Creation", True, f"Test user {TEST_USERNAME} already exists")
                return True
            else:
                self.log_test("User Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Creation", False, f"Exception: {str(e)}")
            return False
        
    def test_authentication_login(self) -> bool:
        """Test 1: POST /api/auth/login - verify login returns valid JWT token"""
        try:
            url = f"{BACKEND_URL}/auth/login"
            payload = {
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            
            if response.status_code != 200:
                self.log_test("Authentication Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            
            # Check for token in response
            if "token" not in data:
                self.log_test("Authentication Login", False, "No token in response")
                return False
                
            self.auth_token = data["token"]
            
            # Verify token format (JWT should have 3 parts separated by dots)
            token_parts = self.auth_token.split('.')
            if len(token_parts) != 3:
                self.log_test("Authentication Login", False, "Invalid JWT token format")
                return False
                
            self.log_test("Authentication Login", True, f"Valid JWT token received (length: {len(self.auth_token)})")
            return True
            
        except Exception as e:
            self.log_test("Authentication Login", False, f"Exception: {str(e)}")
            return False
            
    def test_token_verification(self) -> bool:
        """Test 2: GET /api/auth/verify - verify token can be used for authenticated requests"""
        if not self.auth_token:
            self.log_test("Token Verification", False, "No auth token available")
            return False
            
        try:
            url = f"{BACKEND_URL}/auth/verify"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                self.log_test("Token Verification", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            
            # Verify user data is returned
            if "user" not in data:
                self.log_test("Token Verification", False, "No user data in response")
                return False
                
            user_data = data["user"]
            if "username" not in user_data:
                self.log_test("Token Verification", False, "No username in user data")
                return False
                
            if user_data["username"] != TEST_USERNAME:
                self.log_test("Token Verification", False, f"Username mismatch: expected {TEST_USERNAME}, got {user_data['username']}")
                return False
                
            self.log_test("Token Verification", True, f"Token verified for user: {user_data['username']}")
            return True
            
        except Exception as e:
            self.log_test("Token Verification", False, f"Exception: {str(e)}")
            return False
            
    def test_gacha_endpoint(self) -> bool:
        """Test 3: POST /api/gacha/pull - verify gacha API responds correctly"""
        if not self.auth_token:
            self.log_test("Gacha Endpoint", False, "No auth token available")
            return False
            
        try:
            url = f"{BACKEND_URL}/gacha/pull"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payload = {
                "username": TEST_USERNAME,
                "currency_type": "coins",
                "pull_type": "single"
            }
            
            response = self.session.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code != 200:
                self.log_test("Gacha Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            
            # Verify response structure
            required_fields = ["heroes", "user_resources"]
            for field in required_fields:
                if field not in data:
                    self.log_test("Gacha Endpoint", False, f"Missing field in response: {field}")
                    return False
                    
            # Verify heroes array exists (even if empty)
            if not isinstance(data["heroes"], list):
                self.log_test("Gacha Endpoint", False, "Heroes field is not an array")
                return False
                
            # Verify user resources updated
            if not isinstance(data["user_resources"], dict):
                self.log_test("Gacha Endpoint", False, "User resources field is not an object")
                return False
                
            heroes_count = len(data["heroes"])
            self.log_test("Gacha Endpoint", True, f"Gacha pull successful - {heroes_count} heroes returned")
            return True
            
        except Exception as e:
            self.log_test("Gacha Endpoint", False, f"Exception: {str(e)}")
            return False
            
    def test_entitlements_snapshot(self) -> bool:
        """Test 4: GET /api/entitlements/snapshot - verify entitlements API works"""
        if not self.auth_token:
            self.log_test("Entitlements Snapshot", False, "No auth token available")
            return False
            
        try:
            url = f"{BACKEND_URL}/entitlements/snapshot"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                self.log_test("Entitlements Snapshot", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            
            # Verify response is a valid entitlements structure
            if not isinstance(data, dict):
                self.log_test("Entitlements Snapshot", False, "Response is not an object")
                return False
                
            # Check for expected entitlements fields (flexible structure)
            entitlements_count = len(data.keys())
            self.log_test("Entitlements Snapshot", True, f"Entitlements snapshot retrieved - {entitlements_count} entitlements")
            return True
            
        except Exception as e:
            self.log_test("Entitlements Snapshot", False, f"Exception: {str(e)}")
            return False
            
    def test_user_profile(self) -> bool:
        """Test 5: GET /api/user/Adam - verify user data fetch works"""
        if not self.auth_token:
            self.log_test("User Profile", False, "No auth token available")
            return False
            
        try:
            url = f"{BACKEND_URL}/user/{TEST_USERNAME}"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                self.log_test("User Profile", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            
            # Verify user data structure
            required_fields = ["username", "crystals", "coins", "gold"]
            for field in required_fields:
                if field not in data:
                    self.log_test("User Profile", False, f"Missing field in response: {field}")
                    return False
                    
            # Verify username matches
            if data["username"] != TEST_USERNAME:
                self.log_test("User Profile", False, f"Username mismatch: expected {TEST_USERNAME}, got {data['username']}")
                return False
                
            # Verify currency fields are numeric
            currencies = ["crystals", "coins", "gold"]
            for currency in currencies:
                if not isinstance(data[currency], (int, float)):
                    self.log_test("User Profile", False, f"Currency {currency} is not numeric: {data[currency]}")
                    return False
                    
            self.log_test("User Profile", True, f"User profile retrieved - Crystals: {data['crystals']}, Coins: {data['coins']}, Gold: {data['gold']}")
            return True
            
        except Exception as e:
            self.log_test("User Profile", False, f"Exception: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all AuthEpoch backend support tests"""
        print("🔒 AUTHEPOCH EXPANSION BACKEND TESTING")
        print("=" * 50)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_USERNAME}")
        print()
        
        # First, ensure test user exists
        if not self.create_test_user():
            print("❌ Failed to create test user - aborting tests")
            return False
        
        # Test sequence - authentication first, then authenticated endpoints
        tests = [
            ("Authentication Login", self.test_authentication_login),
            ("Token Verification", self.test_token_verification),
            ("Gacha Endpoint", self.test_gacha_endpoint),
            ("Entitlements Snapshot", self.test_entitlements_snapshot),
            ("User Profile", self.test_user_profile),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            success = test_func()
            if success:
                passed += 1
                
        print()
        print("=" * 50)
        print(f"RESULTS: {passed}/{total} tests passed ({(passed/total)*100:.1f}% success rate)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - AuthEpoch backend endpoints are functional")
        else:
            print("⚠️  SOME TESTS FAILED - AuthEpoch backend support may have issues")
            
        return passed == total

def main():
    """Main test execution"""
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()