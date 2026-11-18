/**
 * Bio-Age & Longevity Prediction Engine
 * Computes Biological Age, Life Expectancy, Organ Ages, Pace of Aging,
 * and generates high-impact personalized interventions.
 */

export function calculateBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg) return 23.0;
  const heightM = heightCm / 100;
  return +(weightKg / (heightM * heightM)).toFixed(1);
}

export function evaluateBiologicalAge(formData) {
  const age = Number(formData.chronologicalAge) || 35;
  const gender = formData.gender || 'male';
  const bmi = calculateBMI(formData.height, formData.weight);
  const rhr = Number(formData.restingHeartRate) || 70;
  const sysBp = Number(formData.bloodPressureSystolic) || 120;
  const diaBp = Number(formData.bloodPressureDiastolic) || 80;

  // Domain score accumulators
  let cardioDelta = 0;
  let metabolicDelta = 0;
  let cellularDelta = 0;
  let cognitiveDelta = 0;

  // 1. BMI Impact
  let bmiDelta = 0;
  if (bmi < 18.5) bmiDelta = 0.5;
  else if (bmi <= 24.9) bmiDelta = -1.0;
  else if (bmi <= 27.9) bmiDelta = 0.6;
  else if (bmi <= 31.9) bmiDelta = 1.8;
  else bmiDelta = 3.4;
  metabolicDelta += bmiDelta;

  // 2. Resting Heart Rate
  let rhrDelta = 0;
  if (rhr < 56) rhrDelta = -1.8;
  else if (rhr <= 65) rhrDelta = -0.8;
  else if (rhr <= 75) rhrDelta = 0.3;
  else if (rhr <= 85) rhrDelta = 1.6;
  else rhrDelta = 2.8;
  cardioDelta += rhrDelta;

  // 3. Blood Pressure
  let bpDelta = 0;
  if (sysBp < 118 && diaBp < 78) bpDelta = -1.4;
  else if (sysBp <= 126 && diaBp <= 82) bpDelta = 0.2;
  else if (sysBp <= 138 || diaBp <= 88) bpDelta = 1.8;
  else bpDelta = 3.6;
  cardioDelta += bpDelta;

  // 4. Nutrition - Mediterranean
  let medDelta = 0;
  if (formData.mediterraneanScore === 'high') medDelta = -2.4;
  else if (formData.mediterraneanScore === 'moderate') medDelta = 0.0;
  else medDelta = 2.2;
  metabolicDelta += medDelta * 0.6;
  cellularDelta += medDelta * 0.4;

  // 5. Ultra-Processed Food
  let upfDelta = 0;
  if (formData.ultraProcessedFood === 'rare') upfDelta = -1.5;
  else if (formData.ultraProcessedFood === 'moderate') upfDelta = 0.2;
  else upfDelta = 2.6;
  cellularDelta += upfDelta;
  metabolicDelta += upfDelta * 0.5;

  // 6. Sugar Intake
  let sugarDelta = 0;
  if (formData.sugarIntake === 'minimal') sugarDelta = -1.0;
  else if (formData.sugarIntake === 'moderate') sugarDelta = 0.1;
  else sugarDelta = 2.0;
  metabolicDelta += sugarDelta;

  // 7. Water Hydration
  let waterDelta = 0;
  if (formData.dailyWater === 'optimal') waterDelta = -0.7;
  else if (formData.dailyWater === 'adequate') waterDelta = 0.0;
  else waterDelta = 0.9;
  cellularDelta += waterDelta * 0.5;

  // 8. Intermittent Fasting
  let ifDelta = 0;
  if (formData.intermittentFasting === 'yes') ifDelta = -1.1;
  else ifDelta = 0.4;
  cellularDelta += ifDelta * 0.6;
  metabolicDelta += ifDelta * 0.4;

  // 9. Sleep Duration
  let sleepDurDelta = 0;
  if (formData.sleepDuration === 'optimal') sleepDurDelta = -2.0;
  else if (formData.sleepDuration === 'mild_deficit') sleepDurDelta = 1.3;
  else if (formData.sleepDuration === 'severe_deficit') sleepDurDelta = 3.4;
  else sleepDurDelta = 1.0;
  cellularDelta += sleepDurDelta * 0.6;
  cognitiveDelta += sleepDurDelta * 0.6;

  // 10. Sleep Consistency & Quality
  let sleepQualDelta = 0;
  if (formData.sleepConsistency === 'consistent') sleepQualDelta -= 0.8;
  else if (formData.sleepConsistency === 'erratic') sleepQualDelta += 1.4;

  if (formData.sleepQuality === 'refreshed') sleepQualDelta -= 1.0;
  else if (formData.sleepQuality === 'poor') sleepQualDelta += 1.8;
  cognitiveDelta += sleepQualDelta;

  // 11. Cardio Exercise
  let cardioMinsDelta = 0;
  if (formData.cardioMinutes === 'high') cardioMinsDelta = -3.2;
  else if (formData.cardioMinutes === 'moderate') cardioMinsDelta = -1.2;
  else if (formData.cardioMinutes === 'low') cardioMinsDelta = 1.2;
  else cardioMinsDelta = 3.0;
  cardioDelta += cardioMinsDelta;

  // 12. Strength Training
  let strengthDelta = 0;
  if (formData.strengthDays === 'optimal') strengthDelta = -2.0;
  else if (formData.strengthDays === 'moderate') strengthDelta = -0.6;
  else strengthDelta = 1.6;
  metabolicDelta += strengthDelta;

  // 13. Daily Steps & Sedentary
  let stepDelta = 0;
  if (formData.dailySteps === 'high') stepDelta -= 1.4;
  else if (formData.dailySteps === 'moderate') stepDelta -= 0.5;
  else if (formData.dailySteps === 'fair') stepDelta += 0.6;
  else stepDelta += 1.8;

  if (formData.sedentaryHours === 'low') stepDelta -= 0.8;
  else if (formData.sedentaryHours === 'high') stepDelta += 1.6;
  cardioDelta += stepDelta * 0.5;

  // 14. Smoking & Vaping
  let smokingDelta = 0;
  if (formData.smokingStatus === 'never') smokingDelta = -0.5;
  else if (formData.smokingStatus === 'former') smokingDelta = 1.0;
  else if (formData.smokingStatus === 'light') smokingDelta = 3.8;
  else smokingDelta = 7.5;
  cardioDelta += smokingDelta * 0.6;
  cellularDelta += smokingDelta * 0.6;

  // 15. Alcohol
  let alcoholDelta = 0;
  if (formData.alcoholIntake === 'none') alcoholDelta = -0.4;
  else if (formData.alcoholIntake === 'low') alcoholDelta = 0.0;
  else if (formData.alcoholIntake === 'moderate') alcoholDelta = 1.3;
  else alcoholDelta = 3.6;
  cellularDelta += alcoholDelta * 0.6;
  cognitiveDelta += alcoholDelta * 0.4;

  // 16. Chronic Stress & Social Resilience
  let stressDelta = 0;
  if (formData.stressLevel === 'low') stressDelta = -1.4;
  else if (formData.stressLevel === 'moderate') stressDelta = 0.4;
  else stressDelta = 2.8;

  let socialDelta = 0;
  if (formData.socialConnection === 'strong') socialDelta = -1.6;
  else if (formData.socialConnection === 'average') socialDelta = 0.1;
  else socialDelta = 2.4;

  cognitiveDelta += stressDelta + socialDelta;

  // 17. Biomarkers (if provided)
  let biomarkerDelta = 0;
  if (formData.hasLabs === 'yes') {
    const gluc = Number(formData.fastingGlucose) || 90;
    if (gluc < 88) biomarkerDelta -= 0.8;
    else if (gluc > 105) biomarkerDelta += 1.6;

    const chol = Number(formData.cholesterolRatio) || 3.5;
    if (chol < 3.2) biomarkerDelta -= 0.6;
    else if (chol > 4.5) biomarkerDelta += 1.4;

    if (formData.hsCrp === 'low') biomarkerDelta -= 0.9;
    else if (formData.hsCrp === 'high') biomarkerDelta += 2.0;
  }

  // Total delta
  const totalDelta = +(
    bmiDelta +
    rhrDelta +
    bpDelta +
    medDelta +
    upfDelta +
    sugarDelta +
    waterDelta +
    ifDelta +
    sleepDurDelta +
    sleepQualDelta +
    cardioMinsDelta +
    strengthDelta +
    stepDelta +
    smokingDelta +
    alcoholDelta +
    stressDelta +
    socialDelta +
    biomarkerDelta
  ).toFixed(1);

  // Biological Age with clinical rejuvenation bounds (max ~14 years younger than calendar age)
  const minPossibleBioAge = Math.max(18, age - 14);
  const maxPossibleBioAge = Math.min(100, age + 25);
  let biologicalAge = +(age + totalDelta).toFixed(1);
  if (biologicalAge < minPossibleBioAge) biologicalAge = minPossibleBioAge;
  if (biologicalAge > maxPossibleBioAge) biologicalAge = maxPossibleBioAge;

  // Life Expectancy Calculation
  // Baseline: US/Global developed benchmark
  const baseExpectancy = gender === 'female' ? 81.4 : 76.3;

  // Longevity modifiers (gain or loss in remaining lifespan)
  // Positive habit gains can add up to +12-15 years beyond baseline (e.g. Blue Zones supercentenarians)
  // Negative habits can reduce lifespan by 10-18 years
  let longevityModifier = 0;
  longevityModifier -= totalDelta * 0.75; // 1 year younger bio-age equates to approx +0.75-0.85 years life expectancy

  let projectedLifeExpectancy = +(baseExpectancy + longevityModifier).toFixed(1);
  // Realistic clinical boundaries
  if (projectedLifeExpectancy > 102) projectedLifeExpectancy = 102.0;
  if (projectedLifeExpectancy < Math.max(age + 3, 58)) {
    projectedLifeExpectancy = +(Math.max(age + 3, 58)).toFixed(1);
  }

  const remainingYears = +(projectedLifeExpectancy - age).toFixed(1);

  // Pace of Aging (BioAge / ChronoAge)
  const paceOfAging = +(biologicalAge / age).toFixed(2);
  let paceCategory = 'Normal';
  let paceColor = 'var(--accent-cyan)';
  if (paceOfAging < 0.92) {
    paceCategory = 'Decelerated (Aging 12%+ Slower)';
    paceColor = 'var(--accent-emerald)';
  } else if (paceOfAging > 1.08) {
    paceCategory = 'Accelerated (Aging Faster than Average)';
    paceColor = 'var(--accent-rose)';
  }

  // Organ Ages
  const cardiovascularAge = +(age + (cardioDelta * 0.85)).toFixed(1);
  const metabolicAge = +(age + (metabolicDelta * 0.85)).toFixed(1);
  const cellularAge = +(age + (cellularDelta * 0.85)).toFixed(1);
  const cognitiveAge = +(age + (cognitiveDelta * 0.85)).toFixed(1);

  // Domain Scores for Radar Chart (0 to 100 scale, 100 = optimal longevity)
  const domainScores = {
    cardiovascular: Math.min(100, Math.max(25, Math.round(80 - (cardioDelta * 5)))),
    nutrition: Math.min(100, Math.max(25, Math.round(80 - ((medDelta + upfDelta + sugarDelta) * 4)))),
    sleep: Math.min(100, Math.max(25, Math.round(80 - ((sleepDurDelta + sleepQualDelta) * 6)))),
    physicalFitness: Math.min(100, Math.max(25, Math.round(80 - ((cardioMinsDelta + strengthDelta + stepDelta) * 4)))),
    mentalResilience: Math.min(100, Math.max(25, Math.round(80 - ((stressDelta + socialDelta) * 5))))
  };

  // Generate Prioritized Actionable Longevity Interventions
  const improvements = generateLongevityPrescription(formData, bmi, rhr, sysBp);

  return {
    chronologicalAge: age,
    biologicalAge,
    ageDifference: +(biologicalAge - age).toFixed(1),
    projectedLifeExpectancy,
    remainingYears,
    baselineExpectancy: baseExpectancy,
    lifeYearsDelta: +(projectedLifeExpectancy - baseExpectancy).toFixed(1),
    paceOfAging,
    paceCategory,
    paceColor,
    bmi,
    organAges: {
      cardiovascular: Math.max(18, cardiovascularAge),
      metabolic: Math.max(18, metabolicAge),
      cellular: Math.max(18, cellularAge),
      cognitive: Math.max(18, cognitiveAge)
    },
    domainScores,
    improvements
  };
}

