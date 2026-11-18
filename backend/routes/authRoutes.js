const express = require('express');
const router = express.Router();
const db = require('../database/db');
const emailService = require('../services/emailService');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);

    // 1. If email not detected in database
    if (!user) {
      return res.status(404).json({ error: 'Email not found, create account.' });
    }

    // 2. If password does not match
    if (user.password !== password) {
      return res.status(401).json({ error: 'The email and password are not correct.' });
    }

    // 3. Successful login
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        gender: user.gender,
        data: user.data
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
// POST /api/auth/register/send-otp (Pre-registration check & OTP dispatch)
router.post('/register/send-otp', async (req, res) => {
  try {
    const { name, email, password, birthdate, gender } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are mandatory.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists, please sign in.' });
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in pending registration (ACCOUNT IS NOT CREATED IN DATABASE YET!)
    db.savePendingRegistration(cleanEmail, {
      name: name.trim(),
      email: cleanEmail,
      password,
      birthdate: birthdate || '1992-01-01',
      gender: gender || 'male',
      otp
    });

    // Audit log in Supabase ai_chat_logs
    if (db.supabase) {
      try {
        await db.supabase.from('ai_chat_logs').insert({
          id: 'reg_otp_' + Date.now(),
          user_id: null,
          query: `[REGISTRATION_OTP_GENERATED] Target: ${cleanEmail}`,
          response: `One-Time Password [${otp}] generated for new registration: ${name.trim()}.`,
          created_at: new Date().toISOString()
        });
      } catch (err) {}
    }

    // Dispatch OTP email to user's registered inbox
    const emailResult = await emailService.sendOTPEmail(cleanEmail, otp, name.trim());

    if (!emailResult.success) {
      return res.status(502).json({
        error: emailResult.error || 'Failed to dispatch verification OTP to your email.'
      });
    }

    return res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}.`,
      email: cleanEmail,
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error in register/send-otp:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch verification OTP.' });
  }
});

// POST /api/auth/register/verify-otp (Verifies OTP and CREATES account in database only now)
router.post('/register/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const pending = db.getPendingRegistration(cleanEmail);
    if (!pending) {
      return res.status(400).json({ error: 'Registration session expired. Please enter details again.' });
    }

    if (pending.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Double check email isn't already taken
    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      db.deletePendingRegistration(cleanEmail);
      return res.status(409).json({ error: 'Email already exists, please sign in.' });
    }

    // ONLY NOW: Create account in database!
    const user = await db.createUser({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      birthdate: pending.birthdate,
      gender: pending.gender
    });

    // Remove from pending registrations
    db.deletePendingRegistration(cleanEmail);

    return res.status(201).json({
      success: true,
      message: 'Email verified! Account successfully created.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        gender: user.gender,
        data: user.data
      }
    });
  } catch (err) {
    console.error('Error in register/verify-otp:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify code and create account.' });
  }
});

// POST /api/auth/register/resend-otp
router.post('/register/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanEmail = email.trim().toLowerCase();
    const pending = db.getPendingRegistration(cleanEmail);
    if (!pending) {
      return res.status(400).json({ error: 'Registration session expired. Please fill out the form again.' });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otp = newOtp;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    db.savePendingRegistration(cleanEmail, pending);

    const emailResult = await emailService.sendOTPEmail(cleanEmail, newOtp, pending.name);

    if (!emailResult.success) {
      return res.status(502).json({
        error: emailResult.error || 'Failed to resend verification code to your email.'
      });
    }

    return res.json({
      success: true,
      message: `A new 6-digit verification code has been dispatched to ${cleanEmail}.`,
      email: cleanEmail,
      cooldownSeconds: 60
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to resend verification code.' });
  }
});

// POST /api/auth/register (Direct fallback)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, birthdate, gender } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are mandatory.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists, please sign in.' });
    }

    const user = await db.createUser({
      name: name.trim(),
      email: cleanEmail,
      password,
      birthdate: birthdate || '1992-01-01',
      gender: gender || 'male'
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        gender: user.gender,
        data: user.data
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ error: 'Email already exists, please sign in.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/user/:id
router.get('/user/:id', async (req, res) => {
  try {
    const user = await db.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/user/:id/data
router.put('/user/:id/data', async (req, res) => {
  try {
    const updated = await db.updateUserData(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/user/:id/profile
router.put('/user/:id/profile', async (req, res) => {
  try {
    const { name, oldPassword, newPassword, confirmPassword, birthdate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const userId = req.params.id;
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    let passwordToUpdate = undefined;

    // Password change validation logic
    if (newPassword || oldPassword || confirmPassword) {
      if (!oldPassword || !oldPassword.trim()) {
        return res.status(400).json({ error: 'Please enter your current password to authorize changing your password.' });
      }

      if (!newPassword || !newPassword.trim()) {
        return res.status(400).json({ error: 'Please enter your new password.' });
      }

      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      if (!confirmPassword || confirmPassword.trim() !== newPassword.trim()) {
        return res.status(400).json({ error: 'New password and confirm password do not match.' });
      }

      // 1. Database check: Verify old password matches database record
      if (user.password !== oldPassword.trim()) {
        return res.status(400).json({ error: 'The current password you entered is incorrect.' });
      }

      // 2. Verify new password is not the same as old password
      if (newPassword.trim() === oldPassword.trim()) {
        return res.status(400).json({ error: 'New password cannot be the same as your old password.' });
      }

      passwordToUpdate = newPassword.trim();
    }

    const updatedUser = await db.updateUserProfile(userId, {
      name: name.trim(),
      password: passwordToUpdate,
      birthdate
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    return res.json({
      success: true,
      message: passwordToUpdate ? 'Profile and password updated successfully.' : 'Profile updated successfully.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        birthdate: updatedUser.birthdate,
        gender: updatedUser.gender,
        data: updatedUser.data
      }
    });
  } catch (err) {
    console.error('Error in PUT /api/auth/user/:id/profile:', err);
    return res.status(500).json({ error: err.message || 'Database error updating profile.' });
  }
});

// ==========================================
// FORGOT PASSWORD & OTP ENDPOINTS
// ==========================================

// POST /api/auth/forgot-password/send-otp
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'Email not found in database. Please check your email or register.' });
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database and send OTP email in parallel for fast response
    const [, emailResult] = await Promise.all([
      db.saveOTP(cleanEmail, otp, 10),
      emailService.sendOTPEmail(cleanEmail, otp, user.name)
    ]);

    if (!emailResult.success) {
      return res.status(502).json({
        error: emailResult.error || 'Failed to dispatch verification OTP to your email.'
      });
    }

    return res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}.`,
      email: cleanEmail,
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('Error in send-otp:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch verification OTP.' });
  }
});

// POST /api/auth/forgot-password/verify-otp
router.post('/forgot-password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await db.verifyOTP(cleanEmail, otp);

    if (!result.valid) {
      return res.status(400).json({ error: result.error || 'Invalid OTP' });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully. You may now set your new password.'
    });
  } catch (err) {
    console.error('Error in verify-otp:', err);
    return res.status(500).json({ error: err.message || 'Database error verifying OTP.' });
  }
});

// POST /api/auth/forgot-password/reset-password
router.post('/forgot-password/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await db.resetUserPasswordWithOTP(cleanEmail, otp, newPassword);

    return res.json({
      success: true,
      message: result.message || 'Password updated successfully in database.'
    });
  } catch (err) {
    console.error('Error in reset-password:', err);
    return res.status(400).json({ error: err.message || 'Failed to update password.' });
  }
});

module.exports = router;
