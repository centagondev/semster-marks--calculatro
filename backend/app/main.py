from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schema import ExamRequest
from .calculator import calculate_exam


from pathlib import Path
from fastapi.staticfiles import StaticFiles

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
if frontend_dir.exists():
    app.mount("/demo", StaticFiles(directory=str(frontend_dir), html=True), name="demo")



@app.get("/")
def home():
    return {
        "message": "Exam Mark Calculator API is running"
    }


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