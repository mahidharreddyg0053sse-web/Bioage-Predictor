-- ==============================================================================
-- BioAge Pro — Biological Age & Longevity Clinical Database Schema
-- Compatible with MySQL (8.0+) and PostgreSQL (12+) / SQLite
-- ==============================================================================

-- 1. Create Database (Uncomment if needed)
-- CREATE DATABASE IF NOT EXISTS bioage_pro_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE bioage_pro_db;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS ai_chat_logs;
DROP TABLE IF EXISTS interventions;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS user_biomarkers;
DROP TABLE IF EXISTS users;

-- ==============================================================================
-- Table: users
-- Stores registered accounts, credentials, and demographic profiles
-- ==============================================================================
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    birthdate DATE NULL,
    gender VARCHAR(20) DEFAULT 'male',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ==============================================================================
-- Table: user_biomarkers
-- Stores the latest clinical, lifestyle, and telemetry inputs for each user
-- ==============================================================================
CREATE TABLE user_biomarkers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE,
    chronological_age INT NOT NULL,
    height_cm DECIMAL(5, 1) NOT NULL,
    weight_kg DECIMAL(5, 1) NOT NULL,
    bmi DECIMAL(4, 1) NOT NULL,
    resting_heart_rate INT NOT NULL,
    blood_pressure_systolic INT NOT NULL,
    blood_pressure_diastolic INT NOT NULL,
    mediterranean_score VARCHAR(30) DEFAULT 'moderate',
    ultra_processed_food VARCHAR(30) DEFAULT 'moderate',
    sugar_intake VARCHAR(30) DEFAULT 'moderate',
    daily_water VARCHAR(30) DEFAULT 'adequate',
    intermittent_fasting VARCHAR(10) DEFAULT 'no',
    sleep_duration VARCHAR(30) DEFAULT 'adequate',
    sleep_consistency VARCHAR(30) DEFAULT 'moderate',
    sleep_quality VARCHAR(30) DEFAULT 'average',
    cardio_minutes VARCHAR(30) DEFAULT 'moderate',
    strength_days VARCHAR(30) DEFAULT 'moderate',
    daily_steps VARCHAR(30) DEFAULT 'moderate',
    sedentary_hours VARCHAR(30) DEFAULT 'moderate',
    smoking_status VARCHAR(30) DEFAULT 'never',
    alcohol_intake VARCHAR(30) DEFAULT 'low',
    stress_level VARCHAR(30) DEFAULT 'moderate',
    social_connection VARCHAR(30) DEFAULT 'average',
    has_labs VARCHAR(10) DEFAULT 'no',
    fasting_glucose DECIMAL(5, 1) NULL,
    cholesterol_ratio DECIMAL(4, 2) NULL,
    hs_crp VARCHAR(30) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_biomarkers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_biomarkers_user ON user_biomarkers(user_id);

-- ==============================================================================
-- Table: assessments
-- Historical clinical evaluations, biological age calculations, and domain scores
-- ==============================================================================
CREATE TABLE assessments (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    chronological_age DECIMAL(4, 1) NOT NULL,
    biological_age DECIMAL(4, 1) NOT NULL,
    age_difference DECIMAL(4, 1) NOT NULL,
    projected_life_expectancy DECIMAL(4, 1) NOT NULL,
    remaining_years DECIMAL(4, 1) NOT NULL,
    pace_of_aging DECIMAL(4, 2) NOT NULL,
    pace_category VARCHAR(50) NOT NULL,
    
    -- Organ specific biological ages
    cardiovascular_age DECIMAL(4, 1) NOT NULL,
    metabolic_age DECIMAL(4, 1) NOT NULL,
    cellular_age DECIMAL(4, 1) NOT NULL,
    cognitive_age DECIMAL(4, 1) NOT NULL,
    
    -- Domain scores (0 to 100)
    cardiovascular_score INT DEFAULT 80,
    nutrition_score INT DEFAULT 80,
    sleep_score INT DEFAULT 80,
    fitness_score INT DEFAULT 80,
    mental_score INT DEFAULT 80,
    
    -- AI and hazard analysis payloads
    ai_clinical_summary TEXT NULL,
    hazards_json TEXT NULL,
    raw_input_json TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assessments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessments_user_date ON assessments(user_id, created_at DESC);

-- ==============================================================================
-- Table: interventions
-- Personalized longevity action protocols generated from evaluations
-- ==============================================================================
CREATE TABLE interventions (
    id VARCHAR(64) PRIMARY KEY,
    assessment_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,       -- 'CRITICAL', 'HIGH', 'MEDIUM'
    difficulty VARCHAR(20) NOT NULL,     -- 'Easy', 'Medium', 'High'
    life_gain_years DECIMAL(4, 1) DEFAULT 0.0,
    bio_age_reduction_years DECIMAL(4, 1) DEFAULT 0.0,
    description TEXT NOT NULL,
    mechanism TEXT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_interventions_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_interventions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_interventions_user ON interventions(user_id, is_completed);

-- ==============================================================================
-- Table: ai_chat_logs
-- Stores conversations with the AI Longevity Assistant
-- ==============================================================================
CREATE TABLE ai_chat_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_chat_user ON ai_chat_logs(user_id, created_at DESC);

-- ==============================================================================
-- SEED DATA (Demo Users and Initial Telemetry)
-- ==============================================================================
INSERT INTO users (id, name, email, password_hash, birthdate, gender) VALUES
('usr_elena', 'Dr. Elena Vance (Longevity Protocol)', 'elena@longevity.bio', 'password123', '1988-04-12', 'female'),
('usr_alex', 'Alex Mercer (Urban Professional)', 'alex@workplace.com', 'password123', '1992-09-18', 'male'),
('usr_robert', 'Robert Davis (High Stress & Poor Sleep)', 'robert@financecorp.com', 'password123', '1979-02-10', 'male');

INSERT INTO user_biomarkers (
    id, user_id, chronological_age, height_cm, weight_kg, bmi, resting_heart_rate,
    blood_pressure_systolic, blood_pressure_diastolic, mediterranean_score,
    ultra_processed_food, sugar_intake, daily_water, intermittent_fasting,
    sleep_duration, sleep_consistency, sleep_quality, cardio_minutes,
    strength_days, daily_steps, sedentary_hours, smoking_status, alcohol_intake,
    stress_level, social_connection, has_labs, fasting_glucose, cholesterol_ratio, hs_crp
) VALUES
('bio_elena', 'usr_elena', 38, 168.0, 60.0, 21.3, 54, 112, 72, 'high', 'rare', 'minimal', 'optimal', 'yes', 'optimal', 'consistent', 'refreshed', 'high', 'optimal', 'high', 'low', 'never', 'none', 'low', 'strong', 'yes', 84.0, 2.80, 'low'),
('bio_alex', 'usr_alex', 34, 178.0, 84.0, 26.5, 74, 128, 82, 'moderate', 'moderate', 'moderate', 'adequate', 'no', 'mild_deficit', 'moderate', 'average', 'low', 'moderate', 'fair', 'high', 'never', 'moderate', 'moderate', 'average', 'no', NULL, NULL, NULL),
('bio_robert', 'usr_robert', 47, 174.0, 96.0, 31.7, 84, 144, 92, 'low', 'frequent', 'high', 'low', 'no', 'severe_deficit', 'erratic', 'poor', 'sedentary', 'none', 'sedentary', 'high', 'light', 'heavy', 'severe', 'isolated', 'no', NULL, NULL, NULL);
