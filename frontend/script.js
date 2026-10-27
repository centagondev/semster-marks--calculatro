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
        
        // 20-mark score & Theory / Practical components
        resScore20: document.getElementById('res-score-20'),
        resConvertedScore: document.getElementById('res-score-20'),
        resTheoryNeeded: document.getElementById('res-theory-needed'),
        resPracticalNeeded: document.getElementById('res-practical-needed'),
        
        // Detailed Report toggle & panel
        detailedReportBtn: document.getElementById('detailed-report-btn') || document.getElementById('convert-20-btn'),
        detailedReportIcon: document.getElementById('detailed-report-icon') || document.getElementById('convert-btn-icon'),
        detailedReportPanel: document.getElementById('detailed-report-panel') || document.getElementById('convert-panel'),
        convert20Btn: document.getElementById('detailed-report-btn') || document.getElementById('convert-20-btn'),
        convertBtnIcon: document.getElementById('detailed-report-icon') || document.getElementById('convert-btn-icon'),
        convertPanel: document.getElementById('detailed-report-panel') || document.getElementById('convert-panel'),
        numExamParts: document.getElementById('num-exam-parts'),
        partsMaxLimit: document.getElementById('parts-max-limit'),
        resRawMarksLabel: document.getElementById('res-raw-marks-label'),
        resRawMarksNeeded: document.getElementById('res-raw-marks-needed'),
        resPerPartNeeded: document.getElementById('res-per-part-needed'),
        dynamicPartsContainer: document.getElementById('dynamic-parts-container'),

        // Status
        resStatusContainer: document.getElementById('res-status-container'),
        resStatusText: document.getElementById('res-status-text'),

        // Google Auth & User Profile
        googleSigninBtn: document.getElementById('google-signin-btn'),
        authLoggedOut: document.getElementById('auth-logged-out'),
        authLoggedIn: document.getElementById('auth-logged-in'),
        userMenuBtn: document.getElementById('user-menu-btn'),
        userDropdownMenu: document.getElementById('user-dropdown-menu'),
        userAvatar: document.getElementById('user-avatar'),
        userNameDisplay: document.getElementById('user-name-display'),
        userDropdownAvatar: document.getElementById('user-dropdown-avatar'),
        userDropdownName: document.getElementById('user-dropdown-name'),
        userDropdownEmail: document.getElementById('user-dropdown-email'),
        userDropdownBatchTag: document.getElementById('user-dropdown-batch-tag'),
        userAdminBadge: document.getElementById('user-admin-badge'),
        adminPanelBtn: document.getElementById('admin-panel-btn'),
        editBatchBtn: document.getElementById('edit-batch-btn'),
        viewHistoryBtn: document.getElementById('view-history-btn'),
        signoutBtn: document.getElementById('signout-btn'),
        historyBadgeCount: document.getElementById('history-badge-count'),

        // Mandatory Gate & App Wrapper
        mandatoryAuthGate: document.getElementById('mandatory-auth-gate'),
        closeGateBtn: document.getElementById('close-gate-btn'),
        appWrapper: document.getElementById('app-wrapper'),
        gateStepSignin: document.getElementById('gate-step-signin'),
        gateStepBatch: document.getElementById('gate-step-batch'),
        gateTitle: document.getElementById('gate-title'),
        gateSubtitle: document.getElementById('gate-subtitle'),
        batchWelcomeName: document.getElementById('batch-welcome-name'),
        hubSelect: document.getElementById('hub-select'),
        batchHubTag: document.getElementById('batch-hub-tag'),
        batch2DigitInput: document.getElementById('batch-2digit-input'),
        batchErrorMsg: document.getElementById('batch-error-msg'),
        submitBatchBtn: document.getElementById('submit-batch-btn'),
        gIdSigninMandatoryRender: document.getElementById('g_id_signin_mandatory_render'),

        // Dedicated Sign Out Modal
        signoutModal: document.getElementById('signout-modal'),
        closeSignoutBtn: document.getElementById('close-signout-btn'),
        signoutStudentAvatar: document.getElementById('signout-student-avatar'),
        signoutStudentName: document.getElementById('signout-student-name'),
        signoutStudentEmail: document.getElementById('signout-student-email'),
        signoutStudentBatch: document.getElementById('signout-student-batch'),
        cancelSignoutBtn: document.getElementById('cancel-signout-btn'),
        confirmSignoutBtn: document.getElementById('confirm-signout-btn'),

        // Saved History Modal
        historyModal: document.getElementById('history-modal'),
        closeHistoryModal: document.getElementById('close-history-modal'),
        historyUserName: document.getElementById('history-user-name'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        historyList: document.getElementById('history-list'),
        historyEmpty: document.getElementById('history-empty'),

        // Toast
        authToast: document.getElementById('auth-toast'),
        toastMessage: document.getElementById('toast-message'),

        // Mobile Navigation Drawer
        mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
        mobileNavDrawer: document.getElementById('mobile-nav-drawer'),
        mobileNavBackdrop: document.getElementById('mobile-nav-backdrop'),
        closeMobileNav: document.getElementById('close-mobile-nav'),
        mobileHistoryBtn: document.getElementById('mobile-history-btn'),
        mobileAdminBtn: document.getElementById('mobile-admin-btn'),
        mobileHistoryCount: document.getElementById('mobile-history-count')
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

    // Toggle Detailed Report Panel
    const reportBtn = refs.detailedReportBtn;
    const reportPanel = refs.detailedReportPanel;
    const reportIcon = refs.detailedReportIcon;

    if (reportBtn && reportPanel) {
        reportBtn.addEventListener('click', () => {
            const isNowOpen = reportPanel.classList.toggle('hidden') === false;
            if (reportIcon) {
                reportIcon.textContent = isNowOpen ? '−' : '+';
            }
            reportBtn.classList.toggle('active', isNowOpen);
            reportBtn.setAttribute('aria-expanded', isNowOpen.toString());
        });
    }

    refs.addModuleBtn.addEventListener('click', () => {
        const total = Math.min(7, parseInt(refs.numModules.value) || 1);
        if (state.completedMarks.length < total) {
            state.completedMarks.push({ theory: 0, practical: 0 });
            renderModules();
            if (state.hasCalculated) recalculate();
        }
    });

    if (refs.targetBtns && refs.targetBtns.length > 0) {
        refs.targetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                refs.targetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (refs.customTarget) refs.customTarget.value = btn.dataset.val;
                if (state.hasCalculated) recalculate();
            });
        });
    }

    if (refs.customTarget) {
        refs.customTarget.addEventListener('input', () => {
            const val = parseFloat(refs.customTarget.value);
            if (refs.targetBtns) {
                refs.targetBtns.forEach(btn => {
                    if (parseFloat(btn.dataset.val) === val) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
            if (state.hasCalculated) recalculate();
        });
    }

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
        if (!currentUser) {
            openMandatoryGate();
            showToast("Student sign-in required to calculate exam marks.");
            return;
        }

        let totalModules = parseInt(refs.numModules.value);
        if (isNaN(totalModules) || totalModules < 1) {
            totalModules = 1;
        } else if (totalModules > 7) {
            totalModules = 7;
        }

        let examParts = refs.numExamParts ? (parseInt(refs.numExamParts.value) || 1) : 1;
        if (examParts < 1) examParts = 1;
        if (examParts > totalModules) examParts = totalModules;

        const targetPct = (refs.customTarget && parseFloat(refs.customTarget.value)) ? parseFloat(refs.customTarget.value) : 40.0;

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
            if (currentUser) {
                saveCalculationToHistory(data);
                notifyCalculationToServer(currentUser.email);
            }
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

        // Calculate score out of 20 and Theory & Practical components
        const marksNeeded60 = data.marks_needed;
        const score20 = marksNeeded60 / 3.0;

        let theoryNeeded = 0;
        let practicalNeeded = 3.0; // Mandatory min 3.0 practical cutoff

        if (marksNeeded60 <= 0) {
            theoryNeeded = 0.0;
            practicalNeeded = 3.0;
        } else if (score20 > 20.0) {
            theoryNeeded = 10.0;
            practicalNeeded = 10.0;
        } else if (score20 <= 3.0) {
            theoryNeeded = 0.0;
            practicalNeeded = 3.0;
        } else if (score20 <= 6.0) {
            practicalNeeded = 3.0;
            theoryNeeded = score20 - 3.0;
        } else {
            theoryNeeded = score20 / 2.0;
            practicalNeeded = score20 / 2.0;
        }

        // Primary Display (Score out of 20, Theory & Practical)
        if (refs.resScore20) {
            refs.resScore20.textContent = `${score20.toFixed(2)} / 20`;
        }
        if (refs.resTheoryNeeded) {
            refs.resTheoryNeeded.innerHTML = `${theoryNeeded.toFixed(2)} <span class="component-denom">/ 10</span>`;
        }
        if (refs.resPracticalNeeded) {
            refs.resPracticalNeeded.innerHTML = `${practicalNeeded.toFixed(2)} <span class="component-denom">/ 10</span>`;
        }

        // Detailed Report fields
        refs.resTarget.textContent = `${data.target_percentage}%`;
        refs.resModuleAggregate.textContent = `${data.module_aggregate.toFixed(2)} / 40`;
        refs.resModulesSummary.textContent = `${formatNumber(data.completed_modules)} / ${formatNumber(data.number_of_modules)} Completed • ${formatNumber(data.remaining_modules)} Remaining (0 marks)`;
        refs.resMarksNeeded.textContent = `${data.marks_needed.toFixed(2)} / 60`;
        if (refs.resMarksPercentage) {
            refs.resMarksPercentage.textContent = `${data.required_percentage.toFixed(2)}% needed in final paper exam`;
        }

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

        let displayStatus = data.status;
        if (displayStatus === 'TARGET ACHIEVABLE') displayStatus = 'PASS ACHIEVABLE';
        if (displayStatus === 'TARGET ACHIEVED') displayStatus = 'PASS ACHIEVED';
        if (displayStatus === 'TARGET UNACHIEVABLE') displayStatus = 'PASS UNACHIEVABLE';
        refs.resStatusText.textContent = displayStatus;
    }

    // Error handling
    function showError(msg) {
        refs.errorText.textContent = msg;
        refs.errorBanner.classList.remove('hidden');
    }
    function hideError() {
        refs.errorBanner.classList.add('hidden');
    }

    // ==========================================
    // Google Authentication & User Profile Logic
    // ==========================================
    const AUTH_KEY = 'centagon_auth_user';
    const CLIENT_ID_KEY = 'centagon_google_client_id';

    let currentUser = null;
    let toastTimer = null;

    function showToast(message) {
        if (!refs.authToast || !refs.toastMessage) return;
        refs.toastMessage.textContent = message;
        refs.authToast.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            refs.authToast.classList.add('hidden');
        }, 3200);
    }

    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Failed to parse Google JWT', e);
            return null;
        }
    }

    function getDefaultAvatar(name) {
        const initial = (name || 'S').trim().charAt(0).toUpperCase();
        return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23171717'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23ffffff' font-family='sans-serif' font-size='18' font-weight='bold'>${initial}</text></svg>`;
    }

    function loadStoredUser() {
        try {
            const stored = localStorage.getItem(AUTH_KEY);
            if (stored) {
                currentUser = JSON.parse(stored);
                if (currentUser && currentUser.email) {
                    syncStudentToServer(currentUser);
                }
            }
        } catch (e) {
            currentUser = null;
        }
    }

    const GOOGLE_CLIENT_ID = '470097466192-qft1oohev9cev3acq9ljm5jl5324ik1o.apps.googleusercontent.com';

    function openMandatoryGate() {
        if (refs.mandatoryAuthGate) {
            refs.mandatoryAuthGate.classList.remove('hidden');
            refs.mandatoryAuthGate.classList.remove('gate-unlocking');
        }
        if (refs.appWrapper) {
            refs.appWrapper.classList.add('app-locked');
        }
    }

    function closeMandatoryGate() {
        if (refs.mandatoryAuthGate && !refs.mandatoryAuthGate.classList.contains('hidden')) {
            refs.mandatoryAuthGate.classList.add('gate-unlocking');
            setTimeout(() => {
                if (refs.mandatoryAuthGate) {
                    refs.mandatoryAuthGate.classList.add('hidden');
                    refs.mandatoryAuthGate.classList.remove('gate-unlocking');
                }
            }, 320);
        }
        if (refs.appWrapper) {
            refs.appWrapper.classList.remove('app-locked');
        }
    }

    const HUB_DATA = {
        'BCK': { name: 'Kozhikode', prefix: 'BCK' },
        'BCR': { name: 'Remote', prefix: 'BCR' },
        'BCE': { name: 'Ernakulam', prefix: 'BCE' },
        'BCT': { name: 'Trivandrum', prefix: 'BCT' }
    };
    let currentSelectedHub = 'BCK';

    function showBatchGate(isEdit = false) {
        if (refs.gateStepSignin) refs.gateStepSignin.classList.add('hidden');
        if (refs.gateStepBatch) refs.gateStepBatch.classList.remove('hidden');
        if (refs.batchWelcomeName && currentUser) {
            refs.batchWelcomeName.textContent = currentUser.given_name || currentUser.name || 'Student';
        }
        if (refs.batchErrorMsg) refs.batchErrorMsg.classList.add('hidden');

        // Pre-fill existing hub if any
        if (currentUser && currentUser.hub && HUB_DATA[currentUser.hub.toUpperCase()]) {
            selectHub(currentUser.hub.toUpperCase());
        } else {
            selectHub('BCK');
        }

        // Pre-fill existing 2-digit batch if any (extract last 2 digits of 4XX)
        if (currentUser && currentUser.batch) {
            const raw = currentUser.batch.toString().trim();
            const twoDigits = raw.startsWith('4') && raw.length === 3 ? raw.slice(1) : raw.slice(-2);
            if (refs.batch2DigitInput) refs.batch2DigitInput.value = twoDigits;
        } else {
            if (refs.batch2DigitInput) refs.batch2DigitInput.value = '';
        }

        updateBatchPreview();
        openMandatoryGate();
        setTimeout(() => {
            if (refs.batch2DigitInput) {
                refs.batch2DigitInput.focus();
                refs.batch2DigitInput.select();
            }
        }, 150);
    }

    function selectHub(hubCode) {
        hubCode = (hubCode || 'BCK').toUpperCase();
        if (!HUB_DATA[hubCode]) hubCode = 'BCK';
        currentSelectedHub = hubCode;

        if (refs.hubSelect && refs.hubSelect.value !== hubCode) {
            refs.hubSelect.value = hubCode;
        }
        if (refs.batchHubTag) {
            refs.batchHubTag.textContent = hubCode;
        }
        updateBatchPreview();
    }

    function updateBatchPreview() {
        if (refs.batchHubTag) {
            refs.batchHubTag.textContent = currentSelectedHub;
        }
    }

    function handleBatch2DigitInput(e) {
        let val = e.target.value.trim().toUpperCase();

        // Check if user pasted full code e.g. "BCK 421", "BCK421", "bce 412"
        const fullMatch = val.match(/^(BCK|BCR|BCE|BCT)\s*(4)?([0-9]{1,2})$/i);
        if (fullMatch) {
            const matchedHub = fullMatch[1].toUpperCase();
            const digits = fullMatch[3];
            selectHub(matchedHub);
            e.target.value = digits;
            updateBatchPreview();
            return;
        }

        // Extract numbers only
        let digits = val.replace(/\D/g, '');

        // If user typed 3 digits starting with 4 (e.g. 421), automatically take the last 2 digits (21)
        if (digits.length === 3 && digits[0] === '4') {
            digits = digits.slice(1);
        } else if (digits.length > 2) {
            digits = digits.slice(0, 2);
        }

        e.target.value = digits;
        if (refs.batchErrorMsg) refs.batchErrorMsg.classList.add('hidden');
        updateBatchPreview();
    }

    function submitBatch() {
        if (!currentUser) return;
        const twoDigits = refs.batch2DigitInput ? refs.batch2DigitInput.value.trim() : '';
        
        // Strict Validation: exactly 2 digits (e.g., 21 for 421)
        if (!/^\d{2}$/.test(twoDigits)) {
            if (refs.batchErrorMsg) {
                refs.batchErrorMsg.textContent = 'Please enter a 2-digit batch number (e.g. 21 for batch 421).';
                refs.batchErrorMsg.classList.remove('hidden');
            }
            if (refs.batch2DigitInput) refs.batch2DigitInput.focus();
            return;
        }

        const fullBatchNum = `4${twoDigits}`;
        const hubInfo = HUB_DATA[currentSelectedHub] || HUB_DATA['BCK'];
        currentUser.hub = currentSelectedHub;
        currentUser.hub_name = hubInfo.name;
        currentUser.batch = fullBatchNum;
        currentUser.batch_code = `${currentSelectedHub} ${fullBatchNum}`;

        localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
        syncStudentToServer(currentUser);
        closeMandatoryGate();
        updateAuthUI();
        closeAllModals();
        showToast(`Welcome! Batch ${currentUser.batch_code} (${hubInfo.name}) confirmed.`);
    }

    function syncStudentToServer(user) {
        if (!user || !user.email) return;

        // Sync to client-side student directory for admin portal resilience
        try {
            let directory = JSON.parse(localStorage.getItem('centagon_student_directory') || '[]');
            if (!Array.isArray(directory)) directory = [];
            const emailLower = user.email.trim().toLowerCase();
            const idx = directory.findIndex(s => s.email && s.email.toLowerCase() === emailLower);
            const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

            if (idx >= 0) {
                directory[idx] = {
                    ...directory[idx],
                    name: user.name || directory[idx].name,
                    picture: user.picture || directory[idx].picture,
                    hub: user.hub || directory[idx].hub,
                    hub_name: user.hub_name || directory[idx].hub_name,
                    batch: user.batch || directory[idx].batch,
                    batch_code: user.batch_code || directory[idx].batch_code,
                    last_active: nowIso,
                    visit_count: (directory[idx].visit_count || 1) + 1
                };
            } else {
                directory.unshift({
                    id: directory.length + 1,
                    name: user.name || 'Student',
                    email: user.email,
                    picture: user.picture || '',
                    hub: user.hub || '',
                    hub_name: user.hub_name || '',
                    batch: user.batch || '',
                    batch_code: user.batch_code || '',
                    first_login: nowIso,
                    last_active: nowIso,
                    visit_count: 1,
                    calculations_count: 0
                });
            }
            localStorage.setItem('centagon_student_directory', JSON.stringify(directory));
        } catch(e) {}

        // Attempt server sync if backend is active
        fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: user.name,
                email: user.email,
                picture: user.picture,
                google_id: user.sub,
                hub: user.hub || '',
                hub_name: user.hub_name || '',
                batch: user.batch || '',
                batch_code: user.batch_code || '',
                user_agent: navigator.userAgent,
                id_token: user.idToken || ''
            })
        }).catch(err => {
            console.warn('Could not sync student to server:', err);
        });
    }

    function notifyCalculationToServer(email) {
        if (!email) return;

        // Sync calculation count to client-side directory
        try {
            let directory = JSON.parse(localStorage.getItem('centagon_student_directory') || '[]');
            if (Array.isArray(directory)) {
                const emailLower = email.trim().toLowerCase();
                const student = directory.find(s => s.email && s.email.toLowerCase() === emailLower);
                if (student) {
                    student.calculations_count = (student.calculations_count || 0) + 1;
                    student.last_active = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    localStorage.setItem('centagon_student_directory', JSON.stringify(directory));
                }
            }
        } catch(e) {}

        fetch('/api/students/calc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).catch(() => {});
    }

    function isAdminUser(user) {
        if (!user || !user.email) return false;
        const email = user.email.trim().toLowerCase();
        return email.includes('dhanishmohd1136') || email === 'admin@centagon.in' || !!user.is_admin;
    }

    function verifyAdminSession(email) {
        if (!email) return;
        fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                id_token: currentUser?.idToken || ''
            })
        }).then(r => r.json()).then(res => {
            if (res && res.is_admin && currentUser) {
                currentUser.is_admin = true;
            }
        }).catch(() => {});
    }

    function updateAuthUI() {
        if (currentUser) {
            if (refs.authLoggedOut) refs.authLoggedOut.classList.add('hidden');
            if (refs.authLoggedIn) refs.authLoggedIn.classList.remove('hidden');

            const avatarUrl = currentUser.picture || getDefaultAvatar(currentUser.name);
            const firstName = (currentUser.given_name || (currentUser.name ? currentUser.name.split(' ')[0] : 'STUDENT')).toUpperCase();

            if (refs.userAvatar) {
                refs.userAvatar.src = avatarUrl;
                refs.userAvatar.onerror = () => { refs.userAvatar.src = getDefaultAvatar(currentUser.name); };
            }
            if (refs.userNameDisplay) {
                refs.userNameDisplay.textContent = currentUser.batch_code ? `${firstName} • ${currentUser.batch_code}` : firstName;
            }
            if (refs.userDropdownAvatar) {
                refs.userDropdownAvatar.src = avatarUrl;
                refs.userDropdownAvatar.onerror = () => { refs.userDropdownAvatar.src = getDefaultAvatar(currentUser.name); };
            }
            if (refs.userDropdownName) refs.userDropdownName.textContent = currentUser.name || 'Student';
            if (refs.userDropdownEmail) refs.userDropdownEmail.textContent = currentUser.email || '';
            if (refs.userDropdownBatchTag) {
                if (currentUser.batch_code && currentUser.hub_name) {
                    refs.userDropdownBatchTag.textContent = `${currentUser.batch_code} • ${currentUser.hub_name.toUpperCase()} HUB`;
                    refs.userDropdownBatchTag.classList.remove('hidden');
                } else {
                    refs.userDropdownBatchTag.textContent = 'NO BATCH ASSIGNED';
                    refs.userDropdownBatchTag.classList.add('hidden');
                }
            }
            if (refs.historyUserName) refs.historyUserName.textContent = currentUser.name || 'Student';

            // Check Admin Status (Authorized admins e.g. dhanishmohd1136)
            const isAdmin = isAdminUser(currentUser);
            if (refs.adminPanelBtn) {
                if (isAdmin) {
                    refs.adminPanelBtn.href = '/admin?key=centagon@admin';
                    refs.adminPanelBtn.classList.remove('hidden');
                } else {
                    refs.adminPanelBtn.classList.add('hidden');
                }
            }
            if (refs.mobileAdminBtn) {
                if (isAdmin) {
                    refs.mobileAdminBtn.href = '/admin?key=centagon@admin';
                    refs.mobileAdminBtn.classList.remove('hidden');
                } else {
                    refs.mobileAdminBtn.classList.add('hidden');
                }
            }
            if (refs.userAdminBadge) {
                if (isAdmin) {
                    refs.userAdminBadge.classList.remove('hidden');
                } else {
                    refs.userAdminBadge.classList.add('hidden');
                }
            }
            if (isAdmin) {
                verifyAdminSession(currentUser.email);
            }

            updateHistoryBadge();

            // Check if student has registered their hub & batch
            if (!currentUser.batch || !currentUser.hub) {
                showBatchGate(false);
            } else {
                closeMandatoryGate();
            }
        } else {
            // Unauthenticated: update UI to logged-out state
            if (refs.gateStepSignin) refs.gateStepSignin.classList.remove('hidden');
            if (refs.gateStepBatch) refs.gateStepBatch.classList.add('hidden');
            if (refs.gateTitle) refs.gateTitle.textContent = 'SIGN IN';
            if (refs.gateSubtitle) refs.gateSubtitle.textContent = 'Sign in with Google to access the 400-Series Exam Calculator.';

            if (refs.authLoggedOut) refs.authLoggedOut.classList.remove('hidden');
            if (refs.authLoggedIn) refs.authLoggedIn.classList.add('hidden');
            if (refs.userDropdownMenu) refs.userDropdownMenu.classList.add('hidden');
            if (refs.userMenuBtn) refs.userMenuBtn.setAttribute('aria-expanded', 'false');

            if (refs.userNameDisplay) refs.userNameDisplay.textContent = 'STUDENT';
            if (refs.userAvatar) refs.userAvatar.src = getDefaultAvatar('Student');
            if (refs.userDropdownName) refs.userDropdownName.textContent = 'Student';
            if (refs.userDropdownEmail) refs.userDropdownEmail.textContent = '';
            if (refs.userDropdownBatchTag) refs.userDropdownBatchTag.classList.add('hidden');
            if (refs.adminPanelBtn) refs.adminPanelBtn.classList.add('hidden');
            if (refs.mobileAdminBtn) refs.mobileAdminBtn.classList.add('hidden');
            if (refs.userAdminBadge) refs.userAdminBadge.classList.add('hidden');
        }
    }

    function handleGoogleCredentialResponse(response) {
        if (!response || !response.credential) return;
        const payload = parseJwt(response.credential);
        if (!payload) {
            showToast('Failed to parse Google credentials.');
            return;
        }

        const existingBatch = currentUser?.batch || '';
        const existingHub = currentUser?.hub || '';
        const existingHubName = currentUser?.hub_name || '';
        const existingBatchCode = currentUser?.batch_code || '';

        currentUser = {
            sub: payload.sub,
            name: payload.name || 'Student',
            given_name: payload.given_name || (payload.name ? payload.name.split(' ')[0] : 'Student'),
            email: payload.email || '',
            picture: payload.picture || '',
            idToken: response.credential,
            batch: existingBatch,
            hub: existingHub,
            hub_name: existingHubName,
            batch_code: existingBatchCode
        };

        localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
        syncStudentToServer(currentUser);

        if (refs.gateTitle) refs.gateTitle.textContent = 'SIGN IN';
        if (refs.gateSubtitle) refs.gateSubtitle.textContent = 'Sign in with Google to access the 400-Series Exam Calculator.';

        if (!currentUser.batch || !currentUser.hub) {
            showBatchGate(false);
            showToast(`Signed in as ${currentUser.name}. Please select your Hub & Batch.`);
        } else {
            updateAuthUI();
            closeAllModals();
            showToast(`Welcome back, ${currentUser.name}! Calculator unlocked.`);
        }
    }

    function initGoogleAuth() {
        if (!window.google?.accounts?.id) {
            setTimeout(initGoogleAuth, 300);
            return;
        }

        try {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse,
                auto_select: true,
                cancel_on_tap_outside: false
            });

            // Render official Google button into mandatory gate
            const mandatoryTarget = document.getElementById('g_id_signin_mandatory_render');
            if (mandatoryTarget) {
                mandatoryTarget.innerHTML = '';
                window.google.accounts.id.renderButton(mandatoryTarget, {
                    theme: 'filled_black',
                    size: 'large',
                    shape: 'rectangular',
                    text: 'signin_with',
                    logo_alignment: 'left',
                    width: 320
                });
            }

            // Automatically prompt One-Tap if unauthenticated
            if (!currentUser) {
                window.google.accounts.id.prompt();
            }
        } catch (err) {
            console.warn('Google Identity initialization error:', err);
        }
    }

    function triggerGooglePrompt() {
        if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt();
        }
    }

    function openSignoutModal() {
        if (!currentUser) return;
        if (refs.userDropdownMenu) refs.userDropdownMenu.classList.add('hidden');
        if (refs.userMenuBtn) refs.userMenuBtn.setAttribute('aria-expanded', 'false');

        if (refs.signoutStudentAvatar) {
            const avatarUrl = currentUser.picture || getDefaultAvatar(currentUser.name);
            refs.signoutStudentAvatar.src = avatarUrl;
            refs.signoutStudentAvatar.onerror = () => { refs.signoutStudentAvatar.src = getDefaultAvatar(currentUser.name); };
        }
        if (refs.signoutStudentName) {
            refs.signoutStudentName.textContent = currentUser.name || 'Student';
        }
        if (refs.signoutStudentEmail) {
            refs.signoutStudentEmail.textContent = currentUser.email || '';
        }
        if (refs.signoutStudentBatch) {
            if (currentUser.batch_code) {
                refs.signoutStudentBatch.textContent = `${currentUser.batch_code} • ${currentUser.hub_name ? currentUser.hub_name.toUpperCase() : ''}`;
                refs.signoutStudentBatch.classList.remove('hidden');
            } else {
                refs.signoutStudentBatch.classList.add('hidden');
            }
        }

        if (refs.signoutModal) {
            refs.signoutModal.classList.remove('hidden');
        }
    }

    function closeSignoutModal() {
        if (refs.signoutModal) {
            refs.signoutModal.classList.add('hidden');
        }
    }

    function performSignOut() {
        currentUser = null;
        localStorage.removeItem(AUTH_KEY);
        sessionStorage.setItem('centagon_guest_mode', 'true');
        closeAllModals();
        closeMandatoryGate();

        // Clear backend session
        fetch('/api/logout', { method: 'POST' }).catch(() => {
            fetch('/api/logout').catch(() => {});
        });

        // Disable automatic re-login in Google Identity Services
        if (window.google?.accounts?.id) {
            try {
                window.google.accounts.id.disableAutoSelect();
            } catch (e) {}
        }

        // Reset batch input
        if (refs.batch2DigitInput) refs.batch2DigitInput.value = '';
        if (refs.hubSelect) refs.hubSelect.value = 'BCK';
        if (refs.batchHubTag) refs.batchHubTag.textContent = 'BCK';
        currentSelectedHub = 'BCK';

        updateAuthUI();

        // Re-render Google button into mandatory gate to guarantee fresh state
        const mandatoryTarget = document.getElementById('g_id_signin_mandatory_render');
        if (mandatoryTarget && window.google?.accounts?.id) {
            mandatoryTarget.innerHTML = '';
            try {
                window.google.accounts.id.renderButton(mandatoryTarget, {
                    theme: 'filled_black',
                    size: 'large',
                    shape: 'rectangular',
                    text: 'signin_with',
                    logo_alignment: 'left',
                    width: 320
                });
            } catch (e) {}
        }

        showToast('Signed out successfully.');
    }

    function signOut() {
        openSignoutModal();
    }

    // ==========================================
    // History Tracking & Persistence
    // ==========================================
    function getHistoryKey() {
        const id = currentUser ? (currentUser.email || currentUser.sub || 'user') : 'guest';
        return `centagon_calc_history_${id}`;
    }

    function getUserHistory() {
        try {
            const raw = localStorage.getItem(getHistoryKey());
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function updateHistoryBadge() {
        const list = getUserHistory();
        if (refs.historyBadgeCount) {
            refs.historyBadgeCount.textContent = list.length;
        }
        if (refs.mobileHistoryCount) {
            refs.mobileHistoryCount.textContent = list.length;
        }
    }

    function saveCalculationToHistory(calcData) {
        if (!currentUser) return;
        try {
            const history = getUserHistory();
            const currentModules = parseInt(refs.numModules.value) || 1;
            const examParts = refs.numExamParts ? (parseInt(refs.numExamParts.value) || 1) : 1;
            const targetPct = 40.0;

            const entry = {
                id: Date.now(),
                timestamp: new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                numModules: currentModules,
                completedMarks: JSON.parse(JSON.stringify(state.completedMarks)),
                targetPercentage: targetPct,
                examParts: examParts,
                moduleAggregate: calcData.module_aggregate,
                marksNeeded: calcData.marks_needed,
                requiredPercentage: calcData.required_percentage,
                status: calcData.status
            };

            history.unshift(entry);
            if (history.length > 30) history.length = 30; // retain last 30 runs
            localStorage.setItem(getHistoryKey(), JSON.stringify(history));
            updateHistoryBadge();
            showToast('✓ Saved to calculation history');
        } catch (err) {
            console.error('Error saving history:', err);
        }
    }

    function renderHistory() {
        if (!refs.historyList) return;
        const history = getUserHistory();
        refs.historyList.innerHTML = '';

        if (history.length === 0) {
            if (refs.historyEmpty) refs.historyEmpty.classList.remove('hidden');
            return;
        }

        if (refs.historyEmpty) refs.historyEmpty.classList.add('hidden');

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const isPass = item.status === 'PASS' || item.status === 'TARGET ACHIEVED' || item.status === 'PASS ACHIEVED';
            const isFail = item.status === 'FAIL' || item.status === 'TARGET UNACHIEVABLE' || item.status === 'PASS UNACHIEVABLE';

            let displayStatus = item.status;
            if (displayStatus === 'TARGET ACHIEVABLE') displayStatus = 'PASS ACHIEVABLE';
            if (displayStatus === 'TARGET ACHIEVED') displayStatus = 'PASS ACHIEVED';
            if (displayStatus === 'TARGET UNACHIEVABLE') displayStatus = 'PASS UNACHIEVABLE';

            card.innerHTML = `
                <div class="history-card-header">
                    <div class="history-target-wrap">
                        <span class="history-target-badge">PASS 40%</span>
                        <span class="history-status-pill ${isPass ? 'status-pass' : (isFail ? 'status-fail' : '')}">
                            ● ${displayStatus}
                        </span>
                    </div>
                    <span class="history-timestamp">${item.timestamp}</span>
                </div>
                <div class="history-metrics">
                    <div class="history-metric-item">
                        <span class="history-metric-lbl">MODULES</span>
                        <span class="history-metric-val">${item.completedMarks.length} / ${item.numModules}</span>
                    </div>
                    <div class="history-metric-item">
                        <span class="history-metric-lbl">MODULE AGG.</span>
                        <span class="history-metric-val">${item.moduleAggregate.toFixed(2)} / 40</span>
                    </div>
                    <div class="history-metric-item">
                        <span class="history-metric-lbl">PAPER NEEDED</span>
                        <span class="history-metric-val">${item.marksNeeded.toFixed(2)} / 60</span>
                    </div>
                    <div class="history-metric-item">
                        <span class="history-metric-lbl">REQUIRED %</span>
                        <span class="history-metric-val">${item.requiredPercentage.toFixed(2)}%</span>
                    </div>
                </div>
                <div class="history-card-actions">
                    <button type="button" class="history-action-delete" data-id="${item.id}">DELETE</button>
                    <button type="button" class="history-action-load" data-id="${item.id}">LOAD INTO CALCULATOR &rarr;</button>
                </div>
            `;

            card.querySelector('.history-action-load').addEventListener('click', () => {
                loadHistoryItem(item);
            });

            card.querySelector('.history-action-delete').addEventListener('click', () => {
                deleteHistoryItem(item.id);
            });

            refs.historyList.appendChild(card);
        });
    }

    function loadHistoryItem(item) {
        refs.numModules.value = formatNumber(item.numModules);
        state.completedMarks = JSON.parse(JSON.stringify(item.completedMarks));
        renderModules();

        if (refs.customTarget) {
            refs.customTarget.value = item.targetPercentage || 40;
        }
        if (refs.targetBtns && refs.targetBtns.length > 0) {
            refs.targetBtns.forEach(btn => {
                if (parseFloat(btn.dataset.val) === item.targetPercentage) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        if (refs.numExamParts && item.examParts) {
            refs.numExamParts.value = formatNumber(item.examParts);
        }

        recalculate();
        closeAllModals();
        showToast('Loaded 40% pass calculation run');

        if (window.innerWidth <= 768) {
            refs.resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function deleteHistoryItem(id) {
        let history = getUserHistory();
        history = history.filter(item => item.id !== id);
        localStorage.setItem(getHistoryKey(), JSON.stringify(history));
        updateHistoryBadge();
        renderHistory();
        showToast('Run removed from history.');
    }

    function clearAllHistory() {
        if (confirm('Are you sure you want to clear your calculation history?')) {
            localStorage.removeItem(getHistoryKey());
            updateHistoryBadge();
            renderHistory();
            showToast('History cleared.');
        }
    }

    // ==========================================
    // Modals & Event Listeners
    // ==========================================
    function openAuthModal() {
        if (refs.userDropdownMenu) refs.userDropdownMenu.classList.add('hidden');
        if (refs.authModal) refs.authModal.classList.remove('hidden');
    }

    function openHistoryModal() {
        if (refs.userDropdownMenu) refs.userDropdownMenu.classList.add('hidden');
        renderHistory();
        if (refs.historyModal) refs.historyModal.classList.remove('hidden');
    }

    function openMobileNav() {
        if (!refs.mobileNavDrawer) return;
        refs.mobileNavDrawer.classList.remove('hidden');
        if (refs.mobileMenuToggle) {
            refs.mobileMenuToggle.classList.add('open');
            refs.mobileMenuToggle.setAttribute('aria-expanded', 'true');
        }
    }

    function closeMobileNavDrawer() {
        if (!refs.mobileNavDrawer) return;
        refs.mobileNavDrawer.classList.add('hidden');
        if (refs.mobileMenuToggle) {
            refs.mobileMenuToggle.classList.remove('open');
            refs.mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
    }

    function closeAllModals() {
        if (refs.historyModal) refs.historyModal.classList.add('hidden');
        if (refs.signoutModal) refs.signoutModal.classList.add('hidden');
        if (refs.userDropdownMenu) refs.userDropdownMenu.classList.add('hidden');
        if (refs.userMenuBtn) refs.userMenuBtn.setAttribute('aria-expanded', 'false');
        closeMobileNavDrawer();
    }

    if (refs.googleSigninBtn) {
        refs.googleSigninBtn.addEventListener('click', () => {
            sessionStorage.removeItem('centagon_guest_mode');
            if (refs.gateStepSignin) refs.gateStepSignin.classList.remove('hidden');
            if (refs.gateStepBatch) refs.gateStepBatch.classList.add('hidden');
            if (refs.gateTitle) refs.gateTitle.textContent = 'SIGN IN';
            if (refs.gateSubtitle) refs.gateSubtitle.textContent = 'Sign in with Google to access the 400-Series Exam Calculator.';
            openMandatoryGate();
            triggerGooglePrompt();
        });
    }

    if (refs.closeGateBtn) {
        refs.closeGateBtn.addEventListener('click', () => {
            sessionStorage.setItem('centagon_guest_mode', 'true');
            closeMandatoryGate();
        });
    }

    if (refs.closeSignoutBtn) {
        refs.closeSignoutBtn.addEventListener('click', closeSignoutModal);
    }

    if (refs.userMenuBtn) {
        refs.userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = refs.userDropdownMenu.classList.toggle('hidden');
            refs.userMenuBtn.setAttribute('aria-expanded', (!isExpanded).toString());
        });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (refs.userDropdownMenu && !refs.userDropdownMenu.contains(e.target) && !refs.userMenuBtn?.contains(e.target)) {
            refs.userDropdownMenu.classList.add('hidden');
            if (refs.userMenuBtn) refs.userMenuBtn.setAttribute('aria-expanded', 'false');
        }
    });

    if (refs.closeHistoryModal) refs.closeHistoryModal.addEventListener('click', closeAllModals);

    // Modal backdrop click to close history modal
    if (refs.historyModal) {
        refs.historyModal.addEventListener('click', (e) => {
            if (e.target === refs.historyModal) closeAllModals();
        });
    }

    // Sign out modal listeners
    if (refs.cancelSignoutBtn) refs.cancelSignoutBtn.addEventListener('click', closeSignoutModal);
    if (refs.confirmSignoutBtn) refs.confirmSignoutBtn.addEventListener('click', performSignOut);
    if (refs.signoutModal) {
        refs.signoutModal.addEventListener('click', (e) => {
            if (e.target === refs.signoutModal) closeSignoutModal();
        });
    }

    // ESC key closes modals & dropdown
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });

    if (refs.viewHistoryBtn) refs.viewHistoryBtn.addEventListener('click', openHistoryModal);
    if (refs.adminPanelBtn) {
        refs.adminPanelBtn.addEventListener('click', (e) => {
            if (!isAdminUser(currentUser)) {
                e.preventDefault();
                showToast('Admin privileges required.');
                return;
            }
        });
    }
    if (refs.signoutBtn) refs.signoutBtn.addEventListener('click', openSignoutModal);
    if (refs.clearHistoryBtn) refs.clearHistoryBtn.addEventListener('click', clearAllHistory);

    // Mobile Navigation Drawer Listeners
    if (refs.mobileMenuToggle) {
        refs.mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (refs.mobileNavDrawer && !refs.mobileNavDrawer.classList.contains('hidden')) {
                closeMobileNavDrawer();
            } else {
                closeAllModals();
                openMobileNav();
            }
        });
    }

    if (refs.closeMobileNav) {
        refs.closeMobileNav.addEventListener('click', closeMobileNavDrawer);
    }

    if (refs.mobileNavBackdrop) {
        refs.mobileNavBackdrop.addEventListener('click', closeMobileNavDrawer);
    }

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            closeMobileNavDrawer();
        });
    });

    if (refs.mobileHistoryBtn) {
        refs.mobileHistoryBtn.addEventListener('click', () => {
            closeMobileNavDrawer();
            openHistoryModal();
        });
    }

    // Hub & Batch Event Listeners
    if (refs.hubSelect) {
        refs.hubSelect.addEventListener('change', (e) => {
            selectHub(e.target.value);
        });
    }

    if (refs.batch2DigitInput) {
        refs.batch2DigitInput.addEventListener('input', handleBatch2DigitInput);
        refs.batch2DigitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitBatch();
        });
    }

    if (refs.submitBatchBtn) {
        refs.submitBatchBtn.addEventListener('click', submitBatch);
    }

    if (refs.editBatchBtn) {
        refs.editBatchBtn.addEventListener('click', () => {
            closeAllModals();
            showBatchGate(true);
        });
    }

    // Initialize Auth & UI
    loadStoredUser();
    updateAuthUI();
    initGoogleAuth();

    if (!currentUser && !sessionStorage.getItem('centagon_guest_mode')) {
        openMandatoryGate();
    }

    // Initialize App
    renderModules();
});
