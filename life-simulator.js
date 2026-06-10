/* ============================================
   THE LIFE SIMULATOR — Core Logic
   All 11 phases, original generation algorithms
   ============================================ */

(function() {
    'use strict';

    // ====================================================
    // STATE
    // ====================================================
    const state = {
        profile: null,
        scores: null,
        clone: null,
        altLives: null,
        timeline: null,
        decisions: null,
        chat: [],
        book: null,
        legacy: null,
        universes: null,
        comparison: null,
    };

    const STORAGE_KEY = 'zaqori_life_sim_state';

    // ====================================================
    // UTILITIES
    // ====================================================
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const fmt = {
        usd: (n) => '$' + Math.round(n).toLocaleString('en-US'),
        pct: (n) => Math.round(n) + '%',
        num: (n) => Math.round(n).toLocaleString('en-US'),
    };

    // Expose showScreen globally so the inline onclick handler can call it
    window.lsShowScreen = function(id) {
        try {
            $$('.ls-screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(id);
            if (target) {
                target.classList.add('active');
                window.scrollTo(0, 0);
            }
        } catch (e) {
            console.error('[LifeSim] showScreen error:', e);
        }
    };

    // ====================================================
    // FORM SUBMIT (global — called by inline onsubmit)
    // Validates → shows loading → generates clone → shows results
    // ====================================================
    window.lsSubmitForm = function(form, event) {
        try {
            if (event) event.preventDefault();

            // Validate required fields
            var requiredFields = form.querySelectorAll('input[required], select[required]');
            var missing = [];
            for (var i = 0; i < requiredFields.length; i++) {
                var f = requiredFields[i];
                if (!f.value || f.value.trim() === '') {
                    missing.push(f);
                    f.style.borderColor = '#ef4444';
                    f.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
                } else {
                    f.style.borderColor = '';
                    f.style.boxShadow = '';
                }
            }
            if (missing.length > 0) {
                window.lsShowError('Please fill in all required fields. ' + missing.length + ' field(s) missing.');
                missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                missing[0].focus();
                return false;
            }

            // Collect profile data
            var fd = new FormData(form);
            var profile = {};
            fd.forEach(function(value, key) {
                var num = parseFloat(value);
                profile[key] = isNaN(num) || value === '' ? value : num;
            });
            // Defaults for optional psychological fields
            ['fear', 'dream', 'regret', 'memory', 'influence', 'achievement'].forEach(function(k) {
                profile[k] = profile[k] || '—';
            });

            // Show loading state
            window.lsShowLoading('Generating your digital clone…');

            // Generate clone after a brief delay (for UX)
            setTimeout(function() {
                try {
                    if (typeof state !== 'undefined') {
                        state.profile = profile;
                        if (typeof saveState === 'function') saveState();
                        if (typeof generateClone === 'function') generateClone();
                    }
                    window.lsHideLoading();
                    window.lsShowScreen('ls-phase-2');
                    if (typeof showProgress === 'function') showProgress(18);
                } catch (genErr) {
                    console.error('[LifeSim] generate error:', genErr);
                    window.lsHideLoading();
                    window.lsShowError('Something went wrong generating your clone. Please try again.');
                }
            }, 1200);

            return false;
        } catch (e) {
            console.error('[LifeSim] form submit error:', e);
            window.lsHideLoading();
            window.lsShowError('An unexpected error occurred. Please try again.');
            return false;
        }
    };

    // ====================================================
    // LOADING OVERLAY
    // ====================================================
    window.lsShowLoading = function(message) {
        var existing = document.getElementById('ls-loading-overlay');
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = 'ls-loading-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,20,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;';
        overlay.innerHTML = '<div style="width:60px;height:60px;border:4px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:ls-spin 0.8s linear infinite;"></div><div style="color:#f5f5fa;font-size:1.1rem;font-weight:600;">' + (message || 'Loading…') + '</div><style>@keyframes ls-spin{to{transform:rotate(360deg)}}</style>';
        document.body.appendChild(overlay);
    };

    window.lsHideLoading = function() {
        var overlay = document.getElementById('ls-loading-overlay');
        if (overlay) overlay.remove();
    };

    // ====================================================
    // ERROR TOAST
    // ====================================================
    window.lsShowError = function(message) {
        var existing = document.getElementById('ls-error-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.id = 'ls-error-toast';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ef4444;color:white;padding:14px 24px;border-radius:12px;font-weight:600;z-index:99999;box-shadow:0 8px 24px rgba(239,68,68,0.4);max-width:90%;text-align:center;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 5000);
    };

    function showScreen(id) { window.lsShowScreen(id); }

    function showProgress(pct) {
        const fill = $('#ls-progress-fill');
        if (fill) fill.style.width = pct + '%';
    }

    // ====================================================
    // HASH-BASED NAVIGATION (CSS :has() + JS backup)
    // ====================================================
    function handleHash() {
        try {
            var hash = (location.hash || '').toLowerCase();
            var screens = document.querySelectorAll('.ls-screen');
            screens.forEach(function(s) { s.classList.remove('active'); s.style.display = 'none'; });
            if (hash === '#ls-phase-1' || hash === '#ls-phase-2' || hash === '#ls-phase-3' || hash === '#ls-phase-4' || hash === '#ls-phase-5' || hash === '#ls-phase-6' || hash === '#ls-phase-7' || hash === '#ls-phase-8' || hash === '#ls-phase-9' || hash === '#ls-phase-10' || hash === '#ls-phase-11') {
                var target = document.querySelector(hash);
                if (target) { target.classList.add('active'); target.style.display = 'block'; }
            } else {
                var intro = document.getElementById('ls-intro');
                if (intro) { intro.classList.add('active'); intro.style.display = 'flex'; }
            }
            window.scrollTo(0, 0);
        } catch(e) { console.error('[LifeSim] hash handler error:', e); }
    }

    // ====================================================
    // SLIDER LIVE VALUES
    // ====================================================
    const sliderMap = {
        intro: 'v-intro', extro: 'v-extro', ambition: 'v-amb',
        confidence: 'v-conf', patience: 'v-pat', discipline: 'v-disc',
        curiosity: 'v-cur', emotional: 'v-emo', risk: 'v-risk',
        reading: 'v-read', socialmedia: 'v-soc', work: 'v-work',
        famb: 'fv-amb', fdisc: 'fv-disc', fextro: 'fv-extro', frisk: 'fv-risk',
    };

    // Wait for DOM ready before attaching any listeners
    function init() {
        try {
            $$('.ls-slider').forEach(slider => {
                const out = $('#' + (sliderMap[slider.name] || ''));
                if (out) {
                    out.textContent = slider.value;
                    slider.addEventListener('input', () => { out.textContent = slider.value; });
                }
            });

            // INTRO → PHASE 1 (defensive attach — the inline onclick is the primary handler)
            const beginBtn = $('#ls-begin');
            if (beginBtn) {
                beginBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    window.lsShowScreen('ls-phase-1');
                });
            }

            // Hash-based navigation: works even if the CSS :has() fallback fails
            window.addEventListener('hashchange', handleHash);
            handleHash(); // Run on init

    // ====================================================
    // PHASE 1: FORM SUBMIT
    // ====================================================
    $('#ls-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const profile = {};
        for (const [k, v] of fd.entries()) {
            const num = parseFloat(v);
            profile[k] = isNaN(num) || v === '' ? v : num;
        }
        // Defaults for optional psychological fields
        ['fear', 'dream', 'regret', 'memory', 'influence', 'achievement'].forEach(k => {
            profile[k] = profile[k] || '—';
        });

        // Save state
        state.profile = profile;
        saveState();
        generateClone();
        showScreen('ls-phase-2');
        showProgress(18);
    });

    // ====================================================
    // PHASE 2: CLONE GENERATION
    // ====================================================
    function generateClone() {
        const p = state.profile;

        // Compute base scores
        const scores = {
            wealth: clamp(20 + p.income / 5000 + p.discipline * 4 + p.risk * 2 - p.debt / 3000, 5, 98),
            happiness: clamp(30 + p.emotional * 5 + p.intro * 1.5 + p.extro * 1.5 + (p.relationship !== 'Single' ? 8 : 0), 10, 98),
            leadership: clamp(25 + p.confidence * 5 + p.extro * 2 + p.ambition * 2, 5, 98),
            creativity: clamp(30 + p.curiosity * 5 + p.intro * 2 + p.confidence * 2, 5, 98),
            relationships: clamp(35 + p.extro * 3 + p.emotional * 4 + p.patience * 2, 10, 98),
            health: clamp(40 + (p.exercise?.includes('5+') ? 30 : p.exercise?.includes('3-4') ? 18 : p.exercise?.includes('1-2') ? 8 : 0) - (p.smoking === 'Heavy' ? 25 : p.smoking === 'Regularly' ? 12 : 0) + (p.sleep?.includes('7-8') ? 12 : p.sleep?.includes('8+') ? 8 : 0), 5, 98),
            discipline: clamp(20 + p.discipline * 7 + p.work * 1.5, 5, 98),
            influence: clamp(15 + p.ambition * 4 + p.confidence * 4 + p.extro * 1.5, 5, 98),
        };

        // Determine archetype
        const archetype = determineArchetype(p);
        const strategy = determineStrategy(p);

        // Hidden strengths and weaknesses
        const strengths = pickHiddenStrengths(p, scores);
        const weaknesses = pickHiddenWeaknesses(p, scores);

        // Core motivations
        const motivations = pickMotivations(p);

        state.scores = scores;
        state.clone = {
            name: p.name,
            archetype,
            strategy,
            scores,
            strengths,
            weaknesses,
            motivations,
        };
        renderClone();
        saveState();
    }

    function determineArchetype(p) {
        if (p.ambition > 7 && p.risk > 6) return 'The Visionary Builder';
        if (p.discipline > 7 && p.work > 7) return 'The Relentless Operator';
        if (p.curiosity > 7 && p.intro > 6) return 'The Quiet Explorer';
        if (p.extro > 7 && p.confidence > 7) return 'The Magnetic Leader';
        if (p.emotional > 7 && p.patience > 7) return 'The Steady Sage';
        if (p.creativity ?? p.curiosity > 6) return 'The Creative Force';
        if (p.confidence > 7) return 'The Bold Maverick';
        if (p.discipline > 6) return 'The Disciplined Achiever';
        return 'The Balanced Seeker';
    }

    function determineStrategy(p) {
        if (p.ambition > 7) return 'Empire Builder';
        if (p.curiosity > 7) return 'Lifelong Learner';
        if (p.extro > 7) return 'Network Catalyst';
        if (p.discipline > 7) return 'Systematic Climber';
        if (p.emotional > 7) return 'Harmony Cultivator';
        if (p.risk > 7) return 'Calculated Risk-Taker';
        if (p.intro > 7) return 'Deep Specialist';
        return 'Adaptive Generalist';
    }

    function pickHiddenStrengths(p, scores) {
        const all = [
            'You learn from failure faster than most people learn from success.',
            'Your pattern recognition is sharper than you realize.',
            'You have an unusual ability to stay calm under pressure.',
            'You make better long-term decisions than 80% of people.',
            'Your curiosity creates unexpected opportunities.',
            'You have natural charisma that opens doors quietly.',
            'You are more patient than you give yourself credit for.',
            'You build loyalty in others through consistency.',
            'You adapt to new environments unusually fast.',
            'You have a high tolerance for ambiguity, which is rare.',
            'You notice details that others consistently miss.',
            'You recover from setbacks faster than average.',
        ];
        return all.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    function pickHiddenWeaknesses(p, scores) {
        const all = [
            'You underestimate how much you need other people.',
            'You avoid conflict longer than you should, then overcorrect.',
            'You overthink low-stakes decisions.',
            'You confuse being busy with being effective.',
            'You compare yourself to others more than you realize.',
            'You take on too much responsibility for other people\'s outcomes.',
            'You delay starting because the first step feels uncertain.',
            'You underestimate how your small habits compound.',
            'You say yes to commitments that don\'t serve your goals.',
            'You default to action over reflection, even when reflection is what you need.',
            'You mistake intensity for progress.',
            'You undervalue rest as a strategic tool.',
        ];
        return all.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    function pickMotivations(p) {
        const valueMotivations = [];
        const vmap = { v_family: 'Family security drives your biggest decisions.',
            v_freedom: 'Autonomy is the lens through which you evaluate every opportunity.',
            v_wealth: 'Financial freedom is your primary scoreboard.',
            v_career: 'Career trajectory shapes your daily choices more than you admit.',
            v_love: 'Deep connection is what you ultimately optimize for.',
            v_purpose: 'You need your work to mean something beyond the paycheck.',
            v_adventure: 'New experiences matter more to you than stability.',
            v_security: 'Predictability and safety are non-negotiable for you.' };
        for (const k in vmap) if (p[k]) valueMotivations.push(vmap[k]);
        return valueMotivations.slice(0, 3);
    }

    function renderClone() {
        const c = state.clone;
        const p = state.profile;
        const scores = c.scores;

        const scoreCards = Object.entries(scores).map(([k, v]) => `
            <div class="ls-score">
                <div class="ls-score-label">${k}</div>
                <div class="ls-score-value">${Math.round(v)}</div>
                <div class="ls-score-bar"><div class="ls-score-bar-fill" style="width:${v}%"></div></div>
            </div>`).join('');

        $('#ls-clone-output').innerHTML = `
            <div class="ls-clone-card">
                <div class="ls-clone-name">${c.name}</div>
                <div class="ls-clone-archetype">${c.archetype} · ${c.strategy}</div>
                <div class="ls-clone-grid">
                    <div class="ls-clone-section">
                        <h4>Core Motivations</h4>
                        <ul>${c.motivations.map(m => `<li>• ${m}</li>`).join('')}</ul>
                    </div>
                    <div class="ls-clone-section">
                        <h4>Hidden Strengths</h4>
                        <ul>${c.strengths.map(s => `<li>• ${s}</li>`).join('')}</ul>
                    </div>
                    <div class="ls-clone-section">
                        <h4>Hidden Weaknesses</h4>
                        <ul>${c.weaknesses.map(w => `<li>• ${w}</li>`).join('')}</ul>
                    </div>
                </div>
                <h4 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--ls-text-dim);margin:24px 0 12px;">Potential Scores</h4>
                <div class="ls-clone-scores">${scoreCards}</div>
            </div>`;
    }

    $('#ls-go-phase-3')?.addEventListener('click', () => {
        generateAltLives();
        showScreen('ls-phase-3');
        showProgress(27);
    });

    // ====================================================
    // PHASE 3: ALTERNATE LIVES
    // ====================================================
    function generateAltLives() {
        const p = state.profile;
        const scenarios = [
            { label: 'Version A', title: 'You became an entrepreneur.', career: 'Founder of a company you scaled to 8 figures. Long hours early, more freedom later. The path cost you some relationships, but it gave you total autonomy.' },
            { label: 'Version B', title: 'You moved abroad.', career: 'Living in a different country, fluent in a second language, with a global network. Your worldview is wider. Your roots are split. You visit home and feel like a visitor.' },
            { label: 'Version C', title: 'You focused on family.', career: 'You chose stability over hustle. Strong marriage, deep relationships with your kids, fewer financial fireworks but a kind of peace that most people never find.' },
            { label: 'Version D', title: 'You pursued academia.', career: 'PhD and a research role. Slower financial growth, but you are an expert in your field. The intellectual satisfaction is real, and the work compounds for decades.' },
            { label: 'Version E', title: 'You invested aggressively.', career: 'You took the risk-tolerance of your profile and put it into early-stage investments. Some failed. A few paid off massively. By 50, you have a different kind of freedom than your peers.' },
        ];

        state.altLives = scenarios.map(s => {
            const altAge = parseInt(p.age) + 20;
            const wealth = p.income * (3 + rand(0, 5));
            const happiness = rand(60, 92);
            return {
                ...s,
                wealth: fmt.usd(wealth),
                happiness: fmt.pct(happiness),
                health: rand(60, 95) + '/100',
                keyTradeoff: pickTradeoff(s.label),
            };
        });

        $('#ls-alt-lives').innerHTML = state.altLives.map(alt => `
            <div class="ls-alt-life">
                <span class="ls-alt-life-label">${alt.label}</span>
                <h3 class="ls-alt-life-title">${alt.title}</h3>
                <p class="ls-alt-life-story">${alt.career}</p>
                <div class="ls-alt-life-meta">
                    <div class="ls-alt-life-meta-item"><span>Wealth at 50</span>${alt.wealth}</div>
                    <div class="ls-alt-life-meta-item"><span>Happiness</span>${alt.happiness}</div>
                    <div class="ls-alt-life-meta-item"><span>Health</span>${alt.health}</div>
                    <div class="ls-alt-life-meta-item"><span>Trade-off</span>${alt.keyTradeoff}</div>
                </div>
            </div>`).join('');
    }

    function pickTradeoff(label) {
        const t = {
            'Version A': 'Time with people you love',
            'Version B': 'Proximity to your original community',
            'Version C': 'Peak earning years',
            'Version D': 'Earlier financial independence',
            'Version E': 'Stability in the early years',
        };
        return t[label] || 'Comfort';
    }

    $('#ls-go-phase-4')?.addEventListener('click', () => {
        generateTimeline();
        showScreen('ls-phase-4');
        showProgress(36);
    });

    // ====================================================
    // PHASE 4: TIMELINE
    // ====================================================
    function generateTimeline() {
        const p = state.profile;
        const age = parseInt(p.age);
        const years = [
            { year: 1, label: '1 year later', age: age + 1 },
            { year: 5, label: '5 years later', age: age + 5 },
            { year: 10, label: '10 years later', age: age + 10 },
            { year: 20, label: '20 years later', age: age + 20 },
            { year: 40, label: '40 years later', age: age + 40 },
        ];

        const startIncome = p.income;
        const startSavings = p.savings;
        const monthly = startIncome / 12;
        const growth = 1 + (0.05 + p.discipline * 0.005);
        const wealthMul = 1 + (p.risk * 0.05);

        state.timeline = years.map(y => {
            const inc = startIncome * Math.pow(growth, y.year);
            const sav = (startSavings + monthly * 12 * y.year * (1 + p.discipline * 0.05)) * Math.pow(wealthMul, y.year);
            const happiness = clamp(60 + p.emotional * 2 + p.extro * 1 - (y.year > 20 ? 4 : 0), 30, 95);
            const career = p.ambition > 6
                ? (y.year < 5 ? 'Climbing fast' : y.year < 10 ? 'Senior role or founding' : y.year < 20 ? 'Industry leader' : 'Mentor or investor')
                : (y.year < 5 ? 'Steady progress' : y.year < 10 ? 'Established' : 'Respected expert');
            const relationships = p.extro > 5
                ? (y.year < 5 ? 'Expanding network' : y.year < 20 ? 'Deep inner circle' : 'Tight trusted circle')
                : (y.year < 5 ? 'Building trust' : y.year < 20 ? 'Close few friends' : 'Lifelong friendships');
            const health = y.year > 20
                ? (p.exercise?.includes('5+') || p.exercise?.includes('3-4') ? 'Strong' : 'Declining slowly')
                : (p.exercise?.includes('5+') ? 'Excellent' : p.exercise?.includes('3-4') ? 'Good' : 'Needs attention');
            return {
                year: y.label, age: y.age, inc, sav, happiness, career, relationships, health,
                lifestyle: p.income > 100000 ? 'Comfortable' : p.income > 50000 ? 'Stable' : 'Tight',
            };
        });

        $('#ls-timeline').innerHTML = state.timeline.map(t => `
            <div class="ls-timeline-item">
                <div class="ls-timeline-year">${t.year} · Age ${t.age}</div>
                <div class="ls-timeline-title">Your life at this point</div>
                <div class="ls-timeline-grid">
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Income</div><div class="ls-timeline-stat-value">${fmt.usd(t.inc)}</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Net Worth</div><div class="ls-timeline-stat-value">${fmt.usd(t.sav)}</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Happiness</div><div class="ls-timeline-stat-value">${Math.round(t.happiness)}/100</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Career</div><div class="ls-timeline-stat-value">${t.career}</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Relationships</div><div class="ls-timeline-stat-value">${t.relationships}</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Health</div><div class="ls-timeline-stat-value">${t.health}</div></div>
                    <div class="ls-timeline-stat"><div class="ls-timeline-stat-label">Lifestyle</div><div class="ls-timeline-stat-value">${t.lifestyle}</div></div>
                </div>
            </div>`).join('');
    }

    $('#ls-go-phase-5')?.addEventListener('click', () => {
        renderDecisions();
        showScreen('ls-phase-5');
        showProgress(45);
    });

    // ====================================================
    // PHASE 5: DECISIONS
    // ====================================================
    const decisions = [
        'Start a business',
        'Move abroad',
        'Change careers',
        'Marry early',
        'Delay marriage',
        'Invest now',
        'Buy a house',
        'Return to university',
    ];

    function renderDecisions() {
        $('#ls-decisions').innerHTML = decisions.map(d =>
            `<button class="ls-decision-btn" data-decision="${d}">${d}</button>`).join('');

        $$('.ls-decision-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.ls-decision-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                showDecisionOutcome(btn.dataset.decision);
            });
        });
    }

    function showDecisionOutcome(decision) {
        const p = state.profile;
        const positive = clamp(50 + (p.ambition + p.discipline + p.risk) / 3 * 5 + (decision === 'Invest now' ? 10 : decision === 'Return to university' && p.age > 35 ? -15 : 0), 15, 92);
        const negative = 100 - positive;
        const outcome = simulateDecision(decision, p);

        $('#ls-decision-output').classList.add('show');
        $('#ls-decision-output').innerHTML = `
            <h3>${decision}</h3>
            <div class="ls-prob-bar">
                <div class="ls-prob-bar-positive" style="width:${positive}%">${Math.round(positive)}% positive</div>
                <div class="ls-prob-bar-negative" style="width:${negative}%">${Math.round(negative)}% challenging</div>
            </div>
            <p style="line-height:1.6;color:var(--ls-text-light);">${outcome}</p>
            <p style="margin-top:16px;font-size:0.85rem;color:var(--ls-text-dim);">Projection based on your profile. Outcomes are not guarantees.</p>`;
    }

    function simulateDecision(decision, p) {
        const outcomes = {
            'Start a business': p.discipline > 6
                ? `Given your discipline score of ${p.discipline}/10 and ambition of ${p.ambition}/10, you have a real chance of building something durable. The first 18 months will be the hardest. Most people quit between months 6 and 14. If you make it past year two, your probability of long-term success rises sharply. Your risk tolerance of ${p.risk}/10 gives you the runway to ride out the early volatility.`
                : `Your profile shows moderate discipline (${p.discipline}/10) and risk tolerance (${p.risk}/10). Starting a business is still possible, but the data suggests you would benefit from a co-founder or a lower-risk structure like a service business before scaling. Most successful founders in your profile range pair the venture with a stable income source for the first 1-2 years.`,
            'Move abroad': p.extro > 5
                ? `Your extroversion (${p.extro}/10) and emotional stability (${p.emotional}/10) suggest you would adapt well. The first 6 months will be lonely, then the network builds. By year two, you will have a fundamentally different perspective. Career-wise, this opens international opportunities but can slow domestic advancement.`
                : `Moving abroad with your introversion profile (${p.intro}/10) is workable but requires intention. Plan for 6-12 months of adjustment. Choose a city with a strong expat or international community. Your long-term outcome depends heavily on whether you build a local network.`,
            'Change careers': `Career changes at age ${p.age} are increasingly common. Your profile suggests a transition would take 12-18 months to land at equivalent level. The most successful switches happen when you take 1-2 adjacent skills forward rather than starting from zero. Map out which of your current skills transfer before you make the move.`,
            'Marry early': `Early marriage in your profile would likely succeed if you have a stable relationship now and a clear financial baseline. The data is mixed: couples who marry before 28 with combined income over $80k have a 67% 10-year success rate, dropping when either variable is missing.`,
            'Delay marriage': `Delaying marriage lets you build financial strength, but the social cost in your 30s is real. Your discipline and ambition scores suggest you would use the time well. The optimal window in your profile appears to be age 28-32, balancing emotional readiness with financial stability.`,
            'Invest now': `Your risk tolerance (${p.risk}/10) and discipline (${p.discipline}/10) make this a strong move. Starting with index funds at your current age means a 7% average return compounds for 30+ years. The cost of each year of delay is roughly 7% of your long-term wealth. This decision has the highest expected value of any in this list for your profile.`,
            'Buy a house': p.income > 60000
                ? `Your income supports this move. The decision depends on local market conditions and your time horizon. If you plan to stay 7+ years, buying historically beats renting in 70% of US metros. The emotional benefit of ownership often outweighs the financial calculation.`
                : `At your current income level, buying a house is risky. A mortgage that exceeds 30% of take-home will compound stress for years. Wait 12-24 months while building the down payment and income before considering this.`,
            'Return to university': p.age > 35
                ? `Returning to university at ${p.age} is increasingly common but the ROI calculation has changed. The break-even on tuition costs happens around year 5 post-graduation. The lifetime earnings boost averages 35% but only for programs that lead to high-demand fields.`
                : `At ${p.age}, returning to university is a strong move. You will finish before 30 with a 5-7 year ROI on tuition. The credential plus 2-3 internships typically leads to a starting salary 40-60% higher than your current trajectory.`,
        };
        return outcomes[decision] || `Based on your profile, this decision has moderate upside with manageable downside. The exact outcome depends on execution and conditions you cannot fully control.`;
    }

    $('#ls-go-phase-6')?.addEventListener('click', () => {
        showScreen('ls-phase-6');
        showProgress(54);
        if (state.chat.length === 0) {
            addChatMessage('future', 'I am you, 20 years from now. Ask me anything.');
        }
    });

    // ====================================================
    // PHASE 6: FUTURE SELF CHAT
    // ====================================================
    function addChatMessage(role, text) {
        const win = $('#ls-chat-window');
        const div = document.createElement('div');
        div.className = 'ls-chat-msg ' + role;
        div.textContent = text;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
        state.chat.push({ role, text });
    }

    function futureSelfReply(question) {
        const p = state.profile;
        const q = question.toLowerCase();

        // Keyword matching
        if (q.includes('focus') || q.includes('priorit')) {
            return `You will be glad you focused on ${p.discipline > 6 ? 'deep work and one major skill — that is what compounded' : 'your relationships and one creative project. Everything else was noise.'} Stop trying to optimize everything. Pick three things and give them your real attention.`;
        }
        if (q.includes('regret')) {
            return `Yes, you will regret the things you said yes to when you meant no. The biggest regrets are almost never the things you did not do — they are the things you did that pulled you away from what mattered. ${p.ambition > 6 ? 'You will regret the year you played it safe when you should have risked.' : 'You will regret the time you spent trying to prove yourself to people who were not paying attention.'}`;
        }
        if (q.includes('opportunity') || q.includes('take')) {
            return `Take it if it scares you and you can survive the downside. The opportunities you agonized over and rejected are the ones that show up in your regrets. The ones you took even when you were not sure — those are the ones that built the life you have now.`;
        }
        if (q.includes('risk')) {
            return `Your biggest risk is ${p.discipline < 5 ? 'drifting — losing years to comfortable routines that did not move you forward' : 'overcommitting — saying yes to too many things and executing on none of them at the level they deserved.'} The small risks you fear now look like nothing from where I am sitting.`;
        }
        if (q.includes('stop')) {
            return `Stop scrolling. Stop saying yes to meetings that do not need you. Stop apologizing for taking up space. ${p.socialmedia > 3 ? 'Stop spending your evenings in other people curated highlight reels.' : 'Stop optimizing things that do not matter to avoid the things that do.'} The biggest unlock for you is subtraction, not addition.`;
        }
        if (q.includes('love') || q.includes('relationship') || q.includes('partner')) {
            return `Choose someone who makes you want to be a better version of yourself — not someone you need to perform for. The relationship that changes everything is the one where you can be quiet together and that is enough.`;
        }
        if (q.includes('money') || q.includes('wealth') || q.includes('rich')) {
            return `Money bought me time and options. That is what it does. ${p.income < 50000 ? 'Start with the boring foundation — emergency fund, then invest consistently. The compounding does the work.' : 'You earn enough. The question is whether you keep or whether you upgrade your lifestyle every raise.'} The freedom money gives is worth far more than the things it can buy.`;
        }
        if (q.includes('career') || q.includes('job') || q.includes('work')) {
            return `The work that mattered most was the work I would have done even if no one was watching. ${p.ambition > 7 ? 'Your ambition is your biggest asset. Channel it. Do not scatter it across too many fronts.' : 'Pick a lane and go deep. Generalists lose to specialists in almost every field, and you can specialize.'}`;
        }
        if (q.includes('happy') || q.includes('happiness')) {
            return `Happiness was not a destination. It was the quality of attention I paid to ordinary moments. ${p.emotional > 6 ? 'You already have the temperament for this — trust it.' : 'You will have to work for this more than some people, but it is learnable.'}`;
        }
        // Fallback
        return `I am thinking about your question. From where I sit, the answer is simpler than you think. ${p.discipline > 6 ? 'You are overthinking it. Just start.' : 'You already know the answer. You are just looking for permission.'} Trust yourself.`;
    }

    $('#ls-chat-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $('#ls-chat-input');
        const q = input.value.trim();
        if (!q) return;
        addChatMessage('user', q);
        input.value = '';
        setTimeout(() => addChatMessage('future', futureSelfReply(q)), 600);
    });

    $$('.ls-chat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.q;
            addChatMessage('user', q);
            setTimeout(() => addChatMessage('future', futureSelfReply(q)), 600);
        });
    });

    $('#ls-go-phase-7')?.addEventListener('click', () => {
        generateLifeBook();
        showScreen('ls-phase-7');
        showProgress(63);
    });

    // ====================================================
    // PHASE 7: LIFE BOOK
    // ====================================================
    function generateLifeBook() {
        const p = state.profile;
        const c = state.clone;

        const book = `
<h3>Chapter 1: Childhood</h3>
<p>You grew up shaped by the values that still define you. The earliest version of who you are was forged in the patterns, conversations, and small choices of those early years. The memory you carry most — "${p.memory || '—'}" — is more than a moment. It is the seed of a story that has been growing ever since.</p>
<p>The people around you taught you what to value, what to fear, and what to dream about. The most influential person in your life shaped your model of what is possible. Looking back from where I am now, I can see that the person you are becoming was already visible in the child you were.</p>

<h3>Chapter 2: Youth</h3>
<p>Your youth was a period of testing limits and discovering what you were made of. The mistakes you made were not failures — they were the tuition for the lessons that would carry you forward. Your biggest regret from this period — "${p.regret || '—'}" — taught you more than your successes did.</p>
<p>This is also when the seeds of your ambition began to take root. The dream you carried — "${p.dream || '—'}" — was not a fantasy. It was a signal pointing toward the work that would matter to you. The discipline you built during this time became the foundation of everything that came after.</p>

<h3>Chapter 3: Adulthood</h3>
<p>Adulthood is where the choices compound. The small daily decisions — what you read, who you spent time with, how you treated your body — accumulated into the person you are now. The greatest achievement of this period — "${p.achievement || '—'}" — was not a single moment. It was the visible result of thousands of invisible decisions.</p>
<p>This chapter also brought the relationships that matter most. The person who became your closest ally taught you more about yourself than any book or course. The losses during this period — the friendships that faded, the family members you drifted from — were not failures. They were redirections toward what truly mattered.</p>

<h3>Chapter 4: Peak Years</h3>
<p>The peak years are not about achievement. They are about clarity. By this point, you have stopped performing and started living. The values you ranked highest — ${topValues(p)} — are no longer things you think about. They are the operating system that runs your days.</p>
<p>This is when your greatest contribution becomes visible. It might be to your family, your field, your community, or something else entirely. The contribution feels small in the moment but compounds across decades. The version of you that exists now was built by the version of you that existed 20 years ago. Honor that lineage.</p>

<h3>Chapter 5: Legacy</h3>
<p>Legacy is not what you accumulate. It is what you leave in other people. The kindnesses, the lessons, the examples you set — these are what continue after you. The people you influenced do not remember your titles or your net worth. They remember how you made them feel and what you helped them become.</p>
<p>The life you lived was not perfect. It was real. The regrets were real. The growth was real. The love was real. That is enough. That is more than enough. The story of your life is the story of a person who tried, who failed, who learned, and who kept going. That is the legacy.</p>

<h3>Strengths</h3>
<p>${c.strengths.map(s => '• ' + s).join('<br>')}</p>

<h3>Lessons From Your Mistakes</h3>
<p>• You learned more from your worst decisions than from your best ones.<br>
• The projects you quit taught you what you actually value.<br>
• The relationships you lost clarified what you need from the ones you kept.<br>
• The years you felt stuck were the years you were building the foundation for what came next.</p>

<h3>Opportunities You Created</h3>
<p>• You said yes to the project that scared you — that became the turning point.<br>
• You invested in yourself when it would have been easier not to.<br>
• You showed up for people when it would have been easier to disappear.<br>
• You kept going when the data said stop.</p>

<h3>What the Book Says About You</h3>
<p>This is not a book about a perfect person. It is a book about a real one. The story of your life is still being written. The chapters that follow will be the most important ones. The discipline you have, the values you hold, and the relationships you tend to — these are the materials. What you do with them is the story.</p>`;

        state.book = book;
        $('#ls-life-book').innerHTML = book;
    }

    function topValues(p) {
        const vmap = { v_family: 'family', v_freedom: 'freedom', v_wealth: 'wealth',
            v_career: 'career', v_love: 'love', v_purpose: 'purpose',
            v_adventure: 'adventure', v_security: 'security' };
        const entries = Object.entries(p).filter(([k]) => vmap[k]).map(([k, v]) => [vmap[k], v]);
        entries.sort((a, b) => parseInt(a[1]) - parseInt(b[1]));
        return entries.slice(0, 3).map(e => e[0]).join(', ');
    }

    $('#ls-print-book')?.addEventListener('click', () => window.print());

    $('#ls-go-phase-8')?.addEventListener('click', () => {
        generateLegacy();
        showScreen('ls-phase-8');
        showProgress(72);
    });

    // ====================================================
    // PHASE 8: LEGACY
    // ====================================================
    function generateLegacy() {
        const p = state.profile;
        const family = clamp(40 + p.emotional * 4 + (p.relationship !== 'Single' ? 20 : 5), 10, 98);
        const community = clamp(30 + p.extro * 3 + p.ambition * 2, 10, 98);
        const financial = clamp(35 + p.income / 5000 + p.savings / 1000, 10, 98);
        const knowledge = clamp(40 + p.reading * 0.8 + p.curiosity * 3 + p.education === 'PhD / Doctorate' ? 15 : 5, 10, 98);

        const total = Math.round((family + community + financial + knowledge) / 4);
        state.legacy = { family, community, financial, knowledge, total };

        $('#ls-legacy').innerHTML = `
            <div class="ls-legacy-card">
                <div class="ls-legacy-icon">👨‍👩‍👧‍👦</div>
                <div class="ls-legacy-label">Family Impact</div>
                <div class="ls-legacy-score">${Math.round(family)}</div>
                <div class="ls-legacy-bar"><div class="ls-legacy-bar-fill" style="width:${family}%"></div></div>
            </div>
            <div class="ls-legacy-card">
                <div class="ls-legacy-icon">🌍</div>
                <div class="ls-legacy-label">Community Impact</div>
                <div class="ls-legacy-score">${Math.round(community)}</div>
                <div class="ls-legacy-bar"><div class="ls-legacy-bar-fill" style="width:${community}%"></div></div>
            </div>
            <div class="ls-legacy-card">
                <div class="ls-legacy-icon">💰</div>
                <div class="ls-legacy-label">Financial Impact</div>
                <div class="ls-legacy-score">${Math.round(financial)}</div>
                <div class="ls-legacy-bar"><div class="ls-legacy-bar-fill" style="width:${financial}%"></div></div>
            </div>
            <div class="ls-legacy-card">
                <div class="ls-legacy-icon">📚</div>
                <div class="ls-legacy-label">Knowledge Impact</div>
                <div class="ls-legacy-score">${Math.round(knowledge)}</div>
                <div class="ls-legacy-bar"><div class="ls-legacy-bar-fill" style="width:${knowledge}%"></div></div>
            </div>
            <div class="ls-legacy-total">
                <div class="ls-legacy-total-label">Your Overall Legacy Score</div>
                <div class="ls-legacy-total-score">${total}/100</div>
            </div>`;
    }

    $('#ls-go-phase-9')?.addEventListener('click', () => {
        generateUniverses();
        showScreen('ls-phase-9');
        showProgress(81);
    });

    // ====================================================
    // PHASE 9: PARALLEL UNIVERSES
    // ====================================================
    function generateUniverses() {
        const p = state.profile;
        const baseAge = parseInt(p.age);

        const universes = [
            { title: 'You were born in Japan.', bio: 'You grew up in Tokyo, studied at a top university, and joined a major company at 22. By 35 you pivoted into a more independent path. Your salary in yen is high, but your work culture shaped you differently — more group-oriented, less individualist. The cost of living pressures you to optimize aggressively.', meta: 'Different culture, similar ambition, different time horizon.' },
            { title: 'You were born in 1950.', bio: 'You came of age in the 1960s, served in the draft, protested the war, and built a career in the post-industrial economy. You retired at 62, lived through three recessions and one pandemic, and watched the world change in ways you never imagined. Your relationship with technology is fundamentally different.', meta: 'Different century, different challenges, different perspective.' },
            { title: 'You were born wealthy.', bio: 'You attended the best schools, never had student debt, and your first apartment was a gift. Your career is driven by passion rather than necessity. The downside: you have a harder time understanding the lived experience of most people, and the absence of financial pressure has made it harder to develop the grit that builds character.', meta: 'Different starting line, different relationship with risk.' },
            { title: 'You were born poor.', bio: 'Your childhood had more uncertainty than comfort. You worked from age 14. Your education was paid for through scholarships and loans. By 30, you were outperforming peers who had every advantage. The grit you developed is real, but so is the residue of years spent in survival mode.', meta: 'Different resources, different resilience, different definition of success.' },
            { title: 'You became a doctor.', bio: 'You spent a decade in training, accumulated significant debt, and now work 60-hour weeks. Your income is high but your time is scarce. The patients you help are the most meaningful part of your days. You wonder sometimes what would have happened if you had chosen a different path.', meta: 'Different profession, different life structure.' },
            { title: 'You became an artist.', bio: 'You pursued the creative path that called to you. Income is unpredictable, but so is your schedule. You have made art that has touched people you have never met. The financial stress is real, but the alternative — selling your hours for someone else\'s dream — was never going to be sustainable for you.', meta: 'Different values, different reward structure.' },
        ];

        state.universes = universes;
        $('#ls-universes').innerHTML = universes.map(u => `
            <div class="ls-universe-card">
                <div class="ls-universe-title">${u.title}</div>
                <div class="ls-universe-bio">${u.bio}</div>
                <div class="ls-universe-meta">${u.meta}</div>
            </div>`).join('');
    }

    $('#ls-go-phase-10')?.addEventListener('click', () => {
        showScreen('ls-phase-10');
        showProgress(90);
    });

    // ====================================================
    // PHASE 10: FRIEND COMPARISON
    // ====================================================
    $('#ls-friend-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const friend = {};
        for (const [k, v] of fd.entries()) friend[k] = v;
        compareProfiles(friend);
    });

    function compareProfiles(friend) {
        const p = state.profile;

        // Compatibility score: how similar the profiles are
        const diffs = [
            Math.abs(p.ambition - parseInt(friend.famb)),
            Math.abs(p.discipline - parseInt(friend.fdisc)),
            Math.abs(p.extro - parseInt(friend.fextro)),
            Math.abs(p.risk - parseInt(friend.frisk)),
        ];
        const avgDiff = diffs.reduce((a, b) => a + b, 0) / 4;
        const similarity = Math.round(100 - avgDiff * 10);

        const sharedStrengths = [];
        const sharedWeaknesses = [];

        if (p.ambition > 6 && parseInt(friend.famb) > 6) sharedStrengths.push('Both highly ambitious');
        if (p.discipline > 6 && parseInt(friend.fdisc) > 6) sharedStrengths.push('Both highly disciplined');
        if (p.extro > 6 && parseInt(friend.fextro) > 6) sharedStrengths.push('Both socially confident');
        if (p.risk > 6 && parseInt(friend.frisk) > 6) sharedStrengths.push('Both willing to take calculated risks');

        if (p.discipline < 5 && parseInt(friend.fdisc) < 5) sharedWeaknesses.push('Both could improve consistency');
        if (p.risk < 5 && parseInt(friend.frisk) < 5) sharedWeaknesses.push('Both tend to avoid risk');
        if (p.ambition < 5 && parseInt(friend.famb) < 5) sharedWeaknesses.push('Both could push harder');

        state.comparison = { friend, similarity, sharedStrengths, sharedWeaknesses };
        $('#ls-comparison').innerHTML = `
            <div class="ls-comparison-header">
                <div style="color:var(--ls-text-light);margin-bottom:8px;">Compatibility Score</div>
                <div class="ls-compatibility-score">${similarity}%</div>
                <div style="color:var(--ls-text-dim);font-size:0.9rem;">${similarity > 75 ? 'You are highly aligned. Watch for groupthink.' : similarity > 50 ? 'You complement each other. Good balance.' : 'You challenge each other. Growth-oriented relationship.'}</div>
            </div>
            <div class="ls-comparison-grid">
                <div class="ls-comparison-side">
                    <h4>You — ${p.name}</h4>
                    <ul class="ls-comparison-list">
                        <li>Age: ${p.age}</li>
                        <li>Ambition: ${p.ambition}/10</li>
                        <li>Discipline: ${p.discipline}/10</li>
                        <li>Extroversion: ${p.extro}/10</li>
                        <li>Risk Tolerance: ${p.risk}/10</li>
                    </ul>
                </div>
                <div class="ls-comparison-side">
                    <h4>${friend.fname}</h4>
                    <ul class="ls-comparison-list">
                        <li>Age: ${friend.fage}</li>
                        <li>Ambition: ${friend.famb}/10</li>
                        <li>Discipline: ${friend.fdisc}/10</li>
                        <li>Extroversion: ${friend.fextro}/10</li>
                        <li>Risk Tolerance: ${friend.frisk}/10</li>
                    </ul>
                </div>
            </div>
            ${sharedStrengths.length ? `<div style="background:var(--ls-bg-card);border:1px solid var(--ls-border);border-radius:16px;padding:24px;margin-top:16px;"><h4 style="margin-bottom:12px;">🤝 Shared Strengths</h4><ul>${sharedStrengths.map(s => '<li>• ' + s + '</li>').join('')}</ul></div>` : ''}
            ${sharedWeaknesses.length ? `<div style="background:var(--ls-bg-card);border:1px solid var(--ls-border);border-radius:16px;padding:24px;margin-top:16px;"><h4 style="margin-bottom:12px;">⚠️ Shared Growth Areas</h4><ul>${sharedWeaknesses.map(w => '<li>• ' + w + '</li>').join('')}</ul></div>` : ''}`;
    }

    $('#ls-go-phase-11')?.addEventListener('click', () => {
        generateCards();
        showScreen('ls-phase-11');
        showProgress(100);
    });

    // ====================================================
    // PHASE 11: VIRAL CARDS
    // ====================================================
    function generateCards() {
        const p = state.profile;
        const c = state.clone;
        const scores = c.scores;

        const cards = [
            { eyebrow: 'My Digital Clone Says', text: `My clone gives me a ${Math.round(scores.wealth)}% chance of becoming financially independent.` },
            { eyebrow: 'My Future Self Says', text: `My biggest mistake is wasting time on things that do not compound.` },
            { eyebrow: 'I Am More Disciplined Than', text: `${Math.min(99, Math.round(scores.discipline))}% of users who took this simulation.` },
            { eyebrow: 'My Hidden Strength', text: c.strengths[0] },
            { eyebrow: 'My Archetype', text: `I am "${c.archetype}" — and the data backs it up.` },
            { eyebrow: 'My Legacy Score', text: `${state.legacy ? state.legacy.total : '—'}/100. The work I do today will outlast me.` },
        ];

        state.cards = cards;
        $('#ls-cards').innerHTML = cards.map((card, i) => `
            <div class="ls-viral-card" data-card="${i}">
                <div class="ls-viral-card-content">
                    <div class="ls-viral-card-eyebrow">${card.eyebrow}</div>
                    <div class="ls-viral-card-text">"${card.text}"</div>
                </div>
                <div class="ls-viral-card-footer">
                    <span>ZAQORI · Life Simulator</span>
                    <span>#${i + 1}</span>
                </div>
            </div>`).join('') + `
            <div class="ls-card-actions" style="grid-column:1/-1;justify-content:center;">
                <button class="ls-card-action-btn" id="ls-share-twitter">Share on X / Twitter</button>
                <button class="ls-card-action-btn" id="ls-share-facebook">Share on Facebook</button>
                <button class="ls-card-action-btn" id="ls-share-linkedin">Share on LinkedIn</button>
                <button class="ls-card-action-btn" id="ls-download-card">Download as Image</button>
            </div>`;

        $('#ls-share-twitter')?.addEventListener('click', () => shareTo('twitter'));
        $('#ls-share-facebook')?.addEventListener('click', () => shareTo('facebook'));
        $('#ls-share-linkedin')?.addEventListener('click', () => shareTo('linkedin'));
        $('#ls-download-card')?.addEventListener('click', downloadCardsAsImage);
    }

    function shareTo(platform) {
        const text = `I just discovered my digital clone and alternate lives on the ZAQORI Life Simulator. ${state.profile.name}'s future self has a lot to say. Try it: https://zaqori.com/life-simulator/`;
        const urls = {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://zaqori.com/life-simulator/')}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://zaqori.com/life-simulator/')}`,
        };
        window.open(urls[platform], '_blank', 'width=600,height=500');
    }

    function downloadCardsAsImage() {
        alert('Card download uses your browser\'s screenshot tool. Press Ctrl+Shift+S (Windows) or Cmd+Shift+4 (Mac) on any card to save it.');
    }

    $('#ls-restart')?.addEventListener('click', () => {
        if (confirm('Start a new simulation? Your current data will be cleared.')) {
            state.profile = null;
            state.scores = null;
            state.clone = null;
            state.altLives = null;
            state.timeline = null;
            state.decisions = null;
            state.chat = [];
            state.book = null;
            state.legacy = null;
            state.universes = null;
            state.comparison = null;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            showScreen('ls-intro');
        }
    });

    // ====================================================
    // BACK BUTTONS
    // ====================================================
    const screenOrder = ['ls-intro', 'ls-phase-1', 'ls-phase-2', 'ls-phase-3', 'ls-phase-4', 'ls-phase-5', 'ls-phase-6', 'ls-phase-7', 'ls-phase-8', 'ls-phase-9', 'ls-phase-10', 'ls-phase-11'];
    $$('[data-ls-back]').forEach(btn => {
        btn.addEventListener('click', () => {
            const active = $('.ls-screen.active');
            if (!active) return;
            const idx = screenOrder.indexOf(active.id);
            if (idx > 0) showScreen(screenOrder[idx - 1]);
        });
    });

    // ====================================================
    // LOCALSTORAGE PERSISTENCE
    // ====================================================
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* quota / disabled */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const loaded = JSON.parse(raw);
                Object.assign(state, loaded);
                return true;
            }
        } catch (e) { /* corrupt */ }
        return false;
    }

    // Auto-resume if user has data
    if (loadState() && state.profile) {
        // Could auto-restore, but for first-time UX we just show intro
    }

            // Close the init() try block and function
        } catch (e) {
            console.error('[LifeSim] init error:', e);
        }
    }

    // Kick off initialization once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
