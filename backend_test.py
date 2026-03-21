#!/usr/bin/env python3
"""
Backend Test Suite for Government File Tracking App - Department Privacy Feature
Tests the new Department Privacy feature where department users can only see their own approval status.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://dept-workflow-2.preview.emergentagent.com/api"

class TestRunner:
    def __init__(self):
        self.tokens = {}
        self.test_file_id = None
        self.passed = 0
        self.failed = 0
        
    def log(self, message: str, level: str = "INFO"):
        print(f"[{level}] {message}")
        
    def login_user(self, username: str, password: str) -> Optional[str]:
        """Login user and return token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json={"username": username, "password": password})
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                self.tokens[username] = token
                self.log(f"✅ Login successful for {username} (role: {data['user']['role']})")
                return token
            else:
                self.log(f"❌ Login failed for {username}: {response.status_code} - {response.text}", "ERROR")
                return None
        except Exception as e:
            self.log(f"❌ Login error for {username}: {str(e)}", "ERROR")
            return None
    
    def make_request(self, method: str, endpoint: str, token: str, data: Dict = None) -> requests.Response:
        """Make authenticated request"""
        headers = {"Authorization": f"Bearer {token}"}
        if method.upper() == "GET":
            return requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        elif method.upper() == "POST":
            return requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data)
        elif method.upper() == "PUT":
            return requests.put(f"{BASE_URL}{endpoint}", headers=headers, json=data)
        elif method.upper() == "DELETE":
            return requests.delete(f"{BASE_URL}{endpoint}", headers=headers)
    
    def test_department_privacy_workflow(self):
        """Test the complete Department Privacy workflow"""
        self.log("🚀 Starting Department Privacy Feature Test")
        
        # Step 1: Login as caseworker
        self.log("\n=== Step 1: Login as caseworker ===")
        caseworker_token = self.login_user("caseworker", "case123")
        if not caseworker_token:
            self.failed += 1
            return False
        
        # Step 2: Create file routed to all 3 departments
        self.log("\n=== Step 2: Create file routed to all 3 departments ===")
        file_data = {
            "file_no": "PRIV001",
            "year": "2026", 
            "description": "Privacy Test File",
            "tahsildar_location": "Mangaluru",
            "departments": ["tahsildar", "sp", "forest"],
            "priority": "normal"
        }
        
        response = self.make_request("POST", "/files", caseworker_token, file_data)
        if response.status_code == 200:
            file_info = response.json()
            self.test_file_id = file_info["id"]
            self.log(f"✅ File created successfully: {file_info['file_number']} (ID: {self.test_file_id})")
            self.passed += 1
        else:
            self.log(f"❌ File creation failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
            return False
        
        # Step 3: Submit the file
        self.log("\n=== Step 3: Submit the file ===")
        response = self.make_request("POST", f"/files/{self.test_file_id}/submit", caseworker_token)
        if response.status_code == 200:
            self.log("✅ File submitted successfully")
            self.passed += 1
        else:
            self.log(f"❌ File submission failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
            return False
        
        # Step 4-6: Test SP user privacy
        self.log("\n=== Step 4-6: Test SP user privacy ===")
        sp_token = self.login_user("sp", "sp123")
        if not sp_token:
            self.failed += 1
            return False
            
        # Test SP file list - should only see SP approval
        response = self.make_request("GET", "/files", sp_token)
        if response.status_code == 200:
            files = response.json()
            test_file = next((f for f in files if f["id"] == self.test_file_id), None)
            if test_file:
                approvals_summary = test_file.get("approvals_summary", {})
                if "sp" in approvals_summary and "tahsildar" not in approvals_summary and "forest" not in approvals_summary:
                    self.log("✅ SP file list privacy: Only SP approval visible in approvals_summary")
                    self.passed += 1
                else:
                    self.log(f"❌ SP file list privacy FAILED: approvals_summary = {approvals_summary}", "ERROR")
                    self.failed += 1
            else:
                self.log("❌ SP cannot see the test file in list", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ SP file list failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Test SP file detail - should only see SP approval
        response = self.make_request("GET", f"/files/{self.test_file_id}", sp_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            sp_approvals = [a for a in approvals if a["department"] == "sp"]
            other_approvals = [a for a in approvals if a["department"] != "sp"]
            
            if len(sp_approvals) == 1 and len(other_approvals) == 0:
                self.log("✅ SP file detail privacy: Only SP approval visible in approvals array")
                self.passed += 1
            else:
                self.log(f"❌ SP file detail privacy FAILED: Found {len(sp_approvals)} SP approvals, {len(other_approvals)} other approvals", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ SP file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Step 7-9: Test Forest user privacy
        self.log("\n=== Step 7-9: Test Forest user privacy ===")
        forest_token = self.login_user("forest", "forest123")
        if not forest_token:
            self.failed += 1
            return False
            
        # Test Forest file list
        response = self.make_request("GET", "/files", forest_token)
        if response.status_code == 200:
            files = response.json()
            test_file = next((f for f in files if f["id"] == self.test_file_id), None)
            if test_file:
                approvals_summary = test_file.get("approvals_summary", {})
                if "forest" in approvals_summary and "tahsildar" not in approvals_summary and "sp" not in approvals_summary:
                    self.log("✅ Forest file list privacy: Only Forest approval visible in approvals_summary")
                    self.passed += 1
                else:
                    self.log(f"❌ Forest file list privacy FAILED: approvals_summary = {approvals_summary}", "ERROR")
                    self.failed += 1
            else:
                self.log("❌ Forest cannot see the test file in list", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ Forest file list failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Test Forest file detail
        response = self.make_request("GET", f"/files/{self.test_file_id}", forest_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            forest_approvals = [a for a in approvals if a["department"] == "forest"]
            other_approvals = [a for a in approvals if a["department"] != "forest"]
            
            if len(forest_approvals) == 1 and len(other_approvals) == 0:
                self.log("✅ Forest file detail privacy: Only Forest approval visible in approvals array")
                self.passed += 1
            else:
                self.log(f"❌ Forest file detail privacy FAILED: Found {len(forest_approvals)} Forest approvals, {len(other_approvals)} other approvals", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ Forest file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Step 10-12: Test Tahsildar user privacy
        self.log("\n=== Step 10-12: Test Tahsildar user privacy ===")
        tah_token = self.login_user("tah_mangaluru", "tah123")
        if not tah_token:
            self.failed += 1
            return False
            
        # Test Tahsildar file list
        response = self.make_request("GET", "/files", tah_token)
        if response.status_code == 200:
            files = response.json()
            test_file = next((f for f in files if f["id"] == self.test_file_id), None)
            if test_file:
                approvals_summary = test_file.get("approvals_summary", {})
                if "tahsildar" in approvals_summary and "sp" not in approvals_summary and "forest" not in approvals_summary:
                    self.log("✅ Tahsildar file list privacy: Only Tahsildar approval visible in approvals_summary")
                    self.passed += 1
                else:
                    self.log(f"❌ Tahsildar file list privacy FAILED: approvals_summary = {approvals_summary}", "ERROR")
                    self.failed += 1
            else:
                self.log("❌ Tahsildar cannot see the test file in list", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ Tahsildar file list failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Test Tahsildar file detail
        response = self.make_request("GET", f"/files/{self.test_file_id}", tah_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            tah_approvals = [a for a in approvals if a["department"] == "tahsildar"]
            other_approvals = [a for a in approvals if a["department"] != "tahsildar"]
            
            if len(tah_approvals) == 1 and len(other_approvals) == 0:
                self.log("✅ Tahsildar file detail privacy: Only Tahsildar approval visible in approvals array")
                self.passed += 1
            else:
                self.log(f"❌ Tahsildar file detail privacy FAILED: Found {len(tah_approvals)} Tahsildar approvals, {len(other_approvals)} other approvals", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ Tahsildar file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Step 13-14: Test Admin can see all approvals
        self.log("\n=== Step 13-14: Test Admin can see all approvals ===")
        admin_token = self.login_user("admin", "admin123")
        if not admin_token:
            self.failed += 1
            return False
            
        response = self.make_request("GET", f"/files/{self.test_file_id}", admin_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            departments = {a["department"] for a in approvals}
            
            if "tahsildar" in departments and "sp" in departments and "forest" in departments:
                self.log("✅ Admin can see ALL 3 department approvals")
                self.passed += 1
            else:
                self.log(f"❌ Admin privacy FAILED: Only sees departments {departments}, expected all 3", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ Admin file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Step 15-16: Test ADC can see all approvals
        self.log("\n=== Step 15-16: Test ADC can see all approvals ===")
        adc_token = self.login_user("ADC", "adc123")
        if not adc_token:
            self.failed += 1
            return False
            
        response = self.make_request("GET", f"/files/{self.test_file_id}", adc_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            departments = {a["department"] for a in approvals}
            
            if "tahsildar" in departments and "sp" in departments and "forest" in departments:
                self.log("✅ ADC can see ALL 3 department approvals")
                self.passed += 1
            else:
                self.log(f"❌ ADC privacy FAILED: Only sees departments {departments}, expected all 3", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ ADC file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Step 17-18: Test DC can see all approvals
        self.log("\n=== Step 17-18: Test DC can see all approvals ===")
        dc_token = self.login_user("DC", "dc123")
        if not dc_token:
            self.failed += 1
            return False
            
        response = self.make_request("GET", f"/files/{self.test_file_id}", dc_token)
        if response.status_code == 200:
            file_detail = response.json()
            approvals = file_detail.get("approvals", [])
            departments = {a["department"] for a in approvals}
            
            if "tahsildar" in departments and "sp" in departments and "forest" in departments:
                self.log("✅ DC can see ALL 3 department approvals")
                self.passed += 1
            else:
                self.log(f"❌ DC privacy FAILED: Only sees departments {departments}, expected all 3", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ DC file detail failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        # Test audit log filtering for department users
        self.log("\n=== Testing Audit Log Filtering ===")
        
        # First, let's make some approval decisions to generate audit logs
        self.log("Making approval decisions to generate audit logs...")
        
        # SP approval
        sp_approval_data = {"decision": "approve", "remark": "SP approves this file"}
        response = self.make_request("POST", f"/files/{self.test_file_id}/approval", sp_token, sp_approval_data)
        if response.status_code == 200:
            self.log("✅ SP approval submitted")
        else:
            self.log(f"⚠️ SP approval failed: {response.status_code} - {response.text}")
        
        # Forest approval
        forest_approval_data = {"decision": "reject", "remark": "Forest rejects this file"}
        response = self.make_request("POST", f"/files/{self.test_file_id}/approval", forest_token, forest_approval_data)
        if response.status_code == 200:
            self.log("✅ Forest approval submitted")
        else:
            self.log(f"⚠️ Forest approval failed: {response.status_code} - {response.text}")
        
        # Now test audit log filtering for SP user
        response = self.make_request("GET", f"/files/{self.test_file_id}", sp_token)
        if response.status_code == 200:
            file_detail = response.json()
            audit_logs = file_detail.get("audit_log", [])
            
            # Check if SP can see forest approval decision in audit logs
            forest_decision_logs = [log for log in audit_logs if "forest decision" in log.get("details", "").lower()]
            
            if len(forest_decision_logs) == 0:
                self.log("✅ Audit log filtering: SP cannot see Forest approval decisions")
                self.passed += 1
            else:
                self.log(f"❌ Audit log filtering FAILED: SP can see {len(forest_decision_logs)} Forest decision logs", "ERROR")
                self.failed += 1
        else:
            self.log(f"❌ SP audit log test failed: {response.status_code} - {response.text}", "ERROR")
            self.failed += 1
        
        return True
    
    def run_tests(self):
        """Run all tests"""
        try:
            self.test_department_privacy_workflow()
            
            self.log(f"\n🎯 TEST SUMMARY:")
            self.log(f"✅ Passed: {self.passed}")
            self.log(f"❌ Failed: {self.failed}")
            self.log(f"📊 Success Rate: {(self.passed/(self.passed+self.failed)*100):.1f}%")
            
            if self.failed == 0:
                self.log("🎉 ALL DEPARTMENT PRIVACY TESTS PASSED!")
                return True
            else:
                self.log("⚠️ Some tests failed - Department Privacy feature needs attention")
                return False
                
        except Exception as e:
            self.log(f"❌ Test execution error: {str(e)}", "ERROR")
            return False

if __name__ == "__main__":
    runner = TestRunner()
    success = runner.run_tests()
    sys.exit(0 if success else 1)