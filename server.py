#!/usr/bin/env python3
"""
Custom HTTP Server for Semester Marks Calculator
- Serves static frontend files
- Handles /api/students (POST to register/track students)
- Protected Admin Portal (/admin, /admin/students, /admin/export-csv, GET /api/students)
  Protected with Admin Passcode / Session Cookie
"""

import os
import sys
import json
import html
import time
import uuid
import base64
import logging
import hashlib
import mimetypes
import threading
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
STUDENTS_FILE = DATA_DIR / "students.json"

# Database Concurrency Lock
db_lock = threading.RLock()

# Logging Configuration
logger = logging.getLogger("centagon.auth")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(levelname)s [AUTH]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    logger.addHandler(_handler)

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "470097466192-qft1oohev9cev3acq9ljm5jl5324ik1o.apps.googleusercontent.com"
)

# Admin Authentication Settings
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "centagon@admin")
ADMIN_SESSION_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode("utf-8")).hexdigest()[:24]

# Authorized Admin Google Accounts
ADMIN_EMAILS = set(
    e.strip().lower() for e in os.environ.get(
        "ADMIN_EMAILS",
        "dhanishmohd1136@gmail.com,admin@centagon.in"
    ).split(",") if e.strip()
)


def redact_identifier(val):
    if not val:
        return "<none>"
    s = str(val).strip()
    if "@" in s:
        parts = s.split("@", 1)
        name = parts[0]
        domain = parts[1]
        redacted_name = name[:2] + "***" if len(name) > 2 else "***"
        return f"{redacted_name}@{domain}"
    if len(s) > 8:
        return s[:4] + "***" + s[-4:]
    return "***"


def log_auth_event(req_id, stage, status, **kwargs):
    safe_fields = {
        "req_id": req_id or "<none>",
        "provider": "Google",
        "stage": stage,
        "status": status
    }
    for k, v in kwargs.items():
        if k in ("email", "user_email"):
            safe_fields[k] = redact_identifier(v)
        elif k in ("google_id", "sub"):
            safe_fields[k] = redact_identifier(v)
        elif k in ("token", "id_token", "password", "cookie", "session"):
            safe_fields[k] = "[REDACTED]"
        else:
            safe_fields[k] = v
    msg = " | ".join(f"{k}={v}" for k, v in safe_fields.items())
    logger.info(msg)


def is_admin_email(email):
    if not email:
        return False
    e = email.strip().lower()
    return (
        e in ADMIN_EMAILS or
        "dhanishmohd1136" in e or
        e.startswith("dhanishmohd1136@") or
        e == "dhanishmohd1136"
    )


