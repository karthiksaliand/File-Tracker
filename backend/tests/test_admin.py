"""Admin operations and notification tests"""
import pytest
import requests
import os

from conftest import BASE_URL

class TestAdminOperations:
    """Test admin-only operations"""

    def test_get_analytics(self, api_client, admin_token):
        """Test admin can get analytics"""
        response = api_client.get(f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "draft" in data
        assert "submitted" in data
        assert "approved" in data
        assert "rejected" in data
        assert "department_pending" in data
        assert isinstance(data["total"], int)

    def test_list_users(self, api_client, admin_token):
        """Test admin can list all users"""
        response = api_client.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 15  # At least the seeded users

    def test_list_users_unauthorized(self, api_client, caseworker_token):
        """Test non-admin cannot list users"""
        response = api_client.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 403

    def test_create_user(self, api_client, admin_token):
        """Test admin can create new user"""
        import time
        username = f"TEST_newuser_{int(time.time())}"
        response = api_client.post(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": username,
                "password": "testpass123",
                "role": "case_worker",
                "display_name": "Test New User",
                "department": "Filing"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == username
        assert data["role"] == "case_worker"

    def test_reset_user_password(self, api_client, admin_token):
        """Test admin can reset user password and verify new password works"""
        import time
        # Create a temporary test user for password reset
        test_username = f"TEST_pwdreset_{int(time.time())}"
        create_response = api_client.post(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": test_username,
                "password": "oldpass123",
                "role": "case_worker",
                "display_name": "Test Password Reset User",
                "department": "Filing"
            }
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]

        # Verify old password works
        login_old = api_client.post(f"{BASE_URL}/api/auth/login",
            json={"username": test_username, "password": "oldpass123"}
        )
        assert login_old.status_code == 200

        # Reset password
        reset_response = api_client.post(f"{BASE_URL}/api/admin/users/{user_id}/reset-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"new_password": "newpass123"}
        )
        assert reset_response.status_code == 200
        assert reset_response.json()["message"] == "Password reset successfully"

        # Verify old password no longer works
        login_old_retry = api_client.post(f"{BASE_URL}/api/auth/login",
            json={"username": test_username, "password": "oldpass123"}
        )
        assert login_old_retry.status_code == 401

        # Verify new password works
        login_new = api_client.post(f"{BASE_URL}/api/auth/login",
            json={"username": test_username, "password": "newpass123"}
        )
        assert login_new.status_code == 200

    def test_get_audit_logs(self, api_client, admin_token):
        """Test admin can view audit logs"""
        response = api_client.get(f"{BASE_URL}/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have logs from previous operations
        if len(data) > 0:
            assert "action" in data[0]
            assert "user_name" in data[0]
            assert "timestamp" in data[0]

    def test_get_credentials_list(self, api_client, admin_token):
        """Test admin can get credentials list"""
        response = api_client.get(f"{BASE_URL}/api/admin/credentials",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "note" in data
        assert "users" in data

class TestNotifications:
    """Test notification system"""

    def test_get_notifications(self, api_client, admin_token):
        """Test user can get notifications"""
        response = api_client.get(f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_unread_count(self, api_client, admin_token):
        """Test get unread notification count"""
        response = api_client.get(f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)

    def test_mark_all_read(self, api_client, admin_token):
        """Test marking all notifications as read"""
        response = api_client.post(f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "All marked as read"
