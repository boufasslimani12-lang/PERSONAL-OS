// Education engine. A subject's grade = weighted mean of graded assessments normalised to the subject's
// grade scale: Σ(score/max × scale × weight) / Σ weight. Semester average = Σ(subject grade × coefficient) / Σ coefficient
// over subjects that have at least one graded assessment.
export interface AssessmentLike { subject_id: string; score: number | null; max_score: number | null; weight: number; status: string }
export interface SubjectLike { id: string; coefficient: number; grade_scale: number }

export function subjectGrade(subject: SubjectLike, assessments: AssessmentLike[]): number | null {
  const graded = assessments.filter((a) => a.subject_id === subject.id && a.score !== null && a.max_score);
  if (!graded.length) return null;
  const w = graded.reduce((s, a) => s + Number(a.weight), 0);
  const total = graded.reduce((s, a) => s + (Number(a.score) / Number(a.max_score)) * Number(subject.grade_scale) * Number(a.weight), 0);
  return w ? total / w : null;
}

/** Weighted average expressed as a percentage (0–100), so subjects with different scales can be combined. */
export function semesterAveragePct(subjects: SubjectLike[], assessments: AssessmentLike[]): number | null {
  let num = 0;
  let den = 0;
  for (const s of subjects) {
    const g = subjectGrade(s, assessments);
    if (g === null) continue;
    num += (g / Number(s.grade_scale)) * 100 * Number(s.coefficient);
    den += Number(s.coefficient);
  }
  return den ? num / den : null;
}
