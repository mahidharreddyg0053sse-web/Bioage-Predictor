/**
 * BioAge Pro — Full-Stack Authentication & Session Controller
 * Connects Frontend UI with Node.js Express REST Backend & Database
 * Provides synchronous session management and persistent cloud/local storage.
 */

import { DEMO_USERS } from './data.js';

const SESSION_KEY = 'bioage_active_session';
const USERS_KEY = 'bioage_registered_users';
const HISTORY_PREFIX = 'bioage_history_';
const USER_DATA_PREFIX = 'bioage_user_data_';
const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : '';

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function calculateAgeFromBirthdate(birthdate) {
  if (!birthdate) return 32;
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return 32;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : 32;
}

export function getCurrentSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function loginWithDemo(demoId) {
  const targetId = demoId || 'demo-average';
  const found = DEMO_USERS.find(u => u.id === targetId) || DEMO_USERS[1] || DEMO_USERS[0];
  const user = {
    id: found.id,
    name: found.name,
    email: found.email,
    birthdate: found.birthdate,
    gender: found.gender,
    data: { ...(found.data || {}) }
  };

  // If user previously updated their data locally, restore that
  const customData = getUserData(user.id);
  if (customData) {
    user.data = { ...user.data, ...customData };
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  getAssessmentHistory(user.id); // Ensure seed history initialized

  // Background sync with backend
  try {
    fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: found.password || 'password123' })
    }).catch(() => {});
  } catch (e) {}

  return user;
}

export function getUserData(userId) {
  if (!userId) return null;
  try {
    const saved = localStorage.getItem(USER_DATA_PREFIX + userId);
    if (saved) return JSON.parse(saved);
  } catch (e) {}

  const current = getCurrentSession();
  if (current && current.id === userId && current.data) {
    return current.data;
  }

  const demo = DEMO_USERS.find(u => u.id === userId);
  if (demo && demo.data) {
    return demo.data;
  }

  return null;
}

export function updateUserData(userId, assessmentData) {
  if (!userId || !assessmentData) return;
  try {
    localStorage.setItem(USER_DATA_PREFIX + userId, JSON.stringify(assessmentData));
    const current = getCurrentSession();
    if (current && current.id === userId) {
      current.data = { ...(current.data || {}), ...assessmentData };
      localStorage.setItem(SESSION_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.warn('Failed saving user data locally', e);
  }

  // Push to backend REST API
  try {
    fetch(`${BACKEND_URL}/api/auth/user/${userId}/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessmentData)
    }).catch(() => {});
  } catch (e) {}
}

export function saveAssessmentResult(userId, currentEvaluation) {
  if (!userId || !currentEvaluation) return null;
  const history = getAssessmentHistory(userId);
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const record = {
    id: 'eval_' + Date.now(),
    userId: userId,
    formattedDate: formattedDate,
    timestamp: now.toISOString(),
    chronologicalAge: Number(currentEvaluation.chronologicalAge) || 35,
    biologicalAge: Number(currentEvaluation.biologicalAge) || 35,
    projectedLifeExpectancy: Number(currentEvaluation.projectedLifeExpectancy) || 80,
    paceOfAging: Number(currentEvaluation.paceOfAging) || 1.0,
    organAges: currentEvaluation.organAges || {},
    domainScores: currentEvaluation.domainScores || {},
    improvements: currentEvaluation.improvements || []
  };

  history.unshift(record);
  if (history.length > 50) history.pop();

  try {
    localStorage.setItem(HISTORY_PREFIX + userId, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed saving history locally', e);
  }

  // Sync with backend API
  try {
    fetch(`${BACKEND_URL}/api/bioage/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {});
  } catch (e) {}

  return record;
}

export function getAssessmentHistory(userId) {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // Provide realistic initial history for demo accounts
  const demo = DEMO_USERS.find(u => u.id === userId);
  if (demo) {
    const age = demo.data.chronologicalAge || 35;
    let bioAge = age;
    let pace = 1.0;
    let lifespan = 80;

    if (userId === 'demo-optimal') {
      bioAge = 29.8;
      pace = 0.78;
      lifespan = 91.5;
    } else if (userId === 'demo-average') {
      bioAge = 36.2;
      pace = 1.06;
      lifespan = 78.4;
    } else if (userId === 'demo-high-risk') {
      bioAge = 54.8;
      pace = 1.35;
      lifespan = 69.2;
    }

    const seed = [
      {
        id: 'eval_seed_' + userId,
        userId: userId,
        formattedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        timestamp: new Date().toISOString(),
        chronologicalAge: age,
        biologicalAge: bioAge,
        projectedLifeExpectancy: lifespan,
        paceOfAging: pace
      }
    ];

    try {
      localStorage.setItem(HISTORY_PREFIX + userId, JSON.stringify(seed));
    } catch (e) {}

    return seed;
  }

  return [];
}

export async function login(email, password, remember = false) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  // 1. Primary: Validate against Supabase Database via Backend REST API
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Backend returns:
      // 404 -> "Email not found, create account."
      // 401 -> "The email and password are not correct."
      throw new Error(data.error || 'The email and password are not correct.');
    }

    if (data.success && data.user) {
      const user = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        birthdate: data.user.birthdate,
        gender: data.user.gender,
        data: data.user.data || {}
      };

      const customData = getUserData(user.id);
      if (customData) {
        user.data = { ...user.data, ...customData };
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      getAssessmentHistory(user.id);

      // Cache locally
      const storedUsers = getStoredUsers();
      if (!storedUsers.some(u => u.id === user.id)) {
        storedUsers.push({ ...user, password });
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));
        } catch (e) {}
      }

      return user;
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }

    // Local fallback when backend offline
    const demo = DEMO_USERS.find(u => u.email.toLowerCase() === cleanEmail);
    const stored = getStoredUsers().find(u => u.email.toLowerCase() === cleanEmail);
    const target = demo || stored;

    if (!target) {
      throw new Error('Email not found, create account.');
    }

    if (target.password !== password && (demo && password !== 'password123')) {
      throw new Error('The email and password are not correct.');
    }

    const offlineUser = {
      id: target.id,
      name: target.name,
      email: target.email,
      birthdate: target.birthdate,
      gender: target.gender,
      data: target.data || {}
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(offlineUser));
    return offlineUser;
  }

  throw new Error('Email not found, create account.');
}

