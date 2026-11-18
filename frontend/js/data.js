/**
 * Bio-Age & Longevity Clinical Reference Data & Assessment Schema
 * Grounded in geroscience, NHANES, Levine PhenoAge, and Blue Zones demographic models.
 */

export const ASSESSMENT_SECTIONS = [
  {
    id: 'biometrics',
    title: 'Biometrics & Vitals',
    subtitle: 'Physical baseline and cardiovascular vitals',
    icon: 'activity',
    fields: [
      {
        id: 'chronologicalAge',
        label: 'Chronological Age',
        type: 'number',
        min: 18,
        max: 100,
        default: 32,
        unit: 'years',
        hint: 'Your official calendar age in years',
        required: true
      },
      {
        id: 'gender',
        label: 'Biological Sex',
        type: 'select',
        options: [
          { value: 'male', label: 'Male (Base Life Expectancy: ~76.3 yrs)' },
          { value: 'female', label: 'Female (Base Life Expectancy: ~81.4 yrs)' }
        ],
        default: 'male',
        required: true
      },
      {
        id: 'height',
        label: 'Height',
        type: 'number',
        min: 120,
        max: 230,
        default: 175,
        unit: 'cm',
        required: true
      },
      {
        id: 'weight',
        label: 'Weight',
        type: 'number',
        min: 35,
        max: 200,
        default: 72,
        unit: 'kg',
        required: true
      },
      {
        id: 'restingHeartRate',
        label: 'Resting Heart Rate (RHR)',
        type: 'number',
        min: 40,
        max: 120,
        default: 64,
        unit: 'bpm',
        hint: 'Measured when waking or sitting quietly for 5 minutes (Optimal: 50-65 bpm)',
        required: true
      },
      {
        id: 'bloodPressureSystolic',
        label: 'Systolic Blood Pressure (Upper)',
        type: 'number',
        min: 80,
        max: 200,
        default: 118,
        unit: 'mmHg',
        hint: 'Optimal is under 120 mmHg',
        required: true
      },
      {
        id: 'bloodPressureDiastolic',
        label: 'Diastolic Blood Pressure (Lower)',
        type: 'number',
        min: 50,
        max: 130,
        default: 76,
        unit: 'mmHg',
        hint: 'Optimal is under 80 mmHg',
        required: true
      }
    ]
  },
  {
    id: 'nutrition',
    title: 'Food Habits & Nutrition',
    subtitle: 'Dietary quality, ultra-processed food exposure, and hydration',
    icon: 'utensils',
    fields: [
      {
        id: 'mediterraneanScore',
        label: 'Dietary Pattern / Whole Foods Adherence',
        type: 'select',
        options: [
          { value: 'high', label: 'Strict Mediterranean / Whole-Food Plant & Clean Protein (Daily greens, EVOO, fish/nuts)' },
          { value: 'moderate', label: 'Balanced / Moderate Whole Foods with occasional processed items' },
          { value: 'low', label: 'Standard Modern Diet (Frequent fast food, refined carbs, packaged meals)' }
        ],
        default: 'moderate',
        hint: 'High adherence is associated with -2.5 years biological age'
      },
      {
        id: 'ultraProcessedFood',
        label: 'Ultra-Processed Foods & Packaged Snacks',
        type: 'select',
        options: [
          { value: 'rare', label: 'Rarely / Less than once a week' },
          { value: 'moderate', label: '1 - 3 times per week' },
          { value: 'frequent', label: 'Daily or almost every meal' }
        ],
        default: 'moderate',
        hint: 'High consumption accelerates cellular telomere shortening and systemic inflammation'
      },
      {
        id: 'sugarIntake',
        label: 'Added Sugar & Sweetened Beverages',
        type: 'select',
        options: [
          { value: 'minimal', label: 'Minimal (<15g/day, zero sodas/energy drinks)' },
          { value: 'moderate', label: 'Moderate (15-40g/day, occasional sweets)' },
          { value: 'high', label: 'High (>50g/day, regular sodas/desserts)' }
        ],
        default: 'moderate'
      },
      {
        id: 'dailyWater',
        label: 'Daily Hydration (Pure Water & Herbal Teas)',
        type: 'select',
        options: [
          { value: 'optimal', label: 'Optimal: 2.5 - 3.5 Liters / day' },
          { value: 'adequate', label: 'Adequate: 1.5 - 2.5 Liters / day' },
          { value: 'low', label: 'Deficient: Less than 1.5 Liters / day' }
        ],
        default: 'adequate'
      },
      {
        id: 'intermittentFasting',
        label: 'Daily Overnight Fasting Window',
        type: 'select',
        options: [
          { value: 'yes', label: '12 - 16 hours overnight fast (e.g. 8pm to 10am) - Stimulates autophagy' },
          { value: 'no', label: 'Frequent late-night eating (<10 hours fast)' }
        ],
        default: 'yes'
      }
    ]
  },
  {
    id: 'sleep',
    title: 'Sleep Architecture & Rest',
    subtitle: 'Circadian alignment, sleep duration, and recovery',
    icon: 'moon',
    fields: [
      {
        id: 'sleepDuration',
        label: 'Average Nightly Sleep Duration',
        type: 'select',
        options: [
          { value: 'optimal', label: '7.0 - 8.5 hours (Optimal restorative window)' },
          { value: 'mild_deficit', label: '6.0 - 6.9 hours (Mild chronic sleep debt)' },
          { value: 'severe_deficit', label: 'Under 6 hours (Severe metabolic & cognitive stress)' },
          { value: 'excessive', label: 'Over 9.5 hours (May indicate systemic fatigue or lethargy)' }
        ],
        default: 'optimal',
        hint: 'Sleep below 6 hours is linked to elevated amyloid-beta deposition and vascular stiffness'
      },
      {
        id: 'sleepConsistency',
        label: 'Sleep & Wake Schedule Regularity',
        type: 'select',
        options: [
          { value: 'consistent', label: 'High Consistency (Sleep/wake times within 30-45 mins 7 days/week)' },
          { value: 'moderate', label: 'Moderate (Weekend shift of 1-2 hours)' },
          { value: 'erratic', label: 'Erratic / Shift work (Variable sleep times)' }
        ],
        default: 'moderate'
      },
      {
        id: 'sleepQuality',
        label: 'Subjective Sleep Quality & Morning Vitality',
        type: 'select',
        options: [
          { value: 'refreshed', label: 'Wake up energetic, fall asleep within 15-20 min, rarely wake up' },
          { value: 'average', label: 'Wake up groggy sometimes, occasional night awakenings' },
          { value: 'poor', label: 'Chronic insomnia, restless tossing, frequent daytime exhaustion' }
        ],
        default: 'refreshed'
      }
    ]
  },
  {
    id: 'fitness',
    title: 'Physical Activity & Fitness',
    subtitle: 'Cardiorespiratory fitness, muscular strength, and daily movement',
    icon: 'zap',
    fields: [
      {
        id: 'cardioMinutes',
        label: 'Weekly Moderate-to-Vigorous Cardio (Zone 2 / Jogging / Cycling)',
        type: 'select',
        options: [
          { value: 'high', label: '180+ minutes/week (Optimal VO2 max preservation)' },
          { value: 'moderate', label: '90 - 180 minutes/week' },
          { value: 'low', label: '30 - 90 minutes/week' },
          { value: 'sedentary', label: 'Less than 30 minutes/week' }
        ],
        default: 'moderate',
        hint: 'VO2 max is the single highest predictor of all-cause mortality reduction'
      },
      {
        id: 'strengthDays',
        label: 'Strength / Resistance Training Frequency',
        type: 'select',
        options: [
          { value: 'optimal', label: '3 - 5 days/week (Weights, bodyweight, resistance)' },
          { value: 'moderate', label: '1 - 2 days/week' },
          { value: 'none', label: 'No structured strength training' }
        ],
        default: 'moderate',
        hint: 'Prevents sarcopenia and preserves bone mineral density and insulin receptor density'
      },
      {
        id: 'dailySteps',
        label: 'Average Daily Steps',
        type: 'select',
        options: [
          { value: 'high', label: '10,000+ steps/day' },
          { value: 'moderate', label: '7,000 - 9,999 steps/day' },
          { value: 'fair', label: '4,500 - 6,999 steps/day' },
          { value: 'sedentary', label: 'Less than 4,500 steps/day' }
        ],
        default: 'moderate'
      },
      {
        id: 'sedentaryHours',
        label: 'Daily Prolonged Sitting / Screen Time',
        type: 'select',
        options: [
          { value: 'low', label: 'Under 5 hours (Frequent standing desk, walking breaks)' },
          { value: 'moderate', label: '5 - 8 hours/day' },
          { value: 'high', label: 'More than 8 hours/day seated continuously' }
        ],
        default: 'moderate'
      }
    ]
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle, Habits & Environment',
    subtitle: 'Toxicant exposures, chronic stress burden, and social resilience',
    icon: 'shield',
    fields: [
      {
        id: 'smokingStatus',
        label: 'Smoking & Nicotine / Vaping',
        type: 'select',
        options: [
          { value: 'never', label: 'Never smoked or vaped' },
          { value: 'former', label: 'Former smoker (>1 year quit)' },
          { value: 'light', label: 'Occasional social smoker / vaper' },
          { value: 'active', label: 'Active daily smoker (accelerates bio-age by +5 to +8 years)' }
        ],
        default: 'never',
        hint: 'Smoking remains the single largest preventable driver of premature biological aging'
      },
      {
        id: 'alcoholIntake',
        label: 'Alcohol Consumption',
        type: 'select',
        options: [
          { value: 'none', label: 'Zero / Abstinent' },
          { value: 'low', label: 'Low (1 - 3 standard drinks/week)' },
          { value: 'moderate', label: 'Moderate (4 - 7 drinks/week)' },
          { value: 'heavy', label: 'Heavy (>8 drinks/week or binge drinking)' }
        ],
        default: 'low'
      },
      {
        id: 'stressLevel',
        label: 'Perceived Chronic Psychological Stress',
        type: 'select',
        options: [
          { value: 'low', label: 'Low / Managed with mindfulness, calm, good balance' },
          { value: 'moderate', label: 'Moderate daily work/life pressure' },
          { value: 'severe', label: 'Severe / Unremitting chronic overwhelm and anxiety' }
        ],
        default: 'moderate',
        hint: 'Chronic cortisol elevation blunts immune senescence and shortens telomeres'
      },
      {
        id: 'socialConnection',
        label: 'Close Relationships & Community Support',
        type: 'select',
        options: [
          { value: 'strong', label: 'Strong (Deep, trusting social circle, frequent bonding, sense of purpose)' },
          { value: 'average', label: 'Moderate (Some social interactions, occasional loneliness)' },
          { value: 'isolated', label: 'Low / Socially isolated (loneliness carries equivalent risk to 15 cigarettes/day)' }
        ],
        default: 'strong'
      }
    ]
  },
  {
    id: 'biomarkers',
    title: 'Clinical Labs (Optional)',
    subtitle: 'Optional blood biomarkers for clinical precision',
    icon: 'thermometer',
    fields: [
      {
        id: 'hasLabs',
        label: 'Do you have recent blood lab tests?',
        type: 'select',
        options: [
          { value: 'no', label: 'No blood labs available (Use algorithm estimates)' },
          { value: 'yes', label: 'Yes, I want to input my lab values for clinical precision' }
        ],
        default: 'no'
      },
      {
        id: 'fastingGlucose',
        label: 'Fasting Blood Glucose (mg/dL)',
        type: 'number',
        min: 60,
        max: 250,
        default: 88,
        unit: 'mg/dL',
        dependsOn: { field: 'hasLabs', value: 'yes' },
        hint: 'Optimal fasting glucose is 70 - 90 mg/dL'
      },
      {
        id: 'cholesterolRatio',
        label: 'Total Cholesterol to HDL Ratio',
        type: 'number',
        min: 1.5,
        max: 10.0,
        step: 0.1,
        default: 3.2,
        dependsOn: { field: 'hasLabs', value: 'yes' },
        hint: 'Optimal ratio is under 3.5'
      },
      {
        id: 'hsCrp',
        label: 'hs-CRP (High-Sensitivity C-Reactive Protein - Inflammation)',
        type: 'select',
        options: [
          { value: 'low', label: 'Low (< 1.0 mg/L) - Minimal systemic inflammation' },
          { value: 'average', label: 'Average (1.0 - 3.0 mg/L) - Moderate risk' },
          { value: 'high', label: 'Elevated (> 3.0 mg/L) - High inflammatory burden' }
        ],
        default: 'low',
        dependsOn: { field: 'hasLabs', value: 'yes' }
      }
    ]
  }
];

export const DEMO_USERS = [
  {
    id: 'demo-optimal',
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
    id: 'demo-average',
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
    id: 'demo-high-risk',
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
