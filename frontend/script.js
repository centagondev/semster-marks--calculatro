// Semester Marks Calculator — Frontend Logic

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──────────────────────────────────────────────────
    const refs = {
        numModules:       document.getElementById('num-modules'),
        modulesMinus:     document.getElementById('modules-minus'),
        modulesPlus:      document.getElementById('modules-plus'),
        modulesContainer: document.getElementById('dynamic-modules'),
        addModuleBtn:     document.getElementById('add-module-btn'),
        modulesStatus:    document.getElementById('modules-status'),

        targetBtns:       document.querySelectorAll('.target-btn'),
        customTarget:     document.getElementById('custom-target'),

        calculateBtn:     document.getElementById('calculate-btn'),

        errorBanner:      document.getElementById('error-message'),
        errorText:        document.getElementById('error-text'),

        resultDisplay:    document.getElementById('result-display'),
        resultPlaceholder:document.getElementById('result-placeholder'),

        // Result fields
        resTarget:        document.getElementById('res-target'),
        resRemainingMods: document.getElementById('res-remaining-mods'),
        resModuleAggregate:document.getElementById('res-module-aggregate'),
        resMarksNeeded:   document.getElementById('res-marks-needed'),
        resMarksSub:      document.getElementById('res-marks-sub'),
        resStatusBadge:   document.getElementById('result-status-badge'),
        resStatusText:    document.getElementById('result-status-text'),
        resStatusIcon:    document.getElementById('result-status-icon'),
        
        themeToggle:      document.getElementById('theme-toggle'),
    };

    // ── State ─────────────────────────────────────────────────────
    let state = {
        // Each entry: { theory: number, practical: number }
        completedMarks: [
            { theory: 7, practical: 7 },
            { theory: 8, practical: 8 }
        ],
    };

    // ── Helpers ───────────────────────────────────────────────────
    function getTotalModules() {
        return parseInt(refs.numModules.value) || 1;
    }

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    // ── Module rendering ──────────────────────────────────────────
    function renderModules() {
        const total = getTotalModules();

        // Cap completed modules at total
        if (state.completedMarks.length > total) {
            state.completedMarks = state.completedMarks.slice(0, total);
        }

        // Update status label
        const completed = state.completedMarks.length;
        refs.modulesStatus.textContent =
            `${completed} of ${total} module${total !== 1 ? 's' : ''} added`;

        // Show/hide add button
        const canAdd = completed < total;
        refs.addModuleBtn.disabled = !canAdd;
        refs.addModuleBtn.style.display = canAdd ? '' : 'none';

        // Rebuild module rows
        refs.modulesContainer.innerHTML = '';

        state.completedMarks.forEach((markObj, idx) => {
            const row = document.createElement('div');
            row.className = 'module-row';

            // Module number badge
            const numBadge = document.createElement('div');
            numBadge.className = 'module-num';
            numBadge.textContent = idx + 1;

            // Theory field
            const theoryField = makeModuleField(
                'Theory',
                markObj.theory,
                10,
                `Theory mark for Module ${idx + 1}`,
                (val) => { state.completedMarks[idx].theory = val; }
            );

            // Practical field
            const pracField = makeModuleField(
                'Practical',
                markObj.practical,
                10,
                `Practical mark for Module ${idx + 1}`,
                (val) => { state.completedMarks[idx].practical = val; }
            );

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-module-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `Remove module ${idx + 1}`);
            removeBtn.addEventListener('click', () => {
                state.completedMarks.splice(idx, 1);
                renderModules();
            });

            row.appendChild(numBadge);
            row.appendChild(theoryField);
            row.appendChild(pracField);
            row.appendChild(removeBtn);

            refs.modulesContainer.appendChild(row);
        });
    }

    function makeModuleField(label, value, max, ariaLabel, onChange) {
        const field = document.createElement('div');
        field.className = 'module-field';

        const labelEl = document.createElement('span');
        labelEl.className = 'module-field-label';
        labelEl.textContent = label;

        const wrap = document.createElement('div');
        wrap.className = 'module-input-wrap';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = String(max);
        input.step = '0.1';
        input.value = value;
        input.setAttribute('aria-label', ariaLabel);

        input.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0;
            val = clamp(val, 0, max);
            e.target.value = val;
            onChange(val);
        });

        const unit = document.createElement('span');
        unit.className = 'module-input-unit';
        unit.textContent = `/ ${max}`;

        wrap.appendChild(input);
        wrap.appendChild(unit);

        field.appendChild(labelEl);
        field.appendChild(wrap);

        return field;
    }

    // ── Total modules stepper ─────────────────────────────────────
    refs.modulesMinus.addEventListener('click', () => {
        const current = getTotalModules();
        if (current > 1) {
            refs.numModules.value = current - 1;
            renderModules();
        }
    });

    refs.modulesPlus.addEventListener('click', () => {
        const current = getTotalModules();
        refs.numModules.value = current + 1;
        renderModules();
    });

    refs.numModules.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        e.target.value = val;
        renderModules();
    });

    // ── Add module button ─────────────────────────────────────────
    refs.addModuleBtn.addEventListener('click', () => {
        const total = getTotalModules();
        if (state.completedMarks.length < total) {
            state.completedMarks.push({ theory: 0, practical: 0 });
            renderModules();
        }
    });

    // ── Target percentage pills ───────────────────────────────────
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

    // ── Calculate ─────────────────────────────────────────────────
    refs.calculateBtn.addEventListener('click', () => {
        const totalModules = getTotalModules();
        const targetPct = parseFloat(refs.customTarget.value);

        if (isNaN(totalModules) || totalModules < 1) {
            showError('Number of modules must be at least 1.');
            return;
        }
        if (isNaN(targetPct) || targetPct <= 0 || targetPct > 100) {
            showError('Target percentage must be between 0 and 100.');
            return;
        }

        hideError();
        setCalculating(true);

        // Combine theory + practical into a single mark per module
        const combinedMarks = state.completedMarks.map(m => m.theory + m.practical);

        try {
            const data = calculateExam(totalModules, combinedMarks, targetPct);
            renderResult(data);

        } catch (err) {
            showError(err.message || 'Could not calculate the result.');
            console.error(err);
        } finally {
            setCalculating(false);
        }
    });

    function calculateExam(numberOfModules, completedModuleMarks, targetPercentage = 40) {
        const completedCount = completedModuleMarks.length;
        const remainingModules = numberOfModules - completedCount;
        const completedMarks = completedModuleMarks.reduce((total, mark) => total + mark, 0);

        // 1. Module Aggregate
        const moduleAggregate = (completedMarks / (numberOfModules * 20)) * 40;

        // 2. Marks Needed To Pass (remaining contribution required)
        const marksNeeded = targetPercentage - moduleAggregate;

        // CASE 1: All modules are completed
        if (remainingModules === 0) {
            let requiredPaperMark = (marksNeeded / 60) * 100;

            if (requiredPaperMark > 100) {
                return {
                    status: 'INVALID INPUT',
                    message: 'Required paper mark exceeds the maximum available mark of 100.',
                    target_percentage: targetPercentage,
                    completed_modules: completedCount,
                    remaining_modules: 0,
                    completed_marks: completedMarks,
                    module_aggregate: moduleAggregate,
                    module_aggregate_max: 40,
                    marks_needed: marksNeeded,
                    required_percentage: requiredPaperMark,
                    required_paper_marks: requiredPaperMark,
                };
            }

            if (requiredPaperMark < 0) requiredPaperMark = 0;

            return {
                status: 'PASS POSSIBLE',
                target_percentage: targetPercentage,
                completed_modules: completedCount,
                remaining_modules: 0,
                completed_marks: completedMarks,
                module_aggregate: moduleAggregate,
                module_aggregate_max: 40,
                marks_needed: marksNeeded,
                required_percentage: requiredPaperMark,
                required_module_marks: [],
                required_paper_marks: requiredPaperMark,
            };
        }

        // CASE 2: Modules + final paper are remaining
        const denominator = (0.4 * remainingModules / numberOfModules) + 0.6;
        let p = marksNeeded / denominator;
        let requiredModuleMark = (p / 100) * 20;
        let requiredPaperMark = p;

        if (requiredModuleMark > 20) {
            return {
                status: 'INVALID INPUT',
                message: 'Required mark exceeds the maximum available module mark of 20.',
                target_percentage: targetPercentage,
                completed_modules: completedCount,
                remaining_modules: remainingModules,
                completed_marks: completedMarks,
                module_aggregate: moduleAggregate,
                module_aggregate_max: 40,
                marks_needed: marksNeeded,
                required_percentage: p,
                required_module_marks: Array(remainingModules).fill(requiredModuleMark),
                required_paper_marks: requiredPaperMark,
            };
        }

        if (requiredModuleMark < 0) {
            requiredModuleMark = 0;
            requiredPaperMark = 0;
            p = 0;
        }

        return {
            status: 'PASS POSSIBLE',
            target_percentage: targetPercentage,
            completed_modules: completedCount,
            remaining_modules: remainingModules,
            completed_marks: completedMarks,
            module_aggregate: moduleAggregate,
            module_aggregate_max: 40,
            marks_needed: marksNeeded,
            required_percentage: p,
            required_module_marks: Array(remainingModules).fill(requiredModuleMark),
            required_paper_marks: requiredPaperMark,
        };
    }

    // ── Render result ─────────────────────────────────────────────
    function renderResult(data) {
        const isAchievable = data.status === 'PASS POSSIBLE';

        // Show result panel, hide placeholder
        refs.resultPlaceholder.classList.add('hidden');
        refs.resultDisplay.classList.remove('hidden');

        // Status badge
        refs.resStatusBadge.className = 'result-status-badge ' +
            (isAchievable ? 'achievable' : 'not-achievable');
        refs.resStatusIcon.textContent = isAchievable ? '✓' : '✗';
        refs.resStatusText.textContent  = isAchievable ? 'Target Achievable' : 'Target Not Achievable';

        // Target
        refs.resTarget.textContent = `${data.target_percentage}%`;

        // Module aggregate
        if (data.module_aggregate !== undefined) {
            refs.resModuleAggregate.textContent = data.module_aggregate.toFixed(2);
        }

        // Remaining modules
        if (data.remaining_modules !== undefined) {
            refs.resRemainingMods.textContent = data.remaining_modules;
        }

        // Marks needed from paper
        if (data.marks_needed !== undefined) {
            refs.resMarksNeeded.textContent = data.marks_needed.toFixed(2);
        }

        // Scroll result into view on mobile
        if (window.innerWidth <= 640) {
            refs.resultDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ── Error helpers ─────────────────────────────────────────────
    function showError(msg) {
        refs.errorText.textContent = msg;
        refs.errorBanner.classList.remove('hidden');
    }

    function hideError() {
        refs.errorBanner.classList.add('hidden');
    }

    // ── Button loading state ──────────────────────────────────────
    function setCalculating(loading) {
        refs.calculateBtn.disabled = loading;
        const textEl = refs.calculateBtn.querySelector('.btn-text');
        if (textEl) {
            textEl.textContent = loading ? 'Calculating…' : 'Calculate';
        }
    }

    // ── Theme toggle ──────────────────────────────────────────────
    if (refs.themeToggle) {
        refs.themeToggle.addEventListener('click', () => {
            document.body.classList.add('theme-transitioning');
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('semcalc-theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('semcalc-theme', 'dark');
            }
            
            // Remove transition class after animation completes
            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, 200);
        });
    }

    // ── Init ──────────────────────────────────────────────────────
    renderModules();

});
