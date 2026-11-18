/**
 * BioAge Pro — Dynamic Slow-Network DNA Loading Engine
 * Activates ONLY when the user is on a slow connection (2G, 3G, high RTT, low downlink)
 * or when network operations exceed latency thresholds (> 700ms).
 * Features high-definition 3D canvas double helix, floating genomic nucleotides (A, T, C, G),
 * cellular telemetry diagnostics, and adaptive connection monitoring.
 */

class NetworkLoaderController {
  constructor() {
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.time = 0;
    this.particles = [];
    this.floatingLetters = [];
    this.statusInterval = null;
    this.isVisible = false;
    this.activeOperations = 0;

    this.dynamicMessages = [
      'High latency detected • Calibrating genetic biomarker stream...',
      'Slow network link • Sequencing genomic base pairs (A-T • C-G)...',
      'Optimizing epigenetic methylation packets over congested channel...',
      'Synthesizing clinical biological age telemetry vectors...',
      'Compensating packet delay • Aligning telomere length projections...'
    ];
    this.msgIndex = 0;

    // Handle resize
    this.handleResize = this.onResize.bind(this);
  }

  /**
   * Evaluates if current user connection is slow based on Network Information API
   */
  isSlowNetwork() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return false;

      const effectiveType = (conn.effectiveType || '').toLowerCase();
      const downlink = conn.downlink; // in Mbps
      const rtt = conn.rtt; // in ms
      const saveData = conn.saveData;

