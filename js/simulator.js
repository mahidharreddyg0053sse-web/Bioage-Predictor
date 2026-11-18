/**
 * Longevity Interactive Simulator (What-If Habit Optimization Engine)
 * Allows users to tweak levers in real-time and observe immediate gains in life years and biological youth.
 */
import { evaluateBiologicalAge } from './calculator.js';

export class LongevitySimulator {
  constructor(baseData, onUpdateCallback) {
    this.baseData = { ...baseData };
    this.simulatedData = { ...baseData };
    this.onUpdateCallback = onUpdateCallback;
    this.baseEvaluation = evaluateBiologicalAge(this.baseData);
  }

  setBaseData(newData) {
    this.baseData = { ...newData };
    this.simulatedData = { ...newData };
    this.baseEvaluation = evaluateBiologicalAge(this.baseData);
    this.calculate();
  }

  updateParam(key, value) {
    this.simulatedData[key] = value;
    return this.calculate();
  }

  reset() {
    this.simulatedData = { ...this.baseData };
    return this.calculate();
  }

  optimizeAll() {
    this.simulatedData = {
      ...this.simulatedData,
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
      socialConnection: 'strong'
    };
    return this.calculate();
  }

  calculate() {
    const simEvaluation = evaluateBiologicalAge(this.simulatedData);

    const bioAgeDelta = +(simEvaluation.biologicalAge - this.baseEvaluation.biologicalAge).toFixed(1);
    const lifeYearsGained = +(simEvaluation.projectedLifeExpectancy - this.baseEvaluation.projectedLifeExpectancy).toFixed(1);

    const result = {
      baseEvaluation: this.baseEvaluation,
      simEvaluation,
      bioAgeDelta, // negative is good (e.g. -4.2 years younger)
      lifeYearsGained, // positive is good (e.g. +5.8 additional life years)
      simulatedData: this.simulatedData
    };

    if (this.onUpdateCallback) {
      this.onUpdateCallback(result);
    }

    return result;
  }
}
