#!/usr/bin/env python3
"""
Authentication System Testing
============================

Testing authentication endpoints as requested in review:
1. Token-based authentication verification: Test that GET /api/auth/verify with valid Bearer token returns user data
2. Login returns token: Test that POST /api/auth/login with valid credentials (Adam/Adam123!) returns a valid token
3. User registration returns token: Test that new user registration returns a token

Test credentials: Adam/Adam123!
"""

import requests
import json
import sys
import random
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://pvp-evolution.preview.emergentagent.com/api"

# Test credentials
TEST_USERNAME = "Adam"
TEST_PASSWORD = "Adam123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(title):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}")

def print_test(test_name):
    print(f"\n{Colors.BOLD}{Colors.BLUE}🔐 Testing: {test_name}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.PURPLE}ℹ️  {message}{Colors.END}")

def log_test_result(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def test_login_authentication():
    """Test POST /api/auth/login with valid credentials returns token"""
    print_test("Login Authentication - POST /api/auth/login")
    
    try:
        url = f"{BACKEND_URL}/auth/login"
        payload = {
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }
        
        print_info(f"Making request to: {url}")
        print_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response Keys: {list(data.keys())}")
            
            # Check if token is present
            if "token" in data and data["token"]:
                token = data["token"]
                print_success(f"Login successful - Token received: {token[:30]}...")
                
                # Verify user data is also returned
                if "user" in data and data["user"]:
                    user_data = data["user"]
                    username = user_data.get("username", "Unknown")
                    print_success(f"User data returned - Username: {username}")
                    
                    if username == TEST_USERNAME:
                        log_test_result("Login Authentication", "PASS", f"Token and user data correct")
                        return token
                    else:
                        log_test_result("Login Authentication", "FAIL", f"Username mismatch: expected {TEST_USERNAME}, got {username}")
                        return None
                else:
                    log_test_result("Login Authentication", "FAIL", "No user data in response")
                    return None
            else:
                log_test_result("Login Authentication", "FAIL", "No token in response")
                return None
        else:
            error_text = response.text
            print_error(f"HTTP {response.status_code}: {error_text}")
            log_test_result("Login Authentication", "FAIL", f"HTTP {response.status_code}")
            return None
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        log_test_result("Login Authentication", "FAIL", f"Exception: {str(e)}")
        return None

def test_token_verification(token):
    """Test GET /api/auth/verify with Bearer token returns user data"""
    print_test("Token Verification - GET /api/auth/verify")
    
    if not token:
        print_error("No token available from login test")
        log_test_result("Token Verification", "FAIL", "No token available")
        return False
    
    try:
        url = f"{BACKEND_URL}/auth/verify"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        print_info(f"Making request to: {url}")
        print_info(f"Authorization header: Bearer {token[:30]}...")
        
        response = requests.get(url, headers=headers, timeout=30)
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response Keys: {list(data.keys())}")
            
            # Check if valid flag is present and true
            if "valid" in data and data["valid"]:
                print_success("Token is valid")
                
                # Check if user data is present
                if "user" in data and data["user"]:
                    user_data = data["user"]
                    username = user_data.get("username", "Unknown")
                    user_id = user_data.get("id", "Unknown")
                    
                    print_success(f"User data returned - Username: {username}, ID: {user_id}")
                    
                    if username == TEST_USERNAME:
                        log_test_result("Token Verification", "PASS", f"Valid token returns correct user data")
                        return True
                    else:
                        log_test_result("Token Verification", "FAIL", f"Username mismatch: expected {TEST_USERNAME}, got {username}")
                        return False
                else:
                    log_test_result("Token Verification", "FAIL", "No user data in response")
                    return False
            else:
                log_test_result("Token Verification", "FAIL", "Token marked as invalid")
                return False
        else:
            error_text = response.text
            print_error(f"HTTP {response.status_code}: {error_text}")
            log_test_result("Token Verification", "FAIL", f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        log_test_result("Token Verification", "FAIL", f"Exception: {str(e)}")
        return False

def test_user_registration():
    """Test POST /api/user/register returns token for new user"""
    print_test("User Registration - POST /api/user/register")
    
    try:
        # Generate unique username for test
        test_user = f"TestUser{random.randint(10000, 99999)}"
        test_pass = "TestPass123!"
        
        url = f"{BACKEND_URL}/user/register"
        payload = {
            "username": test_user,
            "password": test_pass
        }
        
        print_info(f"Making request to: {url}")
        print_info(f"Test user: {test_user}")
        print_info(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response Keys: {list(data.keys())}")
            
            # Check if token is present
            if "token" in data and data["token"]:
                token = data["token"]
                print_success(f"Registration successful - Token received: {token[:30]}...")
                
                # Check if user data is present
                if "user" in data and data["user"]:
                    user_data = data["user"]
                    username = user_data.get("username", "Unknown")
                    user_id = user_data.get("id", "Unknown")
                    
                    print_success(f"User data returned - Username: {username}, ID: {user_id}")
                    
                    if username == test_user:
                        # Verify initial resources are set
                        crystals = user_data.get("crystals", 0)
                        coins = user_data.get("coins", 0)
                        gold = user_data.get("gold", 0)
                        
                        print_info(f"Initial resources - Crystals: {crystals}, Coins: {coins}, Gold: {gold}")
                        
                        log_test_result("User Registration", "PASS", f"New user created with token and correct data")
                        return True
                    else:
                        log_test_result("User Registration", "FAIL", f"Username mismatch: expected {test_user}, got {username}")
                        return False
                else:
                    log_test_result("User Registration", "FAIL", "No user data in response")
                    return False
            else:
                log_test_result("User Registration", "FAIL", "No token in response")
                return False
        else:
            error_text = response.text
            print_error(f"HTTP {response.status_code}: {error_text}")
            log_test_result("User Registration", "FAIL", f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        log_test_result("User Registration", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all authentication tests"""
    print_header("AUTHENTICATION SYSTEM TESTING")
    print_info(f"Backend URL: {BACKEND_URL}")
    print_info(f"Test Credentials: {TEST_USERNAME}/{TEST_PASSWORD}")
    print_info(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track test results
    results = []
    
    # Test 1: Login Authentication
    print_header("TEST 1: LOGIN AUTHENTICATION")
    token = test_login_authentication()
    results.append(("Login Authentication", token is not None))
    
    # Test 2: Token Verification (depends on Test 1)
    print_header("TEST 2: TOKEN VERIFICATION")
    token_valid = test_token_verification(token)
    results.append(("Token Verification", token_valid))
    
    # Test 3: User Registration
    print_header("TEST 3: USER REGISTRATION")
    registration_success = test_user_registration()
    results.append(("User Registration", registration_success))
    
    # Summary
    print_header("AUTHENTICATION TEST SUMMARY")
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        if success:
            print_success(f"✅ {test_name}")
            passed += 1
        else:
            print_error(f"❌ {test_name}")
    
    print(f"\n{Colors.BOLD}Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%){Colors.END}")
    
    if passed == total:
        print_success("🎉 ALL AUTHENTICATION TESTS PASSED!")
        print_info("✅ Token-based authentication verification working")
        print_info("✅ Login returns valid token")
        print_info("✅ User registration returns token")
        return 0
    else:
        print_error(f"⚠️ {total - passed} authentication tests FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())