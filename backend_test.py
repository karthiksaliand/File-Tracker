#!/usr/bin/env python3
"""
Backend Test Suite for Government File Tracking App - Login Config Testing
Tests the public login config endpoint and admin config management functionality.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://dept-workflow-2.preview.emergentagent.com/api"

class LoginConfigTestRunner:
    def __init__(self):
        self.admin_token = None
        self.passed = 0
        self.failed = 0
        self.original_sp_label = None
        
    def log(self, message: str, level: str = "INFO"):
        print(f"[{level}] {message}")
        
    def login_admin(self) -> Optional[str]:
        """Login as admin and return token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json={"username": "admin", "password": "admin123"})
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                self.admin_token = token
                self.log(f"✅ Admin login successful")
                return token
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return None
        except Exception as e:
            self.log(f"❌ Admin login error: {str(e)}", "ERROR")
            return None
    
    def make_authenticated_request(self, method: str, endpoint: str, data: Dict = None) -> requests.Response:
        """Make authenticated request with admin token"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        if method.upper() == "GET":
            return requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        elif method.upper() == "PUT":
            return requests.put(f"{BASE_URL}{endpoint}", headers=headers, json=data)
    
    def test_public_login_config(self):
        """Test 1: GET /api/public/login-config (NO auth token needed)"""
        self.log("\n=== Test 1: Public Login Config Endpoint ===")
        
        try:
            # Test without authentication
            response = requests.get(f"{BASE_URL}/public/login-config")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Public login config endpoint accessible (200 OK)")
                
                # Check if response has required fields
                if "role_labels" in data and "tahsildar_locations" in data:
                    self.log(f"✅ Response contains required fields: role_labels and tahsildar_locations")
                    self.passed += 1
                    
                    # Store original SP label for later restoration
                    self.original_sp_label = data["role_labels"].get("sp", "Superintendent of Police")
                    
                    # Verify expected roles are present
                    expected_roles = ["case_worker", "admin", "sp", "forest_officer", "adc", "dc", "tahsildar"]
                    role_labels = data["role_labels"]
                    missing_roles = [role for role in expected_roles if role not in role_labels]
                    
                    if not missing_roles:
                        self.log(f"✅ All expected roles present: {list(role_labels.keys())}")
                        self.passed += 1
                    else:
                        self.log(f"❌ Missing roles: {missing_roles}", "ERROR")
                        self.failed += 1
                    
                    # Verify tahsildar_locations is an array
                    tahsildar_locations = data["tahsildar_locations"]
                    if isinstance(tahsildar_locations, list) and len(tahsildar_locations) > 0:
                        self.log(f"✅ tahsildar_locations is array with {len(tahsildar_locations)} locations: {tahsildar_locations[:3]}...")
                        self.passed += 1
                    else:
                        self.log(f"❌ tahsildar_locations is not a valid array: {type(tahsildar_locations)}", "ERROR")
                        self.failed += 1
                        
                    self.log(f"📋 Current role labels: {json.dumps(role_labels, indent=2)}")
                    
                else:
                    self.log(f"❌ Response missing required fields. Got: {list(data.keys())}", "ERROR")
                    self.failed += 1
            else:
                self.log(f"❌ Public login config failed: {response.status_code} - {response.text}", "ERROR")
                self.failed += 1
                
        except Exception as e:
            self.log(f"❌ Public login config test error: {str(e)}", "ERROR")
            self.failed += 1
    
    def test_admin_config_update(self):
        """Test 2-4: Admin config update functionality"""
        self.log("\n=== Test 2-4: Admin Config Update ===")
        
        # First login as admin
        if not self.login_admin():
            self.failed += 1
            return
        
        # Test 2: Get current admin config
        self.log("\n--- Test 2: Get Admin Config ---")
        try:
            response = self.make_authenticated_request("GET", "/admin/config")
            
            if response.status_code == 200:
                config_data = response.json()
                self.log(f"✅ Admin config retrieved successfully")
                self.passed += 1
                
                if "role_labels" in config_data:
                    current_sp_label = config_data["role_labels"].get("sp", "Superintendent of Police")
                    self.log(f"📋 Current SP label: '{current_sp_label}'")
                else:
                    self.log(f"⚠️ No role_labels in admin config, will create new one")
                    
            else:
                self.log(f"❌ Admin config retrieval failed: {response.status_code} - {response.text}", "ERROR")
                self.failed += 1
                return
                
        except Exception as e:
            self.log(f"❌ Admin config retrieval error: {str(e)}", "ERROR")
            self.failed += 1
            return
        
        # Test 3: Update SP role label
        self.log("\n--- Test 3: Update SP Role Label ---")
        try:
            new_sp_label = "SP - Police Department"
            update_data = {
                "role_labels": {
                    "case_worker": "Case Worker",
                    "admin": "System Admin", 
                    "tahsildar": "Tahsildar",
                    "sp": new_sp_label,  # Changed label
                    "forest_officer": "Forest Officer (DFO/DCF)",
                    "adc": "Asst. Commissioner (ADC)",
                    "dc": "Deputy Commissioner (DC)"
                }
            }
            
            response = self.make_authenticated_request("PUT", "/admin/config", update_data)
            
            if response.status_code == 200:
                self.log(f"✅ Admin config updated successfully")
                self.passed += 1
                
                # Verify the update
                updated_config = response.json()
                if updated_config.get("role_labels", {}).get("sp") == new_sp_label:
                    self.log(f"✅ SP label successfully updated to: '{new_sp_label}'")
                    self.passed += 1
                else:
                    self.log(f"❌ SP label not updated correctly. Got: '{updated_config.get('role_labels', {}).get('sp')}'", "ERROR")
                    self.failed += 1
                    
            else:
                self.log(f"❌ Admin config update failed: {response.status_code} - {response.text}", "ERROR")
                self.failed += 1
                return
                
        except Exception as e:
            self.log(f"❌ Admin config update error: {str(e)}", "ERROR")
            self.failed += 1
            return
        
        # Test 4: Verify public endpoint reflects the change
        self.log("\n--- Test 4: Verify Public Endpoint Reflects Change ---")
        try:
            response = requests.get(f"{BASE_URL}/public/login-config")
            
            if response.status_code == 200:
                data = response.json()
                public_sp_label = data.get("role_labels", {}).get("sp")
                
                if public_sp_label == new_sp_label:
                    self.log(f"✅ Public endpoint reflects updated SP label: '{public_sp_label}'")
                    self.passed += 1
                else:
                    self.log(f"❌ Public endpoint does not reflect change. Expected: '{new_sp_label}', Got: '{public_sp_label}'", "ERROR")
                    self.failed += 1
                    
            else:
                self.log(f"❌ Public endpoint verification failed: {response.status_code} - {response.text}", "ERROR")
                self.failed += 1
                
        except Exception as e:
            self.log(f"❌ Public endpoint verification error: {str(e)}", "ERROR")
            self.failed += 1
    
    def test_revert_changes(self):
        """Test 5: Revert the changes back"""
        self.log("\n=== Test 5: Revert Changes ===")
        
        if not self.admin_token:
            self.log("❌ No admin token available for revert", "ERROR")
            self.failed += 1
            return
        
        try:
            # Revert SP label back to original
            revert_data = {
                "role_labels": {
                    "case_worker": "Case Worker",
                    "admin": "System Admin",
                    "tahsildar": "Tahsildar", 
                    "sp": self.original_sp_label,  # Revert to original
                    "forest_officer": "Forest Officer (DFO/DCF)",
                    "adc": "Asst. Commissioner (ADC)",
                    "dc": "Deputy Commissioner (DC)"
                }
            }
            
            response = self.make_authenticated_request("PUT", "/admin/config", revert_data)
            
            if response.status_code == 200:
                self.log(f"✅ Config reverted successfully")
                self.passed += 1
                
                # Verify revert
                reverted_config = response.json()
                if reverted_config.get("role_labels", {}).get("sp") == self.original_sp_label:
                    self.log(f"✅ SP label reverted to original: '{self.original_sp_label}'")
                    self.passed += 1
                else:
                    self.log(f"❌ SP label not reverted correctly", "ERROR")
                    self.failed += 1
                    
                # Final verification with public endpoint
                public_response = requests.get(f"{BASE_URL}/public/login-config")
                if public_response.status_code == 200:
                    public_data = public_response.json()
                    final_sp_label = public_data.get("role_labels", {}).get("sp")
                    
                    if final_sp_label == self.original_sp_label:
                        self.log(f"✅ Public endpoint shows reverted SP label: '{final_sp_label}'")
                        self.passed += 1
                    else:
                        self.log(f"❌ Public endpoint does not show reverted label. Expected: '{self.original_sp_label}', Got: '{final_sp_label}'", "ERROR")
                        self.failed += 1
                        
            else:
                self.log(f"❌ Config revert failed: {response.status_code} - {response.text}", "ERROR")
                self.failed += 1
                
        except Exception as e:
            self.log(f"❌ Config revert error: {str(e)}", "ERROR")
            self.failed += 1
    
    def run_tests(self):
        """Run all login config tests"""
        self.log("🚀 Starting Login Config Tests")
        
        try:
            # Test 1: Public login config endpoint
            self.test_public_login_config()
            
            # Test 2-4: Admin config management
            self.test_admin_config_update()
            
            # Test 5: Revert changes
            self.test_revert_changes()
            
            # Summary
            self.log(f"\n🎯 LOGIN CONFIG TEST SUMMARY:")
            self.log(f"✅ Passed: {self.passed}")
            self.log(f"❌ Failed: {self.failed}")
            self.log(f"📊 Success Rate: {(self.passed/(self.passed+self.failed)*100):.1f}%")
            
            if self.failed == 0:
                self.log("🎉 ALL LOGIN CONFIG TESTS PASSED!")
                return True
            else:
                self.log("⚠️ Some tests failed - Login config functionality needs attention")
                return False
                
        except Exception as e:
            self.log(f"❌ Test execution error: {str(e)}", "ERROR")
            return False

if __name__ == "__main__":
    runner = LoginConfigTestRunner()
    success = runner.run_tests()
    sys.exit(0 if success else 1)