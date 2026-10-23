// Exam Mark Calculator - Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
    const refs = {
        numModules: document.getElementById('num-modules'),
        modulesContainer: document.getElementById('dynamic-modules'),
        addModuleBtn: document.getElementById('add-module-btn'),
        modulesStatus: document.getElementById('modules-status'),
        targetBtns: document.querySelectorAll('.target-btn'),
        customTarget: document.getElementById('custom-target'),
        calculateBtn: document.getElementById('calculate-btn'),
        errorBanner: document.getElementById('error-message'),
        errorText: document.getElementById('error-text'),
        resultDisplay: document.getElementById('result-display'),
        resultPlaceholder: document.getElementById('result-placeholder'),
        
        // Result fields
        resTarget: document.getElementById('res-target'),
        resModuleAggregate: document.getElementById('res-module-aggregate'),
        resModulesSummary: document.getElementById('res-modules-summary'),
        resMarksNeeded: document.getElementById('res-marks-needed'),
        resMarksPercentage: document.getElementById('res-marks-percentage'),
        
        // Convert to /20 & parts
        convert20Btn: document.getElementById('convert-20-btn'),
        convertBtnIcon: document.getElementById('convert-btn-icon'),
        convertPanel: document.getElementById('convert-panel'),
        numExamParts: document.getElementById('num-exam-parts'),
        partsMaxLimit: document.getElementById('parts-max-limit'),
        resConvertedScore: document.getElementById('res-converted-score'),
        resRawMarksLabel: document.getElementById('res-raw-marks-label'),
        resRawMarksNeeded: document.getElementById('res-raw-marks-needed'),
        resPerPartNeeded: document.getElementById('res-per-part-needed'),
        dynamicPartsContainer: document.getElementById('dynamic-parts-container'),

        // Status
        resStatusContainer: document.getElementById('res-status-container'),
        resStatusText: document.getElementById('res-status-text')
    };

    // State
    let state = {
        completedMarks: [
            { theory: 7, practical: 7 },
            { theory: 8, practical: 8 }
        ],
        partNames: [
            "Containerization & Cloud for ML",
            "ML API Design & Development",
            "Deep Learning Systems",
            "Big Data Processing",
            "MLOps & Deployment",
            "Advanced System Design",
            "Distributed Computing"
        ],
        partUserScores: Array.from({ length: 7 }, () => ({ theory: null, practical: null })),
        hasCalculated: false
    };

    let lastCalcData = null;

    function formatNumber(num) {
        return Math.max(0, num).toString().padStart(2, '0');
    }

    // Calculator Core Function
    function calculateExam({
        number_of_modules,
        completed_module_marks,
        target_percentage = 40,
        final_exam_parts = 1,
        final_practical_score = null,
        raw_final_exam_marks = null
    }) {
        if (number_of_modules < 1 || number_of_modules > 7) {
            throw new Error("Number of modules must be between 1 and 7.");
        }
        if (final_exam_parts < 1) {
            throw new Error("Number of final-exam parts must be at least 1.");
        }
        if (final_exam_parts > number_of_modules) {
            throw new Error("Final-exam parts cannot exceed the number of modules.");
        }
        if (target_percentage <= 0 || target_percentage > 100) {
            throw new Error("Target percentage must be between 0 and 100.");
        }
        if (completed_module_marks.length > number_of_modules) {
            throw new Error("Completed modules cannot exceed total number of modules.");
        }
        for (const mark of completed_module_marks) {
            if (mark < 0 || mark > 20) {
                throw new Error("Each module mark must be between 0 and 20.");
            }
        }
        if (final_practical_score !== null && !isNaN(final_practical_score)) {
            if (final_practical_score < 0 || final_practical_score > 10) {
                throw new Error("Final practical score must be between 0 and 10.");
            }
        }

        const raw_exam_max = 20 * final_exam_parts;
        if (raw_final_exam_marks !== null && !isNaN(raw_final_exam_marks)) {
            if (raw_final_exam_marks < 0 || raw_final_exam_marks > raw_exam_max) {
                throw new Error(`Raw final exam marks must be between 0 and ${raw_exam_max}.`);
            }
        }

        // 1. Internal Assessment Contribution (I out of 40)
        // I = (Sum of Marks / 20N) * 40
        const completed_count = completed_module_marks.length;
        const remaining_modules = Math.max(0, number_of_modules - completed_count);
        const completed_marks = completed_module_marks.reduce((sum, mark) => sum + mark, 0);

        let module_aggregate = (completed_marks / (number_of_modules * 20.0)) * 40.0;
        module_aggregate = Math.min(40.0, Math.max(0.0, module_aggregate));

        // 2. Required Final Exam Contribution (F_needed out of 60)
        const raw_needed = target_percentage - module_aggregate;
        const marks_needed = Math.max(0.0, raw_needed);

        // 3. Required Raw Final Exam Marks (M_needed out of 20P)
        const required_raw_marks = (marks_needed / 60.0) * raw_exam_max;

        // 4. Equivalent Final Exam Score out of 20 (F_20 = F_needed / 3)
        const required_score_20 = marks_needed / 3.0;

        // Target Achievability
        const is_achievable = raw_needed <= 60.0;

        // 5. Mandatory Final Practical Cutoff (3.0 / 10 if entered)
        let practical_passed = null;
        if (final_practical_score !== null && !isNaN(final_practical_score)) {
            practical_passed = (final_practical_score >= 3.0);
        }

        // 6. Overall Result
        let final_exam_contribution = 0.0;
        let overall_result = module_aggregate;
        let actual_score_20 = 0.0;
        if (raw_final_exam_marks !== null && !isNaN(raw_final_exam_marks)) {
            final_exam_contribution = (raw_final_exam_marks / raw_exam_max) * 60.0;
            overall_result = module_aggregate + final_exam_contribution;
            actual_score_20 = final_exam_contribution / 3.0;
        }

        // 7. Status Determination
        const is_target_met = (raw_needed <= 0.0) || (raw_final_exam_marks !== null && overall_result >= target_percentage);

        let status;
        if (final_practical_score !== null && !isNaN(final_practical_score) && final_practical_score < 3.0) {
            status = "FAIL";
        } else if (!is_achievable) {
            status = "TARGET UNACHIEVABLE";
        } else if (is_target_met) {
            if (final_practical_score !== null && !isNaN(final_practical_score)) {
                status = final_practical_score >= 3.0 ? "PASS" : "FAIL";
            } else {
                status = "TARGET ACHIEVED";
            }
        } else {
            if (raw_final_exam_marks !== null && overall_result < target_percentage) {
                status = "FAIL";
            } else {
                status = "TARGET ACHIEVABLE";
            }
        }

        const part_weight = 60.0 / final_exam_parts;

        return {
            status: status,
            is_achievable: is_achievable,
            is_target_achieved: raw_needed <= 0.0,
            target_percentage: target_percentage,
            number_of_modules: number_of_modules,
            completed_modules: completed_count,
            remaining_modules: remaining_modules,
            completed_marks: completed_marks,
            module_aggregate: module_aggregate,
            module_aggregate_max: 40.0,
            final_exam_parts: final_exam_parts,
            raw_exam_max: raw_exam_max,
            part_max_marks: 20.0,
            part_weight: part_weight,
            marks_needed: marks_needed,
            required_paper_contribution: marks_needed,
            required_paper_max: 60.0,
            required_raw_marks: required_raw_marks,
            required_score_20: required_score_20,
            required_percentage: marks_needed > 0 ? (marks_needed / 60.0) * 100.0 : 0.0,
            final_practical_score: final_practical_score,
            practical_cutoff: 3.0,
            practical_cutoff_max: 10.0,
            practical_passed: practical_passed,
            overall_result: overall_result,
            raw_final_exam_marks: raw_final_exam_marks,
            final_exam_contribution: final_exam_contribution,
            actual_score_20: actual_score_20,
            required_module_marks: []
        };
    }

    // Module management
    function renderModules() {
        let totalModules = parseInt(refs.numModules.value) || 1;
        if (totalModules < 1) totalModules = 1;
        if (totalModules > 7) totalModules = 7;
        
        // Sync parts limits
        if (refs.partsMaxLimit) refs.partsMaxLimit.textContent = totalModules;
        if (refs.numExamParts) {
            refs.numExamParts.max = totalModules;
            if (parseInt(refs.numExamParts.value) > totalModules) {
                refs.numExamParts.value = totalModules;
            }
        }

        // Cap completed modules at total modules
        if (state.completedMarks.length > totalModules) {
            state.completedMarks = state.completedMarks.slice(0, totalModules);
        }

        // Update status label
        refs.modulesStatus.textContent = `${formatNumber(state.completedMarks.length)} / ${formatNumber(totalModules)} COMPLETED`;
        
        // Disable/hide add button if max reached
        if (state.completedMarks.length >= totalModules) {
            refs.addModuleBtn.style.display = 'none';
        } else {
            refs.addModuleBtn.style.display = 'block';
        }

        // Render DOM inputs
        refs.modulesContainer.innerHTML = '';
        state.completedMarks.forEach((markObj, idx) => {
            const row = document.createElement('div');
            row.className = 'module-row';
            
            const label = document.createElement('div');
            label.className = 'module-label';
            label.textContent = formatNumber(idx + 1);
            
            const inputsContainer = document.createElement('div');
            inputsContainer.className = 'module-inputs-container';
            
            // Theory Input
            const theoryWrapper = document.createElement('div');
            theoryWrapper.className = 'module-input-wrapper';
            
            const theoryLabel = document.createElement('span');
            theoryLabel.className = 'input-label-small';
            theoryLabel.textContent = 'THEORY';
            
            const theoryInput = document.createElement('input');
            theoryInput.type = 'number';
            theoryInput.min = '0';
            theoryInput.max = '10';
            theoryInput.step = '0.1';
            theoryInput.value = markObj.theory;
            theoryInput.setAttribute('aria-label', `Theory mark for Module ${idx + 1}`);
            
            const handleTheoryUpdate = (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                if (val > 10) val = 10;
                if (e.type === 'change') {
                    e.target.value = val;
                }
                state.completedMarks[idx].theory = val;
                if (state.hasCalculated) recalculate();
            };
            theoryInput.addEventListener('change', handleTheoryUpdate);
            theoryInput.addEventListener('input', handleTheoryUpdate);
            
            const theorySuffix = document.createElement('span');
            theorySuffix.className = 'input-suffix';
            theorySuffix.textContent = '/ 10';
            
            theoryWrapper.appendChild(theoryLabel);
            theoryWrapper.appendChild(theoryInput);
            theoryWrapper.appendChild(theorySuffix);
            
            // Practical Input
            const pracWrapper = document.createElement('div');
            pracWrapper.className = 'module-input-wrapper';
            
            const pracLabel = document.createElement('span');
            pracLabel.className = 'input-label-small';
            pracLabel.textContent = 'PRACTICAL';
            
            const pracInput = document.createElement('input');
            pracInput.type = 'number';
            pracInput.min = '0';
            pracInput.max = '10';
            pracInput.step = '0.1';
            pracInput.value = markObj.practical;
            pracInput.setAttribute('aria-label', `Practical mark for Module ${idx + 1}`);
            
            const handlePracUpdate = (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                if (val > 10) val = 10;
                if (e.type === 'change') {
                    e.target.value = val;
                }
                state.completedMarks[idx].practical = val;
                if (state.hasCalculated) recalculate();
            };
            pracInput.addEventListener('change', handlePracUpdate);
            pracInput.addEventListener('input', handlePracUpdate);
            
            const pracSuffix = document.createElement('span');
            pracSuffix.className = 'input-suffix';
            pracSuffix.textContent = '/ 10';
            
            pracWrapper.appendChild(pracLabel);
            pracWrapper.appendChild(pracInput);
            pracWrapper.appendChild(pracSuffix);
            
            inputsContainer.appendChild(theoryWrapper);
            inputsContainer.appendChild(pracWrapper);
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-module-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove module ${idx + 1}`);
            removeBtn.addEventListener('click', () => {
                state.completedMarks.splice(idx, 1);
                renderModules();
                if (state.hasCalculated) recalculate();
            });
            
            row.appendChild(label);
            row.appendChild(inputsContainer);
            row.appendChild(removeBtn);
            
            refs.modulesContainer.appendChild(row);
        });
    }

    // Input Listeners
    const handleNumModulesChange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) {
            val = 1;
        } else if (val > 7) {
            val = 7;
        }
        if (e.type === 'change') {
            e.target.value = formatNumber(val);
        }
        renderModules();
        if (state.hasCalculated) recalculate();
    };
    refs.numModules.addEventListener('change', handleNumModulesChange);
    refs.numModules.addEventListener('input', handleNumModulesChange);

    const handleExamPartsChange = (e) => {
        const totalModules = parseInt(refs.numModules.value) || 1;
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) {
            val = 1;
        } else if (val > totalModules) {
            val = totalModules;
        }
        if (e.type === 'change') {
            e.target.value = val;
        }
        updateConvertedDisplay();
    };
    if (refs.numExamParts) {
        refs.numExamParts.addEventListener('change', handleExamPartsChange);
        refs.numExamParts.addEventListener('input', handleExamPartsChange);
    }

    // Toggle Convert to /20 & parts question
    if (refs.convert20Btn) {
        refs.convert20Btn.addEventListener('click', () => {
            const isNowOpen = refs.convertPanel.classList.toggle('hidden') === false;
            if (refs.convertBtnIcon) {
                refs.convertBtnIcon.textContent = isNowOpen ? '−' : '+';
            }
            refs.convert20Btn.classList.toggle('active', isNowOpen);
            if (isNowOpen) {
                if (!lastCalcData) {
                    recalculate();
                }
                const totalModules = parseInt(refs.numModules.value) || 1;
                if (refs.numExamParts) {
                    refs.numExamParts.max = totalModules;
                    if (parseInt(refs.numExamParts.value) > totalModules) {
                        refs.numExamParts.value = totalModules;
                    }
                }
                if (refs.partsMaxLimit) {
                    refs.partsMaxLimit.textContent = totalModules;
                }
                updateConvertedDisplay();
            }
        });
    }

    // Toggle What does Part mean info box
    const partsInfoToggle = document.getElementById('parts-info-toggle');
    const partsInfoContent = document.getElementById('parts-info-content');
    if (partsInfoToggle && partsInfoContent) {
        partsInfoToggle.addEventListener('click', () => {
            const isHidden = partsInfoContent.classList.toggle('hidden');
            partsInfoToggle.classList.toggle('active', !isHidden);
            partsInfoToggle.setAttribute('aria-expanded', !isHidden);
        });

        // Auto-expand if URL contains #parts or ?parts
        if (window.location.hash.includes('parts') || window.location.search.includes('parts')) {
            if (refs.convertPanel) {
                refs.convertPanel.classList.remove('hidden');
                if (refs.convertBtnIcon) refs.convertBtnIcon.textContent = '−';
                refs.convert20Btn.classList.add('active');
            }
            partsInfoContent.classList.remove('hidden');
            partsInfoToggle.classList.add('active');
            partsInfoToggle.setAttribute('aria-expanded', 'true');
        }
    }

    refs.addModuleBtn.addEventListener('click', () => {
        const total = Math.min(7, parseInt(refs.numModules.value) || 1);
        if (state.completedMarks.length < total) {
            state.completedMarks.push({ theory: 0, practical: 0 });
            renderModules();
            if (state.hasCalculated) recalculate();
        }
    });

    refs.targetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            refs.targetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refs.customTarget.value = btn.dataset.val;
            if (state.hasCalculated) recalculate();
        });
    });

    refs.customTarget.addEventListener('input', () => {
        const val = parseFloat(refs.customTarget.value);
        refs.targetBtns.forEach(btn => {
            if (parseFloat(btn.dataset.val) === val) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        if (state.hasCalculated) recalculate();
    });

    // Dynamic Parts Breakdown Render (clean & simple: only marks needed to pass)
    function renderPartsBreakdown() {
        if (!refs.dynamicPartsContainer || !lastCalcData) return;
        const totalModules = parseInt(refs.numModules.value) || 1;
        let partsCount = refs.numExamParts ? (parseInt(refs.numExamParts.value) || 1) : 1;
        if (partsCount < 1) partsCount = 1;
        if (partsCount > totalModules) partsCount = totalModules;

        const marksNeeded60 = lastCalcData.marks_needed;
        const perPartTarget = marksNeeded60 / 3.0; // Target out of 20 per part

        refs.dynamicPartsContainer.innerHTML = '';

        for (let i = 0; i < partsCount; i++) {
            const partNumStr = (i + 1).toString().padStart(2, '0');

            // Calculate exact Theory & Practical needed to pass
            let theoryNeeded = 0;
            let practicalNeeded = 3.0; // Mandatory 3 marks in practical
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
                // Leveled / equalized equally between Theory and Practical above 3.0
                theoryNeeded = perPartTarget / 2.0;
                practicalNeeded = perPartTarget / 2.0;
                partTotalNeeded = perPartTarget;
            }

            const card = document.createElement('div');
            card.className = 'part-display-card';

            card.innerHTML = `
                <div class="part-display-header">
                    <span class="part-simple-title">PART ${partNumStr}</span>
                    <div class="part-total-badge">
                        <span class="badge-label">TOTAL NEEDED TO PASS</span>
                        <span class="badge-value ${isUnachievable ? 'val-unachievable' : ''}">
                            ${isUnachievable ? 'UNACHIEVABLE' : partTotalNeeded.toFixed(2) + ' / 20'}
                        </span>
                    </div>
                </div>

                <div class="components-two-col">
                    <!-- Theory Box -->
                    <div class="component-card theory-card">
                        <span class="component-title">THEORY</span>
                        <div class="component-needed-val ${isUnachievable ? 'val-unachievable' : ''}">
                            ${isUnachievable ? '> 10.00' : theoryNeeded.toFixed(2)} <span class="component-denom">/ 10</span>
                        </div>
                    </div>

                    <!-- Practical Box -->
                    <div class="component-card practical-card">
                        <span class="component-title">PRACTICAL</span>
                        <div class="component-needed-val practical-highlight ${isUnachievable ? 'val-unachievable' : ''}">
                            ${isUnachievable ? '> 10.00' : practicalNeeded.toFixed(2)} <span class="component-denom">/ 10</span>
                        </div>
                    </div>
                </div>
            `;

            refs.dynamicPartsContainer.appendChild(card);
        }
    }

    // Update Converted /20 breakdown
    function updateConvertedDisplay() {
        if (!lastCalcData) return;
        const currentModules = parseInt(refs.numModules.value) || 1;
        let parts = refs.numExamParts ? (parseInt(refs.numExamParts.value) || 1) : 1;
        if (parts < 1) parts = 1;
        if (parts > currentModules) parts = currentModules;

        if (refs.numExamParts) {
            refs.numExamParts.max = currentModules;
        }
        if (refs.partsMaxLimit) {
            refs.partsMaxLimit.textContent = currentModules;
        }

        const marksNeeded = lastCalcData.marks_needed; // out of 60
        const rawMax = 20 * parts;
        const requiredRawMarks = (marksNeeded / 60.0) * rawMax;
        const score20 = marksNeeded / 3.0;
        const perPart = requiredRawMarks / parts;

        if (refs.resConvertedScore) {
            refs.resConvertedScore.textContent = `${score20.toFixed(2)} / 20`;
        }
        if (refs.resRawMarksLabel) {
            refs.resRawMarksLabel.textContent = `RAW MARKS ACROSS ${parts} ${parts === 1 ? 'PART' : 'PARTS'}`;
        }
        if (refs.resRawMarksNeeded) {
            refs.resRawMarksNeeded.textContent = `${requiredRawMarks.toFixed(2)} / ${rawMax}`;
        }
        if (refs.resPerPartNeeded) {
            refs.resPerPartNeeded.textContent = `${perPart.toFixed(2)} / 20 per part`;
        }

        // Render detailed parts breakdown table matching user portal
        renderPartsBreakdown();
    }

    // Calculation Trigger
    function recalculate() {
        let totalModules = parseInt(refs.numModules.value);
        if (isNaN(totalModules) || totalModules < 1) {
            totalModules = 1;
        } else if (totalModules > 7) {
            totalModules = 7;
        }

        let examParts = refs.numExamParts ? (parseInt(refs.numExamParts.value) || 1) : 1;
        if (examParts < 1) examParts = 1;
        if (examParts > totalModules) examParts = totalModules;

        const targetPct = parseFloat(refs.customTarget.value);

        if (isNaN(targetPct) || targetPct <= 0 || targetPct > 100) {
            showError("Target percentage must be between 0 and 100.");
            return;
        }

        hideError();

        // Ensure completed modules do not exceed total modules
        if (state.completedMarks.length > totalModules) {
            state.completedMarks = state.completedMarks.slice(0, totalModules);
            renderModules();
        }

        const combinedMarks = state.completedMarks.map(m => m.theory + m.practical);

        try {
            const data = calculateExam({
                number_of_modules: totalModules,
                completed_module_marks: combinedMarks,
                target_percentage: targetPct,
                final_exam_parts: examParts,
                final_practical_score: null
            });

            state.hasCalculated = true;
            lastCalcData = data;
            renderResult(data);
        } catch (err) {
            showError(err.message || "Calculation failed. Please review your inputs.");
            console.error(err);
        }
    }

    refs.calculateBtn.addEventListener('click', () => {
        recalculate();
        if (window.innerWidth <= 768) {
            refs.resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Result rendering
    function renderResult(data) {
        refs.resultPlaceholder.classList.add('hidden');
        refs.resultDisplay.classList.remove('hidden');

        refs.resTarget.textContent = `${data.target_percentage}%`;
        
        refs.resModuleAggregate.textContent = `${data.module_aggregate.toFixed(2)} / 40`;
        refs.resModulesSummary.textContent = `${formatNumber(data.completed_modules)} / ${formatNumber(data.number_of_modules)} Completed • ${formatNumber(data.remaining_modules)} Remaining (0 marks)`;

        // Final paper exam needed out of 60
        refs.resMarksNeeded.textContent = `${data.marks_needed.toFixed(2)} / 60`;
        if (refs.resMarksPercentage) {
            refs.resMarksPercentage.textContent = `${data.required_percentage.toFixed(2)}% needed in final paper exam`;
        }

        // Update converted values and parts breakdown
        updateConvertedDisplay();

        // Status Styling & Badges
        refs.resStatusContainer.className = 'result-status';
        if (data.status === 'PASS' || data.status === 'TARGET ACHIEVED') {
            refs.resStatusContainer.classList.add('status-success');
        } else if (data.status === 'FAIL' || data.status === 'TARGET UNACHIEVABLE') {
            refs.resStatusContainer.classList.add('status-fail');
        } else if (data.status === 'CONDITIONAL') {
            refs.resStatusContainer.classList.add('status-conditional');
        } else {
            refs.resStatusContainer.classList.add('status-success');
        }
        refs.resStatusText.textContent = data.status;
    }

    // Error handling
    function showError(msg) {
        refs.errorText.textContent = msg;
        refs.errorBanner.classList.remove('hidden');
    }
    function hideError() {
        refs.errorBanner.classList.add('hidden');
    }

    // Initialize
    renderModules();
});
