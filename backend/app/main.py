import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .schema import ExamRequest
from .calculator import calculate_exam

app = FastAPI(
    title="Exam Mark Calculator",
    description="Calculate minimum marks required to achieve a target percentage",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
data_dir = Path(__file__).resolve().parent.parent.parent / "data"
students_file = data_dir / "students.json"

if frontend_dir.exists():
    app.mount("/demo", StaticFiles(directory=str(frontend_dir), html=True), name="demo")


def _get_students():
    if not students_file.exists():
        return []
    try:
        import json
        with open(students_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_students(students):
    data_dir.mkdir(parents=True, exist_ok=True)
    import json
    with open(students_file, "w", encoding="utf-8") as f:
        json.dump(students, f, indent=2, ensure_ascii=False)


@app.get("/")
def home():
    return {
        "message": "Exam Mark Calculator API is running"
    }


@app.post("/api/students")
def register_student(payload: dict):
    from datetime import datetime
    students = _get_students()
    email = (payload.get("email") or "").strip().lower()
    google_id = payload.get("google_id") or payload.get("sub") or ""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    hub_names = {
        "BCK": "Kozhikode",
        "BCR": "Remote",
        "BCE": "Ernakulam",
        "BCT": "Trivandrum"
    }
    hub = (payload.get("hub") or "").strip().upper()
    batch = (payload.get("batch") or "").strip()
    hub_name = (payload.get("hub_name") or "").strip() or hub_names.get(hub, "")
    batch_code = (payload.get("batch_code") or "").strip().upper()
    if hub and batch and not batch_code:
        batch_code = f"{hub} {batch}"

    existing = None
    if google_id:
        for s in students:
            if s.get("google_id") == google_id:
                existing = s
                break
    if not existing and email:
        for s in students:
            if s.get("email", "").lower() == email and not s.get("google_id"):
                existing = s
                existing["google_id"] = google_id
                break

    if existing:
        existing["last_active"] = now_iso
        existing["visit_count"] = int(existing.get("visit_count", 1)) + 1
        if payload.get("name"):
            existing["name"] = payload["name"]
        if payload.get("picture"):
            existing["picture"] = payload["picture"]
        if hub:
            existing["hub"] = hub
        if hub_name:
            existing["hub_name"] = hub_name
        if batch:
            existing["batch"] = batch
        if batch_code:
            existing["batch_code"] = batch_code
        if google_id:
            existing["google_id"] = google_id
        record = existing
    else:
        next_id = max([s.get("id", 0) for s in students], default=0) + 1
        record = {
            "id": next_id,
            "google_id": google_id,
            "name": payload.get("name") or "Student",
            "email": email or "unknown@student.edu",
            "picture": payload.get("picture") or "",
            "hub": hub,
            "hub_name": hub_name,
            "batch": batch,
            "batch_code": batch_code,
            "first_login": now_iso,
            "last_active": now_iso,
            "visit_count": 1,
            "calculations_count": 0,
            "user_agent": payload.get("user_agent") or ""
        }
        students.append(record)

    _save_students(students)
    is_admin = email in ADMIN_EMAILS
    return {"status": "success", "student": record, "total_students": len(students), "is_admin": is_admin}


@app.post("/api/students/calc")
def track_calc(payload: dict):
    from datetime import datetime
    email = (payload.get("email") or "").strip().lower()
    if not email:
        return {"status": "skipped"}
    students = _get_students()
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for s in students:
        if s.get("email", "").lower() == email:
            s["calculations_count"] = s.get("calculations_count", 0) + 1
            s["last_active"] = now_iso
            _save_students(students)
            break
    return {"status": "success"}


ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "centagon@admin")
ADMIN_EMAILS = set(
    e.strip().lower() for e in os.environ.get(
        "ADMIN_EMAILS",
        "dhanishmohd1136@gmail.com,admin@centagon.in"
    ).split(",") if e.strip()
)

@app.get("/api/students")
def list_students(key: str = None, email: str = None):
    is_auth = (key == ADMIN_PASSWORD) or (email and email.strip().lower() in ADMIN_EMAILS)
    if not is_auth:
        raise HTTPException(status_code=404, detail="Not Found")
    students = _get_students()
    return {"status": "success", "total": len(students), "students": students}


@app.post("/calculate")
def calculate(request: ExamRequest):
    # Cannot have more completed modules than the total number of modules
    if len(request.completed_module_marks) > request.number_of_modules:
        raise HTTPException(
            status_code=400,
            detail="Completed modules cannot exceed the total number of modules."
        )

    # Validate individual module marks
    for mark in request.completed_module_marks:
        if mark < 0 or mark > 20:
            raise HTTPException(
                status_code=400,
                detail="Each module mark must be between 0 and 20."
            )

    if request.number_of_modules > 7:
        raise HTTPException(
            status_code=400,
            detail="Number of modules cannot exceed 7."
        )

    if request.final_exam_parts < 1:
        raise HTTPException(
            status_code=400,
            detail="Number of final-exam parts must be at least 1."
        )

    if request.final_exam_parts > request.number_of_modules:
        raise HTTPException(
            status_code=400,
            detail="Final-exam parts cannot exceed the number of modules."
        )

    if request.final_practical_score is not None:
        if request.final_practical_score < 0 or request.final_practical_score > 10:
            raise HTTPException(
                status_code=400,
                detail="Final practical score must be between 0 and 10."
            )

    try:
        return calculate_exam(
            number_of_modules=request.number_of_modules,
            completed_module_marks=request.completed_module_marks,
            target_percentage=request.target_percentage,
            final_exam_parts=request.final_exam_parts,
            final_practical_score=request.final_practical_score,
            raw_final_exam_marks=request.raw_final_exam_marks
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))