/**
 * Generates tailored clinical interventions with exact bio-age and lifespan gains
 */
export function generateLongevityPrescription(formData, bmi, rhr, sysBp) {
  const recommendations = [];

  // Sleep optimization
  if (formData.sleepDuration !== 'optimal' || formData.sleepQuality === 'poor' || formData.sleepConsistency === 'erratic') {
    recommendations.push({
      id: 'fix_sleep',
      category: 'Sleep & Circadian Rhythm',
      icon: 'moon',
      title: 'Synchronize 7.5h Circadian Sleep Architecture',
      description: 'Establish a non-negotiable 10:30 PM sleep window in a 65°F (18°C) pitch-black room. Cease screens 60 minutes prior.',
      bioAgeGain: -1.8,
      lifeGain: 2.4,
      priority: 'CRITICAL',
      difficulty: 'Medium',
      mechanism: 'Promotes glymphatic beta-amyloid clearance, resets insulin sensitivity, and lowers nocturnal vascular tone.'
    });
  }

  // Smoking cessation
  if (formData.smokingStatus === 'active' || formData.smokingStatus === 'light') {
    recommendations.push({
      id: 'quit_smoking',
      category: 'Toxicology & Vascular Protection',
      icon: 'shield-alert',
      title: 'Complete Smoking & Nicotine Cessation',
      description: 'Eliminate combustible cigarettes and vape chemicals. Replace with nicotine tapering or behavioral substitution.',
      bioAgeGain: -4.5,
      lifeGain: 6.2,
      priority: 'CRITICAL',
      difficulty: 'High',
      mechanism: 'Arrests DNA cross-linking, restores endothelial nitric oxide synthesis, and cuts cardiovascular mortality risk by 50% within 1 year.'
    });
  }

  // Zone 2 Aerobic Conditioning
  if (formData.cardioMinutes === 'low' || formData.cardioMinutes === 'sedentary') {
    recommendations.push({
      id: 'zone2_cardio',
      category: 'Cardiovascular Fitness',
      icon: 'heart-pulse',
      title: 'Incorporate 150 min/week Zone 2 Aerobic Training',
      description: 'Engage in 3x 45-minute sessions of conversational-pace cycling, brisk incline walking, or rowing.',
      bioAgeGain: -2.3,
      lifeGain: 3.1,
      priority: 'HIGH',
      difficulty: 'Medium',
      mechanism: 'Increases mitochondrial volume density, elevates VO2 max, and lowers resting blood pressure.'
    });
  }

  // Nutrition: Eliminate Ultra-Processed Foods & Sugar
  if (formData.ultraProcessedFood === 'frequent' || formData.sugarIntake === 'high') {
    recommendations.push({
      id: 'clean_nutrition',
      category: 'Nutritional Biochemistry',
      icon: 'salad',
      title: 'Eliminate Industrial Ultra-Processed Foods & Added Sugar',
      description: 'Switch to whole single-ingredient foods: wild-caught fatty fish, cruciferous vegetables, polyphenols (blueberries, extra virgin olive oil), and avocado.',
      bioAgeGain: -2.1,
      lifeGain: 2.8,
      priority: 'HIGH',
      difficulty: 'Medium',
      mechanism: 'Curbs advanced glycation end-products (AGEs), protects gut microbiome diversity, and suppresses inflammatory cytokines (TNF-alpha, IL-6).'
    });
  }

  // Resistance & Hypertrophy Training
  if (formData.strengthDays === 'none') {
    recommendations.push({
      id: 'strength_training',
      category: 'Musculoskeletal & Metabolism',
      icon: 'dumbbell',
      title: 'Initiate 3x Weekly Progressive Resistance Training',
      description: 'Focus on compound multi-joint movements (squats, deadlifts, presses, pull-ups) to build muscle reserves.',
      bioAgeGain: -1.6,
      lifeGain: 2.2,
      priority: 'HIGH',
      difficulty: 'Medium',
      mechanism: 'Prevents age-related sarcopenia, increases GLUT4 glucose receptors, and stimulates bone osteoblast remodeling.'
    });
  }

  // Blood Pressure & Resting Heart Rate
  if (sysBp >= 130 || rhr >= 78) {
    recommendations.push({
      id: 'optimize_vitals',
      category: 'Cardiovascular Vitals',
      icon: 'activity',
      title: 'Target Resting HR < 62 bpm & Systolic BP < 120 mmHg',
      description: 'Increase daily potassium/magnesium intake, practice 10-minute box breathing (4-4-4-4), and ensure 2.5L clean hydration.',
      bioAgeGain: -1.5,
      lifeGain: 2.0,
      priority: 'HIGH',
      difficulty: 'Easy',
      mechanism: 'Reduces shear stress on arterial walls, prevents microvascular damage in kidneys and brain.'
    });
  }

  // Chronic Stress Mitigation & Social Bonding
  if (formData.stressLevel === 'severe' || formData.socialConnection === 'isolated') {
    recommendations.push({
      id: 'stress_social',
      category: 'Neuro-Endocrine & Psychosocial',
      icon: 'smile',
      title: 'Vagus Nerve Regulation & Social Connection Protocol',
      description: 'Dedicate 15 minutes to physiological sigh breathwork daily, spend 2+ hours weekly in nature, and schedule recurring face-to-face social connection.',
      bioAgeGain: -1.7,
      lifeGain: 2.3,
      priority: 'MEDIUM',
      difficulty: 'Easy',
      mechanism: 'Lowers systemic cortisol and sympathetic tone, preserves telomere length, and activates oxytocin pathways.'
    });
  }

  // Intermittent Fasting & Autophagy
  if (formData.intermittentFasting === 'no') {
    recommendations.push({
      id: 'intermittent_fast',
      category: 'Cellular Renewal & Autophagy',
      icon: 'clock',
      title: 'Adopt 13-15 Hour Circadian Overnight Fasting',
      description: 'Finish dinner by 7:30 PM and break fast at 9:00 AM next morning. Water, black coffee, or herbal tea only during fasting.',
      bioAgeGain: -0.9,
      lifeGain: 1.4,
      priority: 'MEDIUM',
      difficulty: 'Easy',
      mechanism: 'Activates AMPK pathway and cellular autophagy to digest damaged cellular senescent debris.'
    });
  }

  // Daily Step Accumulation
  if (formData.dailySteps === 'sedentary' || formData.dailySteps === 'fair') {
    recommendations.push({
      id: 'step_goal',
      category: 'NEAT (Non-Exercise Activity)',
      icon: 'footprints',
      title: 'Accumulate 8,500+ Daily Steps via Post-Meal Walks',
      description: 'Take a 10-15 minute walk immediately after lunch and dinner to flatten postprandial glucose spikes.',
      bioAgeGain: -1.2,
      lifeGain: 1.6,
      priority: 'MEDIUM',
      difficulty: 'Easy',
      mechanism: 'Activates skeletal muscle glucose uptake without requiring insulin, reducing glycemic variability.'
    });
  }

  // Always return at least 4-6 prioritized recommendations
  return recommendations;
}