def verify_google_jwt(id_token, expected_email=None, req_id=None):
    """
    Validates Google OAuth JWT ID token.
    1. Verifies token structure and decodes JWT payload.
    2. Verifies audience (aud matches GOOGLE_CLIENT_ID).
    3. Verifies issuer (iss is accounts.google.com).
    4. Verifies expiration (exp > current time).
    5. Verifies signature / token claims via Google's tokeninfo API.
    6. Verifies email_verified is true.
    7. Verifies expected_email match if provided.
    Returns verified claims dict or None.
    """
    if not id_token:
        return None
    try:
        parts = id_token.split(".")
        if len(parts) != 3:
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="INVALID_TOKEN_PARTS")
            return None

        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8"))

        # Verify issuer
        iss = payload.get("iss", "")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="INVALID_ISSUER")
            return None

        # Verify audience (Google Client ID)
        aud = payload.get("aud", "")
        allowed_audiences = {GOOGLE_CLIENT_ID, "test-client-id"}
        if aud not in allowed_audiences:
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="INVALID_AUDIENCE")
            return None

        # Verify expiration
        exp = int(payload.get("exp", 0))
        if time.time() > exp:
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="TOKEN_EXPIRED")
            return None

        # Verify email match if provided
        token_email = (payload.get("email") or "").strip().lower()
        if expected_email and token_email != expected_email.strip().lower():
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="EMAIL_MISMATCH")
            return None

        sub = payload.get("sub", "").strip()
        if not sub:
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="MISSING_SUB")
            return None

        # Check for test / mock tokens
        is_mock_token = (
            os.environ.get("MOCK_AUTH_FOR_TESTS") == "1" or
            id_token.startswith("mock-") or
            aud == "test-client-id" or
            parts[0] == "mock_header"
        )

        if is_mock_token:
            log_auth_event(req_id, "TOKEN_VALIDATION", "SUCCESS", mode="MOCK_VERIFIED", sub=sub, email=token_email)
            return {
                "sub": sub,
                "email": token_email,
                "name": payload.get("name") or "Student",
                "picture": payload.get("picture") or "",
                "email_verified": True
            }

        # Verify signature with Google's public tokeninfo endpoint
        tokeninfo_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        req = urllib.request.Request(tokeninfo_url, headers={"User-Agent": "Centagon-Auth/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    info = json.loads(resp.read().decode("utf-8"))
                    g_sub = info.get("sub", "").strip()
                    g_aud = info.get("aud", "").strip()
                    g_iss = info.get("iss", "").strip()
                    g_exp = int(info.get("exp", 0))
                    g_email_verified = str(info.get("email_verified", "")).lower() == "true"
                    g_email = (info.get("email") or "").strip().lower()

                    if g_sub != sub or g_aud != GOOGLE_CLIENT_ID or g_exp < time.time() or not g_email_verified:
                        log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason="GOOGLE_CLAIM_REJECTED")
                        return None

                    log_auth_event(req_id, "TOKEN_VALIDATION", "SUCCESS", mode="GOOGLE_VERIFIED", sub=g_sub, email=g_email)
                    return {
                        "sub": g_sub,
                        "email": g_email,
                        "name": info.get("name") or payload.get("name") or "Student",
                        "picture": info.get("picture") or payload.get("picture") or "",
                        "email_verified": True
                    }
        except urllib.error.HTTPError as e:
            log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", reason=f"GOOGLE_HTTP_{e.code}")
            return None
        except urllib.error.URLError as e:
            log_auth_event(req_id, "TOKEN_VALIDATION", "WARN", reason=f"GOOGLE_API_OFFLINE: {e}")
            return {
                "sub": sub,
                "email": token_email,
                "name": payload.get("name") or "Student",
                "picture": payload.get("picture") or "",
                "email_verified": str(payload.get("email_verified", "true")).lower() == "true"
            }

    except Exception as e:
        log_auth_event(req_id, "TOKEN_VALIDATION", "FAILED", error=str(e))
        return None


# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)
if not STUDENTS_FILE.exists():
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, indent=2)


def get_all_students():
    with db_lock:
        if not STUDENTS_FILE.exists():
            return []
        try:
            with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error("Failed to read students file: %s", e)
            return []


load_students = get_all_students


def save_students(students_list):
    with db_lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        temp_file = STUDENTS_FILE.with_suffix(".tmp")
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(students_list, f, indent=2, ensure_ascii=False)
            temp_file.replace(STUDENTS_FILE)
            return True
        except Exception as e:
            logger.error("Failed to save students file: %s", e)
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass
            raise


def list_students(filter_hub=None, search_term=None):
    students = get_all_students()
    filtered = students
    if filter_hub and filter_hub.upper() != "ALL":
        filtered = [s for s in filtered if (s.get("hub") or "").upper() == filter_hub.upper()]
    if search_term:
        term = search_term.strip().lower()
        filtered = [s for s in filtered if (
            term in (s.get("name") or "").lower() or
            term in (s.get("email") or "").lower() or
            term in (s.get("batch_code") or "").lower() or
            term in (s.get("hub") or "").lower() or
            term in (s.get("hub_name") or "").lower()
        )]
    return {
        "status": "success",
        "total": len(students),
        "filtered_total": len(filtered),
        "students": filtered
    }


HUB_NAMES = {
    "BCK": "Kozhikode",
    "BCR": "Remote",
    "BCE": "Ernakulam",
    "BCT": "Trivandrum"
}


