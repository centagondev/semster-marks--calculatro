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
        convertBtn: document.getElementById('convert-btn'),
        resConvertedScore: document.getElementById('res-converted-score'),
        resStatusContainer: document.getElementById('res-status-container'),
        resStatusText: document.getElementById('res-status-text')
    };

    // 2. State
    let state = {
        completedMarks: [
            { theory: 7, practical: 7 },
            { theory: 8, practical: 8 }
        ],
        currentMarksNeeded: null,
        isConvertedVisible: false
    };

    function calculateExam({ number_of_modules, completed_module_marks, target_percentage = 40 }) {
        const completed_count = completed_module_marks.length;
        const remaining_modules = number_of_modules - completed_count;
        const completed_marks = completed_module_marks.reduce((sum, mark) => sum + mark, 0);

        // 1. Module Aggregate (Secured from modules, out of 40)
        const module_aggregate = (completed_marks / (number_of_modules * 20)) * 40;
        
        // 2. Required Paper Contribution (Required to reach target, out of 60)
        // The paper exam has a 60% weight (maximum contribution is 60).
        const marks_needed = target_percentage - module_aggregate;

        // 3. Target Achievability
        // If required paper contribution <= 60: TARGET ACHIEVABLE
        // If required paper contribution > 60: TARGET UNACHIEVABLE
        const is_achievable = marks_needed <= 60;
        const status = is_achievable ? "TARGET ACHIEVABLE" : "TARGET UNACHIEVABLE";

        const raw_paper_marks = marks_needed > 0 ? (marks_needed / 60) * 20 : 0.0;

        return {
            status: status,
            is_achievable: is_achievable,
            target_percentage: target_percentage,
            completed_modules: completed_count,
            remaining_modules: remaining_modules,
            completed_marks: completed_marks,
            module_aggregate: module_aggregate,
            module_aggregate_max: 40,
            marks_needed: marks_needed,
            required_paper_contribution: marks_needed,
            required_paper_max: 60,
            required_percentage: marks_needed > 0 ? (marks_needed / 60) * 100 : 0.0,
            required_paper_marks: raw_paper_marks,
            required_module_marks: [],
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

        const combinedMarks = state.completedMarks.map(m => m.theory + m.practical);

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
        }
    });

    // 6. Result rendering
    function renderResult(data) {
        refs.resultPlaceholder.classList.add('hidden');
        refs.resultDisplay.classList.remove('hidden');

        // Target achievability: achievable if required paper contribution <= 60
        const isAchievable = data.is_achievable !== undefined 
            ? data.is_achievable 
            : (data.marks_needed !== undefined ? data.marks_needed <= 60 : data.status === "TARGET ACHIEVABLE");
        
        refs.resTarget.textContent = `${data.target_percentage}%`;
        
        if (data.remaining_modules !== undefined) {
             refs.resRemainingMods.textContent = formatNumber(data.remaining_modules);
        }
        
        if (data.module_aggregate !== undefined) {
            refs.resModuleAggregate.textContent = `${data.module_aggregate.toFixed(2)} / ${data.module_aggregate_max}`;
        }
        
        if (data.marks_needed !== undefined) {
            refs.resMarksNeeded.textContent = `${data.marks_needed.toFixed(2)} / 60`;
            state.currentMarksNeeded = data.marks_needed;
            const rawConverted = (data.marks_needed / 60) * 20;
            refs.resConvertedScore.textContent = `${rawConverted.toFixed(2)} / 20`;
        }

        // Keep /20 value hidden until user clicks the button
        state.isConvertedVisible = false;
        refs.resConvertedScore.classList.add('hidden');
        refs.convertBtn.classList.remove('active');
        refs.convertBtn.setAttribute('aria-expanded', 'false');

        refs.resStatusText.textContent = isAchievable ? "TARGET ACHIEVABLE" : "TARGET UNACHIEVABLE";
        
        refs.resStatusContainer.className = 'result-status';
        refs.resStatusContainer.classList.add(isAchievable ? 'status-success' : 'status-fail');

        if (window.innerWidth <= 768) {
            refs.resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 6b. Convert to /20 toggle listener
    refs.convertBtn.addEventListener('click', () => {
        if (state.currentMarksNeeded === null || state.currentMarksNeeded === undefined) return;
        state.isConvertedVisible = !state.isConvertedVisible;
        const rawConverted = (state.currentMarksNeeded / 60) * 20;
        refs.resConvertedScore.textContent = `${rawConverted.toFixed(2)} / 20`;

        if (state.isConvertedVisible) {
            refs.resConvertedScore.classList.remove('hidden');
            refs.convertBtn.classList.add('active');
            refs.convertBtn.setAttribute('aria-expanded', 'true');
        } else {
            refs.resConvertedScore.classList.add('hidden');
            refs.convertBtn.classList.remove('active');
            refs.convertBtn.setAttribute('aria-expanded', 'false');
        }
    });

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
