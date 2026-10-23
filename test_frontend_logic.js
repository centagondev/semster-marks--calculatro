// Comprehensive test suite for frontend calculation logic
const fs = require('fs');

// Extract calculateExam function from frontend/script.js
const scriptCode = fs.readFileSync(__dirname + '/frontend/script.js', 'utf8');

// Isolate calculateExam
const calcFuncMatch = scriptCode.match(/function calculateExam\(\{[\s\S]*?return \{[\s\S]*?\};\s*\}/);
if (!calcFuncMatch) {
    console.error("Failed to find calculateExam in script.js");
    process.exit(1);
}

// Evaluate calculateExam in local scope
const calculateExam = new Function(calcFuncMatch[0] + "\nreturn calculateExam;")();

// Part allocation helper matching script.js renderPartsBreakdown
function getPartsAllocation(marksNeeded60, perPartTarget) {
    let theoryNeeded = 0;
    let practicalNeeded = 3.0;
    let partTotalNeeded = perPartTarget;
    let isUnachievable = false;

    if (marksNeeded60 <= 0) {
        theoryNeeded = 0.0;
        practicalNeeded = 3.0;
        partTotalNeeded = 3.0;
    } else if (perPartTarget > 20.0) {
        isUnachievable = true;
        theoryNeeded = 10.0;
        practicalNeeded = 10.0;
        partTotalNeeded = perPartTarget;
    } else if (perPartTarget <= 3.0) {
        theoryNeeded = 0.0;
        practicalNeeded = 3.0;
        partTotalNeeded = 3.0;
    } else if (perPartTarget <= 6.0) {
        practicalNeeded = 3.0;
        theoryNeeded = perPartTarget - 3.0;
        partTotalNeeded = perPartTarget;
    } else {
        theoryNeeded = perPartTarget / 2.0;
        practicalNeeded = perPartTarget / 2.0;
        partTotalNeeded = perPartTarget;
    }

    return { theoryNeeded, practicalNeeded, partTotalNeeded, isUnachievable };
}

console.log("Running Frontend Logic Tests...\n");

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    }
    passed++;
}

// Test 1: User's exact scenario: 2 modules, 0 marks, Target 40%, 2 parts
{
    const res = calculateExam({
        number_of_modules: 2,
        completed_module_marks: [0, 0],
        target_percentage: 40,
        final_exam_parts: 2
    });
    assert(res.module_aggregate === 0.0, "Test 1: Module aggregate should be 0.0 / 40");
    assert(res.marks_needed === 40.0, "Test 1: Marks needed in paper exam should be 40.0 / 60");
    assert(Math.abs(res.required_score_20 - 13.3333) < 0.01, "Test 1: Required score out of 20 should be 13.33");
    
    const alloc = getPartsAllocation(res.marks_needed, res.required_score_20);
    assert(Math.abs(alloc.theoryNeeded - 6.67) < 0.01, "Test 1: Leveled theory should be 6.67");
    assert(Math.abs(alloc.practicalNeeded - 6.67) < 0.01, "Test 1: Leveled practical should be 6.67");
    assert(Math.abs(alloc.partTotalNeeded - 13.33) < 0.01, "Test 1: Part total should be 13.33");
}

// Test 2: Standard 5 modules, 2 completed (14, 16), Target 40%, 2 parts
{
    const res = calculateExam({
        number_of_modules: 5,
        completed_module_marks: [14, 16],
        target_percentage: 40,
        final_exam_parts: 2
    });
    // sum = 30, I = (30 / 100) * 40 = 12.0. Needed = 40 - 12 = 28.0 / 60
    assert(res.module_aggregate === 12.0, "Test 2: Module aggregate should be 12.0");
    assert(res.marks_needed === 28.0, "Test 2: Marks needed should be 28.0");
    // per part = 28 / 3 = 9.3333
    const alloc = getPartsAllocation(res.marks_needed, res.required_score_20);
    assert(Math.abs(alloc.theoryNeeded - 4.67) < 0.01, "Test 2: Leveled theory should be 4.67");
    assert(Math.abs(alloc.practicalNeeded - 4.67) < 0.01, "Test 2: Leveled practical should be 4.67");
    assert(Math.abs(alloc.partTotalNeeded - 9.33) < 0.01, "Test 2: Part total should be 9.33");
}

