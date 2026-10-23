from backend.app.calculator import calculate_exam


def test_1_one_final_exam_part_max_20_raw_marks():
    """1. One final-exam part: maximum 20 raw marks."""
    res = calculate_exam(
        number_of_modules=4,
        completed_module_marks=[10, 10],
        target_percentage=40,
        final_exam_parts=1,
    )
    assert res["final_exam_parts"] == 1
    assert res["raw_exam_max"] == 20
    assert res["part_max_marks"] == 20.0
    assert res["part_weight"] == 60.0


def test_2_two_final_exam_parts_max_40_raw_marks():
    """2. Two final-exam parts: maximum 40 raw marks."""
    res = calculate_exam(
        number_of_modules=4,
        completed_module_marks=[10, 10],
        target_percentage=40,
        final_exam_parts=2,
    )
    assert res["final_exam_parts"] == 2
    assert res["raw_exam_max"] == 40
    assert res["part_max_marks"] == 20.0
    assert res["part_weight"] == 30.0


def test_3_five_internal_modules_grouped_into_two_final_exam_parts():
    """3. Five internal modules grouped into two final-exam parts (independence of N and P)."""
    # 5 internal modules, each out of 20 (max 100). Completed: 3 modules with 15 each (45 total).
    # Internal contribution I = (45 / (5 * 20)) * 40 = (45 / 100) * 40 = 18.0 / 40.
    # Target = 40. Needed contribution = 40 - 18 = 22.0 / 60.
    # P = 2 parts, max raw = 40.
    # Required raw marks M_needed = (22 / 60) * 40 = 14.666...
    res = calculate_exam(
        number_of_modules=5,
        completed_module_marks=[15, 15, 15],
        target_percentage=40,
        final_exam_parts=2,
    )
    assert res["number_of_modules"] == 5
    assert res["completed_modules"] == 3
    assert res["remaining_modules"] == 2
    assert res["module_aggregate"] == 18.0
    assert res["final_exam_parts"] == 2
    assert res["raw_exam_max"] == 40
    assert res["marks_needed"] == 22.0
    assert abs(res["required_raw_marks"] - (22.0 / 60.0 * 40.0)) < 1e-4
    assert abs(res["required_score_20"] - (22.0 / 3.0)) < 1e-4


def test_4_internal_contribution_below_40():
    """4. Internal contribution below 40."""
    # 5 modules, marks earned = 10, 10 -> sum = 20 / 100 -> I = 8.0 / 40
    res = calculate_exam(
        number_of_modules=5,
        completed_module_marks=[10, 10],
        target_percentage=50,
        final_exam_parts=2,
    )
    assert res["module_aggregate"] < 40.0
    assert res["module_aggregate"] == 8.0
    assert res["marks_needed"] == 42.0  # 50 - 8 = 42 out of 60
    assert res["is_achievable"] is True
    assert res["status"] == "TARGET ACHIEVABLE"


def test_5_internal_contribution_already_at_or_above_40():
    """5. Internal contribution already at or above 40."""
    # 2 modules, each scored 20/20 -> sum = 40/40 -> I = 40.0 / 40
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=2,
        final_practical_score=5.0,
    )
    assert res["module_aggregate"] == 40.0
    assert res["marks_needed"] == 0.0
    assert res["required_raw_marks"] == 0.0
    assert res["required_score_20"] == 0.0
    assert res["is_target_achieved"] is True
    assert res["status"] == "PASS"


def test_6_final_practical_score_of_2_out_of_10():
    """6. Final practical score of 2/10 (violates cutoff)."""
    res = calculate_exam(
        number_of_modules=4,
        completed_module_marks=[15, 15],
        target_percentage=40,
        final_exam_parts=2,
        final_practical_score=2.0,
    )
    assert res["final_practical_score"] == 2.0
    assert res["practical_passed"] is False
    assert res["status"] == "FAIL"


def test_7_final_practical_score_exactly_3_out_of_10():
    """7. Final practical score exactly 3/10 (satisfies cutoff)."""
    # High internal marks (I = 40) + practical exactly 3.0 -> PASS
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=1,
        final_practical_score=3.0,
    )
    assert res["final_practical_score"] == 3.0
    assert res["practical_passed"] is True
    assert res["status"] == "PASS"


def test_8_final_practical_score_above_3_out_of_10():
    """8. Final practical score above 3/10 (e.g., 8.5/10 satisfies cutoff)."""
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=1,
        final_practical_score=8.5,
    )
    assert res["final_practical_score"] == 8.5
    assert res["practical_passed"] is True
    assert res["status"] == "PASS"


