/**
 * BioAge Pro — Persistent Database Service (Supabase PostgreSQL + JSON Fallback)
 * Handles user authentication records, clinical evaluations, and assessment history.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Supabase Config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ensffepxgaqtourpwhqp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

class Database {
  constructor() {
    this.data = {
      users: [],
      assessments: [],
      chatLogs: [],
      otps: []
    };
    this.pendingRegistrations = new Map();
    this.supabase = null;
    this.init();
  }

  init() {
    // 1. Initialize Supabase if keys exist
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase Client initialized successfully for BioAge Pro.');
      } catch (err) {
        console.warn('⚠️ Failed to initialize Supabase client:', err.message);
      }
    }

    // 2. Local fallback storage init
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        this.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        this.data.otps = this.data.otps || [];
      } catch (e) {
        this.seedLocal();
      }
    } else {
      this.seedLocal();
    }
  }

  saveLocal() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write local database file', e);
    }
  }

  seedLocal() {
    this.data.users = [
      {
        id: 'usr_elena',
        name: 'Dr. Elena Vance (Longevity Protocol)',
        email: 'elena@longevity.bio',
        password: 'password123',
        birthdate: '1988-04-12',
        gender: 'female',
        data: {
          chronologicalAge: 38,
          gender: 'female',
          height: 168,
          weight: 60,
          restingHeartRate: 54,
          bloodPressureSystolic: 112,
          bloodPressureDiastolic: 72,
          mediterraneanScore: 'high',
          ultraProcessedFood: 'rare',
          sugarIntake: 'minimal',
          dailyWater: 'optimal',
          intermittentFasting: 'yes',
          sleepDuration: 'optimal',
          sleepConsistency: 'consistent',
          sleepQuality: 'refreshed',
          cardioMinutes: 'high',
          strengthDays: 'optimal',
          dailySteps: 'high',
          sedentaryHours: 'low',
          smokingStatus: 'never',
          alcoholIntake: 'none',
          stressLevel: 'low',
          socialConnection: 'strong',
          hasLabs: 'yes',
          fastingGlucose: 84,
          cholesterolRatio: 2.8,
          hsCrp: 'low'
        }
      },
      {
        id: 'usr_alex',
        name: 'Alex Mercer (Urban Professional)',
        email: 'alex@workplace.com',
        password: 'password123',
        birthdate: '1992-09-18',
        gender: 'male',
        data: {
          chronologicalAge: 34,
          gender: 'male',
          height: 178,
          weight: 84,
          restingHeartRate: 74,
          bloodPressureSystolic: 128,
          bloodPressureDiastolic: 82,
          mediterraneanScore: 'moderate',
          ultraProcessedFood: 'moderate',
          sugarIntake: 'moderate',
          dailyWater: 'adequate',
          intermittentFasting: 'no',
          sleepDuration: 'mild_deficit',
          sleepConsistency: 'moderate',
          sleepQuality: 'average',
          cardioMinutes: 'low',
          strengthDays: 'moderate',
          dailySteps: 'fair',
          sedentaryHours: 'high',
          smokingStatus: 'never',
          alcoholIntake: 'moderate',
          stressLevel: 'moderate',
          socialConnection: 'average',
          hasLabs: 'no'
        }
      },
      {
        id: 'usr_robert',
        name: 'Robert Davis (High Stress & Poor Sleep)',
        email: 'robert@financecorp.com',
        password: 'password123',
        birthdate: '1979-02-10',
        gender: 'male',
        data: {
          chronologicalAge: 47,
          gender: 'male',
          height: 174,
          weight: 96,
          restingHeartRate: 84,
          bloodPressureSystolic: 144,
          bloodPressureDiastolic: 92,
          mediterraneanScore: 'low',
          ultraProcessedFood: 'frequent',
          sugarIntake: 'high',
          dailyWater: 'low',
          intermittentFasting: 'no',
          sleepDuration: 'severe_deficit',
          sleepConsistency: 'erratic',
          sleepQuality: 'poor',
          cardioMinutes: 'sedentary',
          strengthDays: 'none',
          dailySteps: 'sedentary',
          sedentaryHours: 'high',
          smokingStatus: 'light',
          alcoholIntake: 'heavy',
          stressLevel: 'severe',
          socialConnection: 'isolated',
          hasLabs: 'no'
        }
      }
    ];
    this.saveLocal();
  }

  // --- Helper: Format DB row to user object ---
  formatUserFromDB(dbUser) {
    if (!dbUser) return null;
    const bio = Array.isArray(dbUser.user_biomarkers)
      ? dbUser.user_biomarkers[0]
      : dbUser.user_biomarkers || {};

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      password: dbUser.password_hash,
      birthdate: dbUser.birthdate,
      gender: dbUser.gender,
      createdAt: dbUser.created_at,
      data: {
        chronologicalAge: bio.chronological_age || 35,
        gender: dbUser.gender || 'male',
        height: bio.height_cm || 170,
        weight: bio.weight_kg || 70,
        bmi: bio.bmi || 24.2,
        restingHeartRate: bio.resting_heart_rate || 70,
        bloodPressureSystolic: bio.blood_pressure_systolic || 120,
        bloodPressureDiastolic: bio.blood_pressure_diastolic || 80,
        mediterraneanScore: bio.mediterranean_score || 'moderate',
        ultraProcessedFood: bio.ultra_processed_food || 'moderate',
        sugarIntake: bio.sugar_intake || 'moderate',
        dailyWater: bio.daily_water || 'adequate',
        intermittentFasting: bio.intermittent_fasting || 'no',
        sleepDuration: bio.sleep_duration || 'adequate',
        sleepConsistency: bio.sleep_consistency || 'moderate',
        sleepQuality: bio.sleep_quality || 'average',
        cardioMinutes: bio.cardio_minutes || 'moderate',
        strengthDays: bio.strength_days || 'moderate',
        dailySteps: bio.daily_steps || 'moderate',
        sedentaryHours: bio.sedentary_hours || 'moderate',
        smokingStatus: bio.smoking_status || 'never',
        alcoholIntake: bio.alcohol_intake || 'low',
        stressLevel: bio.stress_level || 'moderate',
        socialConnection: bio.social_connection || 'average',
        hasLabs: bio.has_labs || 'no',
        fastingGlucose: bio.fasting_glucose || null,
        cholesterolRatio: bio.cholesterol_ratio || null,
        hsCrp: bio.hs_crp || null
      }
    };
  }

  // --- Helper: Format user form data to DB biomarkers ---
  formatBiomarkersToDB(userId, formData = {}) {
    const h = Number(formData.height) || 170;
    const w = Number(formData.weight) || 70;
    const hM = h / 100;
    const bmi = +(w / (hM * hM)).toFixed(1);

    return {
      id: 'bio_' + Date.now(),
      user_id: userId,
      chronological_age: Number(formData.chronologicalAge) || 35,
      height_cm: h,
      weight_kg: w,
      bmi: bmi,
      resting_heart_rate: Number(formData.restingHeartRate) || 70,
      blood_pressure_systolic: Number(formData.bloodPressureSystolic) || 120,
      blood_pressure_diastolic: Number(formData.bloodPressureDiastolic) || 80,
      mediterranean_score: formData.mediterraneanScore || 'moderate',
      ultra_processed_food: formData.ultraProcessedFood || 'moderate',
      sugar_intake: formData.sugarIntake || 'moderate',
      daily_water: formData.dailyWater || 'adequate',
      intermittent_fasting: formData.intermittentFasting || 'no',
      sleep_duration: formData.sleepDuration || 'adequate',
      sleep_consistency: formData.sleepConsistency || 'moderate',
      sleep_quality: formData.sleepQuality || 'average',
      cardio_minutes: formData.cardioMinutes || 'moderate',
      strength_days: formData.strengthDays || 'moderate',
      daily_steps: formData.dailySteps || 'moderate',
      sedentary_hours: formData.sedentaryHours || 'moderate',
      smoking_status: formData.smokingStatus || 'never',
      alcohol_intake: formData.alcoholIntake || 'low',
      stress_level: formData.stressLevel || 'moderate',
      social_connection: formData.socialConnection || 'average',
      has_labs: formData.hasLabs || 'no',
      fasting_glucose: formData.fastingGlucose ? Number(formData.fastingGlucose) : null,
      cholesterol_ratio: formData.cholesterolRatio ? Number(formData.cholesterolRatio) : null,
      hs_crp: formData.hsCrp || null,
      updated_at: new Date().toISOString()
    };
  }

  // ==========================================
  // USER OPERATIONS
  // ==========================================
  async findUserByEmail(email) {
    const clean = (email || '').trim().toLowerCase();

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('*, user_biomarkers(*)')
          .ilike('email', clean)
          .maybeSingle();

        if (!error && data) {
          return this.formatUserFromDB(data);
        }
      } catch (err) {
        console.warn('Supabase findUserByEmail error, fallback to local store:', err.message);
      }
    }

    // Local fallback
    return this.data.users.find(u => u.email.toLowerCase() === clean);
  }

  async findUserById(id) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('*, user_biomarkers(*)')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return this.formatUserFromDB(data);
        }
      } catch (err) {
        console.warn('Supabase findUserById error, fallback to local store:', err.message);
      }
    }

    // Local fallback
    return this.data.users.find(u => u.id === id);
  }

  async createUser(userData) {
    const userId = 'usr_' + Date.now();
    const cleanEmail = userData.email.trim().toLowerCase();

    if (this.supabase) {
      try {
        // 1. Insert User
        const { error: userErr } = await this.supabase.from('users').insert({
          id: userId,
          name: userData.name,
          email: cleanEmail,
          password_hash: userData.password,
          birthdate: userData.birthdate || null,
          gender: userData.gender || 'male'
        });

        if (userErr) {
          if (userErr.code === '23505' || userErr.message?.includes('duplicate') || userErr.message?.includes('unique') || userErr.message?.includes('already exists')) {
            throw new Error('Email already exists, please sign in.');
          }
          throw userErr;
        }

        // 2. Insert Biomarkers if provided
        const bioRow = this.formatBiomarkersToDB(userId, userData.data || {});
        await this.supabase.from('user_biomarkers').insert(bioRow);

        console.log(`✅ User registered in Supabase: ${cleanEmail}`);
        return {
          id: userId,
          name: userData.name,
          email: cleanEmail,
          password: userData.password,
          birthdate: userData.birthdate,
          gender: userData.gender || 'male',
          createdAt: new Date().toISOString(),
          data: userData.data || {}
        };
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          throw err;
        }
        console.error('Supabase createUser failed, fallback to local store:', err.message);
      }
    }

    // Local fallback
    const newUser = {
      id: userId,
      name: userData.name,
      email: cleanEmail,
      password: userData.password,
      birthdate: userData.birthdate,
      gender: userData.gender || 'male',
      createdAt: new Date().toISOString(),
      data: userData.data || {}
    };
    this.data.users.push(newUser);
    this.saveLocal();
    return newUser;
  }

  async updateUserData(userId, formData) {
    if (this.supabase) {
      try {
        const bioRow = this.formatBiomarkersToDB(userId, formData);
        
        // Upsert into user_biomarkers
        const { error } = await this.supabase
          .from('user_biomarkers')
          .upsert(bioRow, { onConflict: 'user_id' });

        if (!error) {
          return formData;
        }
        console.warn('Supabase updateUserData warning:', error.message);
      } catch (err) {
        console.warn('Supabase updateUserData error, fallback to local:', err.message);
      }
    }

    // Local fallback
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      user.data = { ...user.data, ...formData };
      this.saveLocal();
      return user.data;
    }
    return null;
  }

  async updateUserProfile(userId, { name, password, birthdate }) {
    let updatedUser = null;

    if (this.supabase) {
      try {
        const updatePayload = {
          updated_at: new Date().toISOString()
        };
        if (name && name.trim()) updatePayload.name = name.trim();
        if (password && password.trim()) updatePayload.password_hash = password.trim();
        if (birthdate) updatePayload.birthdate = birthdate;

        const { data, error } = await this.supabase
          .from('users')
          .update(updatePayload)
          .eq('id', userId)
          .select('*, user_biomarkers(*)')
          .maybeSingle();

        if (!error && data) {
          console.log(`✅ User profile updated in Supabase: ${userId}`);
          updatedUser = this.formatUserFromDB(data);

          if (birthdate) {
            const bDate = new Date(birthdate);
            const now = new Date();
            let newAge = now.getFullYear() - bDate.getFullYear();
            const m = now.getMonth() - bDate.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) newAge--;
            if (newAge > 0) {
              await this.supabase
                .from('user_biomarkers')
                .update({ chronological_age: newAge, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
              if (updatedUser.data) {
                updatedUser.data.chronologicalAge = newAge;
              }
            }
          }
        } else if (error) {
          console.warn('Supabase updateUserProfile error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateUserProfile error, fallback to local:', err.message);
      }
    }

    // Local store sync / fallback
    let localUser = this.data.users.find(u => u.id === userId);
    if (!localUser && updatedUser) {
      localUser = { ...updatedUser };
      this.data.users.push(localUser);
    }
    if (localUser) {
      if (name && name.trim()) localUser.name = name.trim();
      if (password && password.trim()) localUser.password = password.trim();
      if (birthdate) {
        localUser.birthdate = birthdate;
        const bDate = new Date(birthdate);
        const now = new Date();
        let newAge = now.getFullYear() - bDate.getFullYear();
        const m = now.getMonth() - bDate.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) newAge--;
        if (newAge > 0 && localUser.data) {
          localUser.data.chronologicalAge = newAge;
        }
      }
      this.saveLocal();
      if (!updatedUser) updatedUser = localUser;
    }

    return updatedUser;
  }

  // ==========================================
  // OTP & PASSWORD RESET OPERATIONS
  // ==========================================
  async saveOTP(email, otp, expiryMinutes = 10) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !otp) {
      throw new Error('Email and OTP code are required.');
    }

    const user = await this.findUserByEmail(cleanEmail);
    if (!user) {
      throw new Error('Email not found, create account.');
    }

    const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
    const otpRecord = {
      id: 'otp_' + Date.now(),
      email: cleanEmail,
      otp: String(otp).trim(),
      expiresAt: expiresAt,
      createdAt: new Date().toISOString(),
      attempts: 0,
      verified: false
    };

    this.data.otps = (this.data.otps || []).filter(o => o.email !== cleanEmail);
    this.data.otps.push(otpRecord);
    this.saveLocal();

    if (this.supabase) {
      // 1. Save directly into Supabase 'otps' table (if table exists)
      try {
        await this.supabase.from('otps').upsert({
          id: 'otp_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
          email: cleanEmail,
          otp: String(otp).trim(),
          expires_at: expiresAt,
          verified: false,
          attempts: 0,
          created_at: new Date().toISOString()
        });
        console.log(`✅ Real-time OTP synced to Supabase 'otps' table for ${cleanEmail}`);
      } catch (err) {
        // Table may not exist yet, logged below
      }

      // 2. Also log real-time OTP audit entry to Supabase 'ai_chat_logs'
      try {
        await this.supabase.from('ai_chat_logs').insert({
          id: 'otp_log_' + Date.now(),
          user_id: user.id || null,
          query: `[SECURITY_OTP_GENERATED] Target: ${cleanEmail}`,
          response: `One-Time Password [${otp}] generated with ${expiryMinutes}-minute window.`,
          created_at: new Date().toISOString()
        });
        console.log(`✅ Real-time OTP audit logged to Supabase 'ai_chat_logs' for ${cleanEmail}`);
      } catch (err) {
        // Non-critical audit log
      }
    }

    return otpRecord;
  }

  async verifyOTP(email, otp) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();

    if (!cleanEmail || !cleanOtp) {
      return { valid: false, error: 'Email and verification code are required.' };
    }

    // 1. Try checking Supabase 'otps' table first if available
    if (this.supabase) {
      try {
        const { data: sOtp } = await this.supabase
          .from('otps')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (sOtp) {
          if (Date.now() > Number(sOtp.expires_at)) {
            return { valid: false, error: 'OTP has expired. Please request a new code.' };
          }
          if (String(sOtp.otp).trim() !== cleanOtp) {
            await this.supabase.from('otps').update({ attempts: (sOtp.attempts || 0) + 1 }).eq('email', cleanEmail);
            return { valid: false, error: 'Invalid OTP' };
          }
          await this.supabase.from('otps').update({ verified: true }).eq('email', cleanEmail);
          return { valid: true };
        }
      } catch (err) {
        // Fallback to local store
      }
    }

    // 2. Local fallback check
    const record = (this.data.otps || []).find(o => o.email === cleanEmail);
    if (!record) {
      return { valid: false, error: 'No OTP requested for this email. Please request a new code.' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'OTP has expired. Please request a new code.' };
    }

    if (record.otp !== cleanOtp) {
      record.attempts = (record.attempts || 0) + 1;
      this.saveLocal();
      return { valid: false, error: 'Invalid OTP' };
    }

    record.verified = true;
    this.saveLocal();
    return { valid: true };
  }

  async resetUserPasswordWithOTP(email, otp, newPassword) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();

    if (!cleanEmail || !cleanOtp || !newPassword) {
      throw new Error('Email, OTP, and new password are required.');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // 1. Database check: Verify OTP is correct
    const verification = await this.verifyOTP(cleanEmail, cleanOtp);
    if (!verification.valid) {
      throw new Error(verification.error || 'Invalid OTP');
    }

    // 2. Database check: Verify new password is not the same as current password
    const existingUser = await this.findUserByEmail(cleanEmail);
    if (existingUser && existingUser.password && existingUser.password.trim() === newPassword.trim()) {
      throw new Error('New password cannot be the same as your old password.');
    }

    // 3. Database update: Supabase
    let updatedInSupabase = false;
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('users')
          .update({
            password_hash: newPassword,
            updated_at: new Date().toISOString()
          })
          .ilike('email', cleanEmail);

        if (!error) {
          updatedInSupabase = true;
          console.log(`✅ User password updated in Supabase: ${cleanEmail}`);
        } else {
          console.warn('⚠️ Supabase password update warning:', error.message);
        }
      } catch (err) {
        console.warn('⚠️ Supabase password update error:', err.message);
      }
    }

    // 3. Database update: Local Store
    const localUser = (this.data.users || []).find(u => u.email.toLowerCase() === cleanEmail);
    if (localUser) {
      localUser.password = newPassword;
      console.log(`✅ User password updated in local store: ${cleanEmail}`);
    }

    // 4. Invalidate used OTP
    this.data.otps = (this.data.otps || []).filter(o => o.email !== cleanEmail);
    this.saveLocal();

    return {
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
      updatedInSupabase
    };
  }

  // ==========================================
  // PENDING REGISTRATION OPERATIONS (OTP FIRST)
  // ==========================================
  savePendingRegistration(email, data) {
    const cleanEmail = (email || '').trim().toLowerCase();
    this.pendingRegistrations.set(cleanEmail, {
      ...data,
      email: cleanEmail,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });
  }

  getPendingRegistration(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const item = this.pendingRegistrations.get(cleanEmail);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.pendingRegistrations.delete(cleanEmail);
      return null;
    }
    return item;
  }

  deletePendingRegistration(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    this.pendingRegistrations.delete(cleanEmail);
  }

  // ==========================================
  // ASSESSMENT HISTORY OPERATIONS
  // ==========================================
  async saveAssessment(record) {
    const evalId = 'eval_' + Date.now();
    const createdAt = new Date().toISOString();

    if (this.supabase) {
      try {
        const assessmentRow = {
          id: evalId,
          user_id: record.userId || 'usr_guest',
          chronological_age: Number(record.chronologicalAge) || 35,
          biological_age: Number(record.biologicalAge) || 35,
          age_difference: Number(record.ageDifference ?? record.ageDelta ?? 0),
          projected_life_expectancy: Number(record.projectedLifeExpectancy) || 78,
          remaining_years: Number(record.remainingYears) || 40,
          pace_of_aging: Number(record.paceOfAging) || 1.0,
          pace_category: record.paceCategory || 'Normal',
          cardiovascular_age: Number(record.organAges?.cardiovascular || record.biologicalAge || 35),
          metabolic_age: Number(record.organAges?.metabolic || record.biologicalAge || 35),
          cellular_age: Number(record.organAges?.cellular || record.biologicalAge || 35),
          cognitive_age: Number(record.organAges?.cognitive || record.biologicalAge || 35),
          cardiovascular_score: record.domainScores?.cardiovascular || 80,
          nutrition_score: record.domainScores?.nutrition || 80,
          sleep_score: record.domainScores?.sleep || 80,
          fitness_score: record.domainScores?.physicalFitness || 80,
          mental_score: record.domainScores?.mentalResilience || 80,
          ai_clinical_summary: record.aiClinicalSummary || null,
          hazards_json: JSON.stringify(record.hazards || record.aiLongevityRisks || []),
          raw_input_json: JSON.stringify(record.rawInput || record.formData || {}),
          created_at: createdAt
        };

        const { error } = await this.supabase.from('assessments').insert(assessmentRow);
        if (!error) {
          console.log(`✅ Assessment saved in Supabase for user: ${record.userId}`);

          // Also save action protocols/interventions if present
          const actionPlan = record.actionPlan || record.aiTopInterventions || [];
          if (Array.isArray(actionPlan) && actionPlan.length > 0) {
            const interventionRows = actionPlan.map((act, idx) => ({
              id: `int_${Date.now()}_${idx}`,
              assessment_id: evalId,
              user_id: record.userId || 'usr_guest',
              title: act.title || 'Longevity Protocol',
              category: act.category || 'Lifestyle',
              priority: act.priority || 'HIGH',
              difficulty: act.difficulty || 'Medium',
              life_gain_years: Number(act.lifeGain || act.lifeGainYears || 0),
              bio_age_reduction_years: Number(act.bioAgeGain || act.bioAgeReductionYears || 0),
              description: act.description || '',
              mechanism: act.mechanism || ''
            }));
            await this.supabase.from('interventions').insert(interventionRows);
          }

          return { id: evalId, createdAt, ...record };
        }
      } catch (err) {
        console.warn('Supabase saveAssessment error, fallback to local store:', err.message);
      }
    }

    // Local fallback
    const assessment = {
      id: evalId,
      createdAt,
      ...record
    };
    this.data.assessments.unshift(assessment);
    this.saveLocal();
    return assessment;
  }

  async getAssessmentsByUserId(userId) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('assessments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map(row => ({
            id: row.id,
            userId: row.user_id,
            chronologicalAge: row.chronological_age,
            biologicalAge: row.biological_age,
            ageDifference: row.age_difference,
            projectedLifeExpectancy: row.projected_life_expectancy,
            remainingYears: row.remaining_years,
            paceOfAging: row.pace_of_aging,
            paceCategory: row.pace_category,
            organAges: {
              cardiovascular: row.cardiovascular_age,
              metabolic: row.metabolic_age,
              cellular: row.cellular_age,
              cognitive: row.cognitive_age
            },
            domainScores: {
              cardiovascular: row.cardiovascular_score,
              nutrition: row.nutrition_score,
              sleep: row.sleep_score,
              physicalFitness: row.fitness_score,
              mentalResilience: row.mental_score
            },
            aiClinicalSummary: row.ai_clinical_summary,
            hazards: row.hazards_json ? JSON.parse(row.hazards_json) : [],
            rawInput: row.raw_input_json ? JSON.parse(row.raw_input_json) : {},
            createdAt: row.created_at
          }));
        }
      } catch (err) {
        console.warn('Supabase getAssessments error, fallback to local store:', err.message);
      }
    }

    // Local fallback
    return this.data.assessments.filter(a => a.userId === userId);
  }

  // ==========================================
  // CHAT LOGGING
  // ==========================================
  async logChat(userId, query, response) {
    const timestamp = new Date().toISOString();

    if (this.supabase) {
      try {
        await this.supabase.from('ai_chat_logs').insert({
          id: 'chat_' + Date.now(),
          user_id: userId || null,
          query,
          response,
          created_at: timestamp
        });
        return;
      } catch (err) {
        console.warn('Supabase logChat error:', err.message);
      }
    }

    // Local fallback
    this.data.chatLogs.push({
      id: 'chat_' + Date.now(),
      userId,
      query,
      response,
      timestamp
    });
    this.saveLocal();
  }
}

module.exports = new Database();