export async function register(userData) {
  const { name, email, birthdate, gender, password } = userData;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!name || !cleanEmail || !password) {
    throw new Error('Please fill out all required fields.');
  }

  // 1. Primary: Save new user and credentials directly into Supabase
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: cleanEmail,
        password,
        birthdate: birthdate || '1992-01-01',
        gender: gender || 'male'
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed. Please try again.');
    }

    if (data.success && data.user) {
      const sessionUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        birthdate: data.user.birthdate,
        gender: data.user.gender,
        data: data.user.data || {
          chronologicalAge: calculateAgeFromBirthdate(birthdate),
          gender: gender || 'male'
        }
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      localStorage.setItem(USER_DATA_PREFIX + sessionUser.id, JSON.stringify(sessionUser.data));

      const storedUsers = getStoredUsers();
      if (!storedUsers.some(u => u.id === sessionUser.id)) {
        storedUsers.push({ ...sessionUser, password });
        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));
        } catch (e) {}
      }

      return sessionUser;
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }

    // Local fallback if backend network down
    const storedUsers = getStoredUsers();
    if (storedUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Email already exists, please sign in.');
    }

    const userAge = calculateAgeFromBirthdate(birthdate);
    const localUser = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      password: password,
      birthdate: birthdate || '1992-01-01',
      gender: gender || 'male',
      data: { chronologicalAge: userAge, gender: gender || 'male' }
    };
    storedUsers.push(localUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));
    localStorage.setItem(SESSION_KEY, JSON.stringify(localUser));
    return localUser;
  }

  throw new Error('Unable to complete registration. Please try again.');
}

export async function updateUserProfile(userId, profileData) {
  const { name, password, oldPassword, newPassword, confirmPassword, birthdate } = profileData;
  if (!userId) throw new Error('User session ID is missing.');
  if (!name || !name.trim()) throw new Error('Full Name cannot be empty.');

  let updatedUser = null;
  const effectiveNewPassword = (newPassword && newPassword.trim()) || (password && password.trim()) || undefined;

  // 1. Primary: Update user record and credentials in database via Backend REST API
  try {
    const payload = { name: name.trim() };
    if (oldPassword && oldPassword.trim()) payload.oldPassword = oldPassword.trim();
    if (effectiveNewPassword) payload.newPassword = effectiveNewPassword;
    if (confirmPassword && confirmPassword.trim()) payload.confirmPassword = confirmPassword.trim();
    if (birthdate) payload.birthdate = birthdate;

    const res = await fetch(`${BACKEND_URL}/api/auth/user/${userId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile in database.');
    }

    if (data.success && data.user) {
      updatedUser = data.user;
    }
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    console.warn('Backend server offline, updating session locally:', err.message);

    // Enforce current password validation in offline / fallback mode
    const current = getCurrentSession();
    const storedUsers = getStoredUsers();
    const cachedUser = (current && current.id === userId ? current : null) || storedUsers.find(u => u.id === userId);
    
    if (effectiveNewPassword) {
      if (!oldPassword || !oldPassword.trim()) {
        throw new Error('Please enter your current password to authorize changing your password.');
      }
      if (cachedUser && cachedUser.password && cachedUser.password !== oldPassword.trim()) {
        throw new Error('The current password you entered is incorrect.');
      }
      if (effectiveNewPassword === oldPassword.trim()) {
        throw new Error('New password cannot be the same as your current password.');
      }
    }
  }

  // 2. Synchronize active local session
  const current = getCurrentSession();
  const sessionUser = {
    ...(current || {}),
    ...(updatedUser || {}),
    id: userId,
    name: name.trim(),
    birthdate: birthdate || (current ? current.birthdate : undefined)
  };
  if (effectiveNewPassword) {
    sessionUser.password = effectiveNewPassword;
  }

  if (birthdate) {
    const newAge = calculateAgeFromBirthdate(birthdate);
    if (!sessionUser.data) sessionUser.data = {};
    sessionUser.data.chronologicalAge = newAge;
    try {
      localStorage.setItem(USER_DATA_PREFIX + userId, JSON.stringify(sessionUser.data));
    } catch (e) {}
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  } catch (e) {}

  // 3. Update cached stored users
  const storedUsers = getStoredUsers();
  const foundIdx = storedUsers.findIndex(u => u.id === userId);
  if (foundIdx >= 0) {
    storedUsers[foundIdx].name = name.trim();
    if (effectiveNewPassword) storedUsers[foundIdx].password = effectiveNewPassword;
    if (birthdate) storedUsers[foundIdx].birthdate = birthdate;
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));
    } catch (e) {}
  }

  return sessionUser;
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

export const auth = {
  getCurrentSession,
  loginWithDemo,
  getUserData,
  updateUserData,
  saveAssessmentResult,
  getAssessmentHistory,
  calculateAgeFromBirthdate,
  updateUserProfile,
  login,
  register,
  logout
};

export default auth;

if (typeof window !== 'undefined') {
  window.auth = auth;
  window.BioAgeAuth = auth;
}
