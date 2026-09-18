from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
def home():
    return {
        "message": "Exam Mark Calculator API is running"
    }


@app.post("/calculate")
def calculate(request: ExamRequest):

    # Cannot have more completed modules
    # than the total number of modules.
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

    return calculate_exam(
        number_of_modules=request.number_of_modules,
        completed_module_marks=request.completed_module_marks,
        target_percentage=request.target_percentage
    )