import { geminiService } from './gemini.js';
/**
 * BioAge Pro — Master Application Controller
 * Handles View Routing, Assessment Wizard, Telemetry Dashboards,
 * What-If Longevity Simulator, Daily Checklist, and User Session.
 */

import { ASSESSMENT_SECTIONS, DEMO_USERS } from './data.js';
import { evaluateBiologicalAge } from './calculator.js';
import { auth } from './auth.js';
import { dashboardView } from './dashboard.js';
import { LongevitySimulator } from './simulator.js';
import { dnaVisualizer } from './dnaVisualizer.js';

class BioAgeApp {
  constructor() {
    this.currentView = 'dashboard-view';
    this.currentStepIndex = 0;
    this.assessmentData = {};
    this.currentEvaluation = null;
    this.simulator = null;
    this.activeUser = null;
    this.dailyHabitsState = {};

    this.init();
  }

  init() {
    // Check session
    this.activeUser = auth.getCurrentSession();

    // Load active user's form data or default
    this.loadUserData();

    // Setup event listeners
    this.setupNavigation();
    this.setupDeviceToggle();
    this.setupAuthUI();
    this.setupUserDropdown();
    this.setupAssessmentWizard();
    this.setupSimulator();
    this.setupActionPlan();
    this.setupReportModal();
    this.setupProfileModal();
    this.setupGeminiUI();

    // Initial render
    this.renderActiveUserSession();
    this.calculateAndRenderDashboard();

    // Activate initial view: if user already has an active session, go to dashboard; otherwise show auth view
    if (this.activeUser) {
      this.switchView('dashboard-view');
    } else {
      this.switchView('auth-view');
    }

    // Start Global Live DNA background visualizer across all views
    dnaVisualizer.start('global-dna-canvas');

    // Initialize Theme (Dark/Light mode)
    this.initTheme();

    // Trigger Lucide icons
    this.refreshIcons();
  }

  initTheme() {
    localStorage.removeItem('bioage_app_theme');
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  }

  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  loadUserData() {
    if (this.activeUser) {
      const savedData = auth.getUserData(this.activeUser.id);
      if (savedData) {
        this.assessmentData = { ...savedData };
      } else {
        // Fallback default
        this.assessmentData = { ...DEMO_USERS[1].data };
      }
    } else {
      this.assessmentData = { ...DEMO_USERS[1].data };
    }
  }

  renderActiveUserSession() {
    const userDisplayName = document.getElementById('user-display-name');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserEmail = document.getElementById('dropdown-user-email');
    const authBtnText = document.getElementById('auth-btn-text');
    const dashGreeting = document.getElementById('dash-greeting');
    const headerBioPill = document.getElementById('header-bio-pill');
    const headerBioVal = document.getElementById('header-bio-val');

    if (this.activeUser) {
      const firstName = (this.activeUser.name || 'User').split(' ')[0];
      if (userDisplayName) userDisplayName.textContent = firstName;
      if (dropdownUserName) dropdownUserName.textContent = this.activeUser.name;
      if (dropdownUserEmail) dropdownUserEmail.textContent = this.activeUser.email;
      if (authBtnText) authBtnText.textContent = 'Sign Out';
      if (dashGreeting) dashGreeting.textContent = `Welcome back, ${firstName}`;

      if (this.currentEvaluation) {
        if (headerBioPill) headerBioPill.style.display = 'flex';
        if (headerBioVal) headerBioVal.textContent = `${this.currentEvaluation.biologicalAge} yrs`;
      }
    } else {
      if (userDisplayName) userDisplayName.textContent = 'Guest';
      if (dropdownUserName) dropdownUserName.textContent = 'Guest User';
      if (dropdownUserEmail) dropdownUserEmail.textContent = 'Sign in to sync your data';
      if (authBtnText) authBtnText.textContent = 'Sign In';
      if (dashGreeting) dashGreeting.textContent = 'Welcome, Guest';
      if (headerBioPill) headerBioPill.style.display = 'none';
    }
  }

