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
import hashlib
import mimetypes
from datetime import datetime
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
STUDENTS_FILE = DATA_DIR / "students.json"

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


def verify_google_jwt(id_token, expected_email=None):
    """
    Validates Google OAuth JWT ID token structure, issuer, audience, and expiration.
    """
    if not id_token:
        return None
    try:
        parts = id_token.split(".")
        if len(parts) != 3:
            return None
        import base64
        import time
        payload_b64 = parts[1]
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8"))
        
        # Verify issuer
        iss = payload.get("iss", "")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            return None
            
        # Verify audience (Google Client ID)
        aud = payload.get("aud", "")
        if aud != "470097466192-qft1oohev9cev3acq9ljm5jl5324ik1o.apps.googleusercontent.com":
            return None
            
        # Verify expiration
        exp = payload.get("exp", 0)
        if time.time() > exp:
            return None
            
        # Verify email match if provided
        if expected_email:
            token_email = (payload.get("email") or "").strip().lower()
            if token_email != expected_email.strip().lower():
                return None
                
        return payload
    except Exception:
        return None


# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)
if not STUDENTS_FILE.exists():
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, indent=2)


def get_all_students():
    try:
        with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_students(students_list):
    temp_file = STUDENTS_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(students_list, f, indent=2, ensure_ascii=False)
    temp_file.replace(STUDENTS_FILE)


HUB_NAMES = {
    "BCK": "Kozhikode",
    "BCR": "Remote",
    "BCE": "Ernakulam",
    "BCT": "Trivandrum"
}


def upsert_student(data):
    students = get_all_students()
    email = (data.get("email") or "").strip().lower()
    google_id = data.get("google_id") or data.get("sub") or ""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    hub = (data.get("hub") or "").strip().upper()
    batch = (data.get("batch") or "").strip()
    hub_name = (data.get("hub_name") or "").strip() or HUB_NAMES.get(hub, "")
    batch_code = (data.get("batch_code") or "").strip().upper()
    if hub and batch and not batch_code:
        batch_code = f"{hub} {batch}"

    existing = None
    for s in students:
        if email and s.get("email", "").lower() == email:
            existing = s
            break
        if google_id and s.get("google_id") == google_id:
            existing = s
            break

    if existing:
        existing["last_active"] = now_iso
        existing["visit_count"] = existing.get("visit_count", 1) + 1
        if data.get("name"):
            existing["name"] = data["name"]
        if data.get("picture"):
            existing["picture"] = data["picture"]
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
        record = existing
    else:
        record = {
            "id": len(students) + 1,
            "google_id": google_id,
            "name": data.get("name") or "Student",
            "email": email or "unknown@student.edu",
            "picture": data.get("picture") or "",
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

    save_students(students)
    return record, len(students)


def log_calculation(email):
    if not email:
        return
    students = get_all_students()
    email = email.strip().lower()
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for s in students:
        if s.get("email", "").lower() == email:
            s["calculations_count"] = s.get("calculations_count", 0) + 1
            s["last_active"] = now_iso
            save_students(students)
            break


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
        if clean_path in ("/admin", "/admin/students", "/admin/export-csv", "/api/students"):
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
            try:
                data = json.loads(body) if body else {}
                record, total = upsert_student(data)
                email = (data.get("email") or "").strip().lower()
                id_token = data.get("id_token") or ""

                # Security Check: Only grant admin session if verified via JWT token or existing authenticated admin session
                already_auth = self._is_admin_authenticated()
                jwt_payload = verify_google_jwt(id_token, email) if id_token else None
                is_admin = is_admin_email(email) and (already_auth or jwt_payload is not None)

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
                self.send_response(400)
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
        if clean_path in ("/admin", "/admin/students"):
            # Emergency/Secret direct bypass: ?key=... or ?secret=... matching ADMIN_PASSWORD
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            secret_key = qs.get("key", [None])[0] or qs.get("secret", [None])[0]
            if secret_key and secret_key == ADMIN_PASSWORD:
                students = get_all_students()
                html = self._render_admin_html(students)
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Set-Cookie", f"centagon_admin_session={ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(html.encode("utf-8"))
                return

            if self._is_admin_authenticated():
                students = get_all_students()
                html = self._render_admin_html(students)
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(html.encode("utf-8"))
            else:
                # Completely invisible to unauthenticated students: returns standard 404
                self.send_error(404, "File not found")
            return

        # Protected API: Get students list in JSON (Requires Admin)
        if clean_path == "/api/students":
            if not self._is_admin_authenticated():
                self.send_error(404, "File not found")
                return

            students = get_all_students()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "success",
                "total": len(students),
                "students": students
            }).encode("utf-8"))
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
