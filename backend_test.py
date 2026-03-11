#!/usr/bin/env python3
"""
Backend API Testing for Government File Tracking Application
Tests all high-priority backend APIs with proper authentication workflow
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Use the production URL from frontend .env
BASE_URL = "https://file-approval-hub-1.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.tokens = {}
        self.test_file_id = None
        self.test_results = {
            "passed": [],
            "failed": [],
            "errors": []
        }
        
    def log_result(self, test_name: str, success: bool, details: str = "", error: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "details": details,
            "error": error
        }
        if success:
            self.test_results["passed"].append(result)
            print(f"✅ {test_name}: {details}")
        else:
            self.test_results["failed"].append(result)
            print(f"❌ {test_name}: {error}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    auth_token: str = None, params: Dict = None) -> Dict[str, Any]:
        """Make HTTP request with proper error handling"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except requests.exceptions.RequestException as e:
            return {
                "status_code": 0,
                "data": {},
                "success": False,
                "error": str(e)
            }
        except json.JSONDecodeError:
            return {
                "status_code": response.status_code,
                "data": {"raw_response": response.text},
                "success": 200 <= response.status_code < 300
            }
    
    def test_auth_login(self):
        """Test authentication for different user roles"""
        print("\n🔐 Testing Authentication...")
        
        test_users = [
            {"username": "caseworker", "password": "case123", "role": "case_worker"},
            {"username": "admin", "password": "admin123", "role": "admin"},
            {"username": "tah_mangaluru", "password": "tah123", "role": "tahsildar"},
            {"username": "sp", "password": "sp123", "role": "sp"},
            {"username": "forest", "password": "forest123", "role": "forest_officer"},
            {"username": "dc", "password": "dc123", "role": "dc"}
        ]
        
        auth_success = True
        for user in test_users:
            result = self.make_request("POST", "/auth/login", {
                "username": user["username"],
                "password": user["password"]
            })
            
            if result["success"] and "token" in result["data"]:
                self.tokens[user["role"]] = result["data"]["token"]
                user_info = result["data"].get("user", {})
                self.log_result(
                    f"Auth Login - {user['username']}", 
                    True, 
                    f"Role: {user_info.get('role', 'unknown')}, Token received"
                )
            else:
                auth_success = False
                error_msg = result["data"].get("detail", result.get("error", "Unknown error"))
                self.log_result(
                    f"Auth Login - {user['username']}", 
                    False, 
                    error=f"Status: {result['status_code']}, Error: {error_msg}"
                )
        
        return auth_success
    
    def test_file_creation_new_fields(self):
        """Test file creation with new fields (file_no, year, description, tahsildar_location)"""
        print("\n📁 Testing File Creation with New Fields...")
        
        if "case_worker" not in self.tokens:
            self.log_result("File Creation", False, error="No case_worker token available")
            return False
            
        # Test with new required fields
        file_data = {
            "file_no": "TEST123",
            "year": "2025",
            "description": "Test file for backend validation",
            "tahsildar_location": "Mangaluru"
        }
        
        result = self.make_request(
            "POST", "/files", file_data, 
            auth_token=self.tokens["case_worker"]
        )
        
        if result["success"]:
            file_info = result["data"]
            if all(key in file_info for key in ["id", "file_number", "file_no", "year", "description", "tahsildar_location"]):
                self.test_file_id = file_info["id"]
                expected_file_number = f"DK/FILE/{file_data['year']}/{file_data['file_no']}"
                
                if file_info["file_number"] == expected_file_number:
                    self.log_result(
                        "File Creation with New Fields", 
                        True, 
                        f"Created file {file_info['file_number']} with ID {self.test_file_id}"
                    )
                    return True
                else:
                    self.log_result(
                        "File Creation with New Fields", 
                        False, 
                        error=f"File number mismatch. Expected: {expected_file_number}, Got: {file_info['file_number']}"
                    )
            else:
                missing_fields = [k for k in ["id", "file_number", "file_no", "year", "description", "tahsildar_location"] 
                                if k not in file_info]
                self.log_result(
                    "File Creation with New Fields", 
                    False, 
                    error=f"Missing fields in response: {missing_fields}"
                )
        else:
            error_msg = result["data"].get("detail", result.get("error", "Unknown error"))
            self.log_result(
                "File Creation with New Fields", 
                False, 
                error=f"Status: {result['status_code']}, Error: {error_msg}"
            )
            
        return False
    
    def test_old_fields_rejected(self):
        """Test that old applicant fields are no longer accepted"""
        print("\n🚫 Testing Old Fields Rejection...")
        
        if "case_worker" not in self.tokens:
            self.log_result("Old Fields Rejection", False, error="No case_worker token available")
            return False
            
        # Try to create file with old fields
        old_file_data = {
            "applicant_name": "Test Applicant",
            "applicant_phone": "9876543210",
            "applicant_address": "Test Address",
            "description": "Should fail"
        }
        
        result = self.make_request(
            "POST", "/files", old_file_data, 
            auth_token=self.tokens["case_worker"]
        )
        
        # This should fail
        if not result["success"]:
            self.log_result(
                "Old Fields Rejection", 
                True, 
                f"Correctly rejected old fields - Status: {result['status_code']}"
            )
            return True
        else:
            self.log_result(
                "Old Fields Rejection", 
                False, 
                error="Should have rejected old applicant fields but accepted them"
            )
            return False
    
    def test_file_list_and_search(self):
        """Test file listing and search by file_no"""
        print("\n📋 Testing File List and Search...")
        
        if "case_worker" not in self.tokens:
            self.log_result("File List and Search", False, error="No case_worker token available")
            return False
        
        # Test basic file listing
        result = self.make_request(
            "GET", "/files", 
            auth_token=self.tokens["case_worker"]
        )
        
        if result["success"]:
            files = result["data"]
            if isinstance(files, list):
                self.log_result(
                    "File List", 
                    True, 
                    f"Retrieved {len(files)} files"
                )
            else:
                self.log_result("File List", False, error="Response is not a list")
                return False
        else:
            error_msg = result["data"].get("detail", result.get("error", "Unknown error"))
            self.log_result("File List", False, error=f"Status: {result['status_code']}, Error: {error_msg}")
            return False
        
        # Test search by file_no
        search_result = self.make_request(
            "GET", "/files", 
            params={"search": "TEST123"},
            auth_token=self.tokens["case_worker"]
        )
        
        if search_result["success"]:
            search_files = search_result["data"]
            if isinstance(search_files, list):
                # Check if our test file is found
                found = any(f.get("file_no") == "TEST123" for f in search_files)
                if found:
                    self.log_result(
                        "File Search by file_no", 
                        True, 
                        f"Found {len(search_files)} files matching 'TEST123'"
                    )
                    return True
                else:
                    self.log_result(
                        "File Search by file_no", 
                        False, 
                        error="Search didn't return the created test file"
                    )
            else:
                self.log_result("File Search by file_no", False, error="Search response is not a list")
        else:
            error_msg = search_result["data"].get("detail", search_result.get("error", "Unknown error"))
            self.log_result("File Search by file_no", False, error=f"Search failed - Status: {search_result['status_code']}, Error: {error_msg}")
            
        return False
    
    def test_file_submit_and_approvals(self):
        """Test file submission and parallel approvals workflow"""
        print("\n📤 Testing File Submit and Parallel Approvals...")
        
        if not self.test_file_id:
            self.log_result("File Submit", False, error="No test file ID available")
            return False
            
        # Submit file
        submit_result = self.make_request(
            "POST", f"/files/{self.test_file_id}/submit",
            auth_token=self.tokens["case_worker"]
        )
        
        if not submit_result["success"]:
            error_msg = submit_result["data"].get("detail", submit_result.get("error", "Unknown error"))
            self.log_result("File Submit", False, error=f"Status: {submit_result['status_code']}, Error: {error_msg}")
            return False
        
        # Check file status changed
        file_info = submit_result["data"]
        if file_info.get("status") == "submitted" and file_info.get("is_locked"):
            self.log_result(
                "File Submit", 
                True, 
                f"File submitted successfully. Status: {file_info['status']}, Locked: {file_info['is_locked']}"
            )
        else:
            self.log_result(
                "File Submit", 
                False, 
                error=f"File status not updated correctly. Status: {file_info.get('status')}, Locked: {file_info.get('is_locked')}"
            )
            return False
        
        # Test parallel approvals
        approval_tests = [
            {"role": "tahsildar", "token_key": "tahsildar", "decision": "yes", "remark": "Tahsildar approved"},
            {"role": "sp", "token_key": "sp", "decision": "yes", "remark": "SP approved"},
            {"role": "forest_officer", "token_key": "forest_officer", "decision": "no", "remark": "Forest concerns"}
        ]
        
        approval_success = True
        for approval_test in approval_tests:
            token_key = approval_test["token_key"]
            if token_key not in self.tokens:
                self.log_result(f"Approval - {approval_test['role']}", False, error=f"No {token_key} token available")
                approval_success = False
                continue
                
            approval_result = self.make_request(
                "POST", f"/files/{self.test_file_id}/approval",
                {
                    "decision": approval_test["decision"],
                    "remark": approval_test["remark"]
                },
                auth_token=self.tokens[token_key]
            )
            
            if approval_result["success"]:
                self.log_result(
                    f"Parallel Approval - {approval_test['role']}", 
                    True, 
                    f"Decision: {approval_test['decision']}, Remark: {approval_test['remark']}"
                )
            else:
                approval_success = False
                error_msg = approval_result["data"].get("detail", approval_result.get("error", "Unknown error"))
                self.log_result(
                    f"Parallel Approval - {approval_test['role']}", 
                    False, 
                    error=f"Status: {approval_result['status_code']}, Error: {error_msg}"
                )
        
        return approval_success
    
    def test_admin_file_operations(self):
        """Test admin file edit and delete operations"""
        print("\n👑 Testing Admin File Operations...")
        
        if "admin" not in self.tokens:
            self.log_result("Admin Operations", False, error="No admin token available")
            return False
        
        if not self.test_file_id:
            self.log_result("Admin Edit", False, error="No test file ID available")
            return False
            
        # Test admin file edit with new fields
        edit_data = {
            "file_no": "ADMIN123",
            "year": "2026",
            "description": "Admin updated description",
            "tahsildar_location": "Bantwal"
        }
        
        edit_result = self.make_request(
            "PUT", f"/admin/files/{self.test_file_id}",
            edit_data,
            auth_token=self.tokens["admin"]
        )
        
        if edit_result["success"]:
            updated_file = edit_result["data"]
            expected_file_number = f"DK/FILE/{edit_data['year']}/{edit_data['file_no']}"
            
            if (updated_file.get("file_no") == edit_data["file_no"] and 
                updated_file.get("year") == edit_data["year"] and
                updated_file.get("file_number") == expected_file_number):
                self.log_result(
                    "Admin File Edit", 
                    True, 
                    f"Updated file_no to {edit_data['file_no']}, year to {edit_data['year']}, file_number to {expected_file_number}"
                )
            else:
                self.log_result(
                    "Admin File Edit", 
                    False, 
                    error=f"Fields not updated correctly. Got file_no: {updated_file.get('file_no')}, year: {updated_file.get('year')}, file_number: {updated_file.get('file_number')}"
                )
                return False
        else:
            error_msg = edit_result["data"].get("detail", edit_result.get("error", "Unknown error"))
            self.log_result("Admin File Edit", False, error=f"Status: {edit_result['status_code']}, Error: {error_msg}")
            return False
        
        # Test admin file delete
        delete_result = self.make_request(
            "DELETE", f"/admin/files/{self.test_file_id}",
            auth_token=self.tokens["admin"]
        )
        
        if delete_result["success"]:
            self.log_result(
                "Admin File Delete", 
                True, 
                f"File deleted successfully: {delete_result['data'].get('message', 'No message')}"
            )
            return True
        else:
            error_msg = delete_result["data"].get("detail", delete_result.get("error", "Unknown error"))
            self.log_result("Admin File Delete", False, error=f"Status: {delete_result['status_code']}, Error: {error_msg}")
            return False
    
    def test_dc_decision(self):
        """Test DC decision functionality"""
        print("\n⚖️ Testing DC Decision...")
        
        if "dc" not in self.tokens:
            self.log_result("DC Decision", False, error="No DC token available")
            return False
        
        # Create a new file for DC decision testing
        if "case_worker" not in self.tokens:
            self.log_result("DC Decision Setup", False, error="No case_worker token for setup")
            return False
            
        # Create and submit a file for DC decision
        file_data = {
            "file_no": "DC001",
            "year": "2025",
            "description": "File for DC decision test",
            "tahsildar_location": "Mangaluru"
        }
        
        create_result = self.make_request(
            "POST", "/files", file_data,
            auth_token=self.tokens["case_worker"]
        )
        
        if not create_result["success"]:
            self.log_result("DC Decision Setup", False, error="Failed to create test file for DC decision")
            return False
        
        dc_test_file_id = create_result["data"]["id"]
        
        # Submit the file
        submit_result = self.make_request(
            "POST", f"/files/{dc_test_file_id}/submit",
            auth_token=self.tokens["case_worker"]
        )
        
        if not submit_result["success"]:
            self.log_result("DC Decision Setup", False, error="Failed to submit file for DC decision")
            return False
        
        # Test DC decision
        dc_decision_data = {
            "decision": "accept",
            "remark": "DC approved the application"
        }
        
        dc_result = self.make_request(
            "POST", f"/files/{dc_test_file_id}/dc-decision",
            dc_decision_data,
            auth_token=self.tokens["dc"]
        )
        
        if dc_result["success"]:
            self.log_result(
                "DC Decision", 
                True, 
                f"DC decision: {dc_decision_data['decision']}, Message: {dc_result['data'].get('message', 'Success')}"
            )
            
            # Cleanup - delete the test file
            if "admin" in self.tokens:
                self.make_request(
                    "DELETE", f"/admin/files/{dc_test_file_id}",
                    auth_token=self.tokens["admin"]
                )
            
            return True
        else:
            error_msg = dc_result["data"].get("detail", dc_result.get("error", "Unknown error"))
            self.log_result("DC Decision", False, error=f"Status: {dc_result['status_code']}, Error: {error_msg}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print(f"🚀 Starting Backend API Tests for Government File Tracking")
        print(f"🌐 Backend URL: {BASE_URL}")
        print("=" * 60)
        
        # Test sequence based on workflow dependencies
        tests = [
            ("Authentication", self.test_auth_login),
            ("File Creation New Fields", self.test_file_creation_new_fields),
            ("Old Fields Rejection", self.test_old_fields_rejected),
            ("File List and Search", self.test_file_list_and_search),
            ("File Submit and Approvals", self.test_file_submit_and_approvals),
            ("DC Decision", self.test_dc_decision),
            ("Admin File Operations", self.test_admin_file_operations),
        ]
        
        for test_name, test_func in tests:
            try:
                success = test_func()
                if not success:
                    print(f"⚠️  {test_name} failed - continuing with remaining tests...")
            except Exception as e:
                self.log_result(test_name, False, error=f"Exception: {str(e)}")
                print(f"💥 {test_name} crashed: {str(e)}")
        
        # Print final summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 BACKEND TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results["passed"]) + len(self.test_results["failed"])
        passed_count = len(self.test_results["passed"])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {len(self.test_results['failed'])}")
        print(f"Success Rate: {(passed_count/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        if self.test_results["failed"]:
            print("\n❌ FAILED TESTS:")
            for fail in self.test_results["failed"]:
                print(f"  • {fail['test']}: {fail['error']}")
        
        if self.test_results["passed"]:
            print(f"\n✅ PASSED TESTS ({len(self.test_results['passed'])}):")
            for success in self.test_results["passed"]:
                print(f"  • {success['test']}: {success['details']}")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()