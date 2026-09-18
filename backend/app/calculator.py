def calculate_exam(
    number_of_modules: int,
    completed_module_marks: list[float],
    target_percentage: float = 40,
):
    completed_count = len(completed_module_marks)
    remaining_modules = number_of_modules - completed_count

    completed_marks = sum(completed_module_marks)

    # 1. Module Aggregate
    module_aggregate = (completed_marks / (number_of_modules * 20)) * 40
    
    # 2. Marks Needed To Pass (remaining contribution required)
    marks_needed = target_percentage - module_aggregate

    # ---------------------------------------------------------
    # CASE 1: All modules are completed
    # ---------------------------------------------------------
    if remaining_modules == 0:
        required_paper_mark = (marks_needed / 60) * 100

        if required_paper_mark > 100:
            return {
                "status": "INVALID INPUT",
                "message": "Required paper mark exceeds the maximum available mark of 100.",
                "target_percentage": target_percentage,
                "completed_modules": completed_count,
                "remaining_modules": 0,
                "completed_marks": completed_marks,
                "module_aggregate": module_aggregate,
                "module_aggregate_max": 40,
                "marks_needed": marks_needed,
                "required_percentage": required_paper_mark,
                "required_paper_marks": required_paper_mark,
            }

        if required_paper_mark < 0:
            required_paper_mark = 0

        return {
            "status": "PASS POSSIBLE",
            "target_percentage": target_percentage,
            "completed_modules": completed_count,
            "remaining_modules": 0,
            "completed_marks": completed_marks,
            "module_aggregate": module_aggregate,
            "module_aggregate_max": 40,
            "marks_needed": marks_needed,
            "required_percentage": required_paper_mark,
            "required_module_marks": [],
            "required_paper_marks": required_paper_mark,
        }

    # ---------------------------------------------------------
    # CASE 2: Modules + final paper are remaining
    # ---------------------------------------------------------
    
    denominator = (0.4 * remaining_modules / number_of_modules) + 0.6
    p = marks_needed / denominator

    required_module_mark = (p / 100) * 20
    required_paper_mark = p  # Since paper is out of 100

    if required_module_mark > 20:
        return {
            "status": "INVALID INPUT",
            "message": "Required mark exceeds the maximum available module mark of 20.",
            "target_percentage": target_percentage,
            "completed_modules": completed_count,
            "remaining_modules": remaining_modules,
            "completed_marks": completed_marks,
            "module_aggregate": module_aggregate,
            "module_aggregate_max": 40,
            "marks_needed": marks_needed,
            "required_percentage": p,
            "required_module_marks": [required_module_mark] * remaining_modules,
            "required_paper_marks": required_paper_mark,
        }

    if required_module_mark < 0:
        required_module_mark = 0
        required_paper_mark = 0
        p = 0

    return {
        "status": "PASS POSSIBLE",
        "target_percentage": target_percentage,
        "completed_modules": completed_count,
        "remaining_modules": remaining_modules,
        "completed_marks": completed_marks,
        "module_aggregate": module_aggregate,
        "module_aggregate_max": 40,
        "marks_needed": marks_needed,
        "required_percentage": p,
        "required_module_marks": [required_module_mark] * remaining_modules,
        "required_paper_marks": required_paper_mark,
    }