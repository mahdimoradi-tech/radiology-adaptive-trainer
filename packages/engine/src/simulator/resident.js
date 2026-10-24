/**
 * Virtual Resident representing a trainee with per-class diagnostic skill.
 */
export class VirtualResident {
  /**
   * @param {Object} [options={}] - Trainee parameters
   * @param {Record<import('@radiology/contracts').ClassId, number>} [options.initialSkills={ covid19: 0.45, pneumonia: 0.50, normal: 0.65 }]
   * @param {number} [options.difficultyPenalty=0.25] - Impact of image difficulty on accuracy
   * @param {number} [options.learningRate=0.03] - Trainee learning speed per question exposure
   * @param {number} [options.noiseStd=0.08] - Decision noise magnitude
   * @param {Record<import('@radiology/contracts').ClassId, import('@radiology/contracts').ClassId>} [options.confusionTargets]
   */
  constructor(options = {}) {
    this.skills = {
      covid19: options.initialSkills?.covid19 ?? 0.45,
      pneumonia: options.initialSkills?.pneumonia ?? 0.5,
      normal: options.initialSkills?.normal ?? 0.65,
    };
    this.difficultyPenalty = options.difficultyPenalty ?? 0.25;
    this.learningRate = options.learningRate ?? 0.03;
    this.noiseStd = options.noiseStd ?? 0.08;
    this.confusionTargets = options.confusionTargets ?? {
      covid19: 'pneumonia',
      pneumonia: 'covid19',
      normal: 'pneumonia',
    };
  }

  /**
   * Produce an answer for a chest X-ray image and update skill.
   *
   * @param {import('@radiology/contracts').ImageMeta} image - Image to evaluate
   * @param {ReturnType<import('../rng.js').createRng>} rng - PRNG instance
   * @returns {import('@radiology/contracts').ClassId} Answer chosen by resident
   */
  answer(image, rng) {
    const c = image.trueClass;
    const d = image.difficulty;
    const skill = this.skills[c] ?? 0.5;

    // Decision probability with difficulty penalty and noise
    const noise = (rng.next() - 0.5) * 2 * this.noiseStd;
    const probCorrect = Math.max(0.05, Math.min(0.98, skill - this.difficultyPenalty * d + noise));

    let answerChosen = c;
    if (rng.next() > probCorrect) {
      // Diagnostic error: pick confusable class
      answerChosen =
        image.confusedWith ||
        this.confusionTargets[c] ||
        (c === 'covid19' ? 'pneumonia' : 'covid19');
    }

    // Trainee learning update per exposure: skill += learningRate * (1 - skill)
    this.skills[c] += this.learningRate * (1 - this.skills[c]);

    return answerChosen;
  }
}