def test_9_overall_target_achieved_but_practical_cutoff_failed():
    """9. Overall target achieved but practical cutoff failed."""
    # Student has full 40/40 in internal modules, target is 40.
    # But final practical score is 2.5/10 (< 3/10). Must be FAIL.
    # High internal aggregate must not bypass the mandatory final practical cutoff.
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=2,
        final_practical_score=2.5,
    )
    assert res["module_aggregate"] == 40.0
    assert res["marks_needed"] == 0.0
    assert res["is_target_achieved"] is True
    assert res["practical_passed"] is False
    assert res["status"] == "FAIL"


def test_10_overall_target_and_practical_cutoff_both_satisfied():
    """10. Overall target and practical cutoff both satisfied."""
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=2,
        final_practical_score=4.0,
    )
    assert res["module_aggregate"] >= 40.0
    assert res["marks_needed"] == 0.0
    assert res["practical_passed"] is True
    assert res["status"] == "PASS"


def test_11_unachievable_target():
    """11. Unachievable target (required final exam contribution > 60)."""
    # N=1, mark=6 -> I = (6/20)*40 = 12. Target=80.
    # F_needed = 80 - 12 = 68. Max available paper contribution is 60.
    res = calculate_exam(
        number_of_modules=1,
        completed_module_marks=[6],
        target_percentage=80,
        final_exam_parts=1,
    )
    assert res["module_aggregate"] == 12.0
    assert res["marks_needed"] == 68.0
    assert res["is_achievable"] is False
    assert res["status"] == "TARGET UNACHIEVABLE"


def test_12_missing_practical_score():
    """12. Missing practical score (overall status must be CONDITIONAL when target is met)."""
    # Student has full 40/40 internally, target 40%. Practical score not entered (None).
    # Must NOT assume PASS; must show CONDITIONAL.
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[20, 20],
        target_percentage=40,
        final_exam_parts=2,
        final_practical_score=None,
    )
    assert res["module_aggregate"] == 40.0
    assert res["marks_needed"] == 0.0
    assert res["final_practical_score"] is None
    assert res["practical_passed"] is None
    assert res["status"] == "CONDITIONAL"
    assert res["is_target_achieved"] is True


def test_13_invalid_part_counts_and_invalid_marks():
    """13. Invalid part counts and invalid marks."""
    # Invalid final exam parts (< 1)
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[10], final_exam_parts=0)
        assert False, "Should raise ValueError for final_exam_parts < 1"
    except ValueError:
        pass

    # Invalid module count (< 1)
    try:
        calculate_exam(number_of_modules=0, completed_module_marks=[], final_exam_parts=1)
        assert False, "Should raise ValueError for number_of_modules < 1"
    except ValueError:
        pass

    # Invalid module mark (> 20)
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[25], final_exam_parts=1)
        assert False, "Should raise ValueError for module mark > 20"
    except ValueError:
        pass

    # Invalid module mark (< 0)
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[-2], final_exam_parts=1)
        assert False, "Should raise ValueError for module mark < 0"
    except ValueError:
        pass

    # Completed modules exceeding number_of_modules
    try:
        calculate_exam(number_of_modules=1, completed_module_marks=[10, 10], final_exam_parts=1)
        assert False, "Should raise ValueError when completed modules > number_of_modules"
    except ValueError:
        pass

    # Invalid practical score (> 10)
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[10], final_practical_score=11.0)
        assert False, "Should raise ValueError for practical score > 10"
    except ValueError:
        pass

    # Invalid practical score (< 0)
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[10], final_practical_score=-1.0)
        assert False, "Should raise ValueError for practical score < 0"
    except ValueError:
        pass

    # Invalid target percentage
    try:
        calculate_exam(number_of_modules=2, completed_module_marks=[10], target_percentage=105)
        assert False, "Should raise ValueError for target_percentage > 100"
    except ValueError:
        pass

    # Number of modules exceeding 7
    try:
        calculate_exam(number_of_modules=8, completed_module_marks=[10], final_exam_parts=1)
        assert False, "Should raise ValueError for number_of_modules > 7"
    except ValueError:
        pass

    # Final-exam parts exceeding number of modules (P > N)
    try:
        calculate_exam(number_of_modules=3, completed_module_marks=[10], final_exam_parts=4)
        assert False, "Should raise ValueError for final_exam_parts > number_of_modules"
    except ValueError:
        pass


