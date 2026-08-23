import type { GrowthFocusId } from "./core-growth";
import { FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY, getFamilyAssessmentMemoryQuestions } from "./family-assessment-capability-memory";

export type Ui02AssessmentAnswer = "OFTEN" | "SOMETIMES" | "RARELY" | "NOT_SURE";

export type Ui02AssessmentQuestion = {
  itemRef: string;
  text: string;
  intent: string;
  evidenceAnchor: string;
};

export const UI02_ASSESSMENT_VERSION = "FAMILY_SUPPORT_NEEDS/v2";

export const UI02_ASSESSMENT_ANSWER_OPTIONS = FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.answerOptions;

export const UI02_DEEP_ASSESSMENT_QUESTIONS = Object.fromEntries(
  FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions.map((dimension) => [dimension.focusId, dimension.questions]),
) as Record<GrowthFocusId, readonly Ui02AssessmentQuestion[]>;

export const UI02_DEEP_ASSESSMENT_ITEM_REFS = Object.values(UI02_DEEP_ASSESSMENT_QUESTIONS).flatMap((questions) => questions.map((question) => question.itemRef));

export function getUi02DeepAssessmentQuestions(focusId: GrowthFocusId | null) {
  return getFamilyAssessmentMemoryQuestions(focusId);
}
