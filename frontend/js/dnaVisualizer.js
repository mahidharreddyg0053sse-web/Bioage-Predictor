/**
 * BioAge Pro — Live 3D DNA Double Helix Interactive Visualizer
 * High-definition, high-FPS canvas rendering featuring delicate 3D rotating DNA strands,
 * dual continuous sugar-phosphate backbones, glowing nucleotide base-pairs,
 * and ambient cellular bioluminescence with automatic mobile scale optimization.
 */

export class DnaVisualizer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.isRunning = false;
    this.time = 0;
    this.particles = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.dpr = 1;

    this.handleResize = this.resize.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
  }

  start(canvasId = 'global-dna-canvas') {
    if (this.isRunning && this.canvas && this.canvas.id === canvasId) return;

    this.canvas = document.getElementById(canvasId) || document.getElementById('global-dna-canvas') || document.getElementById('auth-dna-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.resize();
    this.initParticles();

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('mousemove', this.handleMouseMove);

    this.isRunning = true;
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  onMouseMove(e) {
    this.targetMouseX = (e.clientX / (this.width || window.innerWidth) - 0.5) * 35;
    this.targetMouseY = (e.clientY / (this.height || window.innerHeight) - 0.5) * 20;
  }

  initParticles() {
    this.particles = [];
    const count = Math.min(45, Math.floor((this.width || 1000) / 30));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 1200),
        y: Math.random() * (this.height || 800),
        radius: Math.random() * 1.8 + 0.8,
        speedY: Math.random() * 0.35 + 0.1,
        speedX: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.4 + 0.15,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.45 ? '#10b981' : '#06b6d4'
      });
    }
  }

  drawHelix(centerX, radius, speedMultiplier, offsetPhase, opacityMultiplier = 1.0) {
    const ctx = this.ctx;
    const height = this.height;
    // Step is denser for smoother, higher-quality curves
    const step = 15;
    const totalSteps = Math.ceil(height / step) + 4;
    const t = this.time * 0.018 * speedMultiplier + offsetPhase;

    const strandAPoints = [];
    const strandBPoints = [];

    // 1. Calculate 3D points along the double helix
    for (let i = -2; i < totalSteps; i++) {
      const y = i * step;
      const angle = (y * 0.015) + t;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x1 = centerX + cos * radius;
      const z1 = sin * radius;

      const x2 = centerX - cos * radius;
      const z2 = -sin * radius;

      const scale1 = (z1 + 80) / 140;
      const scale2 = (z2 + 80) / 140;

      const alpha1 = Math.max(0.12, Math.min(0.95, (z1 + 45) / 90)) * opacityMultiplier;
      const alpha2 = Math.max(0.12, Math.min(0.95, (z2 + 45) / 90)) * opacityMultiplier;

      strandAPoints.push({ x: x1, y, z: z1, scale: scale1, alpha: alpha1 });
      strandBPoints.push({ x: x2, y, z: z2, scale: scale2, alpha: alpha2 });
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 2. Draw Back Backbone Segments (z < 0) for depth
    this.drawBackboneSegments(strandAPoints, '#10b981', false, opacityMultiplier);
    this.drawBackboneSegments(strandBPoints, '#06b6d4', false, opacityMultiplier);

    // 3. Draw Connecting Base-Pair Hydrogen Bonds
    for (let i = 0; i < strandAPoints.length; i++) {
      const p1 = strandAPoints[i];
      const p2 = strandBPoints[i];

      const avgScale = (p1.scale + p2.scale) / 2;
      const avgAlpha = ((p1.alpha + p2.alpha) / 2) * 0.45;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Strand A to Midpoint (Emerald)
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(midX, midY);
      ctx.strokeStyle = `rgba(16, 185, 129, ${avgAlpha})`;
      ctx.lineWidth = Math.max(0.6, 1.2 * avgScale);
      ctx.stroke();

      // Strand B to Midpoint (Cyan)
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(6, 182, 212, ${avgAlpha})`;
      ctx.lineWidth = Math.max(0.6, 1.2 * avgScale);
      ctx.stroke();
    }

    // 4. Draw Front Backbone Segments (z >= 0)
    this.drawBackboneSegments(strandAPoints, '#10b981', true, opacityMultiplier);
    this.drawBackboneSegments(strandBPoints, '#06b6d4', true, opacityMultiplier);

    // 5. Draw Nucleotide Spheres with 3D Bioluminescent Glow
    for (let i = 0; i < strandAPoints.length; i++) {
      const p1 = strandAPoints[i];
      const p2 = strandBPoints[i];

      // Draw Node A (Emerald Green - Guanine/Cytosine)
      this.drawGlowingNode(p1.x, p1.y, Math.max(1.4, 2.6 * p1.scale), p1.alpha, '#10b981', '#a7f3d0');

      // Draw Node B (Cyan Blue - Adenine/Thymine)
      this.drawGlowingNode(p2.x, p2.y, Math.max(1.4, 2.6 * p2.scale), p2.alpha, '#06b6d4', '#bae6fd');
    }

    ctx.restore();
  }

  drawBackboneSegments(points, colorHex, isFront, opacityMultiplier) {
    const ctx = this.ctx;
    ctx.beginPath();
    let drawing = false;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const condition = isFront ? p.z >= -5 : p.z < -5;

      if (condition) {
        if (!drawing) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          drawing = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      } else {
        if (drawing) {
          ctx.strokeStyle = isFront
            ? (colorHex === '#10b981' ? `rgba(16, 185, 129, ${0.45 * opacityMultiplier})` : `rgba(6, 182, 212, ${0.45 * opacityMultiplier})`)
            : (colorHex === '#10b981' ? `rgba(16, 185, 129, ${0.15 * opacityMultiplier})` : `rgba(6, 182, 212, ${0.15 * opacityMultiplier})`);
          ctx.lineWidth = isFront ? 1.4 : 0.8;
          ctx.stroke();
          drawing = false;
        }
      }
    }

    if (drawing) {
      ctx.strokeStyle = isFront
        ? (colorHex === '#10b981' ? `rgba(16, 185, 129, ${0.45 * opacityMultiplier})` : `rgba(6, 182, 212, ${0.45 * opacityMultiplier})`)
        : (colorHex === '#10b981' ? `rgba(16, 185, 129, ${0.15 * opacityMultiplier})` : `rgba(6, 182, 212, ${0.15 * opacityMultiplier})`);
      ctx.lineWidth = isFront ? 1.4 : 0.8;
      ctx.stroke();
    }
  }

  drawGlowingNode(x, y, radius, alpha, glowColor, coreColor) {
    const ctx = this.ctx;
    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.max(3, radius * 2.5);
    ctx.fill();

    // Bright inner core
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.7, radius * 0.45), 0, Math.PI * 2);
    ctx.fillStyle = coreColor;
    ctx.globalAlpha = Math.min(1.0, alpha * 1.3);
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();
  }

  animate() {
    if (!this.isRunning) return;

    this.time++;
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw floating ambient cellular bio-particles
    ctx.save();
    for (let p of this.particles) {
      p.y -= p.speedY;
      p.x += p.speedX;
      p.phase += 0.02;

      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }

      const pulseAlpha = Math.max(0.08, p.alpha * (0.8 + 0.3 * Math.sin(p.phase)));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = pulseAlpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fill();
    }
    ctx.restore();

    // 2. Adaptive DNA Sizing (Refined, smaller, high-fidelity)
    const isMobileMode = this.width <= 768 || document.getElementById('app-wrapper')?.classList.contains('device-mobile');

    if (isMobileMode) {
      // In mobile view: smaller, delicate helix framing or gentle central stream
      if (this.width > 420) {
        // Small side helices with delicate 22px radius
        const leftX = this.width * 0.08 + this.mouseX * 0.3;
        const rightX = this.width * 0.92 - this.mouseX * 0.3;
        this.drawHelix(leftX, 22, 0.95, 0, 0.65);
        this.drawHelix(rightX, 22, 1.05, Math.PI * 0.5, 0.65);
      } else {
        // Narrow smartphone: subtle 26px radius helix with reduced opacity so card is primary
        const centerX = this.width * 0.5 + this.mouseX * 0.2;
        this.drawHelix(centerX, 26, 0.9, 0, 0.4);
      }
    } else {
      // Desktop: refined 34px radius (40% smaller than previous 55px), placed further out
      const leftCenterX = this.width * 0.11 + this.mouseX * 0.35;
      const rightCenterX = this.width * 0.89 - this.mouseX * 0.35;
      this.drawHelix(leftCenterX, 34, 1.0, 0, 0.85);
      this.drawHelix(rightCenterX, 34, 1.08, Math.PI * 0.5, 0.85);
    }

    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }
}

export const dnaVisualizer = new DnaVisualizer();
export default dnaVisualizer;

if (typeof window !== 'undefined') {
  window.dnaVisualizer = dnaVisualizer;
}
