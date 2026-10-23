def calculate_exam(
    number_of_modules: int,
    completed_module_marks: list[float],
    target_percentage: float = 40.0,
    final_exam_parts: int = 1,
    final_practical_score: float | None = None,
    raw_final_exam_marks: float | None = None,
):
    # Validation checks
    if number_of_modules < 1:
        raise ValueError("Number of modules must be at least 1.")
    if number_of_modules > 7:
        raise ValueError("Number of modules cannot exceed 7.")
    if final_exam_parts < 1:
        raise ValueError("Number of final-exam parts must be at least 1.")
    if final_exam_parts > number_of_modules:
        raise ValueError("Final-exam parts cannot exceed the number of modules.")
    if target_percentage <= 0 or target_percentage > 100:
        raise ValueError("Target percentage must be between 0 and 100.")
    if len(completed_module_marks) > number_of_modules:
        raise ValueError("Completed modules cannot exceed total number of modules.")
    for mark in completed_module_marks:
        if mark < 0 or mark > 20:
            raise ValueError("Each module mark must be between 0 and 20.")
    if final_practical_score is not None:
        if final_practical_score < 0 or final_practical_score > 10:
            raise ValueError("Final practical score must be between 0 and 10.")

    raw_exam_max = 20 * final_exam_parts
    if raw_final_exam_marks is not None:
        if raw_final_exam_marks < 0 or raw_final_exam_marks > raw_exam_max:
            raise ValueError(f"Raw final exam marks must be between 0 and {raw_exam_max}.")

    # 1. Internal Assessment Contribution (I out of 40)
    # Total internal marks earned / (20 * N) * 40
    # Incomplete modules count as zero
    completed_count = len(completed_module_marks)
    remaining_modules = max(0, number_of_modules - completed_count)
    completed_marks = float(sum(completed_module_marks))

    module_aggregate = (completed_marks / (number_of_modules * 20.0)) * 40.0
    module_aggregate = min(40.0, max(0.0, module_aggregate))

    # 2. Required Final Exam Contribution (F_needed out of 60)
    raw_needed = target_percentage - module_aggregate
    marks_needed = max(0.0, raw_needed)

    # 3. Required Raw Final Exam Marks (M_needed out of 20P)
    # M_needed = (F_needed / 60) * 20P
    required_raw_marks = (marks_needed / 60.0) * float(raw_exam_max)

    # 4. Equivalent Final Exam Score out of 20
    # F_20 = F_needed / 3 = (marks_needed / 60) * 20
    required_score_20 = marks_needed / 3.0

    # Target Achievability
    is_achievable = raw_needed <= 60.0

    # 5. Mandatory Final Practical Cutoff (3.0 out of 10)
    practical_passed = None
    if final_practical_score is not None:
        practical_passed = (final_practical_score >= 3.0)

    # 6. Overall Result (R = I + (M / 20P) * 60)
    if raw_final_exam_marks is not None:
        final_exam_contribution = (raw_final_exam_marks / float(raw_exam_max)) * 60.0
        overall_result = module_aggregate + final_exam_contribution
        actual_score_20 = final_exam_contribution / 3.0
    else:
        final_exam_contribution = 0.0
        overall_result = module_aggregate
        actual_score_20 = 0.0

    # 7. Status Determination
    # Rules:
    # - Practical score below 3/10: FAIL (mandatory cutoff violated)
    # - If required raw marks exceed maximum available: TARGET UNACHIEVABLE
    # - Student passes if overall result reaches target AND practical score >= 3/10: PASS
    # - If target is reached but practical score is missing (not entered): CONDITIONAL (no false PASS)
    # - If target is not yet reached and achievable: TARGET ACHIEVABLE
    is_target_met = (raw_needed <= 0.0) or (raw_final_exam_marks is not None and overall_result >= target_percentage)

    if final_practical_score is not None and final_practical_score < 3.0:
        status = "FAIL"
    elif not is_achievable:
        status = "TARGET UNACHIEVABLE"
    elif is_target_met:
        if final_practical_score is not None and final_practical_score >= 3.0:
            status = "PASS"
        else:
            # Practical score missing: CONDITIONAL
            # (Aggregate target is reached, but mandatory practical eligibility requires verification)
            status = "CONDITIONAL"
    else:
        if raw_final_exam_marks is not None and overall_result < target_percentage:
            status = "FAIL"
        else:
            status = "TARGET ACHIEVABLE"

    part_weight = 60.0 / final_exam_parts

    per_part_target = required_score_20  # marks_needed / 3.0 (out of 20)
    if not is_achievable or per_part_target > 20.0:
        practical_req = 10.0
        theory_req = 10.0
        part_total_req = 20.0
    elif per_part_target <= 3.0:
        practical_req = 3.0  # mandatory cutoff
        theory_req = 0.0
        part_total_req = 3.0
    elif per_part_target <= 6.0:
        practical_req = 3.0  # mandatory cutoff
        theory_req = per_part_target - 3.0
        part_total_req = per_part_target
    else:
        # After allocating base 3.0 to practical and theory, equalize remaining marks equally
        practical_req = per_part_target / 2.0
        theory_req = per_part_target / 2.0
        part_total_req = per_part_target

    parts_breakdown = [
        {
            "part_number": p,
            "max_marks": 20.0,
            "required_total": part_total_req,
            "theory": {
                "max_marks": 10.0,
                "cutoff": None,
                "required_marks": theory_req,
            },
            "practical": {
                "max_marks": 10.0,
                "cutoff": 3.0,
                "required_marks": practical_req,
            },
        }
        for p in range(1, final_exam_parts + 1)
    ]

    return {
        "status": status,
        "is_achievable": is_achievable,
        "is_target_achieved": raw_needed <= 0.0,
        "target_percentage": float(target_percentage),
        "number_of_modules": int(number_of_modules),
        "completed_modules": int(completed_count),
        "remaining_modules": int(remaining_modules),
        "completed_marks": completed_marks,
        "module_aggregate": module_aggregate,
        "module_aggregate_max": 40.0,
        "final_exam_parts": int(final_exam_parts),
        "raw_exam_max": int(raw_exam_max),
        "part_max_marks": 20.0,
        "part_weight": part_weight,
        "marks_needed": marks_needed,
        "required_paper_contribution": marks_needed,
        "required_paper_max": 60.0,
        "required_raw_marks": required_raw_marks,
        "required_score_20": required_score_20,
        "required_percentage": (marks_needed / 60.0) * 100.0 if marks_needed > 0 else 0.0,
        "final_practical_score": final_practical_score,
        "practical_cutoff": 3.0,
        "practical_cutoff_max": 10.0,
        "practical_passed": practical_passed,
        "overall_result": overall_result,
        "raw_final_exam_marks": raw_final_exam_marks,
        "final_exam_contribution": final_exam_contribution,
        "actual_score_20": actual_score_20,
        "required_module_marks": [],
        "parts_breakdown": parts_breakdown,
    }