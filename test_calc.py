from backend.app.calculator import calculate_exam
res = calculate_exam(number_of_modules=4, completed_module_marks=[15, 0, 0, 0], target_percentage=40)
print(res)
