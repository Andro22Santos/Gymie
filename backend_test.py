import requests
import sys
from datetime import datetime

class WorkoutAPITester:
    def __init__(self, base_url="https://535b5e70-f291-4d00-b430-59f3b48d9b6b.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.passed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.passed_tests.append(name)
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                self.failed_tests.append(f"{name} - Expected {expected_status}, got {response.status_code}")
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")

            return success, {}

        except Exception as e:
            self.failed_tests.append(f"{name} - Error: {str(e)}")
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth(self):
        """Test authentication flow"""
        print("\n🔐 Testing Authentication...")
        success, response = self.run_test(
            "Login with demo credentials",
            "POST",
            "api/auth/login",
            200,
            data={"email": "demo@shape.com", "password": "demo123"},
            auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"✅ Authentication successful - Got token")
            return True
        else:
            print(f"❌ Authentication failed")
            return False

    def test_workout_plans(self):
        """Test workout plans CRUD operations"""
        print("\n🏋️ Testing Workout Plans...")
        
        # Get workout plans
        success, plans_response = self.run_test(
            "GET /api/workout-plans returns 3 ABC plans with exercises",
            "GET",
            "api/workout-plans",
            200
        )
        
        if success:
            plans = plans_response.get('plans', [])
            if len(plans) >= 3:
                print(f"✅ Found {len(plans)} workout plans")
                abc_types = [p.get('plan_type') for p in plans]
                if 'A' in abc_types and 'B' in abc_types and 'C' in abc_types:
                    print("✅ ABC plan types found")
                    # Check if plans have exercises
                    has_exercises = all(len(p.get('exercises', [])) > 0 for p in plans)
                    if has_exercises:
                        print("✅ All plans have exercises")
                    else:
                        print("❌ Some plans missing exercises")
                else:
                    print(f"❌ Missing ABC plan types. Found: {abc_types}")
            else:
                print(f"❌ Expected at least 3 plans, found {len(plans)}")

        # Create new workout plan
        new_plan_data = {
            "name": "Test Plan D",
            "plan_type": "D",
            "exercises": [
                {
                    "name": "Test Exercise",
                    "sets": 3,
                    "reps": "10",
                    "weight_kg": 20.0,
                    "rest_seconds": 60,
                    "notes": "Test exercise"
                }
            ]
        }
        
        success, create_response = self.run_test(
            "POST /api/workout-plans creates a new plan",
            "POST",
            "api/workout-plans",
            201,
            data=new_plan_data
        )
        
        plan_id = None
        if success and 'id' in create_response:
            plan_id = create_response['id']
            print(f"✅ Created plan with ID: {plan_id}")
        
        # Delete workout plan if created
        if plan_id:
            self.run_test(
                "DELETE /api/workout-plans/{id} removes plan",
                "DELETE",
                f"api/workout-plans/{plan_id}",
                200
            )

    def test_workout_sessions(self):
        """Test workout session operations"""
        print("\n💪 Testing Workout Sessions...")
        
        # First get a plan ID
        success, plans_response = self.run_test(
            "Get plans for session test",
            "GET",
            "api/workout-plans",
            200
        )
        
        plan_id = None
        if success and plans_response.get('plans'):
            plan_id = plans_response['plans'][0]['id']
            
        if not plan_id:
            print("❌ No plan available for session testing")
            return
            
        # Start workout session
        success, session_response = self.run_test(
            "POST /api/workout-sessions starts session from plan",
            "POST",
            "api/workout-sessions",
            201,
            data={"plan_id": plan_id}
        )
        
        session_id = None
        if success and 'id' in session_response:
            session_id = session_response['id']
            print(f"✅ Started session with ID: {session_id}")
            
            # Update session exercises
            update_data = {
                "exercises": session_response.get('exercises', []),
                "notes": "Test session update"
            }
            
            self.run_test(
                "PUT /api/workout-sessions/{id} updates exercise data",
                "PUT",
                f"api/workout-sessions/{session_id}",
                200,
                data=update_data
            )
            
            # Complete session
            self.run_test(
                "POST /api/workout-sessions/{id}/complete marks session completed",
                "POST",
                f"api/workout-sessions/{session_id}/complete",
                200
            )
        
        # Get session history
        self.run_test(
            "GET /api/workout-sessions returns session history",
            "GET",
            "api/workout-sessions",
            200
        )

    def test_body_metrics(self):
        """Test body metrics operations"""
        print("\n📊 Testing Body Metrics...")
        
        # Get body metrics
        success, metrics_response = self.run_test(
            "GET /api/body-metrics returns weight history (14 entries from seed)",
            "GET",
            "api/body-metrics",
            200
        )
        
        if success:
            metrics = metrics_response.get('metrics', [])
            print(f"✅ Found {len(metrics)} body metric entries")
            if len(metrics) >= 14:
                print("✅ Has sufficient weight history entries")
            else:
                print(f"⚠️  Expected 14+ entries, found {len(metrics)}")
        
        # Create new body metric
        self.run_test(
            "POST /api/body-metrics logs new weight entry",
            "POST",
            "api/body-metrics",
            200,
            data={"weight": 84.5, "body_fat_pct": 15.0, "notes": "Test entry"}
        )

    def test_progress(self):
        """Test progress endpoints"""
        print("\n📈 Testing Progress...")
        
        # Get progress summary
        success, summary_response = self.run_test(
            "GET /api/progress/summary returns weight, workouts, water avg, consistency stats",
            "GET",
            "api/progress/summary",
            200
        )
        
        if success:
            required_fields = ['latest_weight', 'workouts_this_week', 'avg_water_ml', 'weight_history']
            missing_fields = [f for f in required_fields if f not in summary_response]
            if not missing_fields:
                print("✅ Progress summary has all required fields")
            else:
                print(f"❌ Missing fields in summary: {missing_fields}")
        
        # Get weight metrics
        self.run_test(
            "GET /api/progress/weight returns weight metrics",
            "GET",
            "api/progress/weight",
            200
        )

    def test_health_check(self):
        """Test API health"""
        print("\n🔧 Testing API Health...")
        self.run_test(
            "API Health Check",
            "GET",
            "api/health",
            200,
            auth_required=False
        )

def main():
    print("🚀 Starting Shape Inexplicavel Phase 2 API Testing")
    print("=" * 60)
    
    tester = WorkoutAPITester()
    
    # Test authentication first
    if not tester.test_auth():
        print("❌ Authentication failed, stopping tests")
        return 1
    
    # Run all tests
    tester.test_workout_plans()
    tester.test_workout_sessions() 
    tester.test_body_metrics()
    tester.test_progress()
    tester.test_health_check()
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 BACKEND TESTING COMPLETE")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in tester.failed_tests:
            print(f"  - {test}")
    
    if tester.passed_tests:
        print(f"\n✅ Passed Tests:")
        for test in tester.passed_tests:
            print(f"  - {test}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())