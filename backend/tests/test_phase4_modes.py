"""
Phase 4 Backend Tests - Multi-Mode System with Shared Context
Tests for: Agents/Modes, Insights, Debug Panel, Meal Analysis

Features tested:
- Login with demo@shape.com / demo123
- Agent insights endpoint (/api/agents/insights)
- Agent debug endpoint (/api/agents/debug)
- Meal analysis endpoint (/api/meals/analyze)
- Chat modes routing (companion, nutrition, workout)
- Intent classification (/api/agents/classify)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Store auth token across tests
class TestSession:
    token = None
    user_id = None


@pytest.fixture(scope="module")
def auth_session():
    """Authenticate once and reuse token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@shape.com",
        "password": "demo123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    TestSession.token = data.get("access_token")
    TestSession.user_id = data.get("user_id")
    return TestSession


@pytest.fixture
def auth_headers(auth_session):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {auth_session.token}"}


class TestLogin:
    """Test login functionality"""
    
    def test_login_demo_user(self):
        """Login with demo@shape.com / demo123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@shape.com",
            "password": "demo123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["name"] == "Soldado Demo"
        print(f"✓ Login successful - user: {data['name']}")


class TestAgentInsights:
    """Test /api/agents/insights endpoint for actionable insights"""
    
    def test_get_insights(self, auth_headers):
        """GET /api/agents/insights returns actionable insights"""
        response = requests.get(
            f"{BASE_URL}/api/agents/insights",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "actionable" in data
        assert "raw_insights" in data
        assert "context_summary" in data
        
        # Verify context_summary fields
        ctx = data["context_summary"]
        assert "water_pct" in ctx
        assert "calories_pct" in ctx
        assert "protein_pct" in ctx
        assert "meals_count" in ctx
        assert "has_checkin" in ctx
        assert "has_workout" in ctx
        
        print(f"✓ Insights returned - actionable: {len(data['actionable'])}, raw: {len(data['raw_insights'])}")
        print(f"  Context: water={ctx['water_pct']}%, cals={ctx['calories_pct']}%, protein={ctx['protein_pct']}%")


class TestAgentDebug:
    """Test /api/agents/debug endpoint for orchestration debugging"""
    
    def test_get_debug_info(self, auth_headers):
        """GET /api/agents/debug returns orchestration debug data"""
        response = requests.get(
            f"{BASE_URL}/api/agents/debug",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert data["orchestration_status"] == "operational"
        assert "context_loaded" in data
        assert "recent_decisions" in data
        assert "agents_available" in data
        assert "fallback_agent" in data
        assert data["fallback_agent"] == "companion"
        
        # Verify context_loaded fields
        ctx = data["context_loaded"]
        assert "profile_loaded" in ctx
        assert "persona_style" in ctx
        assert "memory_facts_count" in ctx
        assert "agent_insights_count" in ctx
        
        print(f"✓ Debug info returned - status: {data['orchestration_status']}")
        print(f"  Persona: {ctx['persona_style']}, Facts: {ctx['memory_facts_count']}, Insights: {ctx['agent_insights_count']}")
        
        # Verify agents available
        agent_codes = [a["code"] for a in data["agents_available"]]
        assert "COMP" in agent_codes, "Companion agent missing"
        assert "NUTR" in agent_codes, "Nutrition agent missing"
        assert "TREN" in agent_codes, "Workout agent missing"
        print(f"  Agents: {', '.join(agent_codes)}")


class TestMealAnalysis:
    """Test /api/meals/analyze endpoint for AI meal analysis"""
    
    def test_analyze_meal_simple(self, auth_headers):
        """POST /api/meals/analyze returns standardized contract"""
        response = requests.post(
            f"{BASE_URL}/api/meals/analyze",
            headers=auth_headers,
            json={
                "description": "Frango grelhado com arroz integral e salada"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify standardized response contract
        assert "success" in data
        assert "analysis_text" in data
        assert "estimated_macros" in data
        assert "confidence" in data
        assert "suggestions" in data
        assert "agent_name" in data
        assert "agent_code" in data
        assert "analyzed_at" in data
        
        # Verify estimated_macros structure
        macros = data["estimated_macros"]
        assert "calories" in macros
        assert "protein" in macros
        assert "carbs" in macros
        assert "fat" in macros
        assert "description" in macros
        
        print(f"✓ Meal analysis successful - success: {data['success']}, confidence: {data['confidence']}")
        print(f"  Macros: {macros['calories']}kcal, P:{macros['protein']}g, C:{macros['carbs']}g, G:{macros['fat']}g")
        
        # If successful, macros should have reasonable values
        if data["success"]:
            assert macros["calories"] > 0, "Calories should be positive for a real meal"
            assert macros["protein"] >= 0, "Protein should be non-negative"


class TestIntentClassification:
    """Test /api/agents/classify for message routing"""
    
    def test_classify_macros_message(self):
        """Message about macros routes to Nutrition agent"""
        response = requests.get(
            f"{BASE_URL}/api/agents/classify",
            params={"message": "Como estao meus macros hoje?"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["agent_id"] == "nutrition"
        print(f"✓ 'macros' message routed to: {data['agent_id']} ({data['agent']['name']})")
    
    def test_classify_workout_message(self):
        """Message about treino routes to Workout agent"""
        response = requests.get(
            f"{BASE_URL}/api/agents/classify",
            params={"message": "Qual treino devo fazer hoje?"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["agent_id"] == "workout"
        print(f"✓ 'treino' message routed to: {data['agent_id']} ({data['agent']['name']})")
    
    def test_classify_general_message(self):
        """General message routes to Companion agent"""
        response = requests.get(
            f"{BASE_URL}/api/agents/classify",
            params={"message": "Bom dia, como voce esta?"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["agent_id"] == "companion"
        print(f"✓ General message routed to: {data['agent_id']} ({data['agent']['name']})")


class TestChatModes:
    """Test chat message sending with different modes"""
    
    def test_send_message_companion_mode(self, auth_headers):
        """Send message in companion mode"""
        # First get threads
        threads_resp = requests.get(
            f"{BASE_URL}/api/chat/threads",
            headers=auth_headers
        )
        assert threads_resp.status_code == 200
        threads = threads_resp.json().get("threads", [])
        
        if not threads:
            # Create a thread
            create_resp = requests.post(
                f"{BASE_URL}/api/chat/threads",
                headers=auth_headers
            )
            assert create_resp.status_code == 200
            thread_id = create_resp.json()["id"]
        else:
            thread_id = threads[0]["id"]
        
        # Send message in companion mode
        response = requests.post(
            f"{BASE_URL}/api/chat/threads/{thread_id}/messages",
            headers=auth_headers,
            json={
                "content": "Como estou hoje?",
                "mode": "companion"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "user_message" in data
        assert "ai_message" in data
        
        ai_msg = data["ai_message"]
        assert ai_msg["role"] == "assistant"
        assert "content" in ai_msg
        assert len(ai_msg["content"]) > 0
        
        print(f"✓ Companion mode message sent and received")
        print(f"  Agent: {ai_msg.get('agent_name', 'N/A')} ({ai_msg.get('agent_code', 'N/A')})")
    
    def test_send_message_nutrition_mode(self, auth_headers):
        """Send message in nutrition mode - should route to Nutrition agent"""
        # Get threads
        threads_resp = requests.get(
            f"{BASE_URL}/api/chat/threads",
            headers=auth_headers
        )
        threads = threads_resp.json().get("threads", [])
        thread_id = threads[0]["id"] if threads else None
        
        if not thread_id:
            pytest.skip("No chat threads available")
        
        # Send message in nutrition mode
        response = requests.post(
            f"{BASE_URL}/api/chat/threads/{thread_id}/messages",
            headers=auth_headers,
            json={
                "content": "Quantas calorias comi hoje?",
                "mode": "nutrition"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        ai_msg = data["ai_message"]
        # In nutrition mode, should use nutrition agent
        assert ai_msg.get("agent_code") == "NUTR" or ai_msg.get("agent_id") == "nutrition"
        print(f"✓ Nutrition mode message routed correctly to: {ai_msg.get('agent_name', 'N/A')}")


class TestAgentsEndpoint:
    """Test /api/agents for available agents list"""
    
    def test_get_agents_list(self):
        """GET /api/agents returns all available agents"""
        response = requests.get(f"{BASE_URL}/api/agents")
        assert response.status_code == 200
        data = response.json()
        
        assert "agents" in data
        agents = data["agents"]
        
        # Verify we have expected agents
        agent_ids = [a["id"] for a in agents]
        assert "companion" in agent_ids
        assert "nutrition" in agent_ids
        assert "workout" in agent_ids
        
        # Verify agent structure
        for agent in agents:
            assert "id" in agent
            assert "name" in agent
            assert "code" in agent
            assert "color" in agent
            assert "expertise" in agent
        
        print(f"✓ Agents list returned - {len(agents)} agents available")
        for a in agents:
            print(f"  - {a['code']}: {a['name']}")


class TestDashboardWithInsights:
    """Test dashboard with insights integration"""
    
    def test_dashboard_has_macros(self, auth_headers):
        """GET /api/dashboard/today returns macro data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/today",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "macros" in data
        assert "water" in data
        assert "reminders" in data
        
        macros = data["macros"]
        assert "calories" in macros
        assert "protein" in macros
        
        print(f"✓ Dashboard data returned with macros")
        print(f"  Calories: {macros['calories']['current']}/{macros['calories']['target']}")
        print(f"  Protein: {macros['protein']['current']}/{macros['protein']['target']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
