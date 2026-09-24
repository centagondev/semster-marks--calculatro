from backend.app.calculator import calculate_exam

# 1. Target Achievable test
res1 = calculate_exam(number_of_modules=4, completed_module_marks=[15, 0, 0, 0], target_percentage=40)
print("Achievable case:", res1)
assert res1["is_achievable"] is True
assert res1["status"] == "TARGET ACHIEVABLE"

# 2. User Example: Target = 80, Secured = 12 / 40 -> Required = 68 / 60 -> TARGET UNACHIEVABLE
res2 = calculate_exam(number_of_modules=1, completed_module_marks=[6], target_percentage=80)
print("Unachievable case (example):", res2)
assert res2["is_achievable"] is False
assert res2["status"] == "TARGET UNACHIEVABLE"
assert res2["module_aggregate"] == 12.0
assert res2["marks_needed"] == 68.0

print("All tests passed successfully!")