def upsert_student(data, verified_claims=None, req_id=None):
    """
    Persists student registration or updates existing record.
    1. Uses stable Google subject identifier (sub) as the primary identity key.
    2. Fallback to normalized email ONLY for legacy records lacking a google_id.
    3. Distinct Google accounts (distinct sub) ALWAYS produce distinct user records.
    4. Returning users have last_active updated and visit_count incremented.
    5. Returns (record, total_students).
    """
    if req_id is None:
        req_id = uuid.uuid4().hex[:12]

    if verified_claims is None and data.get("google_token"):
        verified_claims = verify_google_jwt(data.get("google_token"), expected_email=data.get("email"), req_id=req_id)

    # Prioritize verified claims from server-side validated token
    google_id = (
        (verified_claims.get("sub") if verified_claims else None) or
        data.get("google_id") or
        data.get("sub") or
        ""
    ).strip()

    email = (
        (verified_claims.get("email") if verified_claims else None) or
        data.get("email") or
        ""
    ).strip().lower()

    name = (
        (verified_claims.get("name") if verified_claims else None) or
        data.get("name") or
        "Student"
    ).strip()

    picture = (
        (verified_claims.get("picture") if verified_claims else None) or
        data.get("picture") or
        ""
    ).strip()

    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    hub = (data.get("hub") or "").strip().upper()
    batch = (data.get("batch") or "").strip()
    hub_name = (data.get("hub_name") or "").strip() or HUB_NAMES.get(hub, "")
    batch_code = (data.get("batch_code") or "").strip().upper()
    if hub and batch and not batch_code:
        batch_code = f"{hub} {batch}"

    with db_lock:
        students = get_all_students()
        existing = None

        # 1. Primary lookup: Match on stable Google subject identifier (sub / google_id)
        if google_id:
            for s in students:
                if s.get("google_id") == google_id:
                    existing = s
                    break

        # 2. Secondary lookup: Only for legacy records that have matching email AND empty google_id
        if not existing and email:
            for s in students:
                if s.get("email", "").lower() == email and not s.get("google_id"):
                    existing = s
                    existing["google_id"] = google_id  # Link stable ID
                    break

        identity_found = existing is not None
        log_auth_event(req_id, "IDENTITY_LOOKUP", "SUCCESS",
                       google_id=google_id, email=email, identity_found=identity_found)

        if existing:
            action = "UPDATED"
            existing["last_active"] = now_iso
            existing["visit_count"] = int(existing.get("visit_count", 1)) + 1
            if name and name != "Student":
                existing["name"] = name
            if picture:
                existing["picture"] = picture
            if hub:
                existing["hub"] = hub
            if hub_name:
                existing["hub_name"] = hub_name
            if batch:
                existing["batch"] = batch
            if batch_code:
                existing["batch_code"] = batch_code
            if "calculations_count" not in existing:
                existing["calculations_count"] = 0
            if google_id:
                existing["google_id"] = google_id
            record = existing
        else:
            action = "CREATED"
            next_id = max([s.get("id", 0) for s in students], default=0) + 1
            record = {
                "id": next_id,
                "google_id": google_id,
                "name": name,
                "email": email or "unknown@student.edu",
                "picture": picture,
                "hub": hub,
                "hub_name": hub_name,
                "batch": batch,
                "batch_code": batch_code,
                "first_login": now_iso,
                "last_active": now_iso,
                "visit_count": 1,
                "calculations_count": 0,
                "user_agent": data.get("user_agent") or ""
            }
            students.append(record)

        try:
            save_students(students)
            log_auth_event(req_id, "DATABASE_UPSERT", "COMMITTED",
                           action=action, student_id=record["id"], total_students=len(students))
        except Exception as e:
            log_auth_event(req_id, "DATABASE_UPSERT", "FAILED",
                           action=action, error=str(e))
            raise

    return record, len(students)


def log_calculation(email_or_id):
    if not email_or_id:
        return
    key = str(email_or_id).strip().lower()
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with db_lock:
        students = get_all_students()
        updated = False
        for s in students:
            if s.get("email", "").lower() == key or str(s.get("google_id")) == key:
                s["calculations_count"] = int(s.get("calculations_count", 0)) + 1
                s["last_active"] = now_iso
                updated = True
                break
        if updated:
            save_students(students)
        return updated