      if (saveData === true) return true;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') return true;
      // High latency RTT (> 600ms) or severely limited downlink bandwidth (< 0.8 Mbps)
      if (downlink !== undefined && downlink > 0 && downlink < 0.8) return true;
      if (rtt !== undefined && rtt >= 600) return true;

      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retrieves connection telemetry diagnostics
   */
  getConnectionTelemetry() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) {
        return {
          type: 'Broadband / WiFi',
          speedText: 'High Latency Encountered',
          ping: '~650ms',
          downlink: 'Variable'
        };
      }

      const eff = (conn.effectiveType || 'Cellular').toUpperCase();
      const rtt = conn.rtt ? `${conn.rtt}ms` : '~580ms';
      const dl = conn.downlink ? `${conn.downlink} Mbps` : '< 1.5 Mbps';

      return {
        type: eff,
        speedText: `Slow Connection (${eff})`,
        ping: rtt,
        downlink: dl
      };
    } catch (e) {
      return {
        type: 'Cellular',
        speedText: 'Slow Connection Detected',
        ping: '~650ms',
        downlink: '< 1.5 Mbps'
      };
    }
  }

  /**
   * Ensures DOM elements and Canvas are initialized
   */
  initElements() {
    if (!this.overlay) {
      this.overlay = document.getElementById('slow-network-loader');
      this.canvas = document.getElementById('dna-loader-canvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
      }

      const dismissBtn = document.getElementById('btn-cancel-slow-loader');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          this.hide(true);
        });
      }
    }
  }

  /**
   * Show the dynamic DNA loading overlay
   */
  show(customTitle = null, customDesc = null) {
    this.initElements();
    if (!this.overlay || !this.canvas || !this.ctx) return;

    this.isVisible = true;
    this.overlay.style.display = 'flex';
    // Trigger CSS fade-in
    requestAnimationFrame(() => {
      this.overlay.classList.add('active');
      this.overlay.setAttribute('aria-hidden', 'false');
    });

    // Populate telemetry
    const telemetry = this.getConnectionTelemetry();
    const speedTag = document.getElementById('slow-net-speed-tag');
    const pingVal = document.getElementById('slow-net-ping-val');
    const titleEl = document.getElementById('slow-loader-title');
    const descEl = document.getElementById('slow-loader-status-msg');

    if (speedTag) speedTag.textContent = telemetry.speedText;
    if (pingVal) pingVal.textContent = `RTT: ${telemetry.ping}`;
    if (titleEl && customTitle) titleEl.textContent = customTitle;
    if (descEl) descEl.textContent = customDesc || this.dynamicMessages[0];

    // Setup canvas
    this.onResize();
    window.addEventListener('resize', this.handleResize);

    // Initialize particles and floating nucleotides
    this.initParticles();

    // Start 3D DNA rendering loop
    if (!this.animFrameId) {
      this.animate();
    }

    // Dynamic message cycling
    this.msgIndex = 0;
    clearInterval(this.statusInterval);
    this.statusInterval = setInterval(() => {
      if (!this.isVisible) return;
      this.msgIndex = (this.msgIndex + 1) % this.dynamicMessages.length;
      if (descEl && !customDesc) {
        descEl.style.opacity = '0';
        setTimeout(() => {
          descEl.textContent = this.dynamicMessages[this.msgIndex];
          descEl.style.opacity = '1';
        }, 200);
      }
    }, 2800);
  }

  /**
   * Smoothly hide the dynamic DNA loader
   */
  hide(immediate = false) {
    if (!this.overlay || !this.isVisible) return;

    this.isVisible = false;
    clearInterval(this.statusInterval);
    window.removeEventListener('resize', this.handleResize);

    if (immediate) {
      this.overlay.classList.remove('active');
      this.overlay.style.display = 'none';
      this.overlay.setAttribute('aria-hidden', 'true');
      this.stopAnimation();
    } else {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (!this.isVisible) {
          this.overlay.style.display = 'none';
          this.overlay.setAttribute('aria-hidden', 'true');
          this.stopAnimation();
        }
      }, 400);
    }
  }

  stopAnimation() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  onResize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.width = w;
    this.height = h;

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initParticles() {
    this.particles = [];
    const count = 45;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2 + 0.8,
        speedY: -(Math.random() * 0.45 + 0.15),
        speedX: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.5 + 0.2,
        color: Math.random() > 0.5 ? '#10b981' : '#06b6d4'
      });
    }

    // Floating nucleotide symbols (A, T, C, G)
    this.floatingLetters = [];
    const letters = ['A', 'T', 'C', 'G'];
    for (let i = 0; i < 18; i++) {
      this.floatingLetters.push({
        char: letters[Math.floor(Math.random() * letters.length)],
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.floor(Math.random() * 10 + 11),
        speedY: -(Math.random() * 0.35 + 0.1),
        alpha: Math.random() * 0.25 + 0.08,
        color: ['#10b981', '#06b6d4', '#a855f7', '#f59e0b'][Math.floor(Math.random() * 4)]
      });
    }
  }

  /**
   * Main 3D DNA Canvas render loop
   */
  animate() {
    if (!this.isVisible) {
      this.stopAnimation();
      return;
    }

    this.time += 1.8;
    this.renderCanvas();
    this.animFrameId = requestAnimationFrame(() => this.animate());
  }

  renderCanvas() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Gentle trail clear
    ctx.clearRect(0, 0, w, h);

    // 1. Draw floating genomic letters in background
    ctx.font = '600 12px "JetBrains Mono", monospace';
    this.floatingLetters.forEach(item => {
      item.y += item.speedY;
      if (item.y < -20) {
        item.y = h + 20;
        item.x = Math.random() * w;
      }
      ctx.fillStyle = item.color;
      ctx.globalAlpha = item.alpha;
      ctx.fillText(item.char, item.x, item.y);
    });

    // 2. Draw cellular dust particles
    this.particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // 3. Draw Dual 3D Rotating DNA Double Helices (flanking left and right)
    const leftX = w > 768 ? w * 0.14 : w * 0.08;
    const rightX = w > 768 ? w * 0.86 : w * 0.92;
    const helixRadius = Math.min(w * 0.075, 60);

    this.drawSingleHelix(leftX, helixRadius, 1.0, 0);
    this.drawSingleHelix(rightX, helixRadius, 0.92, Math.PI * 0.7);
  }

  drawSingleHelix(centerX, radius, speedMultiplier, offsetPhase) {
    const ctx = this.ctx;
    const h = this.height;
    const step = 14;
    const totalSteps = Math.ceil(h / step) + 4;
    const waveFrequency = 0.022;
    const rotSpeed = this.time * 0.032 * speedMultiplier + offsetPhase;

    const basePairColors = [
      { a: '#10b981', b: '#06b6d4' },
      { a: '#8b5cf6', b: '#ec4899' },
      { a: '#06b6d4', b: '#10b981' },
      { a: '#ec4899', b: '#8b5cf6' }
    ];

    const strand1Points = [];
    const strand2Points = [];

    let idx = 0;
    for (let i = -2; i < totalSteps; i++) {
      const y = i * step;
      const angle = y * waveFrequency + rotSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const x1 = centerX + sinA * radius;
      const z1 = cosA;

      const x2 = centerX - sinA * radius;
      const z2 = -cosA;

      strand1Points.push({ x: x1, y, z: z1 });
      strand2Points.push({ x: x2, y, z: z2 });

      // Connect base-pair rung
      const pair = basePairColors[idx % basePairColors.length];
      const avgZ = (z1 + z2) / 2;
      const depthAlpha = 0.35 + (avgZ + 1) * 0.3;
      const rungWidth = Math.max(1, 1.4 + (avgZ + 1) * 0.5);

      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      const grad = ctx.createLinearGradient(x1, y, x2, y);
      grad.addColorStop(0, pair.a);
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, pair.b);
      ctx.strokeStyle = grad;
      ctx.lineWidth = rungWidth;
      ctx.globalAlpha = depthAlpha * 0.85;
      ctx.stroke();

      // Middle nucleotide bead
      const midX = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.arc(midX, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = depthAlpha;
      ctx.fill();

      idx++;
    }

    // Nodes for Strand 1 (Emerald)
    strand1Points.forEach(pt => {
      const scale = (pt.z + 1.2) / 2.2;
      const nodeRadius = 3.0 + scale * 3.5;
      const alpha = 0.4 + scale * 0.6;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = '#10b981';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x - nodeRadius * 0.25, pt.y - nodeRadius * 0.25, nodeRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.9;
      ctx.fill();
    });

    // Nodes for Strand 2 (Cyan)
    strand2Points.forEach(pt => {
      const scale = (pt.z + 1.2) / 2.2;
      const nodeRadius = 3.0 + scale * 3.5;
      const alpha = 0.4 + scale * 0.6;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 10 * scale;
      ctx.shadowColor = '#06b6d4';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x - nodeRadius * 0.25, pt.y - nodeRadius * 0.25, nodeRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.9;
      ctx.fill();
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }

  /**
   * Tracks an asynchronous network promise.
   * If the network is fast and completes before `thresholdMs`, the loader is NEVER shown!
   * If the network takes longer than `thresholdMs` (or if isSlowNetwork() is already true),
   * the dynamic DNA loader page appears dynamically until completion.
   */
  async trackOperation(promise, actionTitle = 'Synthesizing Genomic Biomarkers', thresholdMs = 700) {
    this.activeOperations++;
    const isAlreadySlow = this.isSlowNetwork();
    let loaderTriggered = false;
    let timer = null;

    if (isAlreadySlow) {
      // Slow connection detected via Network Information API: display loader quickly (180ms buffer)
      timer = setTimeout(() => {
        loaderTriggered = true;
        this.show(actionTitle, 'Slow Network Detected (2G/3G)');
      }, 180);
    } else {
      // Normal / fast network: only display if request exceeds latency threshold
      timer = setTimeout(() => {
        loaderTriggered = true;
        this.show(actionTitle, 'High Network Latency Detected (>700ms)');
      }, thresholdMs);
    }

    try {
      const result = await promise;
      return result;
    } finally {
      clearTimeout(timer);
      this.activeOperations--;
      if (loaderTriggered && this.activeOperations <= 0) {
        this.hide();
      }
    }
  }
}

export const networkLoader = new NetworkLoaderController();

// Expose on window for easy developer inspection & QA demonstration
if (typeof window !== 'undefined') {
  window.networkLoader = networkLoader;
  window.testBioAgeSlowLoader = (show = true) => {
    if (show) {
      networkLoader.show('Genomic Telemetry Test', 'Simulated Slow Network Latency (3G)');
    } else {
      networkLoader.hide();
    }
  };
}
