// 1. DOM references
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
        resRemainingMods: document.getElementById('res-remaining-mods'),
        resModuleAggregate: document.getElementById('res-module-aggregate'),
        resMarksNeeded: document.getElementById('res-marks-needed'),
        resStatusContainer: document.getElementById('res-status-container'),
        resStatusText: document.getElementById('res-status-text')
    };

    // 2. State
    let state = {
        completedMarks: [
            { theory: 7, practical: 7 },
            { theory: 8, practical: 8 }
        ],
    };

    function calculateExam({ number_of_modules, completed_module_marks, target_percentage = 40 }) {
        const completed_count = completed_module_marks.length;
        const remaining_modules = number_of_modules - completed_count;
        const completed_marks = completed_module_marks.reduce((sum, mark) => sum + mark, 0);

        const module_aggregate = (completed_marks / (number_of_modules * 20)) * 40;
        const marks_needed = target_percentage - module_aggregate;

        if (remaining_modules === 0) {
            let required_paper_mark = (marks_needed / 60) * 100;

            if (required_paper_mark > 100) {
                return {
                    status: "INVALID INPUT",
                    message: "Required paper mark exceeds the maximum available mark of 100.",
                    target_percentage: target_percentage,
                    completed_modules: completed_count,
                    remaining_modules: 0,
                    completed_marks: completed_marks,
                    module_aggregate: module_aggregate,
                    module_aggregate_max: 40,
                    marks_needed: marks_needed,
                    required_percentage: required_paper_mark,
                    required_paper_marks: required_paper_mark,
                };
            }

            if (required_paper_mark < 0) {
                required_paper_mark = 0;
            }

            return {
                status: "PASS POSSIBLE",
                target_percentage: target_percentage,
                completed_modules: completed_count,
                remaining_modules: 0,
                completed_marks: completed_marks,
                module_aggregate: module_aggregate,
                module_aggregate_max: 40,
                marks_needed: marks_needed,
                required_percentage: required_paper_mark,
                required_module_marks: [],
                required_paper_marks: required_paper_mark,
            };
        }

        const denominator = (0.4 * remaining_modules / number_of_modules) + 0.6;
        let p = marks_needed / denominator;

        let required_module_mark = (p / 100) * 20;
        let required_paper_mark = p;

        if (required_module_mark > 20) {
            return {
                status: "INVALID INPUT",
                message: "Required mark exceeds the maximum available module mark of 20.",
                target_percentage: target_percentage,
                completed_modules: completed_count,
                remaining_modules: remaining_modules,
                completed_marks: completed_marks,
                module_aggregate: module_aggregate,
                module_aggregate_max: 40,
                marks_needed: marks_needed,
                required_percentage: p,
                required_module_marks: [required_module_mark] * remaining_modules,
                required_paper_marks: required_paper_mark,
            };
        }

        if (required_module_mark < 0) {
            required_module_mark = 0;
            required_paper_mark = 0;
            p = 0;
        }

        return {
            status: "PASS POSSIBLE",
            target_percentage: target_percentage,
            completed_modules: completed_count,
            remaining_modules: remaining_modules,
            completed_marks: completed_marks,
            module_aggregate: module_aggregate,
            module_aggregate_max: 40,
            marks_needed: marks_needed,
            required_percentage: p,
            required_module_marks: [required_module_mark] * remaining_modules,
            required_paper_marks: required_paper_mark,
        };
    }

    // 3. Module management
    function formatNumber(num) {
        return num.toString().padStart(2, '0');
    }

    function renderModules() {
        const totalModules = parseInt(refs.numModules.value) || 1;
        
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
            theoryInput.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                if (val > 10) val = 10;
                e.target.value = val;
                state.completedMarks[idx].theory = val;
            });
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
            pracInput.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                if (val > 10) val = 10;
                e.target.value = val;
                state.completedMarks[idx].practical = val;
            });
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
            });
            
            row.appendChild(label);
            row.appendChild(inputsContainer);
            row.appendChild(removeBtn);
            
            refs.modulesContainer.appendChild(row);
        });
    }

    // 4. Validation & Listeners
    refs.numModules.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) {
            val = 1;
        }
        e.target.value = formatNumber(val);
        renderModules();
    });

    refs.addModuleBtn.addEventListener('click', () => {
        const total = parseInt(refs.numModules.value) || 1;
        if (state.completedMarks.length < total) {
            state.completedMarks.push({ theory: 0, practical: 0 });
            renderModules();
        }
    });

    refs.targetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            refs.targetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refs.customTarget.value = btn.dataset.val;
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
    });

    // 5. API request
    refs.calculateBtn.addEventListener('click', async () => {
        const totalModules = parseInt(refs.numModules.value);
        const targetPct = parseFloat(refs.customTarget.value);

        // Validation defensive checks
        if (isNaN(totalModules) || totalModules < 1) {
            showError("Number of modules must be at least 1.");
            return;
        }
        if (isNaN(targetPct) || targetPct <= 0 || targetPct > 100) {
            showError("Target percentage must be between 0 and 100.");
            return;
        }

        hideError();
        refs.calculateBtn.disabled = true;
        refs.calculateBtn.textContent = 'CALCULATING...';

        const combinedMarks = state.completedMarks.map(m => m.theory + m.practical);

        const payload = {
            number_of_modules: totalModules,
            completed_module_marks: combinedMarks,
            target_percentage: targetPct
        };

        try {
            const data = calculateExam({
                number_of_modules: totalModules,
                completed_module_marks: combinedMarks,
                target_percentage: targetPct
            });
            renderResult(data);
        } catch (err) {
            showError("Calculation failed. Please review your inputs.");
            console.error(err);
        } finally {
            refs.calculateBtn.disabled = false;
            refs.calculateBtn.textContent = 'CALCULATE →';
        }
    });

    // 6. Result rendering
    function renderResult(data) {
        refs.resultPlaceholder.classList.add('hidden');
        refs.resultDisplay.classList.remove('hidden');

        const isAchievable = data.status === "PASS POSSIBLE";
        
        refs.resTarget.textContent = `${data.target_percentage}%`;
        
        if (data.remaining_modules !== undefined) {
             refs.resRemainingMods.textContent = formatNumber(data.remaining_modules);
        }
        
        if (data.module_aggregate !== undefined) {
            refs.resModuleAggregate.textContent = `${data.module_aggregate.toFixed(2)} / ${data.module_aggregate_max}`;
        }
        
        if (data.marks_needed !== undefined) {
            refs.resMarksNeeded.textContent = `${data.marks_needed.toFixed(2)} / 60`;
        }


        

        
        refs.resStatusText.textContent = isAchievable ? "TARGET ACHIEVABLE" : "TARGET NOT ACHIEVABLE";
        
        refs.resStatusContainer.className = 'result-status';
        refs.resStatusContainer.classList.add(isAchievable ? 'status-success' : 'status-fail');

        if (window.innerWidth <= 768) {
            refs.resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 7. Error handling
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
