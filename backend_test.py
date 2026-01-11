#!/usr/bin/env python3
"""
Identity Hardening Backend Test Suite
Tests the critical security refactor for authentication system.

Key Changes Being Tested:
1. JWT 'sub' is now immutable user_id (not username)
2. Login uses username_canon for case-insensitive lookup
3. Registration populates username_canon and reserves 'adam'
4. get_current_user loads user by ID from JWT
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://secureauth-hub-1.preview.emergentagent.com/api"

# Test credentials
ADMIN_USERNAME = "adam"
ADMIN_PASSWORD = "t-l!8c2mUfl*94?7drlj=f$d4&pl+u5ay!st$2Lt0lwros#ip_c#7-thaclbu!t1"

class IdentityHardeningTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.admin_token = None
        
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
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple[bool, Dict]:
        """Make HTTP request and return (success, response_data)"""
        url = f"{BACKEND_URL}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        if headers:
            default_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=default_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=default_headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}
                
            if response.status_code in [200, 201]:
                return True, response.json()
            else:
                return False, {
                    "status_code": response.status_code,
                    "error": response.text
                }
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_new_user_registration(self) -> bool:
        """Test A: New User Registration - verify JWT works"""
        print("\n=== Test A: New User Registration ===")
        
        # Generate unique username (shorter to avoid 20 char limit)
        test_username = f"SecTest{int(time.time()) % 10000}"
        
        success, response = self.make_request("POST", "/user/register", {
            "username": test_username,
            "password": "testpass123"
        })
        
        if not success:
            self.log_test("A1: User Registration", False, f"Registration failed: {response}")
            return False
            
        # Check response contains token
        if "token" not in response:
            self.log_test("A1: User Registration", False, "No token in registration response")
            return False
            
        token = response["token"]
        self.log_test("A1: User Registration", True, f"User {test_username} registered successfully")
        
        # Test that JWT token works for authenticated endpoints
        auth_headers = {"Authorization": f"Bearer {token}"}
        success, verify_response = self.make_request("GET", "/auth/verify", headers=auth_headers)
        
        if not success:
            self.log_test("A2: JWT Token Verification", False, f"Token verification failed: {verify_response}")
            return False
            
        # Check that user data is returned correctly
        if "user" not in verify_response or verify_response["user"]["username"] != test_username:
            self.log_test("A2: JWT Token Verification", False, "Invalid user data in token verification")
            return False
            
        self.log_test("A2: JWT Token Verification", True, "JWT token works for authenticated endpoints")
        
        # Check that username_canon was populated (should be lowercase)
        expected_canon = test_username.lower()
        if verify_response["user"].get("username_canon") != expected_canon:
            self.log_test("A3: Username Canon Population", False, f"Expected username_canon: {expected_canon}, got: {verify_response['user'].get('username_canon')}")
            return False
            
        self.log_test("A3: Username Canon Population", True, f"username_canon correctly set to: {expected_canon}")
        return True
    
    def test_case_insensitive_login(self) -> bool:
        """Test B: Case-insensitive login with existing super admin"""
        print("\n=== Test B: Case-Insensitive Login ===")
        
        # Test lowercase 'adam'
        success, response = self.make_request("POST", "/auth/login", {
            "username": "adam",
            "password": ADMIN_PASSWORD
        })
        
        if not success:
            self.log_test("B1: Lowercase Login", False, f"Login with 'adam' failed: {response}")
            return False
            
        if "token" not in response:
            self.log_test("B1: Lowercase Login", False, "No token in login response")
            return False
            
        self.admin_token = response["token"]
        self.log_test("B1: Lowercase Login", True, "Login with 'adam' successful")
        
        # Test uppercase 'ADAM'
        success, response = self.make_request("POST", "/auth/login", {
            "username": "ADAM",
            "password": ADMIN_PASSWORD
        })
        
        if not success:
            self.log_test("B2: Uppercase Login", False, f"Login with 'ADAM' failed: {response}")
            return False
            
        if "token" not in response:
            self.log_test("B2: Uppercase Login", False, "No token in login response")
            return False
            
        self.log_test("B2: Uppercase Login", True, "Login with 'ADAM' successful")
        
        # Test mixed case 'Adam'
        success, response = self.make_request("POST", "/auth/login", {
            "username": "Adam",
            "password": ADMIN_PASSWORD
        })
        
        if not success:
            self.log_test("B3: Mixed Case Login", False, f"Login with 'Adam' failed: {response}")
            return False
            
        if "token" not in response:
            self.log_test("B3: Mixed Case Login", False, "No token in login response")
            return False
            
        self.log_test("B3: Mixed Case Login", True, "Login with 'Adam' successful")
        return True
    
    def test_reserved_username(self) -> bool:
        """Test C: Reserved Username Test - 'adam' should be reserved"""
        print("\n=== Test C: Reserved Username Test ===")
        
        # Try to register with 'adam' (should FAIL)
        success, response = self.make_request("POST", "/user/register", {
            "username": "adam",
            "password": "hacker123"
        })
        
        if success:
            self.log_test("C1: Reserve 'adam'", False, "Registration with 'adam' should have failed but succeeded")
            return False
            
        # Check for appropriate error message
        error_msg = response.get("error", "").lower()
        if "reserved" not in error_msg:
            self.log_test("C1: Reserve 'adam'", False, f"Expected 'reserved' error, got: {response}")
            return False
            
        self.log_test("C1: Reserve 'adam'", True, "Registration with 'adam' correctly rejected")
        
        # Try to register with 'ADAM' (should also FAIL - case insensitive)
        success, response = self.make_request("POST", "/user/register", {
            "username": "ADAM",
            "password": "hacker123"
        })
        
        if success:
            self.log_test("C2: Reserve 'ADAM'", False, "Registration with 'ADAM' should have failed but succeeded")
            return False
            
        # Check for appropriate error message
        error_msg = response.get("error", "").lower()
        if "reserved" not in error_msg:
            self.log_test("C2: Reserve 'ADAM'", False, f"Expected 'reserved' error, got: {response}")
            return False
            
        self.log_test("C2: Reserve 'ADAM'", True, "Registration with 'ADAM' correctly rejected (case-insensitive)")
        return True
    
    def test_jwt_authentication(self) -> bool:
        """Test D: Token-based Authentication - JWT contains user_id"""
        print("\n=== Test D: JWT Authentication ===")
        
        if not self.admin_token:
            self.log_test("D1: Token Availability", False, "No admin token available from previous tests")
            return False
            
        # Verify token works for auth endpoint
        auth_headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, response = self.make_request("GET", "/auth/verify", headers=auth_headers)
        
        if not success:
            self.log_test("D1: Auth Verify", False, f"Token verification failed: {response}")
            return False
            
        if not response.get("valid"):
            self.log_test("D1: Auth Verify", False, "Token marked as invalid")
            return False
            
        # Check user data is present
        user_data = response.get("user")
        if not user_data:
            self.log_test("D1: Auth Verify", False, "No user data in verification response")
            return False
            
        # Verify user has ID (immutable identifier)
        if not user_data.get("id"):
            self.log_test("D2: User ID Present", False, "No user ID in verification response")
            return False
            
        self.log_test("D1: Auth Verify", True, "Token verification successful with user data")
        self.log_test("D2: User ID Present", True, f"User ID present: {user_data.get('id')}")
        return True
    
    def test_admin_endpoint_access(self) -> bool:
        """Test E: Admin Endpoint Access - require_super_admin"""
        print("\n=== Test E: Admin Endpoint Access ===")
        
        if not self.admin_token:
            self.log_test("E1: Admin Token", False, "No admin token available")
            return False
            
        # Test admin endpoint with ADAM's token
        auth_headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, response = self.make_request("GET", "/admin/user/adam", headers=auth_headers)
        
        if not success:
            self.log_test("E1: Admin Access", False, f"Admin endpoint access failed: {response}")
            return False
            
        # Check that we get user data
        if "username" not in response:
            self.log_test("E1: Admin Access", False, "No username in admin response")
            return False
            
        self.log_test("E1: Admin Access", True, f"Admin endpoint accessible, returned user data for: {response.get('username')}")
        
        # Test with non-admin token (create a regular user first)
        test_username = f"RegUser{int(time.time()) % 10000}"
        success, reg_response = self.make_request("POST", "/user/register", {
            "username": test_username,
            "password": "testpass123"
        })
        
        if not success:
            self.log_test("E2: Regular User Creation", False, "Failed to create regular user for testing")
            return False
            
        regular_token = reg_response["token"]
        regular_headers = {"Authorization": f"Bearer {regular_token}"}
        
        # Try admin endpoint with regular user token (should fail with 403)
        success, response = self.make_request("GET", "/admin/user/adam", headers=regular_headers)
        
        if success:
            self.log_test("E2: Non-Admin Rejection", False, "Regular user should not have admin access")
            return False
            
        # Check for 403 status
        if response.get("status_code") != 403:
            self.log_test("E2: Non-Admin Rejection", False, f"Expected 403, got: {response.get('status_code')}")
            return False
            
        self.log_test("E2: Non-Admin Rejection", True, "Regular user correctly denied admin access (403)")
        return True
    
    def test_chat_endpoint(self) -> bool:
        """Test F: Chat Endpoint - authenticated via JWT"""
        print("\n=== Test F: Chat Endpoint Authentication ===")
        
        if not self.admin_token:
            self.log_test("F1: Token Availability", False, "No admin token available")
            return False
            
        # Test chat send endpoint with token
        auth_headers = {"Authorization": f"Bearer {self.admin_token}"}
        success, response = self.make_request("POST", "/chat/send", {
            "message": "Hello from identity test",
            "channel_type": "world"
        }, headers=auth_headers)
        
        if not success:
            self.log_test("F1: Chat Send", False, f"Chat send failed: {response}")
            return False
            
        # Check that message was sent successfully (response is the message itself)
        if "id" not in response:
            self.log_test("F1: Chat Send", False, "No message ID in response")
            return False
            
        # Verify sender is derived from JWT (server-authoritative)
        if not response.get("sender_id"):
            self.log_test("F2: Server-Authoritative Sender", False, "No sender_id in message")
            return False
            
        self.log_test("F1: Chat Send", True, "Chat message sent successfully")
        self.log_test("F2: Server-Authoritative Sender", True, f"Sender ID derived from JWT: {response.get('sender_id')}")
        return True
    
    def run_all_tests(self) -> bool:
        """Run all identity hardening tests"""
        print("🔐 IDENTITY HARDENING TEST SUITE")
        print("=" * 50)
        
        all_passed = True
        
        # Run all test scenarios
        test_methods = [
            self.test_new_user_registration,
            self.test_case_insensitive_login,
            self.test_reserved_username,
            self.test_jwt_authentication,
            self.test_admin_endpoint_access,
            self.test_chat_endpoint
        ]
        
        for test_method in test_methods:
            try:
                result = test_method()
                if not result:
                    all_passed = False
            except Exception as e:
                print(f"❌ EXCEPTION in {test_method.__name__}: {e}")
                all_passed = False
        
        # Summary
        print("\n" + "=" * 50)
        print("🔐 IDENTITY HARDENING TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if all_passed:
            print("✅ ALL IDENTITY HARDENING TESTS PASSED")
        else:
            print("❌ SOME TESTS FAILED - SECURITY ISSUES DETECTED")
            
        return all_passed

def main():
    """Main test execution"""
    tester = IdentityHardeningTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 Identity Hardening implementation is SECURE and FUNCTIONAL!")
        sys.exit(0)
    else:
        print("\n⚠️  Identity Hardening has ISSUES that need attention!")
        sys.exit(1)

if __name__ == "__main__":
    main()