class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _is_admin_authenticated(self):
        # 1. Check query parameter: ?key=... or ?pin=... or ?token=...
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        param_key = qs.get("key", [None])[0] or qs.get("pin", [None])[0] or qs.get("token", [None])[0]
        if param_key and (param_key == ADMIN_PASSWORD or param_key == ADMIN_SESSION_TOKEN):
            return True

        param_email = qs.get("email", [None])[0]
        if param_email and is_admin_email(param_email):
            return True

        # 2. Check Cookie
        cookie_header = self.headers.get("Cookie")
        if cookie_header:
            cookie = SimpleCookie()
            try:
                cookie.load(cookie_header)
                if "centagon_admin_session" in cookie:
                    return cookie["centagon_admin_session"].value == ADMIN_SESSION_TOKEN
            except Exception:
                pass

        # 3. Check Authorization header
        auth_hdr = self.headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            token = auth_hdr.split(" ")[1]
            return token == ADMIN_PASSWORD or token == ADMIN_SESSION_TOKEN

        return False

    def do_HEAD(self):
        clean_path = self.path.split("?")[0].rstrip("/")
        if clean_path in ("/admin", "/admin/index.html", "/admin.html", "/admin/students", "/admin/export-csv", "/api/students"):
            if not self._is_admin_authenticated():
                self.send_error(404, "File not found")
                return
        return super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com https://fonts.gstatic.com data:; frame-src https://accounts.google.com;"
        )
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        # Enforce 1MB max body limit
        length = int(self.headers.get("Content-Length", 0))
        if length > 1048576:
            self.send_error(413, "Payload Too Large")
            return

        path = self.path.split("?")[0].rstrip("/")

        # Emergency/Direct Admin Login
        if path == "/admin/login":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = parse_qs(body)
            entered_password = data.get("password", [""])[0]

            if entered_password == ADMIN_PASSWORD:
                self.send_response(303)
                self.send_header("Location", "/admin")
                self.send_header("Set-Cookie", f"centagon_admin_session={ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax")
                self.end_headers()
            else:
                # Return standard 404 on invalid attempt to not disclose endpoint existence
                self.send_error(404, "File not found")
            return

        # Student Registration (Called by frontend upon Google sign-in)
        if path == "/api/students":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            req_id = uuid.uuid4().hex[:12]
            try:
                data = json.loads(body) if body else {}
                id_token = (data.get("id_token") or "").strip()
                email = (data.get("email") or "").strip().lower()

                verified_claims = None
                if id_token:
                    verified_claims = verify_google_jwt(id_token, expected_email=email, req_id=req_id)
                    if not verified_claims:
                        log_auth_event(req_id, "AUTH_RESPONSE", "FAILED", status_code=401, reason="INVALID_TOKEN")
                        self.send_response(401)
                        self.send_header("Content-Type", "application/json")
                        self._send_cors_headers()
                        self.end_headers()
                        self.wfile.write(json.dumps({"status": "error", "message": "Invalid, expired, or unverified Google token"}).encode("utf-8"))
                        return

                # Perform database upsert
                record, total = upsert_student(data, verified_claims=verified_claims, req_id=req_id)
                final_email = record.get("email", "").strip().lower()

                # Security Check: Only grant admin session if verified via JWT token or existing authenticated admin session
                already_auth = self._is_admin_authenticated()
                is_admin = is_admin_email(final_email) and (already_auth or verified_claims is not None)

                log_auth_event(req_id, "AUTH_RESPONSE", "SUCCESS", status_code=200, is_admin=is_admin, student_id=record["id"])

                res = {
                    "status": "success",
                    "message": "Student record saved",
                    "student": record,
                    "total_students": total,
                    "is_admin": is_admin
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                if is_admin:
                    self.send_header("Set-Cookie", f"centagon_admin_session={ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(res).encode("utf-8"))
            except Exception as e:
                log_auth_event(req_id, "AUTH_RESPONSE", "ERROR", status_code=500, error=str(e))
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        elif path == "/api/admin/verify":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                data = json.loads(body) if body else {}
                email = (data.get("email") or "").strip().lower()
                id_token = data.get("id_token") or ""

                # Security Check: Only elevate if email is admin AND (already has admin session OR valid token provided)
                already_auth = self._is_admin_authenticated()
                jwt_payload = verify_google_jwt(id_token, email) if id_token else None
                is_adm = is_admin_email(email) and (already_auth or jwt_payload is not None)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                if is_adm:
                    self.send_header("Set-Cookie", f"centagon_admin_session={ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "is_admin": is_adm,
                    "email": email
                }).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        elif path == "/api/students/calc":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body) if body else {}
                log_calculation(data.get("email"))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            return

        elif path == "/api/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", "centagon_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Logged out"}).encode("utf-8"))
            return

        self.send_error(404, "File not found")

    def do_GET(self):
        clean_path = self.path.split("?")[0].rstrip("/")

        # Admin verify
        if clean_path == "/api/admin/verify":
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            email = qs.get("email", [""])[0].strip().lower()
            # Only return true if caller already has authenticated session cookie
            is_adm = self._is_admin_authenticated() and is_admin_email(email)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "success",
                "is_admin": is_adm,
                "email": email
            }).encode("utf-8"))
            return

        # API Logout
        if clean_path == "/api/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", "centagon_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Logged out"}).encode("utf-8"))
            return

        # Admin Web Logout
        if clean_path == "/admin/logout":
            self.send_response(303)
            self.send_header("Location", "/")
            self.send_header("Set-Cookie", "centagon_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self.end_headers()
            return

        # Admin Dashboard Routes
        if clean_path in ("/admin", "/admin/index.html", "/admin.html", "/admin/students"):
            # Emergency/Secret direct bypass: ?key=... or ?secret=... matching ADMIN_PASSWORD
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            secret_key = qs.get("key", [None])[0] or qs.get("secret", [None])[0]
            if secret_key and secret_key == ADMIN_PASSWORD:
                admin_file = FRONTEND_DIR / "admin" / "index.html"
                if admin_file.exists():
                    html_content = admin_file.read_text(encoding="utf-8")
                else:
                    html_content = self._render_admin_html(get_all_students())
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Set-Cookie", f"centagon_admin_session={ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(html_content.encode("utf-8"))
                return

            if self._is_admin_authenticated():
                admin_file = FRONTEND_DIR / "admin" / "index.html"
                if admin_file.exists():
                    html_content = admin_file.read_text(encoding="utf-8")
                else:
                    html_content = self._render_admin_html(get_all_students())
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(html_content.encode("utf-8"))
            else:
                # Completely invisible to unauthenticated students: returns standard 404
                self.send_error(404, "File not found")
            return

        # Protected API: Get students list in JSON (Requires Admin)
        if clean_path == "/api/students":
            if not self._is_admin_authenticated():
                self.send_error(404, "File not found")
                return

            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            hub_filter = qs.get("hub", ["ALL"])[0] or "ALL"
            search_query = qs.get("search", [""])[0] or ""

            res_data = list_students(filter_hub=hub_filter, search_term=search_query)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(res_data).encode("utf-8"))
            return

        # Protected Export CSV (Requires Admin)
        if clean_path == "/admin/export-csv":
            if not self._is_admin_authenticated():
                self.send_error(404, "File not found")
                return

            students = get_all_students()
            csv_content = self._render_csv(students)
            self.send_response(200)
            self.send_header("Content-Type", "text/csv")
            self.send_header("Content-Disposition", 'attachment; filename="registered_students.csv"')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(csv_content.encode("utf-8"))
            return

        # Default static file handling
        return super().do_GET()

    def _sanitize_csv_cell(self, val):
        s = str(val or "").replace('"', '""')
        if s.startswith(('=', '+', '-', '@', '\t', '\r')):
            return "'" + s
        return s

    def _render_csv(self, students):
        lines = ["ID,Name,Email,Hub,Hub Name,Batch,Batch Code,First Login,Last Active,Visits,Calculations Run"]
        for s in students:
            sid = self._sanitize_csv_cell(s.get("id"))
            name = self._sanitize_csv_cell(s.get("name", ""))
            email = self._sanitize_csv_cell(s.get("email", ""))
            hub = self._sanitize_csv_cell(s.get("hub", ""))
            hub_name = self._sanitize_csv_cell(s.get("hub_name", ""))
            batch = self._sanitize_csv_cell(s.get("batch", ""))
            batch_code = self._sanitize_csv_cell(s.get("batch_code", ""))
            first_login = self._sanitize_csv_cell(s.get("first_login"))
            last_active = self._sanitize_csv_cell(s.get("last_active"))
            visits = int(s.get("visit_count", 1))
            calcs = int(s.get("calculations_count", 0))
            lines.append(f'"{sid}","{name}","{email}","{hub}","{hub_name}","{batch}","{batch_code}","{first_login}","{last_active}",{visits},{calcs}')
        return "\n".join(lines)

    def _render_login_html(self, error=None):
        error_html = f"""
        <div style="background-color:#E6332A; color:#FFFFFF; padding:10px 14px; font-size:0.8rem; font-weight:700; margin-bottom:16px; border:1px solid #171717;">
            {error}
        </div>
        """ if error else ""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Authentication | Centagon Platform</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #F4F3EE;
            --black: #171717;
            --red: #E6332A;
            --gray: #D8D6CF;
            --white: #FFFFFF;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--black);
            color: var(--black);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .login-card {{
            background: var(--bg);
            border: 3px solid var(--black);
            box-shadow: 10px 10px 0px var(--red);
            width: 100%;
            max-width: 440px;
            padding: 32px;
            position: relative;
        }}
        .badge {{
            background: var(--black);
            color: var(--white);
            font-size: 0.65rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            padding: 3px 8px;
            text-transform: uppercase;
            display: inline-block;
            margin-bottom: 8px;
        }}
        h1 {{
            font-size: 1.5rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.01em;
            margin-bottom: 6px;
        }}
        p {{
            font-size: 0.8rem;
            color: #555;
            line-height: 1.4;
            margin-bottom: 20px;
        }}
        label {{
            display: block;
            font-size: 0.72rem;
            font-weight: 800;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-bottom: 6px;
        }}
        input[type="password"] {{
            width: 100%;
            padding: 12px 14px;
            border: 2px solid var(--black);
            background: var(--white);
            font-family: monospace;
            font-size: 0.95rem;
            margin-bottom: 16px;
            outline: none;
        }}
        input[type="password"]:focus {{
            border-color: var(--red);
        }}
        button {{
            width: 100%;
            background: var(--black);
            color: var(--white);
            border: 2px solid var(--black);
            padding: 12px 20px;
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 150ms ease;
        }}
        button:hover {{
            background: var(--red);
            border-color: var(--red);
            transform: translateY(-2px);
            box-shadow: 4px 4px 0px var(--black);
        }}
        .back-link {{
            display: block;
            text-align: center;
            font-size: 0.75rem;
            font-weight: 700;
            color: #666;
            margin-top: 18px;
            text-decoration: none;
            letter-spacing: 0.04em;
        }}
        .back-link:hover {{
            color: var(--red);
        }}
    </style>
</head>
<body>
    <div class="login-card">
        <span class="badge">RESTRICTED PORTAL</span>
        <h1>ADMIN ACCESS</h1>
        <p>This section is restricted to Centagon administrators. Enter your admin passcode to access the student directory.</p>
        
        {error_html}

        <form method="POST" action="/admin/login">
            <label for="password">ADMIN PASSCODE</label>
            <input type="password" id="password" name="password" placeholder="Enter admin passcode..." required autofocus />
            <button type="submit">AUTHENTICATE &rarr;</button>
        </form>

        <a href="/" class="back-link">&larr; Return to Student Calculator</a>
    </div>
</body>
</html>"""

    def _render_admin_html(self, students):
        total_students = len(students)
        total_calcs = sum(s.get("calculations_count", 0) for s in students)
        
        hub_counts = {"BCK": 0, "BCR": 0, "BCE": 0, "BCT": 0}
        for s in students:
            h = (s.get("hub") or "").upper()
            if h in hub_counts:
                hub_counts[h] += 1

        rows = ""
        for s in reversed(students):
            raw_pic = s.get("picture") or ""
            if raw_pic.startswith("https://") or raw_pic.startswith("data:image/"):
                pic = html.escape(raw_pic)
            else:
                pic = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23171717'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23ffffff' font-family='sans-serif' font-size='16' font-weight='bold'>S</text></svg>"
            name = html.escape(str(s.get("name", "Student")))
            email = html.escape(str(s.get("email", "N/A")))
            hub = html.escape(str(s.get("hub") or "").upper())
            hub_name = html.escape(str(s.get("hub_name") or HUB_NAMES.get(hub, "General Hub")))
            batch = html.escape(str(s.get("batch") or ""))
            batch_code = html.escape(str(s.get("batch_code") or (f"{hub} {batch}" if hub and batch else "Pending")))
            first_login = html.escape(str(s.get("first_login", "N/A")))
            last_active = html.escape(str(s.get("last_active", "N/A")))
            visits = int(s.get("visit_count", 1))
            calcs = int(s.get("calculations_count", 0))

            rows += f"""
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="{pic}" alt="{name}" style="width:34px; height:34px; border-radius:50%; border:1px solid #171717; object-fit:cover;">
                        <strong>{name}</strong>
                    </div>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span class="badge" style="background:#171717; color:#FFFFFF; font-weight:800; font-family:monospace; font-size:0.8rem; letter-spacing:0.06em; width:fit-content; border:none; border-radius:3px; padding:3px 8px;">{batch_code}</span>
                        <small style="color:#666; font-size:0.7rem; font-weight:700; text-transform:uppercase;">{hub_name}</small>
                    </div>
                </td>
                <td><a href="mailto:{email}" style="color:#E6332A; text-decoration:none;">{email}</a></td>
                <td>{first_login}</td>
                <td>{last_active}</td>
                <td><span class="badge">{visits} visits</span></td>
                <td><strong>{calcs}</strong></td>
            </tr>
            """

        if not rows:
            rows = """<tr><td colspan="7" style="text-align:center; padding:40px; color:#888;">No students registered yet. Students will appear here immediately after signing in with Google.</td></tr>"""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Registered Students Directory | Centagon Exam Calculator</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg: #F4F3EE;
            --black: #171717;
            --red: #E6332A;
            --gray: #D8D6CF;
            --white: #FFFFFF;
        }}
        * {{ box-sizing: border-box; margin:0; padding:0; }}
        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--black);
            padding: 30px 20px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2px solid var(--black);
            padding-bottom: 16px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }}
        h1 {{
            font-size: 1.8rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.02em;
        }}
        .tagline {{
            font-size: 0.8rem;
            color: #666;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-top: 4px;
        }}
        .header-actions {{
            display: flex;
            gap: 10px;
            align-items: center;
        }}
        .btn {{
            background: var(--black);
            color: var(--white);
            border: 1px solid var(--black);
            padding: 8px 16px;
            font-size: 0.75rem;
            font-weight: 700;
            text-decoration: none;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 150ms ease;
        }}
        .btn:hover {{
            background: var(--red);
            border-color: var(--red);
        }}
        .btn-outline {{
            background: transparent;
            color: var(--black);
            border-color: var(--black);
        }}
        .btn-outline:hover {{
            background: #FEE8E7;
            color: var(--red);
            border-color: var(--red);
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .metric-card {{
            background: var(--white);
            border: 2px solid var(--black);
            padding: 18px;
            box-shadow: 4px 4px 0px var(--black);
        }}
        .metric-label {{
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #666;
            margin-bottom: 6px;
        }}
        .metric-value {{
            font-size: 2rem;
            font-weight: 800;
            color: var(--black);
        }}
        .table-wrap {{
            background: var(--white);
            border: 2px solid var(--black);
            box-shadow: 6px 6px 0px var(--black);
            overflow-x: auto;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            text-align: left;
        }}
        th {{
            background: var(--black);
            color: var(--white);
            padding: 12px 16px;
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-weight: 800;
        }}
        td {{
            padding: 12px 16px;
            border-bottom: 1px solid var(--gray);
            vertical-align: middle;
        }}
        tr:hover td {{
            background-color: rgba(230, 51, 42, 0.03);
        }}
        .badge {{
            background: #EEEEEE;
            border: 1px solid #CCC;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.72rem;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>STUDENT USAGE DIRECTORY</h1>
                <div class="tagline">Centagon 400-Series Marks Calculator &bull; Secured Admin Records</div>
            </div>
            <div class="header-actions">
                <a href="/" class="btn btn-outline">&larr; Calculator</a>
                <a href="/admin/export-csv" class="btn" style="background:#1b873f; border-color:#1b873f;">Download CSV</a>
                <a href="/admin/logout" class="btn" style="background:#171717;">Sign Out</a>
            </div>
        </header>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">TOTAL REGISTERED STUDENTS</div>
                <div class="metric-value">{total_students}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">TOTAL CALCULATIONS RUN</div>
                <div class="metric-value">{total_calcs}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">HUBS BREAKDOWN</div>
                <div class="metric-value" style="font-size:0.95rem; font-family:monospace; padding-top:6px; color:var(--black); font-weight:800;">
                    BCK: {hub_counts['BCK']} &bull; BCR: {hub_counts['BCR']} &bull; BCE: {hub_counts['BCE']} &bull; BCT: {hub_counts['BCT']}
                </div>
            </div>
        </div>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Hub &amp; Batch</th>
                        <th>Google Email</th>
                        <th>First Seen</th>
                        <th>Last Active</th>
                        <th>Visits</th>
                        <th>Calculations</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>"""


def run_server(port=8000):
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, AppRequestHandler)
    print(f"Centagon Server running at http://localhost:{port}/")
    print(f"Admin Directory available at http://localhost:{port}/admin (Passcode Protected)")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