// Test 3: Low target where practical cutoff 3 dominates (Target already reached or very low)
{
    const res = calculateExam({
        number_of_modules: 2,
        completed_module_marks: [18, 19], // sum = 37 / 40 -> I = 37.0. Target = 40. Needed = 3.0 / 60
        target_percentage: 40,
        final_exam_parts: 1
    });
    // Needed = 3.0 / 60 -> Score out of 20 = 1.0 / 20.
    const alloc = getPartsAllocation(res.marks_needed, res.required_score_20);
    assert(alloc.practicalNeeded === 3.0, "Test 3: Practical must be at least 3.0 cutoff");
    assert(alloc.theoryNeeded === 0.0, "Test 3: Theory should be 0.0 since practical cutoff satisfies target");
    assert(alloc.partTotalNeeded === 3.0, "Test 3: Part total needed is 3.0");
}

// Test 4: Intermediate target between 3 and 6
{
    const alloc = getPartsAllocation(15.0, 5.0); // 15/60 -> 5/20
    assert(alloc.practicalNeeded === 3.0, "Test 4: Practical is mandatory minimum 3.0");
    assert(alloc.theoryNeeded === 2.0, "Test 4: Theory covers remaining 2.0");
    assert(alloc.partTotalNeeded === 5.0, "Test 4: Part total is 5.0");
}

// Test 5: Boundary at 6.0
{
    const alloc = getPartsAllocation(18.0, 6.0); // 18/60 -> 6/20
    assert(alloc.practicalNeeded === 3.0, "Test 5: Practical is 3.0");
    assert(alloc.theoryNeeded === 3.0, "Test 5: Theory is 3.0");
    assert(alloc.partTotalNeeded === 6.0, "Test 5: Total is 6.0");
}

// Test 6: Boundary at 20.0
{
    const alloc = getPartsAllocation(60.0, 20.0); // 60/60 -> 20/20
    assert(alloc.practicalNeeded === 10.0, "Test 6: Practical is 10.0");
    assert(alloc.theoryNeeded === 10.0, "Test 6: Theory is 10.0");
    assert(alloc.partTotalNeeded === 20.0, "Test 6: Total is 20.0");
}

// Test 7: Unachievable target (> 20.0)
{
    const alloc = getPartsAllocation(65.0, 21.67);
    assert(alloc.isUnachievable === true, "Test 7: Should be unachievable");
}

// Test 8: Practical cutoff violation test (< 3)
{
    const res = calculateExam({
        number_of_modules: 2,
        completed_module_marks: [20, 20],
        target_percentage: 40,
        final_practical_score: 2.5
    });
    assert(res.status === "FAIL", "Test 8: Practical score < 3 must result in FAIL");
}

// Test 9: Practical cutoff met (>= 3) with target met
{
    const res = calculateExam({
        number_of_modules: 2,
        completed_module_marks: [20, 20],
        target_percentage: 40,
        final_practical_score: 3.0
    });
    assert(res.status === "PASS", "Test 9: Practical score >= 3 with target met must result in PASS");
}

// Test 10: Validation errors (N > 7, P > N, negative marks, etc.)
{
    let caughtN = false;
    try {
        calculateExam({ number_of_modules: 8, completed_module_marks: [] });
    } catch (e) {
        caughtN = true;
    }
    assert(caughtN, "Test 10: Modules > 7 must throw Error");

    let caughtP = false;
    try {
        calculateExam({ number_of_modules: 2, completed_module_marks: [], final_exam_parts: 3 });
    } catch (e) {
        caughtP = true;
    }
    assert(caughtP, "Test 10: Parts > Modules must throw Error");
}

console.log(`All ${passed} / ${total} frontend logic tests passed successfully!\n`);
