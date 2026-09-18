from pydantic import BaseModel, Field


class ExamRequest(BaseModel):
    number_of_modules: int = Field(gt=0)

    completed_module_marks: list[float] = Field(
        default_factory=list
    )

    target_percentage: float = Field(
        default=40,
        gt=0,
        le=100
    )