def calculate_exam(
    number_of_modules: int,
    completed_module_marks: list[float],
    target_percentage: float = 40,
):
    completed_count = len(completed_module_marks)
    remaining_modules = number_of_modules - completed_count

    completed_marks = sum(completed_module_marks)

    # 1. Module Aggregate (Secured from modules, out of 40)
    module_aggregate = (completed_marks / (number_of_modules * 20)) * 40
    
    # 2. Required Paper Contribution (Required to reach target, out of 60)
    # The paper exam has a 60% weight (maximum contribution is 60).
    marks_needed = target_percentage - module_aggregate

    # 3. Target Achievability
    # If required paper contribution <= 60: TARGET ACHIEVABLE
    # If required paper contribution > 60: TARGET UNACHIEVABLE
    is_achievable = marks_needed <= 60
    status = "TARGET ACHIEVABLE" if is_achievable else "TARGET UNACHIEVABLE"

    raw_paper_marks = (marks_needed / 60) * 20 if marks_needed > 0 else 0.0

    return {
        "status": status,
        "is_achievable": is_achievable,
        "target_percentage": target_percentage,
        "completed_modules": completed_count,
        "remaining_modules": remaining_modules,
        "completed_marks": completed_marks,
        "module_aggregate": module_aggregate,
        "module_aggregate_max": 40,
        "marks_needed": marks_needed,
        "required_paper_contribution": marks_needed,
        "required_paper_max": 60,
        "required_percentage": (marks_needed / 60) * 100 if marks_needed > 0 else 0.0,
        "required_paper_marks": raw_paper_marks,
        "required_module_marks": [],
    }