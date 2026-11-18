/**
 * Bio-Age & Longevity Dashboard Visualizer
 * Renders SVG gauges, Canvas Spider/Radar charts, Organ Cards, and Longevity Prescriptions.
 */

export class LongevityDashboard {
  constructor() {
    this.radarCanvas = null;
    this.radarCtx = null;
  }

  init(containerId) {
    this.container = document.getElementById(containerId);
  }

  /**
   * Draws the animated 5-Axis Spider / Radar Longevity Chart
   */
  drawRadarChart(canvasId, scores) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Handle high DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 280;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2 + 5;
    const maxRadius = Math.min(centerX, centerY) - 40;

    const categories = [
      { key: 'cardiovascular', label: 'Cardio Vitals' },
      { key: 'nutrition', label: 'Food Habits' },
      { key: 'sleep', label: 'Sleep Health' },
      { key: 'physicalFitness', label: 'Fitness & NEAT' },
      { key: 'mentalResilience', label: 'Stress & Ikigai' }
    ];

    const numAxes = categories.length;
    const angleStep = (Math.PI * 2) / numAxes;

    const isDark = document.body.classList.contains('theme-dark');

    // Draw background concentric polygons (25%, 50%, 75%, 100%)
    const levels = [0.25, 0.5, 0.75, 1.0];
    levels.forEach((level, idx) => {
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * (maxRadius * level);
        const y = centerY + Math.sin(angle) * (maxRadius * level);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = isDark
        ? (idx === levels.length - 1 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)')
        : (idx === levels.length - 1 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.06)');
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label concentric circles (score 50, 75, 100)
      if (idx > 0) {
        ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${level * 100}%`, centerX + 4, centerY - (maxRadius * level) + 10);
      }
    });

    // Draw axis spokes and labels
    categories.forEach((cat, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;

      // Spoke line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
      ctx.stroke();

      // Category text
      const labelX = centerX + Math.cos(angle) * (maxRadius + 22);
      const labelY = centerY + Math.sin(angle) * (maxRadius + 20);

      ctx.fillStyle = isDark ? '#f8fafc' : '#334155';
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const scoreVal = scores[cat.key] || 70;
      ctx.fillText(cat.label, labelX, labelY - 7);

      ctx.fillStyle = scoreVal >= 75 ? '#10b981' : scoreVal >= 55 ? '#06b6d4' : '#f59e0b';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`${scoreVal}/100`, labelX, labelY + 8);
    });

    // Draw user score filled polygon
    ctx.beginPath();
    categories.forEach((cat, i) => {
      const score = Math.max(10, Math.min(100, scores[cat.key] || 60));
      const radius = (score / 100) * maxRadius;
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, maxRadius);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.12)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Draw data points on vertices
    categories.forEach((cat, i) => {
      const score = Math.max(10, Math.min(100, scores[cat.key] || 60));
      const radius = (score / 100) * maxRadius;
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10b981';
      ctx.stroke();
    });
  }

  /**
   * Renders the SVG Bio-Age Speedometer Gauge
   */
  renderGauge(evaluation) {
    const diff = evaluation.ageDifference;
    const isYounger = diff <= 0;
    const absDiff = Math.abs(diff);

    const diffBadgeClass = isYounger ? 'badge-success' : 'badge-warning';
    const diffText = isYounger
      ? `${absDiff} Years Younger than Calendar Age`
      : `${absDiff} Years Older than Calendar Age`;

    // Calculate arc percentage (from 18 to 80 years scale)
    const minAge = 18;
    const maxAge = 85;
    const normalizedBio = Math.min(maxAge, Math.max(minAge, evaluation.biologicalAge));
    const percent = (normalizedBio - minAge) / (maxAge - minAge);

    // SVG semi-circle gauge calculations
    // Circumference of semi-circle radius 110 = PI * 110 ≈ 345.57
    const radius = 110;
    const semiCircumference = Math.PI * radius;
    const strokeDashoffset = semiCircumference * (1 - percent);

    const strokeColor = isYounger ? '#10b981' : diff < 3 ? '#06b6d4' : diff < 7 ? '#f59e0b' : '#ef4444';

    return `
      <div class="bio-gauge-container">
        <div class="gauge-svg-wrap">
          <svg viewBox="0 0 260 150" class="gauge-svg">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="50%" stop-color="#06b6d4" />
                <stop offset="85%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#ef4444" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Background Track Arc -->
            <path d="M 20 135 A 110 110 0 0 1 240 135" 
                  fill="none" 
                  stroke="rgba(0, 0, 0, 0.08)" 
                  stroke-width="16" 
                  stroke-linecap="round" />

            <!-- Active Value Arc -->
            <path d="M 20 135 A 110 110 0 0 1 240 135" 
                  fill="none" 
                  stroke="url(#gaugeGrad)" 
                  stroke-width="16" 
                  stroke-linecap="round"
                  stroke-dasharray="${semiCircumference}"
                  stroke-dashoffset="${strokeDashoffset}"
                  filter="url(#glow)"
                  class="gauge-animated-path" />
          </svg>

          <!-- Gauge Center Display -->
          <div class="gauge-center-content">
            <span class="gauge-sublabel">ESTIMATED BIOLOGICAL AGE</span>
            <div class="gauge-main-number">
              <span class="bio-number">${evaluation.biologicalAge}</span>
              <span class="bio-unit">yrs</span>
            </div>
            <div class="gauge-chrono-compare">
              vs. ${evaluation.chronologicalAge} calendar years
            </div>
          </div>
        </div>

        <div class="gauge-badge-row">
          <div class="bio-diff-pill ${diffBadgeClass}">
            <i data-lucide="${isYounger ? 'arrow-down-circle' : 'alert-triangle'}"></i>
            <span>${diffText}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the Hero Life Expectancy & Years Alive projection card
   */
  renderLongevityHero(evaluation) {
    const isAbove = evaluation.lifeYearsDelta >= 0;
    const deltaText = isAbove
      ? `+${evaluation.lifeYearsDelta} Years Above Average`
      : `${evaluation.lifeYearsDelta} Years Below Average`;

    return `
      <div class="longevity-hero-card">
        <div class="hero-left">
          <div class="hero-tag">
            <i data-lucide="sparkles"></i>
            <span>PROJECTED LIFESPAN & HEALTHSPAN</span>
          </div>
          <h2 class="hero-title">
            You are projected to live to 
            <span class="highlight-age">${evaluation.projectedLifeExpectancy}</span> Years Old
          </h2>
          <p class="hero-subtitle">
            Based on your combined nutrition score, sleep architecture, cardiorespiratory activity, 
            and vascular markers, you have approximately <strong>${evaluation.remainingYears} vibrant years ahead</strong>.
          </p>
          <div class="hero-stat-row">
            <div class="hero-mini-stat">
              <span class="stat-caption">PROJECTED AGE</span>
              <span class="stat-val emerald">${evaluation.projectedLifeExpectancy} yrs</span>
            </div>
            <div class="hero-mini-stat">
              <span class="stat-caption">YEARS REMAINING</span>
              <span class="stat-val cyan">${evaluation.remainingYears} yrs</span>
            </div>
            <div class="hero-mini-stat">
              <span class="stat-caption">LIFESPAN IMPACT</span>
              <span class="stat-val ${isAbove ? 'emerald' : 'amber'}">${deltaText}</span>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <div class="pace-meter-card">
            <div class="pace-header">
              <i data-lucide="timer"></i>
              <span>PACE OF AGING</span>
            </div>
            <div class="pace-number-row">
              <span class="pace-big" style="color: ${evaluation.paceColor}">${evaluation.paceOfAging}x</span>
              <span class="pace-label">bio-yrs / calendar-yr</span>
            </div>
            <p class="pace-desc">${evaluation.paceCategory}</p>
            <div class="pace-bar-track">
              <div class="pace-bar-fill" style="width: ${Math.min(100, (evaluation.paceOfAging / 1.5) * 100)}%; background-color: ${evaluation.paceColor};"></div>
            </div>
            <div class="pace-ticks">
              <span>0.7x (Slow)</span>
              <span>1.0x (Standard)</span>
              <span>1.4x (Fast)</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the 4 Organ / Biological Subsystem Cards
   */
  renderOrganCards(organAges, chronoAge) {
    const organs = [
      {
        id: 'cardio',
        title: 'Cardiovascular Age',
        icon: 'heart',
        age: organAges.cardiovascular,
        desc: 'Endothelial elasticity, RHR, BP & VO2 endurance'
      },
      {
        id: 'metabolic',
        title: 'Metabolic Age',
        icon: 'flame',
        age: organAges.metabolic,
        desc: 'Insulin sensitivity, lean muscle mass & glycemic control'
      },
      {
        id: 'cellular',
        title: 'Immune & Cellular Age',
        icon: 'shield-check',
        age: organAges.cellular,
        desc: 'Sleep autophagy, systemic hs-CRP inflammation & oxidative stress'
      },
      {
        id: 'cognitive',
        title: 'Cognitive & Brain Age',
        icon: 'brain',
        age: organAges.cognitive,
        desc: 'Glymphatic sleep wash, stress resilience & neurogenesis'
      }
    ];

    return `
      <div class="organ-grid">
        ${organs.map(organ => {
          const delta = +(organ.age - chronoAge).toFixed(1);
          const isYounger = delta <= 0;
          const badgeClass = isYounger ? 'organ-badge-younger' : 'organ-badge-older';
          const badgeText = isYounger ? `${Math.abs(delta)}y younger` : `+${delta}y older`;

          return `
            <div class="organ-card">
              <div class="organ-top">
                <div class="organ-icon-wrap">
                  <i data-lucide="${organ.icon}"></i>
                </div>
                <div class="organ-badge ${badgeClass}">${badgeText}</div>
              </div>
              <h4 class="organ-name">${organ.title}</h4>
              <div class="organ-age-val">
                <span class="organ-num">${organ.age}</span>
                <span class="organ-yrs">years</span>
              </div>
              <p class="organ-desc">${organ.desc}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renders prioritized clinical longevity recommendations with impact badges
   */
  renderPrescriptions(improvements) {
    if (!improvements || improvements.length === 0) {
      return `
        <div class="empty-state">
          <i data-lucide="check-circle" class="empty-icon"></i>
          <h4>Your Longevity Habits are Elite!</h4>
          <p>All core biological longevity markers are in top-decile ranges. Continue your current routine.</p>
        </div>
      `;
    }

    return `
      <div class="prescriptions-list">
        ${improvements.map((item, index) => `
          <div class="prescription-item priority-${item.priority.toLowerCase()}">
            <div class="rx-badge-col">
              <span class="rx-priority-tag">${item.priority}</span>
              <div class="rx-impact-chips">
                <span class="chip-gain"><i data-lucide="trending-up"></i> +${item.lifeGain} yrs life</span>
                <span class="chip-bio"><i data-lucide="arrow-down"></i> ${item.bioAgeGain}y bio-age</span>
              </div>
            </div>

            <div class="rx-body">
              <div class="rx-title-row">
                <div class="rx-category">
                  <i data-lucide="${item.icon}"></i>
                  <span>${item.category}</span>
                </div>
                <span class="rx-difficulty">Difficulty: ${item.difficulty}</span>
              </div>
              <h3 class="rx-title">${item.title}</h3>
              <p class="rx-desc">${item.description}</p>
              <div class="rx-mechanism">
                <strong>Biological Mechanism:</strong> ${item.mechanism}
              </div>
            </div>

            <div class="rx-action-col">
              <label class="habit-check-wrap" title="Commit to this habit in your daily routine">
                <input type="checkbox" class="habit-checkbox" data-id="${item.id}" />
                <span class="checkmark"></span>
                <span class="check-label">Add to Daily Habit Protocol</span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

export const dashboardView = new LongevityDashboard();
