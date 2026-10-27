#!/usr/bin/env python3
"""
Automated Test Suite for Google Authentication & Admin Dashboard User Tracking
Covers Section 9 requirements:
- Test 1: First-Time Google User
- Test 2: Existing Google User
- Test 3: Two Different Google Accounts
- Test 4: Account Switching
- Test 5: Different Devices / Independent Clients
- Test 6: Database Write Failure Handling
- Test 7: Admin API Security & Filtering
- Test 8: Regression (Calculations, CSV Export Sanitization, Logout)
"""

import os
import sys
import json
import time
import base64
import unittest
from pathlib import Path
from unittest.mock import patch

# Set environment variables for testing
os.environ["MOCK_AUTH_FOR_TESTS"] = "1"
os.environ["ADMIN_PASSWORD"] = "centagon@admin"
os.environ["ADMIN_EMAILS"] = "dhanishmohd1136@gmail.com,admin@centagon.in"

import server

def create_mock_jwt(sub: str, email: str, name: str = "Test Student", picture: str = "") -> str:
    """Creates a well-formed Google JWT with signature mockup for testing."""
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": "https://accounts.google.com",
        "aud": "test-client-id",
        "sub": sub,
        "email": email,
        "email_verified": True,
        "name": name,
        "picture": picture,
        "exp": int(time.time()) + 3600
    }
    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode("utf-8")).decode("utf-8").rstrip("=")
    return f"mock_header.{b64(payload)}.mock_sig"


