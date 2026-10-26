#!/usr/bin/env python3
"""
Automated Defensive Security Audit & Testing Suite
Centagon Semester Marks Calculator & Admin Directory
"""

import sys
import json
import urllib.request
import urllib.error
from http.cookies import SimpleCookie

BASE_URL = "http://localhost:8000"

def log_test(category, test_name, status, details, severity="INFO"):
    color_map = {
        "PASS": "\033[92m[PASS]\033[0m",
        "FAIL": "\033[91m[VULN - " + severity + "]\033[0m",
        "WARN": "\033[93m[WARN - " + severity + "]\033[0m",
        "INFO": "\033[94m[INFO]\033[0m"
    }
    badge = color_map.get(status, f"[{status}]")
    print(f"{badge} {category} >> {test_name}")
    print(f"       Details: {details}\n")
    return {"category": category, "name": test_name, "status": status, "severity": severity, "details": details}

def main():
    results = []
    print("=================================================================")
    print("   CENTAGON APPLICATION - CYBER SECURITY AUDIT & VULN CHECKS   ")
    print("=================================================================\n")

    # ------------------------------------------------------------------
    # 1. HTTP Security Headers Check
    # ------------------------------------------------------------------
    req = urllib.request.Request(f"{BASE_URL}/", method="HEAD")
    try:
        with urllib.request.urlopen(req) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            
            # Check CSP
            if "content-security-policy" in headers:
                results.append(log_test("Security Headers", "Content-Security-Policy", "PASS", f"Present: {headers['content-security-policy']}"))
            else:
                results.append(log_test("Security Headers", "Content-Security-Policy", "FAIL", "Missing CSP header. App is susceptible to inline script execution.", "MEDIUM"))

            # Check X-Content-Type-Options
            if headers.get("x-content-type-options") == "nosniff":
                results.append(log_test("Security Headers", "X-Content-Type-Options", "PASS", "Present: nosniff"))
            else:
                results.append(log_test("Security Headers", "X-Content-Type-Options", "FAIL", "Missing 'nosniff'. Browsers may perform MIME sniffing.", "LOW"))

            # Check X-Frame-Options
            if "x-frame-options" in headers:
                results.append(log_test("Security Headers", "X-Frame-Options", "PASS", f"Present: {headers['x-frame-options']}"))
            else:
                results.append(log_test("Security Headers", "X-Frame-Options", "FAIL", "Missing X-Frame-Options. Site can be embedded in iframes (Clickjacking risk).", "MEDIUM"))

            # Check Cache-Control on static & sensitive resources
            if "no-cache" in headers.get("cache-control", ""):
                results.append(log_test("Cache Security", "Anti-Caching Headers", "PASS", f"Present: {headers['cache-control']}"))
            else:
                results.append(log_test("Cache Security", "Anti-Caching Headers", "WARN", "Weak cache control headers on root.", "LOW"))

            # Check CORS Configuration
            cors_origin = headers.get("access-control-allow-origin")
            if cors_origin == "*":
                results.append(log_test("CORS Policy", "Access-Control-Allow-Origin", "WARN", "CORS set to wildcard (*). Recommended to restrict to trusted origin in production.", "LOW"))
            else:
                results.append(log_test("CORS Policy", "Access-Control-Allow-Origin", "PASS", f"Configured to: {cors_origin}"))

    except Exception as e:
        results.append(log_test("Network / Connectivity", "Server Availability", "FAIL", str(e), "HIGH"))

    # ------------------------------------------------------------------
    # 2. Authentication & Admin Authorization Checks
    # ------------------------------------------------------------------
    # A. Unauthenticated access to /admin
    try:
        admin_req = urllib.request.Request(f"{BASE_URL}/admin", method="GET")
        with urllib.request.urlopen(admin_req) as resp:
            results.append(log_test("Access Control", "Unauthenticated /admin Access", "FAIL", "Direct /admin is accessible without credentials!", "HIGH"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            results.append(log_test("Access Control", "Unauthenticated /admin Access", "PASS", "Unauthenticated /admin request properly cloaked with 404."))
        else:
            results.append(log_test("Access Control", "Unauthenticated /admin Access", "PASS", f"Protected with HTTP {e.code}."))
    except Exception as e:
        results.append(log_test("Access Control", "Unauthenticated /admin Access", "INFO", str(e)))

    # B1. Token Forgery / Direct Email Claim on /api/admin/verify
    try:
        verify_data = json.dumps({"email": "dhanishmohd1136@gmail.com"}).encode("utf-8")
        verify_req = urllib.request.Request(
            f"{BASE_URL}/api/admin/verify",
            data=verify_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(verify_req) as resp:
            set_cookie = resp.headers.get("Set-Cookie", "")
            body = json.loads(resp.read().decode("utf-8"))
            if "centagon_admin_session" in set_cookie and body.get("is_admin") is True:
                results.append(log_test("Identity Verification", "Unverified Google Identity Claim on /api/admin/verify", "FAIL", 
                    "Arbitrary client can send {'email': 'dhanishmohd1136@gmail.com'} without Google ID token and receive admin session cookie!", "HIGH"))
            else:
                results.append(log_test("Identity Verification", "Unverified Google Identity Claim on /api/admin/verify", "PASS", "Identity claim was rejected without token."))
    except Exception as e:
        results.append(log_test("Identity Verification", "Unverified Google Identity Claim on /api/admin/verify", "INFO", str(e)))

    # B2. Token Forgery / Spoofed Registration on /api/students
    try:
        stu_data = json.dumps({"email": "admin@centagon.in", "name": "Security Audit Bot"}).encode("utf-8")
        stu_req = urllib.request.Request(
            f"{BASE_URL}/api/students",
            data=stu_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(stu_req) as resp:
            set_cookie = resp.headers.get("Set-Cookie", "")
            body = json.loads(resp.read().decode("utf-8"))
            if "centagon_admin_session" in set_cookie or body.get("is_admin") is True:
                results.append(log_test("Identity Verification", "Privilege Escalation via /api/students", "FAIL", 
                    "Arbitrary client can send admin email to /api/students without token and receive admin cookie!", "HIGH"))
            else:
                results.append(log_test("Identity Verification", "Privilege Escalation via /api/students", "PASS", 
                    "Unauthenticated registration cannot obtain admin privileges or session cookies."))
    finally:
        try:
            with open("data/students.json", "r", encoding="utf-8") as f:
                stus = json.load(f)
            cleaned = [s for s in stus if s.get("email") != "admin@centagon.in"]
            if len(cleaned) != len(stus):
                with open("data/students.json", "w", encoding="utf-8") as f:
                    json.dump(cleaned, f, indent=2)
        except Exception:
            pass

    # C. URL Secret Passcode Bypass Check
    try:
        bypass_req = urllib.request.Request(f"{BASE_URL}/admin?key=centagon@admin", method="GET")
        with urllib.request.urlopen(bypass_req) as resp:
            if resp.status == 200:
                results.append(log_test("Credential Exposure", "Secret Key in URL Query Parameter", "WARN", 
                    "Admin access granted via URL parameter '?key=centagon@admin'. Secrets in URL leak in proxy logs, browser history, and referers.", "MEDIUM"))
    except Exception as e:
        results.append(log_test("Credential Exposure", "Secret Key in URL Query Parameter", "INFO", str(e)))

    # D. DoS / Payload Size Capping Check
    try:
        huge_payload = b"A" * (1024 * 1024 + 100) # 1MB + 100 bytes
        dos_req = urllib.request.Request(
            f"{BASE_URL}/api/students",
            data=huge_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(dos_req) as resp:
            results.append(log_test("Resource Management", "HTTP Request Body Size Limit", "FAIL", "Server accepts payloads > 1MB without rejection.", "LOW"))
    except urllib.error.HTTPError as e:
        if e.code == 413:
            results.append(log_test("Resource Management", "HTTP Request Body Size Limit", "PASS", "Excessive payloads (>1MB) rejected with HTTP 413 Payload Too Large."))
        else:
            results.append(log_test("Resource Management", "HTTP Request Body Size Limit", "PASS", f"Rejected with HTTP {e.code}."))
    except Exception as e:
        results.append(log_test("Resource Management", "HTTP Request Body Size Limit", "INFO", str(e)))

    # ------------------------------------------------------------------
    # 3. Injection Vulnerabilities (Stored XSS & CSV Injection)
    # ------------------------------------------------------------------
    # Stored XSS check on HTML template
    with open("server.py", "r", encoding="utf-8") as f:
        server_code = f.read()

    if "html.escape" in server_code or "escape(" in server_code:
        results.append(log_test("Injection Defense", "HTML Entity Encoding in Admin Dashboard", "PASS", "html.escape is implemented."))
    else:
        results.append(log_test("Injection Defense", "HTML Entity Encoding in Admin Dashboard", "FAIL", 
            "Student fields (name, email, hub, batch_code) rendered directly without html.escape(). Stored XSS risk if student inputs malicious payloads.", "HIGH"))

    # CSV Formula Injection check
    if "_render_csv" in server_code:
        if "_sanitize_csv_cell" in server_code and "startswith(('=', '+', '-', '@'" in server_code:
            results.append(log_test("Injection Defense", "CSV Formula Injection Sanitation", "PASS", "CSV fields sanitize spreadsheet formula triggers."))
        else:
            results.append(log_test("Injection Defense", "CSV Formula Injection Sanitation", "WARN", 
                "CSV exports student names/emails directly. If names begin with '=', '+', '-', or '@', spreadsheet applications may execute formulas.", "LOW"))

    # ------------------------------------------------------------------
    # 4. Summary & Scorecard
    # ------------------------------------------------------------------
    fail_count = sum(1 for r in results if r["status"] == "FAIL")
    warn_count = sum(1 for r in results if r["status"] == "WARN")
    pass_count = sum(1 for r in results if r["status"] == "PASS")

    print("=================================================================")
    print(f"   AUDIT SUMMARY: {pass_count} PASSED | {warn_count} WARNINGS | {fail_count} VULNERABILITIES")
    print("=================================================================")

if __name__ == "__main__":
    main()