  // ==========================================
  // NAVIGATION & VIEW ROUTING
  // ==========================================
  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn, .m-nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Brand logo returns to dashboard
    const brandBtn = document.getElementById('brand-logo-btn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        this.switchView('dashboard-view');
      });
    }

    // Dashboard quick action buttons
    const btnDashRetake = document.getElementById('btn-dash-retake');
    if (btnDashRetake) {
      btnDashRetake.addEventListener('click', () => {
        this.currentStepIndex = 0;
        this.switchView('assessment-view');
      });
    }

    const btnDashSimulate = document.getElementById('btn-dash-simulate');
    if (btnDashSimulate) {
      btnDashSimulate.addEventListener('click', () => {
        this.switchView('simulator-view');
      });
    }

    const btnViewFullPlan = document.getElementById('btn-view-full-plan');
    if (btnViewFullPlan) {
      btnViewFullPlan.addEventListener('click', () => {
        this.switchView('action-plan-view');
      });
    }

    const btnHistoryRetake = document.getElementById('btn-history-retake');
    if (btnHistoryRetake) {
      btnHistoryRetake.addEventListener('click', () => {
        this.currentStepIndex = 0;
        this.switchView('assessment-view');
      });
    }
  }

  switchView(viewId) {
    this.currentView = viewId;

    const mainHeader = document.getElementById('main-header');
    const mobileBottomNav = document.getElementById('mobile-bottom-nav');
    const appWrapper = document.getElementById('app-wrapper');

    // Remove headers on login page & lock to single-page without window scroll
    if (viewId === 'auth-view') {
      if (mainHeader) mainHeader.style.display = 'none';
      if (mobileBottomNav) mobileBottomNav.style.display = 'none';
      if (appWrapper) appWrapper.classList.add('auth-page-active');
      document.body.classList.add('auth-page-active');
    } else {
      if (mainHeader) mainHeader.style.display = '';
      if (mobileBottomNav) mobileBottomNav.style.display = '';
      if (appWrapper) appWrapper.classList.remove('auth-page-active');
      document.body.classList.remove('auth-page-active');
    }

    // Toggle views
    document.querySelectorAll('.app-view').forEach(view => {
      view.style.display = view.id === viewId ? (viewId === 'auth-view' ? 'flex' : 'block') : 'none';
    });

    // Update desktop nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    // Update mobile nav buttons
    document.querySelectorAll('.m-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    // Live DNA Visualizer hook (runs across all views)
    if (!dnaVisualizer.isRunning) {
      dnaVisualizer.start('global-dna-canvas');
    }

    // View specific hooks
    if (viewId === 'dashboard-view') {
      this.refreshRadarChart();
    } else if (viewId === 'assessment-view') {
      this.renderAssessmentStep();
    } else if (viewId === 'simulator-view') {
      this.initSimulatorUI();
    } else if (viewId === 'action-plan-view') {
      this.renderDailyChecklist();
    } else if (viewId === 'history-view') {
      this.renderHistoryTable();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.refreshIcons();
  }

  // ==========================================
  // DEVICE MODE SWITCHER (Desktop vs Mobile Frame)
  // ==========================================
  setupDeviceToggle() {
    const toggleBtn = document.getElementById('device-mode-toggle');
    if (!toggleBtn) return;
    const appWrapper = document.getElementById('app-wrapper');
    const deviceIcon = document.getElementById('device-icon');
    const deviceLabel = document.getElementById('device-label');

    toggleBtn.addEventListener('click', () => {
      const isDesktop = appWrapper.classList.contains('device-desktop');
      if (isDesktop) {
        appWrapper.classList.remove('device-desktop');
        appWrapper.classList.add('device-mobile');
        deviceLabel.textContent = 'Desktop View';
        deviceIcon.setAttribute('data-lucide', 'monitor');
        this.showToast('Switched to Mobile App Frame preview');
      } else {
        appWrapper.classList.remove('device-mobile');
        appWrapper.classList.add('device-desktop');
        deviceLabel.textContent = 'Mobile View';
        deviceIcon.setAttribute('data-lucide', 'smartphone');
        this.showToast('Switched to Desktop Widescreen view');
      }
      this.refreshIcons();
      setTimeout(() => this.refreshRadarChart(), 350);
    });
  }

  // ==========================================
  // USER PROFILE DROPDOWN & AUTH
  // ==========================================
  setupUserDropdown() {
    const userBtn = document.getElementById('user-profile-btn');
    const dropdown = document.getElementById('user-dropdown-card');

    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    const btnOpenProfile = document.getElementById('btn-open-profile');
    if (btnOpenProfile) {
      btnOpenProfile.addEventListener('click', () => {
        dropdown.classList.remove('show');
        this.openProfileModal();
      });
    }

    document.getElementById('btn-retake-assessment').addEventListener('click', () => {
      dropdown.classList.remove('show');
      this.currentStepIndex = 0;
      this.switchView('assessment-view');
    });

    document.getElementById('btn-export-report').addEventListener('click', () => {
      dropdown.classList.remove('show');
      this.openReportModal();
    });

    const btnQuickSwitch = document.getElementById('btn-quick-switch-demo');
    if (btnQuickSwitch) {
      btnQuickSwitch.addEventListener('click', () => {
        dropdown.classList.remove('show');
        const currentId = this.activeUser ? this.activeUser.id : '';
        let nextDemo = 'demo-optimal';
        if (currentId === 'demo-optimal') nextDemo = 'demo-average';
        else if (currentId === 'demo-average') nextDemo = 'demo-high-risk';
        else nextDemo = 'demo-optimal';

        this.activeUser = auth.loginWithDemo(nextDemo);
        this.loadUserData();
        this.renderActiveUserSession();
        this.calculateAndRenderDashboard();
        this.showToast(`Switched profile to ${this.activeUser.name}`);
        this.switchView('dashboard-view');
      });
    }

    document.getElementById('btn-auth-action').addEventListener('click', () => {
      dropdown.classList.remove('show');
      if (this.activeUser) {
        auth.logout();
        this.activeUser = null;
        this.renderActiveUserSession();
        this.showToast('You have been signed out.');
      }
      this.switchView('auth-view');
    });
  }

  setupAuthUI() {
    // Clear any browser-cached autofill on initial page load and tab switches
    const clearAllAuthFields = () => {
      const loginEmail = document.getElementById('login-email');
      const loginPass = document.getElementById('login-password');
      const regName = document.getElementById('reg-name');
      const regEmail = document.getElementById('reg-email');
      const regPass = document.getElementById('reg-password');
      const regConfirmPass = document.getElementById('reg-confirm-password');

      if (loginEmail && document.activeElement !== loginEmail) loginEmail.value = '';
      if (loginPass && document.activeElement !== loginPass) loginPass.value = '';
      if (regName && document.activeElement !== regName) regName.value = '';
      if (regEmail && document.activeElement !== regEmail) regEmail.value = '';
      if (regPass && document.activeElement !== regPass) regPass.value = '';
      if (regConfirmPass && document.activeElement !== regConfirmPass) regConfirmPass.value = '';
    };

    clearAllAuthFields();
    setTimeout(clearAllAuthFields, 50);
    setTimeout(clearAllAuthFields, 250);
    setTimeout(clearAllAuthFields, 600);

    // Password Viewers (Show/Hide toggles) - Global Delegated Handler
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-toggle-pass');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password' || input.getAttribute('type') === 'password';
      const newType = isPassword ? 'text' : 'password';
      input.type = newType;
      input.setAttribute('type', newType);

      btn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
      this.refreshIcons();
    });

    // Tabs (Sign In & Create Account)
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const mode = tab.getAttribute('data-tab');
        const forgotPanel = document.getElementById('forgot-password-panel');
        if (forgotPanel) forgotPanel.style.display = 'none';
        if (loginForm) loginForm.style.display = mode === 'login' ? 'block' : 'none';
        if (registerForm) registerForm.style.display = mode === 'register' ? 'block' : 'none';
        clearAllAuthFields();
        this.refreshIcons();
      });
    });

    // Helper for Auth Card Blur & Small Loading Visual
    const setAuthCardLoading = (isLoading, text = 'Signing in...') => {
      const authCard = document.querySelector('.auth-card');
      const cardLoader = document.getElementById('auth-card-loader');
      const loadingText = document.getElementById('auth-loading-text');

      if (isLoading) {
        if (loadingText) loadingText.textContent = text;
        if (cardLoader) cardLoader.style.display = 'flex';
        if (authCard) authCard.classList.add('is-loading');
      } else {
        if (cardLoader) cardLoader.style.display = 'none';
        if (authCard) authCard.classList.remove('is-loading');
      }
    };

    // Login Form Submit
    const handleLoginSubmit = async (e) => {
      if (e) e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      const remember = document.getElementById('login-remember').checked;
      const errBox = document.getElementById('login-error');
      const submitBtn = document.getElementById('btn-submit-login');

      try {
        errBox.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.7';
        }
        setAuthCardLoading(true, 'Signing in...');

        this.activeUser = await auth.login(email, pass, remember);
        this.loadUserData();
        this.renderActiveUserSession();
        this.calculateAndRenderDashboard();
        this.showToast(`Welcome back, ${this.activeUser.name}!`);
        this.switchView('dashboard-view');
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        setAuthCardLoading(false);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
      }
    };

    loginForm.addEventListener('submit', handleLoginSubmit);
    const btnSubmitLogin = document.getElementById('btn-submit-login');
    if (btnSubmitLogin) {
      btnSubmitLogin.addEventListener('click', (e) => {
        // If the browser didn't already dispatch submit
        if (loginForm.checkValidity()) {
          handleLoginSubmit(e);
        }
      });
    }

    // Register Form Submit
    let isRegistering = false;
    const handleRegisterSubmit = async (e) => {
      if (e) e.preventDefault();
      if (isRegistering) return;
      isRegistering = true;

      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const birthdate = document.getElementById('reg-birthdate').value;
      const gender = document.getElementById('reg-gender').value;
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password') ? document.getElementById('reg-confirm-password').value : '';
      const errBox = document.getElementById('register-error');
      const submitBtn = document.getElementById('btn-submit-register') || registerForm.querySelector('button[type="submit"]');

      if (password !== confirmPassword) {
        errBox.textContent = 'Passwords do not match. Please verify both passwords.';
        errBox.style.display = 'block';
        isRegistering = false;
        return;
      }

      if (password.length < 6) {
        errBox.textContent = 'Password must be at least 6 characters.';
        errBox.style.display = 'block';
        isRegistering = false;
        return;
      }

      const origHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Checking...</span>`;
      }

      try {
        errBox.style.display = 'none';

        const res = await fetch('/api/auth/register/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, birthdate, gender, password })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          errBox.textContent = data.error || 'Registration failed. Please try again.';
          errBox.style.display = 'block';
          return;
        }

        // Open Register OTP verification view in this window
        this.openRegisterOtpView({ name, email, birthdate, gender, password }, data);

      } catch (err) {
        errBox.textContent = err.message || 'Server connection error. Please try again.';
        errBox.style.display = 'block';
      } finally {
        isRegistering = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      }
    };

    registerForm.addEventListener('submit', handleRegisterSubmit);
    const btnSubmitRegister = document.getElementById('btn-submit-register');
    if (btnSubmitRegister) {
      btnSubmitRegister.addEventListener('click', (e) => {
        if (registerForm.checkValidity()) {
          handleRegisterSubmit(e);
        }
      });
    }

    // Demo Logins
    document.querySelectorAll('.demo-login-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const demoId = btn.getAttribute('data-demo-id');
        this.activeUser = auth.loginWithDemo(demoId);
        this.loadUserData();
        this.renderActiveUserSession();
        this.calculateAndRenderDashboard();
        this.showToast(`Logged in as ${this.activeUser.name}`);
        this.switchView('dashboard-view');
      });
    });

    // Guest Access (if element present)
    const guestBtn = document.getElementById('btn-guest-access');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        this.showToast('Continuing as Guest session.');
        this.switchView('dashboard-view');
      });
    }

    // Forgot Password Flow — Opens Reset Password panel in this window only
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const emailVal = document.getElementById('login-email')?.value?.trim() || '';
        this.openForgotPasswordView(emailVal);
      });
    }

    // Setup the In-Window Forgot Password Controller
    this.setupForgotPasswordInline();

    // Setup the In-Window Registration OTP Controller
    this.setupRegisterOtpInline();
  }

  // ==========================================
  // IN-WINDOW REGISTRATION OTP CONTROLLER
  // ==========================================
  openRegisterOtpView(userData, serverResponse) {
    const tabSwitch = document.querySelector('.auth-tab-switch');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPanel = document.getElementById('forgot-password-panel');
    const regOtpPanel = document.getElementById('register-otp-panel');

    if (tabSwitch) tabSwitch.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (forgotPanel) forgotPanel.style.display = 'none';
    if (regOtpPanel) regOtpPanel.style.display = 'block';

    this._pendingRegistration = {
      ...userData,
      email: (userData.email || '').trim().toLowerCase()
    };

    const targetDisp = document.getElementById('reg-otp-target-display');
    if (targetDisp) targetDisp.textContent = this._pendingRegistration.email;

    const previewBox = document.getElementById('reg-alert-otp-preview');
    const previewVal = document.getElementById('reg-preview-code-value');
    if (serverResponse && serverResponse.previewOtp && previewBox && previewVal) {
      previewVal.textContent = serverResponse.previewOtp;
      previewBox.style.display = 'flex';
    } else if (previewBox) {
      previewBox.style.display = 'none';
    }

    const errBox = document.getElementById('reg-alert-otp-error');
    if (errBox) errBox.style.display = 'none';

    // Clear and focus OTP inputs
    const regOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`reg-otp-${i}`));
    regOtpBoxes.forEach(b => {
      if (b) {
        b.value = '';
        b.classList.remove('has-value', 'is-invalid');
      }
    });
    setTimeout(() => regOtpBoxes[0]?.focus(), 150);

    // Start 60-second timer
    this.startRegisterOtpTimer(serverResponse?.cooldownSeconds || 60);
    this.refreshIcons();
  }

  closeRegisterOtpView() {
    if (this._regTimerInterval) {
      clearInterval(this._regTimerInterval);
    }
    const tabSwitch = document.querySelector('.auth-tab-switch');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const regOtpPanel = document.getElementById('register-otp-panel');

    if (regOtpPanel) regOtpPanel.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (tabSwitch) tabSwitch.style.display = 'flex';
    if (registerForm) registerForm.style.display = 'block';

    document.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'register');
    });

    this.refreshIcons();
  }

  startRegisterOtpTimer(seconds = 60) {
    if (this._regTimerInterval) {
      clearInterval(this._regTimerInterval);
    }
    let remaining = seconds;
    const timerStatus = document.getElementById('reg-fp-timer-status');
    const resendBtn = document.getElementById('reg-btn-resend-otp');

    const updateUI = () => {
      if (remaining > 0) {
        if (timerStatus) timerStatus.innerHTML = `Resend OTP in <strong class="fp-timer-count">${remaining}</strong>s`;
        if (resendBtn) resendBtn.disabled = true;
      } else {
        clearInterval(this._regTimerInterval);
        if (timerStatus) timerStatus.innerHTML = `<span>Didn't receive the code?</span>`;
        if (resendBtn) resendBtn.disabled = false;
      }
    };

    updateUI();
    this._regTimerInterval = setInterval(() => {
      remaining--;
      updateUI();
    }, 1000);
  }

  setupRegisterOtpInline() {
    // Back to registration details button
    const backBtn = document.getElementById('btn-back-to-register');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeRegisterOtpView());
    }

    // OTP Inputs navigation
    const regOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`reg-otp-${i}`));
    regOtpBoxes.forEach((input, index) => {
      if (!input) return;
      input.addEventListener('focus', () => input.select());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            regOtpBoxes[index - 1]?.focus();
          } else {
            input.value = '';
            input.classList.remove('has-value');
          }
        } else if (e.key === 'ArrowLeft' && index > 0) {
          regOtpBoxes[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
          regOtpBoxes[index + 1]?.focus();
        }
      });

      input.addEventListener('input', () => {
        const val = input.value.replace(/[^0-9]/g, '');
        input.value = val ? val[0] : '';
        if (input.value) {
          input.classList.add('has-value');
          input.classList.remove('is-invalid');
          if (index < 5) {
            regOtpBoxes[index + 1]?.focus();
          }
        } else {
          input.classList.remove('has-value');
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
        if (digits) {
          digits.split('').forEach((d, i) => {
            if (regOtpBoxes[i]) {
              regOtpBoxes[i].value = d;
              regOtpBoxes[i].classList.add('has-value');
              regOtpBoxes[i].classList.remove('is-invalid');
            }
          });
          const focusIdx = Math.min(digits.length, 5);
          regOtpBoxes[focusIdx]?.focus();
        }
      });
    });

    // Resend OTP button
    const resendBtn = document.getElementById('reg-btn-resend-otp');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        if (resendBtn.disabled || !this._pendingRegistration?.email) return;
        resendBtn.disabled = true;
        resendBtn.innerHTML = `<span class="btn-spinner"></span> <span>Sending...</span>`;

        const errBox = document.getElementById('reg-alert-otp-error');
        if (errBox) errBox.style.display = 'none';

        try {
          const res = await fetch('/api/auth/register/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this._pendingRegistration.email })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errMsg = document.getElementById('reg-alert-otp-msg');
            if (errMsg) errMsg.textContent = data.error || 'Failed to resend OTP.';
            if (errBox) errBox.style.display = 'flex';
            resendBtn.disabled = false;
            return;
          }

          const previewBox = document.getElementById('reg-alert-otp-preview');
          const previewVal = document.getElementById('reg-preview-code-value');
          if (data.previewOtp && previewBox && previewVal) {
            previewVal.textContent = data.previewOtp;
            previewBox.style.display = 'flex';
          }

          regOtpBoxes.forEach(b => {
            if (b) {
              b.value = '';
              b.classList.remove('has-value', 'is-invalid');
            }
          });
          regOtpBoxes[0]?.focus();

          this.startRegisterOtpTimer(60);

        } catch (err) {
          const errMsg = document.getElementById('reg-alert-otp-msg');
          if (errMsg) errMsg.textContent = 'Network error resending OTP.';
          if (errBox) errBox.style.display = 'flex';
          resendBtn.disabled = false;
        } finally {
          resendBtn.innerHTML = `<i data-lucide="rotate-cw"></i> <span>Resend OTP</span>`;
          this.refreshIcons();
        }
      });
    }

    // Form Verify OTP and Create Account
    const formVerify = document.getElementById('form-verify-register-otp');
    if (formVerify) {
      formVerify.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('reg-alert-otp-error');
        const errMsg = document.getElementById('reg-alert-otp-msg');
        if (errBox) errBox.style.display = 'none';

        const fullOtp = regOtpBoxes.map(b => b ? b.value : '').join('');
        if (fullOtp.length !== 6) {
          if (errMsg) errMsg.textContent = 'Please enter all 6 digits of the verification code.';
          if (errBox) errBox.style.display = 'flex';
          regOtpBoxes.find(b => !b?.value)?.focus();
          return;
        }

        const submitBtn = document.getElementById('btn-submit-verify-reg-otp');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Verifying...</span>`;
        }

        try {
          const res = await fetch('/api/auth/register/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: this._pendingRegistration.email,
              otp: fullOtp
            })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (errMsg) errMsg.textContent = data.error || 'Invalid OTP';
            if (errBox) errBox.style.display = 'flex';
            regOtpBoxes.forEach(b => b && b.classList.add('is-invalid'));
            return;
          }

          // OTP is verified and account is now officially created in the database!
          const user = data.user;
          localStorage.setItem('bioage_active_session', JSON.stringify(user));
          this.activeUser = user;
          this.loadUserData();
          this.renderActiveUserSession();

          if (this._regTimerInterval) clearInterval(this._regTimerInterval);
          const regOtpPanel = document.getElementById('register-otp-panel');
          if (regOtpPanel) regOtpPanel.style.display = 'none';

          this.showToast(`✅ Welcome, ${user.name}! Your account has been verified and created.`);

          // ALLOW DIRECTLY TO DASHBOARD
          this.switchView('dashboard-view');

        } catch (err) {
          if (errMsg) errMsg.textContent = err.message || 'Error verifying OTP.';
          if (errBox) errBox.style.display = 'flex';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        }
      });
    }
  }

  // ==========================================
  // IN-WINDOW FORGOT PASSWORD CONTROLLER
  // ==========================================
  openForgotPasswordView(prefillEmail = '') {
    const tabSwitch = document.querySelector('.auth-tab-switch');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPanel = document.getElementById('forgot-password-panel');

    if (tabSwitch) tabSwitch.style.display = 'none';
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (forgotPanel) forgotPanel.style.display = 'block';

    const emailInput = document.getElementById('inline-fp-email-input');
    if (emailInput) {
      emailInput.value = prefillEmail || '';
      setTimeout(() => emailInput.focus(), 150);
    }

    this.resetForgotPasswordInline();
    this.refreshIcons();
  }

  closeForgotPasswordView() {
    const tabSwitch = document.querySelector('.auth-tab-switch');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPanel = document.getElementById('forgot-password-panel');

    if (this._inlineTimerInterval) {
      clearInterval(this._inlineTimerInterval);
    }

    if (forgotPanel) forgotPanel.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (tabSwitch) tabSwitch.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'block';

    // Set tab active
    document.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === 'login');
    });

    this.refreshIcons();
  }

  resetForgotPasswordInline() {
    this._inlineState = {
      email: '',
      otp: '',
      timerSeconds: 60
    };
    if (this._inlineTimerInterval) {
      clearInterval(this._inlineTimerInterval);
    }
    this.setInlineStep(1);
  }

  setInlineStep(step) {
    const paneEmail = document.getElementById('inline-pane-email');
    const paneOtp = document.getElementById('inline-pane-otp');
    const panePassword = document.getElementById('inline-pane-password');
    const paneSuccess = document.getElementById('inline-pane-success');

    const ind1 = document.getElementById('inline-step-ind-1');
    const ind2 = document.getElementById('inline-step-ind-2');
    const ind3 = document.getElementById('inline-step-ind-3');
    const line1 = document.getElementById('inline-step-line-1');
    const line2 = document.getElementById('inline-step-line-2');

    [paneEmail, paneOtp, panePassword, paneSuccess].forEach(p => p && p.classList.remove('active'));

    if (step === 1) {
      if (paneEmail) paneEmail.classList.add('active');
      if (ind1) ind1.className = 'fp-step-item active';
      if (ind2) ind2.className = 'fp-step-item';
      if (ind3) ind3.className = 'fp-step-item';
      if (line1) line1.className = 'fp-step-line';
      if (line2) line2.className = 'fp-step-line';
      setTimeout(() => document.getElementById('inline-fp-email-input')?.focus(), 150);
    } else if (step === 2) {
      if (paneOtp) paneOtp.classList.add('active');
      if (ind1) ind1.className = 'fp-step-item completed';
      if (ind2) ind2.className = 'fp-step-item active';
      if (ind3) ind3.className = 'fp-step-item';
      if (line1) line1.className = 'fp-step-line completed';
      if (line2) line2.className = 'fp-step-line';
      const targetDisp = document.getElementById('inline-fp-target-display');
      if (targetDisp) targetDisp.textContent = this._inlineState.email;
      setTimeout(() => document.getElementById('inline-otp-1')?.focus(), 150);
    } else if (step === 3) {
      if (panePassword) panePassword.classList.add('active');
      if (ind1) ind1.className = 'fp-step-item completed';
      if (ind2) ind2.className = 'fp-step-item completed';
      if (ind3) ind3.className = 'fp-step-item active';
      if (line1) line1.className = 'fp-step-line completed';
      if (line2) line2.className = 'fp-step-line completed';
      setTimeout(() => document.getElementById('inline-fp-new-password')?.focus(), 150);
    } else if (step === 4) {
      if (paneSuccess) paneSuccess.classList.add('active');
      if (ind1) ind1.className = 'fp-step-item completed';
      if (ind2) ind2.className = 'fp-step-item completed';
      if (ind3) ind3.className = 'fp-step-item completed';
      if (line1) line1.className = 'fp-step-line completed';
      if (line2) line2.className = 'fp-step-line completed';
    }

    this.refreshIcons();
  }

  setupForgotPasswordInline() {
    this._inlineState = {
      email: '',
      otp: '',
      timerSeconds: 60
    };

    // Cancel / Back to Login
    const cancelBtn = document.getElementById('btn-cancel-fp');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeForgotPasswordView());
    }

    // 60-second Timer Function
    const startInlineTimer = (seconds = 60) => {
      clearInterval(this._inlineTimerInterval);
      this._inlineState.timerSeconds = seconds;
      const timerStatus = document.getElementById('inline-fp-timer-status');
      const resendBtn = document.getElementById('inline-btn-resend-otp');

      const updateUI = () => {
        if (this._inlineState.timerSeconds > 0) {
          if (timerStatus) timerStatus.innerHTML = `Resend OTP in <strong class="fp-timer-count">${this._inlineState.timerSeconds}</strong>s`;
          if (resendBtn) resendBtn.disabled = true;
        } else {
          clearInterval(this._inlineTimerInterval);
          if (timerStatus) timerStatus.innerHTML = `<span>Didn't receive the code?</span>`;
          if (resendBtn) resendBtn.disabled = false;
        }
      };

      updateUI();
      this._inlineTimerInterval = setInterval(() => {
        this._inlineState.timerSeconds--;
        updateUI();
      }, 1000);
    };

    // Form 1: Send OTP to email
    const formSend = document.getElementById('inline-form-send-otp');
    if (formSend) {
      formSend.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('inline-fp-email-input');
        const errBox = document.getElementById('inline-alert-email-error');
        const errMsg = document.getElementById('inline-alert-email-msg');
        const submitBtn = document.getElementById('inline-btn-send-otp');

        if (errBox) errBox.style.display = 'none';
        const email = emailInput?.value?.trim().toLowerCase();
        if (!email) return;

        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Checking...</span>`;
        }

        try {
          const res = await fetch('/api/auth/forgot-password/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            if (errMsg) errMsg.textContent = data.error || 'Email not found in database.';
            if (errBox) errBox.style.display = 'flex';
            this.refreshIcons();
            return;
          }

          this._inlineState.email = email;

          // Preview code if dev mode
          const previewBox = document.getElementById('inline-alert-otp-preview');
          const previewVal = document.getElementById('inline-preview-code-value');
          if (data.previewOtp && previewBox && previewVal) {
            previewVal.textContent = data.previewOtp;
            previewBox.style.display = 'flex';
          } else if (previewBox) {
            previewBox.style.display = 'none';
          }

          this.setInlineStep(2);
          startInlineTimer(data.cooldownSeconds || 60);

        } catch (err) {
          if (errMsg) errMsg.textContent = 'Server connection error. Please try again.';
          if (errBox) errBox.style.display = 'flex';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
            this.refreshIcons();
          }
        }
      });
    }

    // Resend OTP Button (Enabled after 60 seconds)
    const resendBtn = document.getElementById('inline-btn-resend-otp');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        if (resendBtn.disabled || !this._inlineState.email) return;
        resendBtn.disabled = true;
        resendBtn.innerHTML = `<span class="btn-spinner"></span> <span>Sending...</span>`;

        const errBox = document.getElementById('inline-alert-otp-error');
        if (errBox) errBox.style.display = 'none';

        try {
          const res = await fetch('/api/auth/forgot-password/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this._inlineState.email })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errMsg = document.getElementById('inline-alert-otp-msg');
            if (errMsg) errMsg.textContent = data.error || 'Failed to resend OTP.';
            if (errBox) errBox.style.display = 'flex';
            resendBtn.disabled = false;
            return;
          }

          const previewBox = document.getElementById('inline-alert-otp-preview');
          const previewVal = document.getElementById('inline-preview-code-value');
          if (data.previewOtp && previewBox && previewVal) {
            previewVal.textContent = data.previewOtp;
            previewBox.style.display = 'flex';
          }

          const otpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`inline-otp-${i}`));
          otpBoxes.forEach(b => {
            if (b) {
              b.value = '';
              b.classList.remove('has-value', 'is-invalid');
            }
          });
          otpBoxes[0]?.focus();

          startInlineTimer(60);

        } catch (err) {
          const errMsg = document.getElementById('inline-alert-otp-msg');
          if (errMsg) errMsg.textContent = 'Network error resending OTP.';
          if (errBox) errBox.style.display = 'flex';
          resendBtn.disabled = false;
        } finally {
          resendBtn.innerHTML = `<i data-lucide="rotate-cw"></i> <span>Resend OTP</span>`;
          this.refreshIcons();
        }
      });
    }

    // Back to email step button
    const backEmailBtn = document.getElementById('inline-btn-back-to-email');
    if (backEmailBtn) {
      backEmailBtn.addEventListener('click', () => {
        clearInterval(this._inlineTimerInterval);
        this.setInlineStep(1);
      });
    }

    // OTP Boxes inputs
    const inlineOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`inline-otp-${i}`));
    inlineOtpBoxes.forEach((input, index) => {
      if (!input) return;
      input.addEventListener('focus', () => input.select());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            inlineOtpBoxes[index - 1]?.focus();
          } else {
            input.value = '';
            input.classList.remove('has-value');
          }
        } else if (e.key === 'ArrowLeft' && index > 0) {
          inlineOtpBoxes[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
          inlineOtpBoxes[index + 1]?.focus();
        }
      });

      input.addEventListener('input', () => {
        const val = input.value.replace(/[^0-9]/g, '');
        input.value = val ? val[0] : '';
        if (input.value) {
          input.classList.add('has-value');
          input.classList.remove('is-invalid');
          if (index < 5) {
            inlineOtpBoxes[index + 1]?.focus();
          }
        } else {
          input.classList.remove('has-value');
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
        if (digits) {
          digits.split('').forEach((d, i) => {
            if (inlineOtpBoxes[i]) {
              inlineOtpBoxes[i].value = d;
              inlineOtpBoxes[i].classList.add('has-value');
              inlineOtpBoxes[i].classList.remove('is-invalid');
            }
          });
          const focusIdx = Math.min(digits.length, 5);
          inlineOtpBoxes[focusIdx]?.focus();
        }
      });
    });

    // Form 2: Verify OTP
    const formVerify = document.getElementById('inline-form-verify-otp');
    if (formVerify) {
      formVerify.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('inline-alert-otp-error');
        const errMsg = document.getElementById('inline-alert-otp-msg');
        if (errBox) errBox.style.display = 'none';

        const fullOtp = inlineOtpBoxes.map(b => b ? b.value : '').join('');
        if (fullOtp.length !== 6) {
          if (errMsg) errMsg.textContent = 'Please enter all 6 digits of the OTP.';
          if (errBox) errBox.style.display = 'flex';
          inlineOtpBoxes.find(b => !b?.value)?.focus();
          this.refreshIcons();
          return;
        }

        const submitBtn = document.getElementById('inline-btn-verify-otp');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Verifying...</span>`;
        }

        try {
          const res = await fetch('/api/auth/forgot-password/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this._inlineState.email, otp: fullOtp })
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            // Database check failed! Show Invalid OTP
            if (errMsg) errMsg.textContent = data.error || 'Invalid OTP';
            if (errBox) errBox.style.display = 'flex';
            inlineOtpBoxes.forEach(b => b && b.classList.add('is-invalid'));
            this.refreshIcons();
            return;
          }

          // Database confirmed OTP is correct!
          this._inlineState.otp = fullOtp;
          clearInterval(this._inlineTimerInterval);
          this.setInlineStep(3);

        } catch (err) {
          if (errMsg) errMsg.textContent = 'Server error verifying OTP.';
          if (errBox) errBox.style.display = 'flex';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
            this.refreshIcons();
          }
        }
      });
    }

    // Form 3: Reset Password
    const formReset = document.getElementById('inline-form-reset-password');
    if (formReset) {
      formReset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('inline-alert-pass-error');
        const errMsg = document.getElementById('inline-alert-pass-msg');
        if (errBox) errBox.style.display = 'none';

        const newPass = document.getElementById('inline-fp-new-password')?.value;
        const confirmPass = document.getElementById('inline-fp-confirm-password')?.value;

        if (!newPass || newPass.length < 6) {
          if (errMsg) errMsg.textContent = 'Password must be at least 6 characters.';
          if (errBox) errBox.style.display = 'flex';
          return;
        }

        if (newPass !== confirmPass) {
          if (errMsg) errMsg.textContent = 'Passwords do not match. Please verify.';
          if (errBox) errBox.style.display = 'flex';
          return;
        }

        const submitBtn = document.getElementById('inline-btn-submit-reset');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Updating...</span>`;
        }

        try {
          const res = await fetch('/api/auth/forgot-password/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: this._inlineState.email,
              otp: this._inlineState.otp,
              newPassword: newPass
            })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (errMsg) errMsg.textContent = data.error || 'Failed to update password in database.';
            if (errBox) errBox.style.display = 'flex';
            this.refreshIcons();
            return;
          }

          // Direct redirect to login page immediately!
          this.closeForgotPasswordView();
          const emailInput = document.getElementById('login-email');
          const passInput = document.getElementById('login-password');
          if (emailInput && this._inlineState.email) {
            emailInput.value = this._inlineState.email;
          }
          if (passInput) {
            passInput.value = '';
            passInput.focus();
          }
          this.showToast('✅ Password updated successfully! Please sign in with your new password.');

        } catch (err) {
          if (errMsg) errMsg.textContent = 'Database error updating password.';
          if (errBox) errBox.style.display = 'flex';
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
            this.refreshIcons();
          }
        }
      });
    }

    // Step 4 Finish Button (Return to Sign In)
    const finishBtn = document.getElementById('inline-btn-finish-signin');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        if (emailInput && this._inlineState.email) {
          emailInput.value = this._inlineState.email;
        }
        if (passInput) {
          passInput.value = '';
          passInput.focus();
        }
        this.closeForgotPasswordView();
        this.showToast('✅ Password reset successful! Please sign in with your new password.');
      });
    }
  }

  // ==========================================
  // ASSESSMENT WIZARD CONTROLLER
  // ==========================================
  setupAssessmentWizard() {
    document.getElementById('btn-wizard-prev').addEventListener('click', () => {
      if (this.currentStepIndex > 0) {
        this.saveCurrentStepInputs();
        this.currentStepIndex--;
        this.renderAssessmentStep();
      }
    });

    document.getElementById('btn-wizard-next').addEventListener('click', () => {
      if (this.validateCurrentStep()) {
        this.saveCurrentStepInputs();
        if (this.currentStepIndex < ASSESSMENT_SECTIONS.length - 1) {
          this.currentStepIndex++;
          this.renderAssessmentStep();
        }
      }
    });

    document.getElementById('btn-wizard-calculate').addEventListener('click', () => {
      if (this.validateCurrentStep()) {
        this.saveCurrentStepInputs();
        this.finishAssessment();
      }
    });

    document.getElementById('btn-load-sample').addEventListener('click', () => {
      this.assessmentData = { ...DEMO_USERS[0].data }; // Healthy longevity sample
      this.renderAssessmentStep();
      this.showToast('Loaded healthy longevity reference sample metrics!');
    });
  }

  renderAssessmentStep() {
    const section = ASSESSMENT_SECTIONS[this.currentStepIndex];
    if (!section) return;

    // Wizard header updates
    document.getElementById('wizard-step-badge').textContent = `Step ${this.currentStepIndex + 1} of ${ASSESSMENT_SECTIONS.length}`;
    document.getElementById('wizard-section-title').textContent = section.title;
    document.getElementById('wizard-section-subtitle').textContent = section.subtitle;

    const progressPct = ((this.currentStepIndex + 1) / ASSESSMENT_SECTIONS.length) * 100;
    document.getElementById('wizard-progress-fill').style.width = `${progressPct}%`;

    // Render Step Nav Bar
    const navBar = document.getElementById('step-nav-bar');
    navBar.innerHTML = ASSESSMENT_SECTIONS.map((sec, idx) => {
      const isCurrent = idx === this.currentStepIndex;
      const isPast = idx < this.currentStepIndex;
      const cls = isCurrent ? 'step-nav-pill active' : isPast ? 'step-nav-pill completed' : 'step-nav-pill';
      const icon = isPast ? 'check' : sec.icon;
      return `
        <div class="${cls}" data-step="${idx}">
          <i data-lucide="${icon}"></i>
          <span>${sec.title.split(' ')[0]}</span>
        </div>
      `;
    }).join('');

    // Click on nav pills to jump to step
    navBar.querySelectorAll('.step-nav-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const targetStep = Number(pill.getAttribute('data-step'));
        this.saveCurrentStepInputs();
        this.currentStepIndex = targetStep;
        this.renderAssessmentStep();
      });
    });

    // Render Form Fields
    const container = document.getElementById('assessment-fields-container');
    container.innerHTML = section.fields.map(field => {
      const isVisible = !field.dependsOn || this.assessmentData[field.dependsOn.field] === field.dependsOn.value;
      const currentVal = this.assessmentData[field.id] !== undefined ? this.assessmentData[field.id] : field.default;
      const fullWidthClass = field.type === 'select' ? 'field-full-width' : '';

      if (field.type === 'select') {
        return `
          <div class="form-group ${fullWidthClass}" id="wrap-${field.id}" style="display: ${isVisible ? 'flex' : 'none'};">
            <label for="field-${field.id}">${field.label}</label>
            <select id="field-${field.id}" data-id="${field.id}">
              ${field.options.map(opt => `
                <option value="${opt.value}" ${opt.value === currentVal ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
            ${field.hint ? `<span class="form-hint">${field.hint}</span>` : ''}
          </div>
        `;
      } else if (field.type === 'number') {
        return `
          <div class="form-group ${fullWidthClass}" id="wrap-${field.id}" style="display: ${isVisible ? 'flex' : 'none'};">
            <label for="field-${field.id}">${field.label} ${field.unit ? `(${field.unit})` : ''}</label>
            <input type="number" 
                   id="field-${field.id}" 
                   data-id="${field.id}" 
                   value="${currentVal}" 
                   min="${field.min || 0}" 
                   max="${field.max || 999}" 
                   step="${field.step || 1}" 
                   required />
            ${field.hint ? `<span class="form-hint">${field.hint}</span>` : ''}
          </div>
        `;
      }
      return '';
    }).join('');

    // Attach listener for dependent fields (e.g. hasLabs toggle)
    const hasLabsSelect = document.getElementById('field-hasLabs');
    if (hasLabsSelect) {
      hasLabsSelect.addEventListener('change', (e) => {
        this.assessmentData.hasLabs = e.target.value;
        const labsVisible = e.target.value === 'yes';
        ['fastingGlucose', 'cholesterolRatio', 'hsCrp'].forEach(labId => {
          const wrap = document.getElementById(`wrap-${labId}`);
          if (wrap) wrap.style.display = labsVisible ? 'flex' : 'none';
        });
      });
    }

    // Toggle button visibility
    const isFirst = this.currentStepIndex === 0;
    const isLast = this.currentStepIndex === ASSESSMENT_SECTIONS.length - 1;

    document.getElementById('btn-wizard-prev').style.display = isFirst ? 'none' : 'inline-flex';
    document.getElementById('btn-wizard-next').style.display = isLast ? 'none' : 'inline-flex';
    document.getElementById('btn-wizard-calculate').style.display = isLast ? 'inline-flex' : 'none';

    this.refreshIcons();
  }

  saveCurrentStepInputs() {
    const section = ASSESSMENT_SECTIONS[this.currentStepIndex];
    if (!section) return;

    section.fields.forEach(field => {
      const input = document.getElementById(`field-${field.id}`);
      if (input) {
        if (field.type === 'number') {
          this.assessmentData[field.id] = Number(input.value);
        } else {
          this.assessmentData[field.id] = input.value;
        }
      }
    });

    // Save in user profile store
    if (this.activeUser) {
      auth.updateUserData(this.activeUser.id, this.assessmentData);
    }
  }

  validateCurrentStep() {
    const section = ASSESSMENT_SECTIONS[this.currentStepIndex];
    if (!section) return true;

    for (const field of section.fields) {
      if (field.required) {
        const input = document.getElementById(`field-${field.id}`);
        if (input && !input.value) {
          this.showToast(`Please fill in ${field.label}`, 'error');
          input.focus();
          return false;
        }
      }
    }
    return true;
  }

  finishAssessment() {
    this.saveCurrentStepInputs();
    this.calculateAndRenderDashboard();

    // Save history
    if (this.activeUser) {
      auth.saveAssessmentResult(this.activeUser.id, this.currentEvaluation);
    }

    this.showToast('Biological Age evaluation calculated successfully!');
    this.switchView('dashboard-view');
  }

  // ==========================================
  // DASHBOARD RENDERING & TELEMETRY
  // ==========================================
  calculateAndRenderDashboard() {
    this.currentEvaluation = evaluateBiologicalAge(this.assessmentData);

    // Header Bio Pill
    const headerBioPill = document.getElementById('header-bio-pill');
    const headerBioVal = document.getElementById('header-bio-val');
    if (headerBioPill && headerBioVal) {
      headerBioPill.style.display = 'flex';
      headerBioVal.textContent = `${this.currentEvaluation.biologicalAge} yrs`;
    }

    // Hero Lifespan Section
    const heroMount = document.getElementById('longevity-hero-container');
    if (heroMount) {
      heroMount.innerHTML = dashboardView.renderLongevityHero(this.currentEvaluation);
    }

    // Bio Gauge Mount
    const gaugeMount = document.getElementById('gauge-mount-point');
    if (gaugeMount) {
      gaugeMount.innerHTML = dashboardView.renderGauge(this.currentEvaluation);
    }

    // Organ Subsystems Cards
    const organMount = document.getElementById('organ-cards-container');
    if (organMount) {
      organMount.innerHTML = dashboardView.renderOrganCards(
        this.currentEvaluation.organAges,
        this.currentEvaluation.chronologicalAge
      );
    }

    // Prescriptions List
    const rxMount = document.getElementById('prescriptions-mount-point');
    if (rxMount) {
      rxMount.innerHTML = dashboardView.renderPrescriptions(this.currentEvaluation.improvements);
      
      // Hook up habit checkboxes in dashboard
      rxMount.querySelectorAll('.habit-checkbox').forEach(cb => {
        const id = cb.getAttribute('data-id');
        cb.checked = !!this.dailyHabitsState[id];
        cb.addEventListener('change', (e) => {
          this.dailyHabitsState[id] = e.target.checked;
          this.updateAdherenceStreak();
          this.showToast(e.target.checked ? 'Habit added to your daily protocol!' : 'Habit unchecked.');
        });
      });
    }

    // Render Canvas Spider/Radar Chart
    this.refreshRadarChart();
    this.refreshIcons();
  }

  refreshRadarChart() {
    if (this.currentEvaluation && this.currentEvaluation.domainScores) {
      setTimeout(() => {
        dashboardView.drawRadarChart('longevity-radar-canvas', this.currentEvaluation.domainScores);
      }, 50);
    }
  }

  // ==========================================
  // INTERACTIVE WHAT-IF LONGEVITY SIMULATOR
  // ==========================================
  setupSimulator() {
    const btnReset = document.getElementById('btn-sim-reset');
    const btnOptimal = document.getElementById('btn-sim-optimal');
    const btnApply = document.getElementById('btn-apply-simulation');

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (this.simulator) {
          const res = this.simulator.reset();
          this.updateSimulatorDOM(res);
          this.showToast('Simulator reset to your current baseline habits.');
        }
      });
    }

    if (btnOptimal) {
      btnOptimal.addEventListener('click', () => {
        if (this.simulator) {
          const res = this.simulator.optimizeAll();
          this.updateSimulatorDOM(res);
          this.showToast('Simulated 100% optimal longevity protocol!');
        }
      });
    }

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (this.simulator) {
          this.assessmentData = { ...this.simulator.simulatedData };
          if (this.activeUser) {
            auth.updateUserData(this.activeUser.id, this.assessmentData);
          }
          this.calculateAndRenderDashboard();
          this.showToast('Simulated longevity habits saved as your current target protocol!');
          this.switchView('dashboard-view');
        }
      });
    }
  }

  initSimulatorUI() {
    if (!this.simulator) {
      this.simulator = new LongevitySimulator(this.assessmentData, (result) => {
        this.updateSimulatorDOM(result);
      });
    } else {
      this.simulator.setBaseData(this.assessmentData);
    }

    const currentSimData = this.simulator.simulatedData;

    // Attach pill buttons in levers
    document.querySelectorAll('.lever-options-row').forEach(row => {
      const param = row.getAttribute('data-param');
      const activeVal = currentSimData[param];

      row.querySelectorAll('.lever-pill-btn').forEach(btn => {
        const val = btn.getAttribute('data-val');
        btn.classList.toggle('active', val === activeVal);

        btn.onclick = () => {
          row.querySelectorAll('.lever-pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const res = this.simulator.updateParam(param, val);
          this.updateSimulatorDOM(res);
        };
      });
    });

    const initRes = this.simulator.calculate();
    this.updateSimulatorDOM(initRes);
    this.refreshIcons();
  }

  updateSimulatorDOM(result) {
    const origBio = document.getElementById('sim-orig-bio');
    const newBio = document.getElementById('sim-new-bio');
    const bioDelta = document.getElementById('sim-bio-delta');
    const origLife = document.getElementById('sim-orig-life');
    const newLife = document.getElementById('sim-new-life');
    const lifeGain = document.getElementById('sim-life-gain');

    origBio.textContent = `${result.baseEvaluation.biologicalAge}y`;
    newBio.textContent = `${result.simEvaluation.biologicalAge}y`;

    const deltaSign = result.bioAgeDelta <= 0 ? '' : '+';
    bioDelta.textContent = `${deltaSign}${result.bioAgeDelta} yrs`;
    bioDelta.style.color = result.bioAgeDelta <= 0 ? '#34d399' : '#fbbf24';

    origLife.textContent = `${result.baseEvaluation.projectedLifeExpectancy}y`;
    newLife.textContent = `${result.simEvaluation.projectedLifeExpectancy}y`;

    const gainSign = result.lifeYearsGained >= 0 ? '+' : '';
    lifeGain.textContent = `${gainSign}${result.lifeYearsGained} Extra Years`;
    lifeGain.style.color = result.lifeYearsGained >= 0 ? '#38bdf8' : '#f87171';

    // Synchronize active states of buttons
    document.querySelectorAll('.lever-options-row').forEach(row => {
      const param = row.getAttribute('data-param');
      const curVal = result.simulatedData[param];
      row.querySelectorAll('.lever-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-val') === curVal);
      });
    });
  }

  // ==========================================
  // ACTION PROTOCOL & DAILY CHECKLIST
  // ==========================================
  setupActionPlan() {
    document.getElementById('btn-print-report').addEventListener('click', () => {
      this.openReportModal();
    });
  }

  renderDailyChecklist() {
    const checklistItems = [
      { id: 'h1', text: 'Drink 750ml pure water with pinch of Himalayan salt upon waking', time: 'Morning' },
      { id: 'h2', text: '10 minutes of direct sunlight viewing without sunglasses', time: 'Morning' },
      { id: 'h3', text: '10-minute brisk walk immediately after lunch (flatten glucose spike)', time: 'Afternoon' },
      { id: 'h4', text: 'Complete 30 min Zone 2 cardio (conversational pace) or strength session', time: 'Afternoon' },
      { id: 'h5', text: 'Eat last meal before 7:30 PM (initiate 13h autophagy fasting window)', time: 'Evening' },
      { id: 'h6', text: 'No screens or blue light 60 minutes before bedtime', time: 'Night' },
      { id: 'h7', text: 'Bedroom cooled to 65°F (18°C) in pitch darkness for deep sleep', time: 'Night' }
    ];

    const container = document.getElementById('daily-checklist-items');
    container.innerHTML = checklistItems.map(item => {
      const isDone = !!this.dailyHabitsState[item.id];
      return `
        <div class="check-item-row ${isDone ? 'done' : ''}" data-id="${item.id}">
          <div class="custom-checkbox">
            <input type="checkbox" id="chk-${item.id}" ${isDone ? 'checked' : ''} />
            <span class="checkbox-mark"></span>
          </div>
          <span class="item-text">${item.text}</span>
          <span class="item-time-pill">${item.time}</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.check-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        this.dailyHabitsState[id] = !this.dailyHabitsState[id];
        row.classList.toggle('done', this.dailyHabitsState[id]);
        row.querySelector('input').checked = this.dailyHabitsState[id];
        this.updateAdherenceStreak();
      });
    });

    this.updateAdherenceStreak();
  }

  updateAdherenceStreak() {
    const completedCount = Object.values(this.dailyHabitsState).filter(Boolean).length;
    const adherencePill = document.getElementById('adherence-pill');
    if (adherencePill) {
      adherencePill.textContent = `${completedCount} of 7 Completed`;
    }
  }

  // ==========================================
  // ASSESSMENT HISTORY & TRACKING
  // ==========================================
  renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    const emptyState = document.getElementById('history-empty');

    if (!this.activeUser) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    const history = auth.getAssessmentHistory(this.activeUser.id);
    if (!history || history.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = history.map(rec => {
      const diff = +(rec.biologicalAge - rec.chronologicalAge).toFixed(1);
      const isYounger = diff <= 0;
      const diffClass = isYounger ? 'badge-young' : 'badge-risk';
      const diffText = isYounger ? `${Math.abs(diff)}y younger` : `+${diff}y older`;

      return `
        <tr>
          <td><strong>${rec.formattedDate}</strong></td>
          <td>${rec.chronologicalAge} yrs</td>
          <td><strong style="color: #fff;">${rec.biologicalAge} yrs</strong></td>
          <td><span class="demo-badge ${diffClass}">${diffText}</span></td>
          <td><strong style="color: #06b6d4;">${rec.projectedLifeExpectancy} yrs</strong></td>
          <td>${rec.paceOfAging}x</td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================
  // PRINTABLE LONGEVITY REPORT MODAL
  // ==========================================
  setupReportModal() {
    const modal = document.getElementById('report-modal');
    const closeBtn = document.getElementById('btn-close-modal');
    const cancelBtn = document.getElementById('btn-cancel-report');
    const printBtn = document.getElementById('btn-execute-print');

    const closeModal = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    printBtn.addEventListener('click', () => {
      window.print();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  openReportModal() {
    const modal = document.getElementById('report-modal');
    const printArea = document.getElementById('print-area');
    const evalData = this.currentEvaluation || evaluateBiologicalAge(this.assessmentData);

    const userName = this.activeUser ? this.activeUser.name : 'Guest User';
    const reportDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    printArea.innerHTML = `
      <div class="print-report-header">
        <div>
          <h2>BioAge Pro™ Longevity & Cellular Health Report</h2>
          <span style="font-size: 0.85rem; color: #94a3b8;">Clinical Phenotypic Biological Aging Assessment</span>
        </div>
        <div style="text-align: right;">
          <strong>Date: ${reportDate}</strong>
          <div style="font-size: 0.85rem; color: #10b981;">Confidential Health Document</div>
        </div>
      </div>

      <div class="print-meta-grid">
        <div class="print-meta-item">
          <strong>Patient / Client Name</strong>
          <span>${userName}</span>
        </div>
        <div class="print-meta-item">
          <strong>Calendar Chronological Age</strong>
          <span>${evalData.chronologicalAge} Years</span>
        </div>
        <div class="print-meta-item">
          <strong>Estimated Biological Age</strong>
          <span style="color: #10b981;">${evalData.biologicalAge} Years</span>
        </div>
        <div class="print-meta-item">
          <strong>Projected Life Expectancy</strong>
          <span style="color: #06b6d4;">${evalData.projectedLifeExpectancy} Years</span>
        </div>
        <div class="print-meta-item">
          <strong>Projected Years Remaining</strong>
          <span>${evalData.remainingYears} Years</span>
        </div>
        <div class="print-meta-item">
          <strong>Biological Pace of Aging</strong>
          <span>${evalData.paceOfAging}x / yr</span>
        </div>
      </div>

      <div class="print-section">
        <h4>Organ & Subsystem Biological Ages</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-top: 0.5rem;">
          <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; color: #94a3b8;">Cardiovascular Age</div>
            <strong style="font-size: 1.1rem; color: #fff;">${evalData.organAges.cardiovascular} yrs</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; color: #94a3b8;">Metabolic Age</div>
            <strong style="font-size: 1.1rem; color: #fff;">${evalData.organAges.metabolic} yrs</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; color: #94a3b8;">Cellular / Immune Age</div>
            <strong style="font-size: 1.1rem; color: #fff;">${evalData.organAges.cellular} yrs</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 0.75rem; color: #94a3b8;">Cognitive / Brain Age</div>
            <strong style="font-size: 1.1rem; color: #fff;">${evalData.organAges.cognitive} yrs</strong>
          </div>
        </div>
      </div>

      <div class="print-section">
        <h4>High-Leverage Longevity Interventions Prescribed</h4>
        <ul>
          ${evalData.improvements.map(rx => `
            <li style="margin-bottom: 0.75rem;">
              <strong>${rx.title} (+${rx.lifeGain} yrs lifespan extension | ${rx.bioAgeGain}y bio-age):</strong>
              <div>${rx.description}</div>
              <div style="font-size: 0.75rem; color: #10b981;">Mechanism: ${rx.mechanism}</div>
            </li>
          `).join('')}
        </ul>
      </div>

      <div style="margin-top: 1.5rem; font-size: 0.75rem; color: #64748b; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.75rem;">
        Disclaimer: This tool calculates biological age and life expectancy using established epidemiological risk formulas (NHANES, Levine PhenoAge, Framingham Risk models). It is intended for longevity optimization and educational health tracking, not clinical diagnosis.
      </div>
    `;

    modal.style.display = 'flex';
    this.refreshIcons();
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================
  // USER PROFILE MODAL (NAME, DOB, PASSWORD)
  // ==========================================
  // ==========================================
  // USER PROFILE MODAL (NAME, DOB, PASSWORD & OTP RECOVERY)
  // ==========================================
  setupProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    const closeBtn = document.getElementById('btn-close-profile-modal');
    const cancelBtn = document.getElementById('btn-cancel-profile');
    const form = document.getElementById('form-user-profile');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeProfileModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeProfileModal());
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeProfileModal();
      });
    }


    // "Forgot password?" link -> switch to OTP recovery panel inside modal
    const forgotBtn = document.getElementById('btn-profile-forgot-pwd');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openProfileOtpRecovery();
      });
    }

    // Back / Cancel buttons in OTP recovery panel
    const otpBackBtn = document.getElementById('btn-profile-otp-back');
    const otpCancelBtn = document.getElementById('btn-cancel-profile-otp');
    [otpBackBtn, otpCancelBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.closeProfileOtpRecovery());
      }
    });

    // Resend OTP button in Profile OTP panel
    const resendOtpBtn = document.getElementById('btn-profile-resend-otp');
    if (resendOtpBtn) {
      resendOtpBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (resendOtpBtn.disabled || !this.activeUser?.email) return;
        await this.dispatchProfileOtp(true);
      });
    }

    // Profile OTP 6-Box Navigation, Input & Paste Handler (Zero letter misalignment)
    const profileOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`profile-otp-${i}`));
    const updateHiddenProfileOtp = () => {
      const code = profileOtpBoxes.map(b => (b ? b.value : '')).join('');
      const hiddenInput = document.getElementById('profile-otp-code');
      if (hiddenInput) hiddenInput.value = code;
      return code;
    };

    profileOtpBoxes.forEach((input, index) => {
      if (!input) return;
      input.addEventListener('focus', () => input.select());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            const prev = profileOtpBoxes[index - 1];
            if (prev) {
              prev.value = '';
              prev.classList.remove('has-value');
              prev.focus();
              updateHiddenProfileOtp();
            }
          }
        } else if (e.key === 'ArrowLeft' && index > 0) {
          profileOtpBoxes[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
          profileOtpBoxes[index + 1]?.focus();
        }
      });

      input.addEventListener('input', () => {
        const val = input.value.replace(/[^0-9]/g, '');
        input.value = val ? val[val.length - 1] : '';

        if (input.value) {
          input.classList.add('has-value');
          if (index < 5) {
            profileOtpBoxes[index + 1]?.focus();
          }
        } else {
          input.classList.remove('has-value');
        }
        updateHiddenProfileOtp();
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
        if (!text) return;
        const chars = text.slice(0, 6).split('');
        chars.forEach((c, i) => {
          if (profileOtpBoxes[i]) {
            profileOtpBoxes[i].value = c;
            profileOtpBoxes[i].classList.add('has-value');
          }
        });
        updateHiddenProfileOtp();
        const nextIdx = Math.min(chars.length, 5);
        profileOtpBoxes[nextIdx]?.focus();
      });
    });

    // Auto-fill preview OTP button (dev / testing helper)
    const copyOtpBtn = document.getElementById('btn-copy-profile-otp');
    if (copyOtpBtn) {
      copyOtpBtn.addEventListener('click', () => {
        const previewVal = document.getElementById('profile-otp-preview-code')?.textContent?.trim();
        if (previewVal && previewVal.length >= 6) {
          const chars = previewVal.slice(0, 6).split('');
          profileOtpBoxes.forEach((b, i) => {
            if (b && chars[i]) {
              b.value = chars[i];
              b.classList.add('has-value');
            }
          });
          updateHiddenProfileOtp();
          profileOtpBoxes[5]?.focus();
        }
      });
    }

    // Current Password Input - strip readonly on user interaction, reset if empty on blur
    const currentPassInput = document.getElementById('profile-old-password');
    if (currentPassInput) {
      currentPassInput.addEventListener('focus', () => {
        currentPassInput.removeAttribute('readonly');
      });
      currentPassInput.addEventListener('mousedown', () => {
        currentPassInput.removeAttribute('readonly');
      });
      currentPassInput.addEventListener('blur', () => {
        if (!currentPassInput.value) {
          currentPassInput.setAttribute('readonly', 'readonly');
        }
      });
    }

    // Verify OTP & Update Password Button
    const submitOtpBtn = document.getElementById('btn-submit-profile-otp');
    if (submitOtpBtn) {
      submitOtpBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleProfileOtpPasswordReset();
      });
    }

    // Profile form submission (Name, Birthdate, and Password Change with Old/New/Confirm)
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('profile-modal-error');
        const successBox = document.getElementById('profile-modal-success');
        const saveBtn = document.getElementById('btn-save-profile');
        if (errBox) errBox.style.display = 'none';
        if (successBox) successBox.style.display = 'none';

        if (!this.activeUser) {
          if (errBox) {
            errBox.textContent = 'No active session found. Please sign in.';
            errBox.style.display = 'block';
          }
          return;
        }

        const name = document.getElementById('profile-name')?.value?.trim();
        const birthdate = document.getElementById('profile-birthdate')?.value;
        const oldPassword = document.getElementById('profile-old-password')?.value || '';
        const newPassword = document.getElementById('profile-new-password')?.value || '';
        const confirmPassword = document.getElementById('profile-confirm-password')?.value || '';

        if (!name) {
          if (errBox) {
            errBox.textContent = 'Please enter your full name.';
            errBox.style.display = 'block';
          }
          return;
        }

        // Validate password change if any password field is touched
        const isPasswordChangeRequested = !!(oldPassword.trim() || newPassword.trim() || confirmPassword.trim());
        if (isPasswordChangeRequested) {
          if (!oldPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'Please enter your current password to authorize changing your password.';
              errBox.style.display = 'block';
            }
            const oldInp = document.getElementById('profile-old-password');
            if (oldInp) {
              oldInp.removeAttribute('readonly');
              oldInp.focus();
            }
            return;
          }

          if (!newPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'Please enter a new password.';
              errBox.style.display = 'block';
            }
            document.getElementById('profile-new-password')?.focus();
            return;
          }

          if (newPassword.trim().length < 6) {
            if (errBox) {
              errBox.textContent = 'New password must be at least 6 characters.';
              errBox.style.display = 'block';
            }
            document.getElementById('profile-new-password')?.focus();
            return;
          }

          if (newPassword.trim() === oldPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'New password cannot be the same as your current password.';
              errBox.style.display = 'block';
            }
            document.getElementById('profile-new-password')?.focus();
            return;
          }

          if (!confirmPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'Please confirm your new password.';
              errBox.style.display = 'block';
            }
            document.getElementById('profile-confirm-password')?.focus();
            return;
          }

          if (newPassword.trim() !== confirmPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'New password and confirm password do not match.';
              errBox.style.display = 'block';
            }
            document.getElementById('profile-confirm-password')?.focus();
            return;
          }

          // Client-side verification against session user if cached
          if (this.activeUser && this.activeUser.password && this.activeUser.password !== oldPassword.trim()) {
            if (errBox) {
              errBox.textContent = 'The current password you entered is incorrect. Please re-enter your current password.';
              errBox.style.display = 'block';
            }
            const oldInp = document.getElementById('profile-old-password');
            if (oldInp) {
              oldInp.removeAttribute('readonly');
              oldInp.value = '';
              oldInp.focus();
            }
            return;
          }
        }

        const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<span>Saving to database...</span>';
        }

        try {
          const updated = await auth.updateUserProfile(this.activeUser.id, {
            name,
            birthdate,
            oldPassword: isPasswordChangeRequested ? oldPassword.trim() : undefined,
            newPassword: isPasswordChangeRequested ? newPassword.trim() : undefined,
            confirmPassword: isPasswordChangeRequested ? confirmPassword.trim() : undefined
          });

          this.activeUser = updated;

          // Clear password inputs on successful update
          if (document.getElementById('profile-old-password')) document.getElementById('profile-old-password').value = '';
          if (document.getElementById('profile-new-password')) document.getElementById('profile-new-password').value = '';
          if (document.getElementById('profile-confirm-password')) document.getElementById('profile-confirm-password').value = '';

          // Update active assessment vitals if birthdate changed
          if (birthdate) {
            const newAge = auth.calculateAgeFromBirthdate(birthdate);
            if (this.assessmentData) {
              this.assessmentData.chronologicalAge = newAge;
            }
            if (this.currentEvaluation) {
              this.currentEvaluation.chronologicalAge = newAge;
              this.currentEvaluation.ageDifference = +(this.currentEvaluation.biologicalAge - newAge).toFixed(1);
            }
          }

          // Update header and dashboard displays
          this.renderActiveUserSession();
          this.refreshIcons();

          if (successBox) {
            successBox.textContent = isPasswordChangeRequested
              ? 'Profile and password successfully updated in database!'
              : 'Profile successfully updated in database!';
            successBox.style.display = 'block';
          }
          this.showToast('Profile updated in database successfully!');

          setTimeout(() => {
            this.closeProfileModal();
            this.calculateAndRenderDashboard();
          }, 900);
        } catch (err) {
          if (errBox) {
            errBox.textContent = err.message || 'Failed to update profile. Please try again.';
            errBox.style.display = 'block';
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnHtml;
            this.refreshIcons();
          }
        }
      });
    }
  }

  openProfileOtpRecovery() {
    if (!this.activeUser || !this.activeUser.email) {
      const errBox = document.getElementById('profile-modal-error');
      if (errBox) {
        errBox.textContent = 'Please log in to use password recovery.';
        errBox.style.display = 'block';
      }
      return;
    }

    // Switch panels
    const mainPanel = document.getElementById('profile-main-panel');
    const otpPanel = document.getElementById('profile-otp-panel');
    const mainFooter = document.getElementById('profile-main-footer');
    const otpFooter = document.getElementById('profile-otp-footer');

    if (mainPanel) mainPanel.style.display = 'none';
    if (otpPanel) otpPanel.style.display = 'block';
    if (mainFooter) mainFooter.style.display = 'none';
    if (otpFooter) otpFooter.style.display = 'flex';

    // Populate target email display
    const targetEmail = document.getElementById('profile-otp-target-email');
    if (targetEmail) targetEmail.textContent = this.activeUser.email;

    // Reset OTP 6-box fields, hidden input & password inputs
    const profileOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`profile-otp-${i}`));
    profileOtpBoxes.forEach(b => {
      if (b) {
        b.value = '';
        b.classList.remove('has-value', 'is-invalid');
      }
    });
    const otpInput = document.getElementById('profile-otp-code');
    const newPassInput = document.getElementById('profile-otp-new-password');
    const confirmPassInput = document.getElementById('profile-otp-confirm-password');
    if (otpInput) otpInput.value = '';
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';

    const errBox = document.getElementById('profile-otp-error');
    const successBox = document.getElementById('profile-otp-success');
    if (errBox) errBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';

    this.refreshIcons();

    // Automatically send 6-digit OTP code to registered email
    this.dispatchProfileOtp(false);
  }

  closeProfileOtpRecovery() {
    if (this._profileOtpTimerInterval) {
      clearInterval(this._profileOtpTimerInterval);
    }
    const mainPanel = document.getElementById('profile-main-panel');
    const otpPanel = document.getElementById('profile-otp-panel');
    const mainFooter = document.getElementById('profile-main-footer');
    const otpFooter = document.getElementById('profile-otp-footer');

    if (otpPanel) otpPanel.style.display = 'none';
    if (mainPanel) mainPanel.style.display = 'block';
    if (otpFooter) otpFooter.style.display = 'none';
    if (mainFooter) mainFooter.style.display = 'flex';

    this.refreshIcons();
  }

  startProfileOtpTimer(seconds = 60) {
    if (this._profileOtpTimerInterval) {
      clearInterval(this._profileOtpTimerInterval);
    }
    let remaining = seconds;
    const resendBtn = document.getElementById('btn-profile-resend-otp');

    const updateTimer = () => {
      if (remaining > 0) {
        if (resendBtn) {
          resendBtn.disabled = true;
          resendBtn.innerHTML = `<span>Resend OTP in </span><span id="profile-resend-seconds">${remaining}</span>s`;
        }
      } else {
        clearInterval(this._profileOtpTimerInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.innerHTML = `<i data-lucide="rotate-cw"></i> <span>Resend OTP</span>`;
          this.refreshIcons();
        }
      }
    };

    updateTimer();
    this._profileOtpTimerInterval = setInterval(() => {
      remaining--;
      updateTimer();
    }, 1000);
  }

  async dispatchProfileOtp(isResend = false) {
    const errBox = document.getElementById('profile-otp-error');
    const successBox = document.getElementById('profile-otp-success');
    const resendBtn = document.getElementById('btn-profile-resend-otp');
    const previewBox = document.getElementById('profile-otp-preview-alert');
    const previewVal = document.getElementById('profile-otp-preview-code');

    if (errBox) errBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';

    if (isResend && resendBtn) {
      resendBtn.disabled = true;
      resendBtn.innerHTML = `<span class="btn-spinner"></span> <span>Sending...</span>`;
    }

    try {
      const email = this.activeUser.email.trim().toLowerCase();
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errBox) {
          errBox.textContent = data.error || 'Failed to dispatch verification OTP.';
          errBox.style.display = 'block';
        }
        if (isResend && resendBtn) resendBtn.disabled = false;
        return;
      }

      // Show preview code if provided (e.g. dev/local test mode)
      if (data.previewOtp && previewBox && previewVal) {
        previewVal.textContent = data.previewOtp;
        previewBox.style.display = 'flex';
      } else if (previewBox) {
        previewBox.style.display = 'none';
      }

      if (isResend && successBox) {
        successBox.textContent = 'A new 6-digit verification code has been dispatched to your email.';
        successBox.style.display = 'block';
      }

      // Start 60-second countdown timer
      this.startProfileOtpTimer(data.cooldownSeconds || 60);
      setTimeout(() => {
        const firstBox = document.getElementById('profile-otp-1');
        if (firstBox) firstBox.focus();
      }, 150);

    } catch (err) {
      if (errBox) {
        errBox.textContent = 'Network error requesting OTP. Please check your connection.';
        errBox.style.display = 'block';
      }
      if (isResend && resendBtn) resendBtn.disabled = false;
    }
  }

  async handleProfileOtpPasswordReset() {
    const errBox = document.getElementById('profile-otp-error');
    const successBox = document.getElementById('profile-otp-success');
    const submitBtn = document.getElementById('btn-submit-profile-otp');
    const profileOtpBoxes = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`profile-otp-${i}`));
    const newPassInput = document.getElementById('profile-otp-new-password');
    const confirmPassInput = document.getElementById('profile-otp-confirm-password');

    if (errBox) errBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';

    // Collect OTP from the 6 individual digit boxes (or hidden input fallback)
    let otp = profileOtpBoxes.map(b => (b ? b.value.trim() : '')).join('');
    if (!otp) {
      otp = document.getElementById('profile-otp-code')?.value?.trim() || '';
    }
    const newPassword = newPassInput ? newPassInput.value : '';
    const confirmPassword = confirmPassInput ? confirmPassInput.value : '';

    if (!otp || otp.length !== 6) {
      if (errBox) {
        errBox.textContent = 'Please enter the complete 6-digit verification code.';
        errBox.style.display = 'block';
      }
      profileOtpBoxes.forEach(b => b?.classList.add('is-invalid'));
      setTimeout(() => profileOtpBoxes.forEach(b => b?.classList.remove('is-invalid')), 600);
      const emptyBox = profileOtpBoxes.find(b => !b?.value);
      (emptyBox || profileOtpBoxes[0])?.focus();
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      if (errBox) {
        errBox.textContent = 'New password must be at least 6 characters.';
        errBox.style.display = 'block';
      }
      if (newPassInput) newPassInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      if (errBox) {
        errBox.textContent = 'New password and confirmation password do not match.';
        errBox.style.display = 'block';
      }
      if (confirmPassInput) confirmPassInput.focus();
      return;
    }

    const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="btn-spinner"></span> <span>Verifying OTP & Updating...</span>`;
    }

    try {
      const email = this.activeUser.email.trim().toLowerCase();
      const res = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errBox) {
          errBox.textContent = data.error || 'Invalid OTP or unable to update password.';
          errBox.style.display = 'block';
        }
        return;
      }

      // Password successfully updated in database!
      if (this._profileOtpTimerInterval) clearInterval(this._profileOtpTimerInterval);

      // Update active user in session and local store
      if (this.activeUser) {
        this.activeUser.password = newPassword;
        localStorage.setItem('bioage_active_session', JSON.stringify(this.activeUser));
        try {
          const storedUsers = JSON.parse(localStorage.getItem('bioage_users') || '[]');
          const idx = storedUsers.findIndex(u => u.email && u.email.toLowerCase() === email);
          if (idx !== -1) {
            storedUsers[idx].password = newPassword;
            localStorage.setItem('bioage_users', JSON.stringify(storedUsers));
          }
        } catch (e) {}
      }

      if (successBox) {
        successBox.textContent = 'Password successfully reset in database! Your new password is now active.';
        successBox.style.display = 'block';
      }
      this.showToast('Password updated in database successfully!');

      setTimeout(() => {
        this.closeProfileOtpRecovery();
        this.closeProfileModal();
      }, 1400);

    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message || 'Server error updating password.';
        errBox.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
        this.refreshIcons();
      }
    }
  }

  openProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;

    if (!this.activeUser) {
      this.showToast('Please sign in to access your profile.');
      this.switchView('auth-view');
      return;
    }

    // Reset view to main panel and main footer
    const mainPanel = document.getElementById('profile-main-panel');
    const otpPanel = document.getElementById('profile-otp-panel');
    const mainFooter = document.getElementById('profile-main-footer');
    const otpFooter = document.getElementById('profile-otp-footer');

    if (mainPanel) mainPanel.style.display = 'block';
    if (otpPanel) otpPanel.style.display = 'none';
    if (mainFooter) mainFooter.style.display = 'flex';
    if (otpFooter) otpFooter.style.display = 'none';

    if (this._profileOtpTimerInterval) {
      clearInterval(this._profileOtpTimerInterval);
    }

    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const birthdateInput = document.getElementById('profile-birthdate');
    const oldPassInput = document.getElementById('profile-old-password');
    const newPassInput = document.getElementById('profile-new-password');
    const confirmPassInput = document.getElementById('profile-confirm-password');
    const cardName = document.getElementById('profile-card-name');
    const cardEmail = document.getElementById('profile-card-email');
    const avatarLetters = document.getElementById('profile-avatar-letters');
    const errBox = document.getElementById('profile-modal-error');
    const successBox = document.getElementById('profile-modal-success');

    if (errBox) errBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';
    
    // Clear and reset all password inputs to masked password mode with readonly protection
    const allProfilePassInputs = [
      document.getElementById('profile-old-password'),
      document.getElementById('profile-new-password'),
      document.getElementById('profile-confirm-password'),
      document.getElementById('profile-otp-new-password'),
      document.getElementById('profile-otp-confirm-password')
    ];
    allProfilePassInputs.forEach(inp => {
      if (inp) {
        inp.value = '';
        inp.type = 'password';
        inp.setAttribute('type', 'password');
        if (inp.id === 'profile-old-password') {
          inp.setAttribute('readonly', 'readonly');
        }
        const toggleBtn = modal.querySelector(`.btn-toggle-pass[data-target="${inp.id}"]`);
        if (toggleBtn) {
          toggleBtn.innerHTML = '<i data-lucide="eye"></i>';
        }
      }
    });

    // Clear 6-digit OTP boxes
    [1, 2, 3, 4, 5, 6].forEach(i => {
      const b = document.getElementById(`profile-otp-${i}`);
      if (b) {
        b.value = '';
        b.classList.remove('has-value', 'is-invalid');
      }
    });

    const name = this.activeUser.name || 'User';
    const email = this.activeUser.email || '';
    const birthdate = this.activeUser.birthdate || '';

    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = email;
    if (birthdateInput) {
      if (birthdate && birthdate.includes('T')) {
        birthdateInput.value = birthdate.split('T')[0];
      } else {
        birthdateInput.value = birthdate || '1994-06-15';
      }
    }

    if (cardName) cardName.textContent = name;
    if (cardEmail) cardEmail.textContent = email;
    if (avatarLetters) {
      const parts = name.trim().split(/\s+/);
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
      avatarLetters.textContent = initials || 'U';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.refreshIcons();

    // Prevent browser password autofill engines from automatically injecting stored credentials
    const purgeAutofill = () => {
      if (oldPassInput && document.activeElement !== oldPassInput) {
        oldPassInput.value = '';
        oldPassInput.setAttribute('readonly', 'readonly');
      }
      if (newPassInput && document.activeElement !== newPassInput) {
        newPassInput.value = '';
      }
      if (confirmPassInput && document.activeElement !== confirmPassInput) {
        confirmPassInput.value = '';
      }
    };

    purgeAutofill();
    setTimeout(purgeAutofill, 50);
    setTimeout(purgeAutofill, 150);
    setTimeout(purgeAutofill, 300);
    setTimeout(purgeAutofill, 600);
  }

  closeProfileModal() {
    if (this._profileOtpTimerInterval) {
      clearInterval(this._profileOtpTimerInterval);
    }
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
      modal.style.display = 'none';
      ['profile-old-password', 'profile-new-password', 'profile-confirm-password'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) {
          inp.value = '';
          inp.type = 'password';
          inp.setAttribute('type', 'password');
          if (id === 'profile-old-password') inp.setAttribute('readonly', 'readonly');
          const toggleBtn = modal.querySelector(`.btn-toggle-pass[data-target="${id}"]`);
          if (toggleBtn) toggleBtn.innerHTML = '<i data-lucide="eye"></i>';
        }
      });
      [1, 2, 3, 4, 5, 6].forEach(i => {
        const b = document.getElementById(`profile-otp-${i}`);
        if (b) {
          b.value = '';
          b.classList.remove('has-value', 'is-invalid');
        }
      });
      const hiddenOtp = document.getElementById('profile-otp-code');
      if (hiddenOtp) hiddenOtp.value = '';
    }
    document.body.style.overflow = '';
  }

  // ==========================================
  // GEMINI AI LONGEVITY CLINICAL INTEGRATION
  // ==========================================
  setupGeminiUI() {
    // Header Biopro Bot Button & Modal
    const btnHeaderBiopro = document.getElementById('btn-header-biopro');
    const bioproModal = document.getElementById('biopro-bot-modal');
    const btnCloseBioproModal = document.getElementById('btn-close-biopro-modal');
    const bioproChatStream = document.getElementById('biopro-chat-stream');
    const bioproModalInput = document.getElementById('biopro-modal-input');
    const btnSendBioproModal = document.getElementById('btn-send-biopro-modal');

    const openBioproModal = () => {
      if (bioproModal) {
        bioproModal.style.display = 'flex';
        this.refreshIcons();
        if (bioproModalInput) bioproModalInput.focus();
      }
    };

    const closeBioproModal = () => {
      if (bioproModal) bioproModal.style.display = 'none';
    };

    if (btnHeaderBiopro) btnHeaderBiopro.addEventListener('click', openBioproModal);
    if (btnCloseBioproModal) btnCloseBioproModal.addEventListener('click', closeBioproModal);
    if (bioproModal) {
      bioproModal.addEventListener('click', (e) => {
        if (e.target === bioproModal) closeBioproModal();
      });
    }

    const sendBioproModalMessage = async (customText) => {
      const q = (customText || (bioproModalInput ? bioproModalInput.value : '')).trim();
      if (!q || !bioproChatStream) return;

      if (bioproModalInput) bioproModalInput.value = '';

      // Append User Bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble user';
      userBubble.textContent = q;
      bioproChatStream.appendChild(userBubble);

      // Append Loading Bot Bubble
      const botBubble = document.createElement('div');
      botBubble.className = 'chat-bubble bot';
      botBubble.innerHTML = '<strong>Biopro Bot</strong><div class="ai-loading-pulse"><div class="ai-spinner"></div><span>Analyzing physiological markers...</span></div>';
      bioproChatStream.appendChild(botBubble);
      bioproChatStream.scrollTop = bioproChatStream.scrollHeight;

      try {
        const answer = await geminiService.askConsultant(q, this.assessmentData, this.currentEvaluation);
        botBubble.innerHTML = '<strong>Biopro Bot</strong><p style="margin-top: 0.35rem;">' + answer.replace(/\n/g, '<br>') + '</p>';
      } catch (err) {
        botBubble.innerHTML = '<strong>Biopro Bot</strong><span style="color: #e11d48;">Error: ' + err.message + '</span>';
      }
      bioproChatStream.scrollTop = bioproChatStream.scrollHeight;
      this.refreshIcons();
    };

    if (btnSendBioproModal) {
      btnSendBioproModal.addEventListener('click', () => sendBioproModalMessage());
    }

    if (bioproModalInput) {
      bioproModalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendBioproModalMessage();
        }
      });
    }

    document.querySelectorAll('.biopro-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-q');
        sendBioproModalMessage(q);
      });
    });

    // Gemini Card Re-Analyze Button

    const btnReRun = document.getElementById('btn-re-run-gemini');
    if (btnReRun) {
      btnReRun.addEventListener('click', () => {
        this.runGeminiAnalysis(true);
      });
    }

    // Status Pill & Settings Modal
    const statusPill = document.getElementById('gemini-status-pill');
    const keyModal = document.getElementById('gemini-key-modal');
    const btnOpenSettings = document.getElementById('btn-open-gemini-settings');
    const btnCloseKey = document.getElementById('btn-close-key-modal');
    const btnCancelKey = document.getElementById('btn-cancel-key');
    const btnSaveKey = document.getElementById('btn-save-key');
    const inputKey = document.getElementById('input-gemini-key');

    const openKeyModal = () => {
      if (inputKey) inputKey.value = geminiService.apiKey;
      if (keyModal) keyModal.style.display = 'flex';
    };

    const closeKeyModal = () => {
      if (keyModal) keyModal.style.display = 'none';
    };

    if (statusPill) statusPill.addEventListener('click', openKeyModal);
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', openKeyModal);
    if (btnCloseKey) btnCloseKey.addEventListener('click', closeKeyModal);
    if (btnCancelKey) btnCancelKey.addEventListener('click', closeKeyModal);

    if (btnSaveKey && inputKey) {
      btnSaveKey.addEventListener('click', () => {
        const newKey = inputKey.value.trim();
        if (newKey) {
          geminiService.setApiKey(newKey);
          this.showToast('Gemini API key updated successfully!');
          closeKeyModal();
        }
      });
    }

    // Interactive Dr. Gemini Consultant Chat
    const btnAsk = document.getElementById('btn-ask-gemini');
    const chatInput = document.getElementById('gemini-consultant-input');
    const chatAnswerBox = document.getElementById('gemini-consultant-answer');

    const handleAskConsultant = async (question) => {
      const q = (question || (chatInput ? chatInput.value : '')).trim();
      if (!q) return;

      if (chatInput) chatInput.value = q;
      chatAnswerBox.style.display = 'block';
      chatAnswerBox.innerHTML = '<div class="ai-loading-pulse"><div class="ai-spinner"></div><span>Dr. Gemini is analyzing your question...</span></div>';

      try {
        const answer = await geminiService.askConsultant(q, this.assessmentData, this.currentEvaluation);
        chatAnswerBox.innerHTML = '<strong>Dr. Gemini (Longevity AI):</strong><p style="margin-top: 0.4rem;">' + answer.replace(/\n/g, '<br>') + '</p>';
      } catch (err) {
        chatAnswerBox.innerHTML = '<span style="color: #e11d48;">Consultation Error: ' + err.message + '</span>';
      }
    };

    if (btnAsk) {
      btnAsk.addEventListener('click', () => handleAskConsultant());
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAskConsultant();
        }
      });
    }

    document.querySelectorAll('.consultant-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-q');
        handleAskConsultant(q);
      });
    });
  }

  async runGeminiAnalysis(autoScroll = false) {
    const card = document.getElementById('gemini-ai-card');
    const summaryText = document.getElementById('gemini-summary-text');
    const risksBox = document.getElementById('gemini-risks-box');
    const risksList = document.getElementById('gemini-risks-list');

    if (!card || !summaryText) return;

    card.style.display = 'block';
    if (autoScroll) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    summaryText.innerHTML = '<div class="ai-loading-pulse"><div class="ai-spinner"></div><span>Google Gemini 3.5 Flash Lite is synthesizing clinical biological age analysis...</span></div>';
    if (risksBox) risksBox.style.display = 'none';

    try {
      const aiResult = await geminiService.analyzeLongevity(this.assessmentData);

      // Overwrite currentEvaluation with Gemini's high-precision clinical figures
      if (aiResult.biologicalAge) {
        this.currentEvaluation.biologicalAge = Number(aiResult.biologicalAge);
        this.currentEvaluation.ageDifference = +(this.currentEvaluation.biologicalAge - this.currentEvaluation.chronologicalAge).toFixed(1);
      }
      if (aiResult.projectedLifeExpectancy) {
        this.currentEvaluation.projectedLifeExpectancy = Number(aiResult.projectedLifeExpectancy);
        this.currentEvaluation.remainingYears = +(this.currentEvaluation.projectedLifeExpectancy - this.currentEvaluation.chronologicalAge).toFixed(1);
        this.currentEvaluation.lifeYearsDelta = +(this.currentEvaluation.projectedLifeExpectancy - this.currentEvaluation.baselineExpectancy).toFixed(1);
      }
      if (aiResult.paceOfAging) {
        this.currentEvaluation.paceOfAging = Number(aiResult.paceOfAging);
        this.currentEvaluation.paceCategory = aiResult.paceCategory || (this.currentEvaluation.paceOfAging < 0.95 ? 'Decelerated (Slow)' : 'Accelerated');
      }
      if (aiResult.organAges) {
        this.currentEvaluation.organAges = aiResult.organAges;
      }
      if (aiResult.domainScores) {
        this.currentEvaluation.domainScores = aiResult.domainScores;
      }
      if (aiResult.aiTopInterventions && aiResult.aiTopInterventions.length > 0) {
        this.currentEvaluation.improvements = aiResult.aiTopInterventions.map(item => ({
          id: 'gemini_' + Math.random().toString(36).substr(2, 6),
          title: item.title,
          category: item.category || 'Clinical Optimization',
          priority: item.priority || 'HIGH',
          difficulty: item.difficulty || 'Medium',
          lifeGain: item.lifeGainYears || 2.5,
          bioAgeGain: -(item.bioAgeReductionYears || 1.5),
          description: item.description,
          mechanism: item.mechanism
        }));
      }

      // Render Gemini Clinical Narrative
      summaryText.innerHTML = '<strong>Clinical Summary:</strong> ' + aiResult.aiClinicalSummary;

      // Render Gemini Risks
      if (aiResult.aiLongevityRisks && aiResult.aiLongevityRisks.length > 0 && risksBox && risksList) {
        risksList.innerHTML = aiResult.aiLongevityRisks.map(r => '<li>' + r + '</li>').join('');
        risksBox.style.display = 'block';
      }

      // Refresh Dashboard components with updated AI metrics
      const heroMount = document.getElementById('longevity-hero-container');
      if (heroMount) heroMount.innerHTML = dashboardView.renderLongevityHero(this.currentEvaluation);

      const gaugeMount = document.getElementById('gauge-mount-point');
      if (gaugeMount) gaugeMount.innerHTML = dashboardView.renderGauge(this.currentEvaluation);

      const organMount = document.getElementById('organ-cards-container');
      if (organMount) organMount.innerHTML = dashboardView.renderOrganCards(this.currentEvaluation.organAges, this.currentEvaluation.chronologicalAge);

      const rxMount = document.getElementById('prescriptions-mount-point');
      if (rxMount) rxMount.innerHTML = dashboardView.renderPrescriptions(this.currentEvaluation.improvements);

      const headerBioVal = document.getElementById('header-bio-val');
      if (headerBioVal) headerBioVal.textContent = this.currentEvaluation.biologicalAge + ' yrs';

      this.refreshRadarChart();
      this.refreshIcons();

      // Save updated assessment in history
      if (this.activeUser) {
        auth.saveAssessmentResult(this.activeUser.id, this.currentEvaluation);
      }

      this.showToast('✨ Gemini AI Clinical Assessment synthesized successfully!');
    } catch (err) {
      console.error('Gemini error:', err);
      summaryText.innerHTML = '<div style="color: #e11d48;"><strong>Gemini AI Error:</strong> ' + err.message + '<br><small style="color: #64748b;">Falling back to baseline geroscience algorithm.</small></div>';
      this.showToast('Gemini API call failed: ' + err.message, 'error');
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.bioAgeApp = new BioAgeApp();
});