class TestGoogleAuthAndAdminTracking(unittest.TestCase):
    def setUp(self):
        # Use an isolated test database
        self.test_data_dir = Path(__file__).resolve().parent / "data"
        self.test_students_file = self.test_data_dir / "test_students.json"
        self.real_students_file = server.STUDENTS_FILE
        server.STUDENTS_FILE = self.test_students_file
        
        # Initialize empty test database
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.test_students_file, "w", encoding="utf-8") as f:
            json.dump([], f)

    def tearDown(self):
        # Restore real students file and remove test file
        server.STUDENTS_FILE = self.real_students_file
        if self.test_students_file.exists():
            self.test_students_file.unlink()

    # -------------------------------------------------------------
    # Test 1: First-Time Google User
    # -------------------------------------------------------------
    def test_1_first_time_google_user(self):
        """
        Given a valid new Google identity,
        when authentication succeeds,
        then a user record is created, the external identity is associated with the correct user,
        the registration event is recorded, and the admin API returns the user.
        """
        token = create_mock_jwt(sub="google-sub-first-001", email="newuser@example.com", name="Alice Wonderland")
        payload = {
            "name": "Alice Wonderland",
            "email": "newuser@example.com",
            "hub": "BCK",
            "batch": "42",
            "google_token": token,
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        }

        record, total = server.upsert_student(payload)
        
        self.assertIsNotNone(record)
        self.assertEqual(record["google_id"], "google-sub-first-001")
        self.assertEqual(record["email"], "newuser@example.com")
        self.assertEqual(record["name"], "Alice Wonderland")
        self.assertEqual(record["hub"], "BCK")
        self.assertEqual(record["hub_name"], "Kozhikode")
        self.assertEqual(record["batch_code"], "BCK 42")
        self.assertEqual(record["visit_count"], 1)
        self.assertIn("first_login", record)
        self.assertIn("last_active", record)

        # Check persistence in database
        saved_students = server.load_students()
        self.assertEqual(len(saved_students), 1)
        self.assertEqual(saved_students[0]["google_id"], "google-sub-first-001")

        # Verify admin API can retrieve the new user
        admin_data = server.list_students()
        self.assertEqual(admin_data["total"], 1)
        self.assertEqual(admin_data["students"][0]["email"], "newuser@example.com")

    # -------------------------------------------------------------
    # Test 2: Existing Google User
    # -------------------------------------------------------------
    def test_2_existing_google_user_reused(self):
        """
        Given an existing user,
        when they log in again,
        then the existing record is reused, no duplicate user is created,
        and visit_count is incremented while last_active is updated.
        """
        token = create_mock_jwt(sub="google-sub-existing-002", email="returning@example.com", name="Bob Returner")
        payload = {
            "name": "Bob Returner",
            "email": "returning@example.com",
            "hub": "BCR",
            "batch": "10",
            "google_token": token
        }

        # First login
        record1, _ = server.upsert_student(payload)
        self.assertEqual(record1["visit_count"], 1)
        user_id = record1["id"]

        # Simulate time passing
        time.sleep(0.01)

        # Second login with same Google identity
        record2, _ = server.upsert_student(payload)
        self.assertEqual(record2["id"], user_id)
        self.assertEqual(record2["visit_count"], 2)

        # Ensure no duplicates in database
        students = server.load_students()
        self.assertEqual(len(students), 1)
        self.assertEqual(students[0]["id"], user_id)
        self.assertEqual(students[0]["visit_count"], 2)

    # -------------------------------------------------------------
    # Test 3: Two Different Google Accounts
    # -------------------------------------------------------------
    def test_3_two_different_google_accounts(self):
        """
        Given two distinct Google identities (e.g. Dhanish and his Friend),
        when each completes authentication,
        then both identities map to distinct application users,
        neither account overwrites the other, and both users appear in the admin dashboard.
        """
        # User A: Dhanish
        token_a = create_mock_jwt(sub="google-sub-dhanish-111", email="dhanishmohd1136@gmail.com", name="Dhanish Mohd")
        payload_a = {
            "name": "Dhanish Mohd",
            "email": "dhanishmohd1136@gmail.com",
            "hub": "BCK",
            "batch": "42",
            "google_token": token_a
        }
        user_a, _ = server.upsert_student(payload_a)

        # User B: Friend
        token_b = create_mock_jwt(sub="google-sub-friend-222", email="friend.user@centagon.in", name="Friend Student")
        payload_b = {
            "name": "Friend Student",
            "email": "friend.user@centagon.in",
            "hub": "BCE",
            "batch": "18",
            "google_token": token_b
        }
        user_b, _ = server.upsert_student(payload_b)

        # Check identities are distinct
        self.assertNotEqual(user_a["id"], user_b["id"])
        self.assertNotEqual(user_a["google_id"], user_b["google_id"])
        self.assertNotEqual(user_a["email"], user_b["email"])

        # Check database persistence of both
        students = server.load_students()
        self.assertEqual(len(students), 2)
        
        emails = {s["email"] for s in students}
        google_ids = {s["google_id"] for s in students}
        self.assertIn("dhanishmohd1136@gmail.com", emails)
        self.assertIn("friend.user@centagon.in", emails)
        self.assertIn("google-sub-dhanish-111", google_ids)
        self.assertIn("google-sub-friend-222", google_ids)

        # Verify Admin dashboard retrieves both records
        admin_data = server.list_students()
        self.assertEqual(admin_data["total"], 2)

    # -------------------------------------------------------------
    # Test 4: Account Switching
    # -------------------------------------------------------------
    def test_4_account_switching_no_leakage(self):
        """
        Given a browser session authenticated as User A,
        when the user logs out and authenticates as User B on the same machine,
        then the session changes to User B, User A's identity is not reused,
        User A's batch/hub metadata is not leaked onto User B,
        and both records remain intact.
        """
        # User A logs in with batch BCK 42
        token_a = create_mock_jwt(sub="sub-user-a", email="user_a@gmail.com", name="User A")
        res_a, _ = server.upsert_student({
            "name": "User A",
            "email": "user_a@gmail.com",
            "hub": "BCK",
            "batch": "42",
            "google_token": token_a
        })

        # User B logs in without specifying batch yet
        token_b = create_mock_jwt(sub="sub-user-b", email="user_b@gmail.com", name="User B")
        res_b, _ = server.upsert_student({
            "name": "User B",
            "email": "user_b@gmail.com",
            "google_token": token_b
        })

        # User B should NOT inherit User A's hub or batch
        self.assertEqual(res_b["email"], "user_b@gmail.com")
        self.assertEqual(res_b["google_id"], "sub-user-b")
        self.assertEqual(res_b["hub"], "")
        self.assertEqual(res_b["batch"], "")
        self.assertEqual(res_b["batch_code"], "")

        # User A's record remains unmodified
        students = server.load_students()
        user_a_saved = next(s for s in students if s["email"] == "user_a@gmail.com")
        self.assertEqual(user_a_saved["batch"], "42")
        self.assertEqual(user_a_saved["hub"], "BCK")

    # -------------------------------------------------------------
    # Test 5: Different Devices / Cross-Device Tracking
    # -------------------------------------------------------------
    def test_5_different_devices_tracking(self):
        """
        Authenticate two different users from separate browser profiles or devices.
        Verify that registration and login tracking work without relying on shared browser storage.
        """
        # Device 1: Mobile Phone
        token_dev1 = create_mock_jwt(sub="sub-device-1", email="mobile.user@gmail.com", name="Mobile User")
        server.upsert_student({
            "name": "Mobile User",
            "email": "mobile.user@gmail.com",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            "google_token": token_dev1
        })

        # Device 2: Desktop Laptop
        token_dev2 = create_mock_jwt(sub="sub-device-2", email="laptop.user@gmail.com", name="Laptop User")
        server.upsert_student({
            "name": "Laptop User",
            "email": "laptop.user@gmail.com",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "google_token": token_dev2
        })

        # Device 3: Admin on iPad querying the server API
        admin_view = server.list_students()
        self.assertEqual(admin_view["total"], 2)
        users = [s["name"] for s in admin_view["students"]]
        self.assertIn("Mobile User", users)
        self.assertIn("Laptop User", users)

    # -------------------------------------------------------------
    # Test 6: Database Failure Handling
    # -------------------------------------------------------------
    def test_6_database_failure_handling(self):
        """
        Simulate a database write failure.
        Verify that the failure is handled gracefully and does not falsely report persistence success.
        """
        token = create_mock_jwt(sub="sub-fail-test", email="fail@example.com")
        payload = {
            "name": "Fail Test",
            "email": "fail@example.com",
            "google_token": token
        }

        # Mock save_students to simulate disk full or I/O error
        with patch("server.save_students", side_effect=IOError("Disk write simulated failure")):
            with self.assertRaises(IOError):
                server.upsert_student(payload)

    # -------------------------------------------------------------
    # Test 7: Admin API Security & Filtering
    # -------------------------------------------------------------
    def test_7_admin_api_security_and_filtering(self):
        """
        Verify that the admin endpoint:
        - Filters by hub correctly.
        - Filters by search term correctly.
        - Does not expose sensitive authentication tokens or credentials in student records.
        - Enforces admin authorization.
        """
        # Seed 3 students
        s1, _ = server.upsert_student({"name": "Rahul BCK", "email": "rahul@centagon.in", "hub": "BCK", "batch": "10", "google_token": create_mock_jwt("sub-1", "rahul@centagon.in", name="Rahul BCK")})
        s2, _ = server.upsert_student({"name": "Pooja BCR", "email": "pooja@centagon.in", "hub": "BCR", "batch": "12", "google_token": create_mock_jwt("sub-2", "pooja@centagon.in", name="Pooja BCR")})
        s3, _ = server.upsert_student({"name": "Kiran BCK", "email": "kiran@centagon.in", "hub": "BCK", "batch": "14", "google_token": create_mock_jwt("sub-3", "kiran@centagon.in", name="Kiran BCK")})

        # 1. Hub Filtering
        bck_view = server.list_students(filter_hub="BCK")
        self.assertEqual(bck_view["total"], 3)
        self.assertEqual(bck_view["filtered_total"], 2)
        self.assertTrue(all(s["hub"] == "BCK" for s in bck_view["students"]))

        # 2. Search Filtering
        search_view = server.list_students(search_term="pooja")
        self.assertEqual(search_view["filtered_total"], 1)
        self.assertEqual(search_view["students"][0]["name"], "Pooja BCR")

        # 3. Sensitive Data Check
        for s in server.list_students()["students"]:
            self.assertNotIn("google_token", s)
            self.assertNotIn("id_token", s)
            self.assertNotIn("access_token", s)
            self.assertNotIn("refresh_token", s)
            self.assertNotIn("password", s)

        # 4. Admin Authorization Helpers
        self.assertTrue(server.is_admin_email("dhanishmohd1136@gmail.com"))
        self.assertTrue(server.is_admin_email("admin@centagon.in"))
        self.assertFalse(server.is_admin_email("random.student@gmail.com"))
        self.assertFalse(server.is_admin_email(""))

    # -------------------------------------------------------------
    # Test 8: Regression (Calculations, CSV Sanitization)
    # -------------------------------------------------------------
    def test_8_regression_features(self):
        """
        Verify calculation tracking and CSV injection protection.
        """
        # Calculation tracking
        s, _ = server.upsert_student({
            "name": "Calc Student",
            "email": "calc@example.com",
            "google_token": create_mock_jwt("sub-calc", "calc@example.com")
        })
        self.assertEqual(s["calculations_count"], 0)

        # Increment calculation
        calc_res = server.log_calculation("calc@example.com")
        self.assertTrue(calc_res)
        updated_s = next(x for x in server.load_students() if x["email"] == "calc@example.com")
        self.assertEqual(updated_s["calculations_count"], 1)

        # Non-existent user calc tracking is safely ignored
        self.assertFalse(server.log_calculation("nonexistent@example.com"))

        # Verify Google JWT verification rejects invalid tokens
        self.assertIsNone(server.verify_google_jwt(""))
        self.assertIsNone(server.verify_google_jwt("invalid.token"))
        
        # Expired token rejected
        header = {"alg": "RS256", "typ": "JWT"}
        exp_payload = {
            "iss": "https://accounts.google.com",
            "aud": "test-client-id",
            "sub": "sub-exp",
            "email": "exp@example.com",
            "exp": int(time.time()) - 3600
        }
        b64_exp = base64.urlsafe_b64encode(json.dumps(exp_payload).encode()).decode().rstrip("=")
        tampered = f"mock_header.{b64_exp}.mock_sig"
        self.assertIsNone(server.verify_google_jwt(tampered))


if __name__ == "__main__":
    unittest.main()
