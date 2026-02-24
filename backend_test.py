#!/usr/bin/env python3
"""
Backend API Test Suite for Shape Inexplicavel
Tests all endpoints with demo user: demo@shape.com / demo123
"""

import requests
import sys
import json
from datetime import datetime

class ShapeAPITester:
    def __init__(self, base_url="https://535b5e70-f291-4d00-b430-59f3b48d9b6b.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.demo_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, method, endpoint, expected_status, success, response_code=None, error_msg=None):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {method} {endpoint} | {name}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({
                "name": name,
                "endpoint": endpoint,
                "expected": expected_status,
                "actual": response_code,
                "error": error_msg
            })
            if error_msg:
                print(f"    Error: {error_msg}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=30)
            
            success = response.status_code == expected_status
            
            self.log_test(name, method, endpoint, expected_status, success, 
                         response.status_code, 
                         f"Status {response.status_code}: {response.text[:200]}" if not success else None)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                return False, response.text

        except Exception as e:
            self.log_test(name, method, endpoint, expected_status, False, 
                         None, str(e))
            return False, str(e)

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check", "GET", "/api/health", 200
        )
        return success

    def test_login_demo_user(self):
        """Login with demo credentials"""
        success, response = self.run_test(
            "Demo User Login", "POST", "/api/auth/login", 200,
            {"email": "demo@shape.com", "password": "demo123"}
        )
        if success and isinstance(response, dict):
            self.token = response.get('access_token')
            self.demo_user_id = response.get('user_id')
            return True
        return False

    def test_login_wrong_password(self):
        """Test login with wrong password"""
        success, response = self.run_test(
            "Wrong Password Login", "POST", "/api/auth/login", 401,
            {"email": "demo@shape.com", "password": "wrongpass"}
        )
        return success

    def test_register_new_user(self):
        """Test registration of new user"""
        timestamp = datetime.now().strftime("%H%M%S")
        success, response = self.run_test(
            "New User Registration", "POST", "/api/auth/register", 200,
            {
                "name": f"Test User {timestamp}",
                "email": f"test{timestamp}@shape.com",
                "password": "testpass123"
            }
        )
        return success

    def test_get_user_profile(self):
        """Test get current user profile"""
        if not self.token:
            return False
        success, response = self.run_test(
            "Get User Profile", "GET", "/api/me", 200
        )
        return success

    def test_dashboard_today(self):
        """Test dashboard endpoint"""
        if not self.token:
            return False
        success, response = self.run_test(
            "Dashboard Today", "GET", "/api/dashboard/today", 200
        )
        return success

    def test_meals_operations(self):
        """Test meals CRUD operations"""
        if not self.token:
            return False
        
        # Create meal
        meal_data = {
            "description": "Test meal - banana + whey",
            "meal_type": "snack",
            "calories": 250,
            "protein": 30,
            "carbs": 25,
            "fat": 2
        }
        success, response = self.run_test(
            "Create Meal", "POST", "/api/meals", 200, meal_data
        )
        
        meal_id = None
        if success and isinstance(response, dict):
            meal_id = response.get('id')
        
        # Get meals
        success, response = self.run_test(
            "Get Meals List", "GET", "/api/meals", 200
        )
        
        # Delete meal if created
        if meal_id:
            success, response = self.run_test(
                "Delete Meal", "DELETE", f"/api/meals/{meal_id}", 200
            )
            return success
        
        return True

    def test_water_operations(self):
        """Test water tracking operations"""
        if not self.token:
            return False
        
        # Add water
        success, response = self.run_test(
            "Add Water Log", "POST", "/api/water", 200,
            {"amount_ml": 300}
        )
        
        water_id = None
        if success and isinstance(response, dict):
            water_id = response.get('id')
        
        # Get water logs
        success, response = self.run_test(
            "Get Water Logs", "GET", "/api/water", 200
        )
        
        return success

    def test_reminders_operations(self):
        """Test reminders operations"""
        if not self.token:
            return False
        
        # Get reminders
        success, response = self.run_test(
            "Get Reminders", "GET", "/api/reminders", 200
        )
        
        # Try reminder action on existing reminder
        success, response = self.run_test(
            "Get Dashboard for Reminder ID", "GET", "/api/dashboard/today", 200
        )
        
        if success and isinstance(response, dict):
            reminders = response.get('reminders', [])
            if reminders:
                reminder_id = reminders[0].get('id')
                if reminder_id:
                    success, response = self.run_test(
                        "Reminder Action Complete", "POST", f"/api/reminders/{reminder_id}/action", 200,
                        {"action": "completed"}
                    )
                    
                    # Test snooze action on another reminder if available
                    if len(reminders) > 1:
                        reminder_id_2 = reminders[1].get('id')
                        if reminder_id_2:
                            success, response = self.run_test(
                                "Reminder Action Snooze", "POST", f"/api/reminders/{reminder_id_2}/action", 200,
                                {"action": "snoozed"}
                            )
        
        return True

    def test_checkins(self):
        """Test check-ins functionality"""
        if not self.token:
            return False
        
        # Create checkin
        success, response = self.run_test(
            "Create Check-in", "POST", "/api/checkins", 200,
            {
                "sleep_quality": 4,
                "energy_level": 3,
                "mood": "focado",
                "notes": "Test checkin via API"
            }
        )
        
        # Get checkins
        success, response = self.run_test(
            "Get Check-ins", "GET", "/api/checkins", 200
        )
        
        return success

    def test_chat_operations(self):
        """Test chat functionality"""
        if not self.token:
            return False
        
        # Get threads
        success, response = self.run_test(
            "Get Chat Threads", "GET", "/api/chat/threads", 200
        )
        
        thread_id = None
        if success and isinstance(response, dict):
            threads = response.get('threads', [])
            if threads:
                thread_id = threads[0].get('id')
        
        # Create thread if none exist
        if not thread_id:
            success, response = self.run_test(
                "Create Chat Thread", "POST", "/api/chat/threads", 200
            )
            if success and isinstance(response, dict):
                thread_id = response.get('id')
        
        # Send message
        if thread_id:
            success, response = self.run_test(
                "Send Chat Message", "POST", f"/api/chat/threads/{thread_id}/messages", 200,
                {
                    "content": "Como estou hoje?",
                    "mode": "companion"
                }
            )
            return success
        
        return False

    def test_settings_operations(self):
        """Test settings functionality"""
        if not self.token:
            return False
        
        # Get persona settings
        success, response = self.run_test(
            "Get Persona Settings", "GET", "/api/settings/persona", 200
        )
        
        # Update persona
        success, response = self.run_test(
            "Update Persona", "PUT", "/api/settings/persona", 200,
            {"persona_style": "coach"}
        )
        
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*50}")
        print(f"BACKEND API TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\nFAILED TESTS:")
            for test in self.failed_tests:
                print(f"  ❌ {test['name']} ({test['endpoint']})")
                print(f"     Expected: {test['expected']}, Got: {test['actual']}")
                if test['error']:
                    print(f"     Error: {test['error']}")
        
        return len(self.failed_tests) == 0

def main():
    """Main test execution"""
    print("🚀 Starting Shape Inexplicavel Backend API Tests")
    print(f"Target URL: https://535b5e70-f291-4d00-b430-59f3b48d9b6b.preview.emergentagent.com")
    print(f"Demo User: demo@shape.com / demo123\n")
    
    tester = ShapeAPITester()
    
    # Run tests in sequence
    tests = [
        ("Health Check", tester.test_health),
        ("Demo User Login", tester.test_login_demo_user),
        ("Wrong Password Test", tester.test_login_wrong_password),
        ("User Registration", tester.test_register_new_user),
        ("User Profile", tester.test_get_user_profile),
        ("Dashboard", tester.test_dashboard_today),
        ("Meals Operations", tester.test_meals_operations),
        ("Water Operations", tester.test_water_operations),
        ("Reminders Operations", tester.test_reminders_operations),
        ("Check-ins", tester.test_checkins),
        ("Chat Operations", tester.test_chat_operations),
        ("Settings Operations", tester.test_settings_operations),
    ]
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running {test_name}...")
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
    
    # Print summary and return appropriate exit code
    success = tester.print_summary()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())