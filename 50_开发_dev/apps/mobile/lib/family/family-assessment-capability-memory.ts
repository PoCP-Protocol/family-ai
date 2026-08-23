import type { GrowthFocusId } from "./core-growth";

export type FamilyAssessmentMemoryKind = "DIMENSION" | "ITEM" | "EVIDENCE_ANCHOR" | "PRACTICE_PATTERN" | "OUTCOME_FEEDBACK";
export type Ui02AssessmentAnswer = "OFTEN" | "SOMETIMES" | "RARELY" | "NOT_SURE";

export type FamilyAssessmentMemoryQuestion = {
  itemRef: string;
  text: string;
  intent: string;
  evidenceAnchor: string;
};

export type FamilyAssessmentBlueprintStep = {
  stepRef: string;
  title: string;
  purpose: string;
  outputUpperBound: "CONSENT" | "NEED" | "INTENT" | "PREFERENCE" | "DECISION";
  prompt: string;
};

export type FamilyAssessmentDimensionMemory = {
  focusId: GrowthFocusId;
  title: string;
  operationalDefinition: string;
  observableSignals: readonly string[];
  boundary: string;
  questions: readonly FamilyAssessmentMemoryQuestion[];
};

export type FamilyAssessmentCapabilityMemory = {
  capabilityRef: string;
  version: string;
  capabilityClass: "REAL_DOMAIN_CAPABILITY" | "REAL_MODEL_INTELLIGENCE";
  memoryKinds: readonly FamilyAssessmentMemoryKind[];
  assessmentToolRef: string;
  assessmentToolVersion: number;
  aiUseCase: "ASSESSMENT_INTERPRETATION";
  boundary: {
    truthClass: "FAMILY_PERSPECTIVE";
    notScore: true;
    notDiagnosis: true;
    noRanking: true;
    trainingUse: false;
    familyDataMemory: "NAMED_ACTION_AND_CONSENT_ONLY";
  };
  answerOptions: readonly { id: Ui02AssessmentAnswer; label: string }[];
  researchBasis: readonly string[];
  blueprint: {
    methodName: "Family Support Assessment";
    productLabel: "免费家庭测评";
    layer: "L0_FAMILY_NEED_AND_SERVICE_PREFERENCE";
    positioning: string;
    stepModel: readonly FamilyAssessmentBlueprintStep[];
  };
  dimensions: readonly FamilyAssessmentDimensionMemory[];
  improvementSignals: readonly string[];
};