def test_14_equalized_and_leveled_parts_allocation():
    """14. Equalized & leveled parts allocation above mandatory 3 cutoff."""
    # N=2 modules with 0 marks, Target=40% -> Marks needed = 40.0 / 60
    # Score out of 20 = 13.33 / 20.
    # Parts = 2.
    # Each part needs 13.33 / 20 total.
    # Since 13.33 > 6.0, practical and theory are equalized / leveled: 13.33 / 2 = 6.666...
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[0, 0],
        target_percentage=40,
        final_exam_parts=2,
    )
    pb = res["parts_breakdown"]
    assert len(pb) == 2
    for p in pb:
        assert abs(p["required_total"] - (40.0 / 3.0)) < 1e-4
        assert abs(p["theory"]["required_marks"] - (40.0 / 6.0)) < 1e-4
        assert abs(p["practical"]["required_marks"] - (40.0 / 6.0)) < 1e-4
        assert p["practical"]["cutoff"] == 3.0


def test_15_practical_mandatory_cutoff_when_target_is_low():
    """15. Practical mandatory cutoff 3.0 dominates when target is small (T_part <= 3.0)."""
    # 2 modules, each scored 18.5 -> Sum = 37 -> I = (37/40)*40 = 37.0. Target = 40.
    # Marks needed = 3.0 / 60 -> Score out of 20 = 1.0.
    res = calculate_exam(
        number_of_modules=2,
        completed_module_marks=[18.5, 18.5],
        target_percentage=40,
        final_exam_parts=1,
    )
    pb = res["parts_breakdown"][0]
    assert pb["practical"]["required_marks"] == 3.0
    assert pb["theory"]["required_marks"] == 0.0
    assert pb["required_total"] == 3.0


def test_16_intermediate_target_theory_fills_to_3():
    """16. Intermediate target between 3.0 and 6.0: Practical is 3.0, Theory covers remainder."""
    # Needed = 15.0 / 60 -> Score out of 20 = 5.0 / 20.
    # 1 module, scored 12.5 -> I = (12.5/20)*40 = 25.0. Target = 40. Needed = 15.0 / 60.
    res = calculate_exam(
        number_of_modules=1,
        completed_module_marks=[12.5],
        target_percentage=40,
        final_exam_parts=1,
    )
    pb = res["parts_breakdown"][0]
    assert abs(pb["required_total"] - 5.0) < 1e-4
    assert abs(pb["practical"]["required_marks"] - 3.0) < 1e-4
    assert abs(pb["theory"]["required_marks"] - 2.0) < 1e-4


def test_17_full_part_marks_20_out_of_20():
    """17. Maximum achievable paper requirement (20/20 per part): Theory 10.0 and Practical 10.0."""
    # 1 module, scored 0 -> I = 0. Target = 60 -> Needed = 60.0 / 60 -> Score out of 20 = 20.0.
    res = calculate_exam(
        number_of_modules=1,
        completed_module_marks=[0],
        target_percentage=60,
        final_exam_parts=1,
    )
    pb = res["parts_breakdown"][0]
    assert abs(pb["required_total"] - 20.0) < 1e-4
    assert abs(pb["practical"]["required_marks"] - 10.0) < 1e-4
    assert abs(pb["theory"]["required_marks"] - 10.0) < 1e-4


def test_18_maximum_7_modules_and_7_parts():
    """18. Maximum 7 modules and 7 parts boundary."""
    res = calculate_exam(
        number_of_modules=7,
        completed_module_marks=[10] * 7,
        target_percentage=50,
        final_exam_parts=7,
    )
    assert res["number_of_modules"] == 7
    assert res["final_exam_parts"] == 7
    assert len(res["parts_breakdown"]) == 7


if __name__ == "__main__":
    test_1_one_final_exam_part_max_20_raw_marks()
    test_2_two_final_exam_parts_max_40_raw_marks()
    test_3_five_internal_modules_grouped_into_two_final_exam_parts()
    test_4_internal_contribution_below_40()
    test_5_internal_contribution_already_at_or_above_40()
    test_6_final_practical_score_of_2_out_of_10()
    test_7_final_practical_score_exactly_3_out_of_10()
    test_8_final_practical_score_above_3_out_of_10()
    test_9_overall_target_achieved_but_practical_cutoff_failed()
    test_10_overall_target_and_practical_cutoff_both_satisfied()
    test_11_unachievable_target()
    test_12_missing_practical_score()
    test_13_invalid_part_counts_and_invalid_marks()
    test_14_equalized_and_leveled_parts_allocation()
    test_15_practical_mandatory_cutoff_when_target_is_low()
    test_16_intermediate_target_theory_fills_to_3()
    test_17_full_part_marks_20_out_of_20()
    test_18_maximum_7_modules_and_7_parts()
    print("All 18 unit tests passed successfully!")
