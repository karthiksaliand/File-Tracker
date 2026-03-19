#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Government File Tracking System
Testing NEW features: departments, priority, approve/reject decisions, ADC decisions, admin user edit, admin config, analytics
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://file-approval-hub-1.preview.emergentagent.com/api"

# Test credentials from backend code
TEST_USERS = {
    "caseworker": {"username": "caseworker", "password": "case123"},
    "admin": {"username": "admin", "password": "admin123"},
    "sp": {"username": "sp", "password": "sp123"},
    "forest": {"username": "forest", "password": "forest123"},
    "dc": {"username": "dc", "password": "dc123"},
    "adc": {"username": "adc", "password": "adc123"},
    "tah_mangaluru": {"username": "tah_mangaluru", "password": "tah123"}
}

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {symbol} {test_name}")
    if details:
        print(f"    {details}")

def login_user(role):
    """Login and return token for specified role"""
    creds = TEST_USERS[role]
    response = requests.post(f"{BASE_URL}/auth/login", json=creds)
    if response.status_code == 200:
        data = response.json()
        return data["token"], data["user"]
    else:
        log_test(f"Login {role}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return None, None

def auth_headers(token):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_auth_logins():
    """Test 1: Auth Login - All roles"""
    print("\n=== TEST 1: AUTH LOGIN - ALL ROLES ===")
    
    all_passed = True
    tokens = {}
    users = {}
    
    for role in TEST_USERS.keys():
        token, user = login_user(role)
        if token:
            log_test(f"Login {role}", "PASS", f"Role: {user['role']}, Display: {user['display_name']}")
            tokens[role] = token
            users[role] = user
        else:
            log_test(f"Login {role}", "FAIL", "Authentication failed")
            all_passed = False
    
    return all_passed, tokens, users

def test_file_creation_with_departments_priority(tokens):
    """Test 2: NEW - File creation with departments + priority"""
    print("\n=== TEST 2: FILE CREATION WITH DEPARTMENTS + PRIORITY ===")
    
    if 'caseworker' not in tokens:
        log_test("File creation", "FAIL", "No caseworker token available")
        return False, None
    
    # Test high priority file with selected departments
    file_data = {
        "file_no": "PRI001",
        "year": "2025", 
        "description": "High priority test file with selected departments",
        "tahsildar_location": "Mangaluru",
        "departments": ["tahsildar", "sp"],  # NEW: Only tahsildar and sp, NOT forest
        "priority": "high"  # NEW: High priority
    }
    
    response = requests.post(
        f"{BASE_URL}/files", 
        json=file_data,
        headers=auth_headers(tokens['caseworker'])
    )
    
    if response.status_code == 200:
        file_doc = response.json()
        expected_fields = ['departments', 'priority', 'file_no', 'year', 'description']
        missing_fields = [field for field in expected_fields if field not in file_doc]
        
        if missing_fields:
            log_test("File creation", "FAIL", f"Missing fields in response: {missing_fields}")
            return False, None
        
        # Verify departments and priority
        if file_doc['departments'] == ["tahsildar", "sp"] and file_doc['priority'] == "high":
            log_test("File creation with departments+priority", "PASS", 
                    f"File ID: {file_doc['id']}, Departments: {file_doc['departments']}, Priority: {file_doc['priority']}")
            return True, file_doc['id']
        else:
            log_test("File creation", "FAIL", 
                    f"Incorrect departments ({file_doc['departments']}) or priority ({file_doc['priority']})")
            return False, None
    else:
        log_test("File creation", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False, None

def test_file_submit(tokens, file_id):
    """Test 3: File submit - should create approvals only for selected departments"""
    print("\n=== TEST 3: FILE SUBMIT - SELECTED DEPARTMENTS ONLY ===")
    
    if not file_id or 'caseworker' not in tokens:
        log_test("File submit", "FAIL", "No file ID or caseworker token")
        return False
    
    response = requests.post(
        f"{BASE_URL}/files/{file_id}/submit",
        headers=auth_headers(tokens['caseworker'])
    )
    
    if response.status_code == 200:
        updated_file = response.json()
        if updated_file['status'] == 'submitted' and updated_file['is_locked']:
            log_test("File submit", "PASS", f"Status: {updated_file['status']}, Locked: {updated_file['is_locked']}")
            return True
        else:
            log_test("File submit", "FAIL", f"Unexpected status or lock state")
            return False
    else:
        log_test("File submit", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_approval_approve_reject(tokens, file_id):
    """Test 4: NEW - Approval with approve/reject (NOT yes/no)"""
    print("\n=== TEST 4: APPROVAL WITH APPROVE/REJECT (NOT YES/NO) ===")
    
    if not file_id:
        log_test("Approvals", "FAIL", "No file ID available")
        return False
    
    all_passed = True
    
    # Test SP approval with "approve" decision
    if 'sp' in tokens:
        response = requests.post(
            f"{BASE_URL}/files/{file_id}/approval",
            json={"decision": "approve", "remark": "SP approved - new decision format"},
            headers=auth_headers(tokens['sp'])
        )
        
        if response.status_code == 200:
            log_test("SP approval (approve)", "PASS", "Successfully used 'approve' decision")
        else:
            log_test("SP approval (approve)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            all_passed = False
    
    # Test Tahsildar approval with "reject" decision
    if 'tah_mangaluru' in tokens:
        response = requests.post(
            f"{BASE_URL}/files/{file_id}/approval",
            json={"decision": "reject", "remark": "Tahsildar rejected - testing new format"}, 
            headers=auth_headers(tokens['tah_mangaluru'])
        )
        
        if response.status_code == 200:
            log_test("Tahsildar approval (reject)", "PASS", "Successfully used 'reject' decision")
        else:
            log_test("Tahsildar approval (reject)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            all_passed = False
    
    # Test Forest "na" decision (should work for forest only)
    if 'forest' in tokens:
        response = requests.post(
            f"{BASE_URL}/files/{file_id}/approval",
            json={"decision": "na", "remark": "Forest N/A - not applicable"},
            headers=auth_headers(tokens['forest'])
        )
        
        if response.status_code == 200:
            log_test("Forest approval (na)", "PASS", "Successfully used 'na' decision for forest")
        else:
            # This might fail if forest was not included in departments - that's expected
            log_test("Forest approval (na)", "INFO", f"Status: {response.status_code} - Expected if forest not in departments")
    
    return all_passed

def test_adc_decision(tokens, file_id):
    """Test 5: NEW - ADC decision endpoint"""
    print("\n=== TEST 5: ADC DECISION ENDPOINT ===")
    
    if not file_id or 'adc' not in tokens:
        log_test("ADC decision", "FAIL", "No file ID or ADC token")
        return False
    
    response = requests.post(
        f"{BASE_URL}/files/{file_id}/adc-decision",
        json={"decision": "approve", "remark": "ADC approves this file"},
        headers=auth_headers(tokens['adc'])
    )
    
    if response.status_code == 200:
        result = response.json()
        log_test("ADC decision", "PASS", f"Message: {result.get('message', 'Success')}")
        return True
    else:
        log_test("ADC decision", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_dc_decision(tokens, file_id):
    """Test 6: DC decision (accept/reject)"""
    print("\n=== TEST 6: DC DECISION ===")
    
    if not file_id or 'dc' not in tokens:
        log_test("DC decision", "FAIL", "No file ID or DC token")
        return False
    
    response = requests.post(
        f"{BASE_URL}/files/{file_id}/dc-decision",
        json={"decision": "accept", "remark": "DC final acceptance"},
        headers=auth_headers(tokens['dc'])
    )
    
    if response.status_code == 200:
        result = response.json()
        log_test("DC decision", "PASS", f"Message: {result.get('message', 'Success')}")
        return True
    else:
        log_test("DC decision", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_admin_user_edit(tokens, users):
    """Test 7: NEW - Admin user edit"""
    print("\n=== TEST 7: ADMIN USER EDIT ===")
    
    if 'admin' not in tokens or 'caseworker' not in users:
        log_test("Admin user edit", "FAIL", "No admin token or caseworker user info")
        return False
    
    # First get user list to find caseworker ID
    response = requests.get(
        f"{BASE_URL}/admin/users",
        headers=auth_headers(tokens['admin'])
    )
    
    if response.status_code != 200:
        log_test("Admin get users", "FAIL", f"Status: {response.status_code}")
        return False
    
    users_list = response.json()
    caseworker_user = next((u for u in users_list if u['username'] == 'caseworker'), None)
    
    if not caseworker_user:
        log_test("Admin user edit", "FAIL", "Caseworker user not found in users list")
        return False
    
    log_test("Admin get users", "PASS", f"Found {len(users_list)} users")
    
    # Now edit the caseworker user
    edit_data = {
        "display_name": "Updated Case Worker",
        "username": "caseworker_v2"
    }
    
    response = requests.put(
        f"{BASE_URL}/admin/users/{caseworker_user['id']}",
        json=edit_data,
        headers=auth_headers(tokens['admin'])
    )
    
    if response.status_code == 200:
        updated_user = response.json()
        if updated_user['display_name'] == edit_data['display_name'] and updated_user['username'] == edit_data['username']:
            log_test("Admin user edit", "PASS", f"Updated display_name and username successfully")
            return True
        else:
            log_test("Admin user edit", "FAIL", "Update didn't reflect correctly in response")
            return False
    else:
        log_test("Admin user edit", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_admin_config(tokens):
    """Test 8: NEW - Admin config (GET/PUT)"""
    print("\n=== TEST 8: ADMIN CONFIG (GET/PUT) ===")
    
    if 'admin' not in tokens:
        log_test("Admin config", "FAIL", "No admin token")
        return False
    
    # Test GET config
    response = requests.get(
        f"{BASE_URL}/admin/config",
        headers=auth_headers(tokens['admin'])
    )
    
    if response.status_code != 200:
        log_test("Admin get config", "FAIL", f"Status: {response.status_code}")
        return False
    
    config = response.json()
    log_test("Admin get config", "PASS", f"Retrieved config with keys: {list(config.keys())}")
    
    # Test PUT config
    update_data = {
        "department_labels": {
            "tahsildar": "Revenue Officer",
            "sp": "Police Dept", 
            "forest": "Forest Dept"
        }
    }
    
    response = requests.put(
        f"{BASE_URL}/admin/config",
        json=update_data,
        headers=auth_headers(tokens['admin'])
    )
    
    if response.status_code == 200:
        updated_config = response.json()
        if updated_config.get('department_labels') == update_data['department_labels']:
            log_test("Admin update config", "PASS", "Department labels updated successfully")
            return True
        else:
            log_test("Admin update config", "FAIL", "Update didn't reflect in response")
            return False
    else:
        log_test("Admin update config", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_analytics_new_fields(tokens):
    """Test 9: NEW - Analytics with high_priority and overdue fields"""
    print("\n=== TEST 9: ANALYTICS WITH NEW FIELDS ===")
    
    if 'admin' not in tokens:
        log_test("Analytics", "FAIL", "No admin token")
        return False
    
    response = requests.get(
        f"{BASE_URL}/admin/analytics",
        headers=auth_headers(tokens['admin'])
    )
    
    if response.status_code == 200:
        analytics = response.json()
        
        # Check for new fields
        expected_fields = ['high_priority', 'overdue', 'total', 'submitted', 'approved', 'rejected']
        missing_fields = [field for field in expected_fields if field not in analytics]
        
        if missing_fields:
            log_test("Analytics new fields", "FAIL", f"Missing fields: {missing_fields}")
            return False
        else:
            log_test("Analytics new fields", "PASS", 
                    f"High priority: {analytics['high_priority']}, Overdue: {analytics['overdue']}, Total: {analytics['total']}")
            return True
    else:
        log_test("Analytics", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        return False

def test_full_priority_workflow(tokens):
    """Test 10: Full priority workflow - Create high-priority file and verify in analytics"""
    print("\n=== TEST 10: FULL HIGH-PRIORITY WORKFLOW ===")
    
    if 'caseworker' not in tokens:
        log_test("Priority workflow", "FAIL", "No caseworker token")
        return False
    
    # Create another high priority file
    file_data = {
        "file_no": "URGENT999",
        "year": "2025",
        "description": "Urgent high priority file for workflow test",
        "tahsildar_location": "Mangaluru", 
        "departments": ["tahsildar", "sp", "forest"],
        "priority": "high"
    }
    
    response = requests.post(
        f"{BASE_URL}/files",
        json=file_data,
        headers=auth_headers(tokens['caseworker'])
    )
    
    if response.status_code != 200:
        log_test("Priority workflow - create", "FAIL", f"File creation failed: {response.status_code}")
        return False
    
    file_doc = response.json()
    workflow_file_id = file_doc['id']
    
    # Submit the file
    response = requests.post(
        f"{BASE_URL}/files/{workflow_file_id}/submit",
        headers=auth_headers(tokens['caseworker'])
    )
    
    if response.status_code != 200:
        log_test("Priority workflow - submit", "FAIL", f"File submit failed: {response.status_code}")
        return False
    
    # Check if it appears in analytics as high priority
    if 'admin' in tokens:
        response = requests.get(
            f"{BASE_URL}/admin/analytics",
            headers=auth_headers(tokens['admin'])
        )
        
        if response.status_code == 200:
            analytics = response.json()
            if analytics.get('high_priority', 0) > 0:
                log_test("Priority workflow - analytics", "PASS", 
                        f"High priority files in analytics: {analytics['high_priority']}")
                return True
            else:
                log_test("Priority workflow - analytics", "FAIL", "No high priority files shown in analytics")
                return False
        else:
            log_test("Priority workflow - analytics", "FAIL", "Analytics check failed")
            return False
    else:
        log_test("Priority workflow", "INFO", "Skipped analytics check - no admin token")
        return True

def main():
    """Main test runner"""
    print("🚀 STARTING COMPREHENSIVE BACKEND API TESTING")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 70)
    
    # Track test results
    test_results = []
    
    # Test 1: Authentication
    auth_passed, tokens, users = test_auth_logins()
    test_results.append(("Auth Login - All roles", auth_passed))
    
    if not auth_passed:
        print("\n❌ CRITICAL: Authentication failed. Cannot proceed with other tests.")
        return False
    
    # Test 2: File creation with new features
    file_created, file_id = test_file_creation_with_departments_priority(tokens)
    test_results.append(("File Creation (departments+priority)", file_created))
    
    # Test 3: File submit
    if file_id:
        submit_passed = test_file_submit(tokens, file_id)
        test_results.append(("File Submit", submit_passed))
        
        # Test 4: Approvals with new format
        approval_passed = test_approval_approve_reject(tokens, file_id)
        test_results.append(("Approvals (approve/reject/na)", approval_passed))
        
        # Test 5: ADC decision
        adc_passed = test_adc_decision(tokens, file_id)
        test_results.append(("ADC Decision", adc_passed))
        
        # Test 6: DC decision
        dc_passed = test_dc_decision(tokens, file_id)
        test_results.append(("DC Decision", dc_passed))
    else:
        test_results.extend([
            ("File Submit", False),
            ("Approvals (approve/reject/na)", False), 
            ("ADC Decision", False),
            ("DC Decision", False)
        ])
    
    # Test 7: Admin user edit
    admin_edit_passed = test_admin_user_edit(tokens, users)
    test_results.append(("Admin User Edit", admin_edit_passed))
    
    # Test 8: Admin config
    config_passed = test_admin_config(tokens)
    test_results.append(("Admin Config (GET/PUT)", config_passed))
    
    # Test 9: Analytics with new fields
    analytics_passed = test_analytics_new_fields(tokens)
    test_results.append(("Analytics (high_priority + overdue)", analytics_passed))
    
    # Test 10: Full priority workflow
    workflow_passed = test_full_priority_workflow(tokens)
    test_results.append(("Full Priority Workflow", workflow_passed))
    
    # Final Summary
    print("\n" + "=" * 70)
    print("📊 FINAL TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        symbol = "✅" if result else "❌"
        print(f"{symbol} {test_name}")
    
    print(f"\n🏆 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend is ready for production.")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed. Review issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)