export const FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY: FamilyAssessmentCapabilityMemory = {
  capabilityRef: "FAMILY_ASSESSMENT_AI_CAPABILITY",
  version: "v1",
  capabilityClass: "REAL_DOMAIN_CAPABILITY",
  memoryKinds: ["DIMENSION", "ITEM", "EVIDENCE_ANCHOR", "PRACTICE_PATTERN", "OUTCOME_FEEDBACK"],
  assessmentToolRef: "FAMILY_SUPPORT_NEEDS",
  assessmentToolVersion: 2,
  aiUseCase: "ASSESSMENT_INTERPRETATION",
  boundary: {
    truthClass: "FAMILY_PERSPECTIVE",
    notScore: true,
    notDiagnosis: true,
    noRanking: true,
    trainingUse: false,
    familyDataMemory: "NAMED_ACTION_AND_CONSENT_ONLY",
  },
  answerOptions: [
    { id: "OFTEN", label: "经常" },
    { id: "SOMETIMES", label: "有时" },
    { id: "RARELY", label: "很少" },
    { id: "NOT_SURE", label: "不确定" },
  ],
  researchBasis: [
    "Family 分层家庭支持评估框架：首阶段只能做 L0 家庭需要与偏好确认，不做评分、排名、诊断或儿童能力测验。",
    "CASEL SEL：家庭、学校、社区共同支持自我觉察、情绪管理、关系、负责决策与目标达成。",
    "CDC Essentials for Parenting：面向家长的支持应提供可使用的文章、视频和活动，而不是给家庭下结论。",
    "Harvard Executive Function：计划、注意、切换和任务管理能力依赖支持性环境，可通过实践发展。",
    "AAP HealthyChildren 媒介资料：数字媒介需要家长监测和共同解释，重点是家庭规则和支持。",
  ],
  blueprint: {
    methodName: "Family Support Assessment",
    productLabel: "免费家庭测评",
    layer: "L0_FAMILY_NEED_AND_SERVICE_PREFERENCE",
    positioning: "用 2-5 分钟帮助监护人说明此刻希望获得哪类家庭支持，并形成可追溯的 Need/Intent；不测量孩子、不生成结论。",
    stepModel: [
      { stepRef: "CONSENT_AND_BOUNDARY", title: "说明与同意", purpose: "说明非诊断、非评分、可退出和数据最小化。", outputUpperBound: "CONSENT", prompt: "这不是诊断或给孩子打分，只帮助你说明此刻希望获得哪类支持。" },
      { stepRef: "CURRENT_NEED", title: "当下关切", purpose: "让家庭用自己的语言或选择项表达当前最想理清的事。", outputUpperBound: "NEED", prompt: "最近最想一起理清的是哪件事？" },
      { stepRef: "SUPPORT_DIRECTION", title: "支持方向", purpose: "确认家庭希望先看哪类支持方向。", outputUpperBound: "INTENT", prompt: "你更希望先从哪类家庭支持开始？" },
      { stepRef: "SERVICE_PREFERENCE", title: "偏好与边界", purpose: "确认家庭愿意看文字资源、计划草案，或只保留记录。", outputUpperBound: "PREFERENCE", prompt: "你希望先看已准入的文字资源，还是只保留这次记录？" },
      { stepRef: "NEXT_DECISION", title: "结束确认", purpose: "由家庭明确选择继续、返回、暂停或暂不行动。", outputUpperBound: "DECISION", prompt: "你可以选择一个下一步，也可以暂不行动。" },
    ],
  },
  dimensions: [
    {
      focusId: "LEARNING_HABITS",
      title: "学习习惯",
      operationalDefinition: "家庭情境中孩子启动、维持、完成学习任务时获得结构支持的情况。",
      observableSignals: ["作业启动", "困难坚持", "家庭学习节奏"],
      boundary: "不推断智力、学习障碍或学习成绩原因。",
      questions: [
        { itemRef: "LEARNING_HABITS_Q01", text: "过去两周，孩子开始写作业前常需要反复提醒。", intent: "观察任务启动与外部催促依赖。", evidenceAnchor: "学习习惯与执行功能实践假设；需后续研究证据补强。" },
        { itemRef: "LEARNING_HABITS_Q02", text: "孩子遇到稍难的题目时，容易拖延、分心或直接放弃。", intent: "观察坚持性与困难恢复。", evidenceAnchor: "自我调节学习与任务坚持相关研究概念。" },
        { itemRef: "LEARNING_HABITS_Q03", text: "家里目前缺少稳定的学习开始、休息和收尾节奏。", intent: "观察家庭情境中的学习结构支持。", evidenceAnchor: "家庭学习环境与例行情境实践经验。" },
      ],
    },
    {
      focusId: "EMOTION_REGULATION",
      title: "情绪管理",
      operationalDefinition: "孩子情绪触发、表达、恢复，以及家长共同调节支持的家庭互动情况。",
      observableSignals: ["恢复时间", "冲突暂停", "家长回应策略"],
      boundary: "不判断心理疾病、气质类型或临床风险。",
      questions: [
        { itemRef: "EMOTION_REGULATION_Q01", text: "过去两周，孩子情绪上来后需要较长时间才能恢复。", intent: "观察情绪恢复时间。", evidenceAnchor: "情绪调节研究中的恢复与调节策略概念。" },
        { itemRef: "EMOTION_REGULATION_Q02", text: "亲子冲突中，大人和孩子都很难先暂停再说。", intent: "观察共同调节和冲突暂停能力。", evidenceAnchor: "亲子互动中的共同调节实践假设。" },
        { itemRef: "EMOTION_REGULATION_Q03", text: "孩子表达焦虑、生气或委屈时，家长不太确定如何回应。", intent: "观察家长回应策略需求。", evidenceAnchor: "家庭情绪支持与回应方式相关研究概念。" },
      ],
    },
    {
      focusId: "PARENT_CHILD_COMMUNICATION",
      title: "亲子沟通",
      operationalDefinition: "孩子是否愿意表达、家长是否能倾听，以及冲突后关系修复的家庭循环。",
      observableSignals: ["表达意愿", "讲道理/纠正循环", "冲突修复"],
      boundary: "不把一次冲突概括成关系事实或孩子性格标签。",
      questions: [
        { itemRef: "PARENT_CHILD_COMMUNICATION_Q01", text: "孩子遇到不顺心的事，通常不太愿意主动和家长说。", intent: "观察沟通意愿与信任入口。", evidenceAnchor: "亲子沟通开放性与家庭支持研究概念。" },
        { itemRef: "PARENT_CHILD_COMMUNICATION_Q02", text: "家长想帮助孩子时，对话容易变成讲道理、纠正或争执。", intent: "观察沟通循环与冲突升级。", evidenceAnchor: "亲子冲突与沟通方式实践经验。" },
        { itemRef: "PARENT_CHILD_COMMUNICATION_Q03", text: "冲突后，家里较少有重新和好、复盘或修复的过程。", intent: "观察关系修复机制。", evidenceAnchor: "关系修复与家庭互动质量研究概念。" },
      ],
    },
    {
      focusId: "DEVICE_USE_CONTEXT",
      title: "手机依赖",
      operationalDefinition: "数字设备使用对睡眠、作业、家庭节奏与亲子规则协商的影响。",
      observableSignals: ["日常功能干扰", "围绕设备冲突", "规则一致性"],
      boundary: "不使用成瘾诊断，不把设备问题单独归因于孩子。",
      questions: [
        { itemRef: "DEVICE_USE_CONTEXT_Q01", text: "手机或平板使用经常影响作业、睡眠或家庭安排。", intent: "观察屏幕使用对日常功能的干扰。", evidenceAnchor: "青少年数字媒介使用与睡眠/学习干扰研究概念。" },
        { itemRef: "DEVICE_USE_CONTEXT_Q02", text: "围绕手机使用，家里经常发生讨价还价或冲突。", intent: "观察规则执行中的亲子冲突。", evidenceAnchor: "家庭媒介规则与冲突管理实践经验。" },
        { itemRef: "DEVICE_USE_CONTEXT_Q03", text: "家里的手机规则不够清楚，或大人和孩子执行标准不一致。", intent: "观察边界清晰度与一致性。", evidenceAnchor: "家庭规则一致性与行为边界研究概念。" },
      ],
    },
    {
      focusId: "SELF_REGULATION",
      title: "自律能力",
      operationalDefinition: "孩子在家庭支持下参与计划、执行、检查和复盘的自我管理过程。",
      observableSignals: ["监督依赖", "自主参与", "方法复盘"],
      boundary: "不评价孩子懒惰或意志品质，不生成能力排名。",
      questions: [
        { itemRef: "SELF_REGULATION_Q01", text: "孩子完成日常任务时，比较依赖家长全程监督。", intent: "观察外部监督依赖。", evidenceAnchor: "自我调节与执行功能研究概念。" },
        { itemRef: "SELF_REGULATION_Q02", text: "孩子较少参与制定自己的计划、目标或检查方式。", intent: "观察自主参与程度。", evidenceAnchor: "自主性支持与自我管理实践经验。" },
        { itemRef: "SELF_REGULATION_Q03", text: "事情没做好时，家里通常忙着催促补救，较少一起复盘方法。", intent: "观察反思和策略调整。", evidenceAnchor: "自我调节学习中的监控与反思概念。" },
      ],
    },
  ],
  improvementSignals: ["completion_rate", "dropoff_item_ref", "not_sure_rate", "parent_feedback", "human_review_outcome", "followup_action_usefulness"],
} as const;

export function getFamilyAssessmentDimensionMemory(focusId: GrowthFocusId | null) {
  return FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions.find((dimension) => dimension.focusId === focusId) ?? null;
}

export function getFamilyAssessmentMemoryQuestions(focusId: GrowthFocusId | null) {
  return getFamilyAssessmentDimensionMemory(focusId)?.questions ?? [];
}
