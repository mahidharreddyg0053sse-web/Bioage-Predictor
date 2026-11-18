/**
 * BioAge Pro — Server-Side Geroscience Biological Age Engine
 */
function calculateBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg) return 23.0;
  const heightM = heightCm / 100;
  return +(weightKg / (heightM * heightM)).toFixed(1);
}

function evaluateBiologicalAge(formData) {
  const age = Number(formData.chronologicalAge) || 35;
  const gender = formData.gender || 'male';
  const bmi = calculateBMI(formData.height, formData.weight);
  const rhr = Number(formData.restingHeartRate) || 70;
  const sysBp = Number(formData.bloodPressureSystolic) || 120;
  const diaBp = Number(formData.bloodPressureDiastolic) || 80;

  let cardioDelta = 0;
  let metabolicDelta = 0;
  let cellularDelta = 0;
  let cognitiveDelta = 0;

  // BMI
  let bmiDelta = 0;
  if (bmi < 18.5) bmiDelta = 0.5;
  else if (bmi <= 24.9) bmiDelta = -1.0;
  else if (bmi <= 27.9) bmiDelta = 0.6;
  else if (bmi <= 31.9) bmiDelta = 1.8;
  else bmiDelta = 3.4;
  metabolicDelta += bmiDelta;

  // RHR
  let rhrDelta = 0;
  if (rhr < 56) rhrDelta = -1.8;
  else if (rhr <= 65) rhrDelta = -0.8;
  else if (rhr <= 75) rhrDelta = 0.3;
  else if (rhr <= 85) rhrDelta = 1.6;
  else rhrDelta = 2.8;
  cardioDelta += rhrDelta;

  // BP
  let bpDelta = 0;
  if (sysBp < 118 && diaBp < 78) bpDelta = -1.4;
  else if (sysBp <= 126 && diaBp <= 82) bpDelta = 0.2;
  else if (sysBp <= 138 || diaBp <= 88) bpDelta = 1.8;
  else bpDelta = 3.6;
  cardioDelta += bpDelta;

  // Diet
  let medDelta = formData.mediterraneanScore === 'high' ? -2.4 : formData.mediterraneanScore === 'moderate' ? 0.0 : 2.2;
  let upfDelta = formData.ultraProcessedFood === 'rare' ? -1.5 : formData.ultraProcessedFood === 'moderate' ? 0.2 : 2.6;
  let sugarDelta = formData.sugarIntake === 'minimal' ? -1.0 : formData.sugarIntake === 'moderate' ? 0.1 : 2.0;
  let waterDelta = formData.dailyWater === 'optimal' ? -0.7 : formData.dailyWater === 'adequate' ? 0.0 : 0.9;
  let ifDelta = formData.intermittentFasting === 'yes' ? -1.1 : 0.4;

  metabolicDelta += (medDelta * 0.6) + (upfDelta * 0.5) + sugarDelta + (ifDelta * 0.4);
  cellularDelta += (medDelta * 0.4) + upfDelta + (waterDelta * 0.5) + (ifDelta * 0.6);

  // Sleep
  let sleepDurDelta = formData.sleepDuration === 'optimal' ? -2.0 : formData.sleepDuration === 'mild_deficit' ? 1.3 : formData.sleepDuration === 'severe_deficit' ? 3.4 : 1.0;
  let sleepQualDelta = (formData.sleepConsistency === 'consistent' ? -0.8 : formData.sleepConsistency === 'erratic' ? 1.4 : 0) + (formData.sleepQuality === 'refreshed' ? -1.0 : formData.sleepQuality === 'poor' ? 1.8 : 0);

  cellularDelta += sleepDurDelta * 0.6;
  cognitiveDelta += (sleepDurDelta * 0.6) + sleepQualDelta;

  // Fitness
  let cardioMinsDelta = formData.cardioMinutes === 'high' ? -3.2 : formData.cardioMinutes === 'moderate' ? -1.2 : formData.cardioMinutes === 'low' ? 1.2 : 3.0;
  let strengthDelta = formData.strengthDays === 'optimal' ? -2.0 : formData.strengthDays === 'moderate' ? -0.6 : 1.6;
  let stepDelta = (formData.dailySteps === 'high' ? -1.4 : formData.dailySteps === 'moderate' ? -0.5 : formData.dailySteps === 'fair' ? 0.6 : 1.8) + (formData.sedentaryHours === 'low' ? -0.8 : formData.sedentaryHours === 'high' ? 1.6 : 0);

  cardioDelta += cardioMinsDelta + (stepDelta * 0.5);
  metabolicDelta += strengthDelta;

  // Habits
  let smokingDelta = formData.smokingStatus === 'never' ? -0.5 : formData.smokingStatus === 'former' ? 1.0 : formData.smokingStatus === 'light' ? 3.8 : 7.5;
  let alcoholDelta = formData.alcoholIntake === 'none' ? -0.4 : formData.alcoholIntake === 'low' ? 0.0 : formData.alcoholIntake === 'moderate' ? 1.3 : 3.6;
  let stressDelta = formData.stressLevel === 'low' ? -1.4 : formData.stressLevel === 'moderate' ? 0.4 : 2.8;
  let socialDelta = formData.socialConnection === 'strong' ? -1.6 : formData.socialConnection === 'average' ? 0.1 : 2.4;

  cardioDelta += smokingDelta * 0.6;
  cellularDelta += (smokingDelta * 0.6) + (alcoholDelta * 0.6);
  cognitiveDelta += stressDelta + socialDelta + (alcoholDelta * 0.4);

  const totalDelta = +(bmiDelta + rhrDelta + bpDelta + medDelta + upfDelta + sugarDelta + waterDelta + ifDelta + sleepDurDelta + sleepQualDelta + cardioMinsDelta + strengthDelta + stepDelta + smokingDelta + alcoholDelta + stressDelta + socialDelta).toFixed(1);

  const minPossibleBioAge = Math.max(18, age - 14);
  const maxPossibleBioAge = Math.min(100, age + 25);
  let biologicalAge = +(age + totalDelta).toFixed(1);
  if (biologicalAge < minPossibleBioAge) biologicalAge = minPossibleBioAge;
  if (biologicalAge > maxPossibleBioAge) biologicalAge = maxPossibleBioAge;

  const baseExpectancy = gender === 'female' ? 81.4 : 76.3;
  let projectedLifeExpectancy = +(baseExpectancy - (totalDelta * 0.75)).toFixed(1);
  if (projectedLifeExpectancy > 102) projectedLifeExpectancy = 102.0;
  if (projectedLifeExpectancy < Math.max(age + 3, 58)) projectedLifeExpectancy = +(Math.max(age + 3, 58)).toFixed(1);

  const paceOfAging = +(biologicalAge / age).toFixed(2);

  return {
    chronologicalAge: age,
    biologicalAge,
    ageDifference: +(biologicalAge - age).toFixed(1),
    projectedLifeExpectancy,
    remainingYears: +(projectedLifeExpectancy - age).toFixed(1),
    baselineExpectancy: baseExpectancy,
    lifeYearsDelta: +(projectedLifeExpectancy - baseExpectancy).toFixed(1),
    paceOfAging,
    paceCategory: paceOfAging < 0.92 ? 'Decelerated (Slow)' : paceOfAging > 1.08 ? 'Accelerated' : 'Normal',
    bmi,
    organAges: {
      cardiovascular: Math.max(18, +(age + (cardioDelta * 0.85)).toFixed(1)),
      metabolic: Math.max(18, +(age + (metabolicDelta * 0.85)).toFixed(1)),
      cellular: Math.max(18, +(age + (cellularDelta * 0.85)).toFixed(1)),
      cognitive: Math.max(18, +(age + (cognitiveDelta * 0.85)).toFixed(1))
    },
    domainScores: {
      cardiovascular: Math.min(100, Math.max(25, Math.round(80 - (cardioDelta * 5)))),
      nutrition: Math.min(100, Math.max(25, Math.round(80 - ((medDelta + upfDelta + sugarDelta) * 4)))),
      sleep: Math.min(100, Math.max(25, Math.round(80 - ((sleepDurDelta + sleepQualDelta) * 6)))),
      physicalFitness: Math.min(100, Math.max(25, Math.round(80 - ((cardioMinsDelta + strengthDelta + stepDelta) * 4)))),
      mentalResilience: Math.min(100, Math.max(25, Math.round(80 - ((stressDelta + socialDelta) * 5))))
    }
  };
}

module.exports = {
  calculateBMI,
  evaluateBiologicalAge
};
