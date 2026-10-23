from pydantic import BaseModel, Field


class ExamRequest(BaseModel):
    number_of_modules: int = Field(gt=0, le=7, description="Total number of registered internal modules (1 to 7 max)")

    completed_module_marks: list[float] = Field(
        default_factory=list,
        description="List of marks scored in completed modules (each out of 20)"
    )

    target_percentage: float = Field(
        default=40,
        gt=0,
        le=100,
        description="Overall target percentage (0-100)"
    )

    final_exam_parts: int = Field(
        default=1,
        gt=0,
        le=7,
        description="Number of parts in the final examination (must be <= number of modules)"
    )

    final_practical_score: float | None = Field(
        default=None,
        ge=0.0,
        le=10.0,
        description="Separate final practical score out of 10 (Mandatory cutoff: 3/10)"
    )

    raw_final_exam_marks: float | None = Field(
        default=None,
        ge=0.0,
        description="Optional raw final exam marks earned across all parts"
    )