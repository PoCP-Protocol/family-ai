import type { GrowthFocusId } from "./core-growth";

/**
 * UI-02 第 2/5 步的原图展示文案与排序。
 * 只负责首页测评步骤的呈现，不改变核心成长焦点 ID、API 语义或后续解读模型。
 */
export const UI02_ORIGINAL_FOCUS_LAYOUT: readonly {
  id: GrowthFocusId;
  title: string;
  subtitle: string;
}[] = [
  { id: "LEARNING_HABITS", title: "学习习惯", subtitle: "注意力不集中、作业拖拉" },
  { id: "EMOTION_REGULATION", title: "情绪管理", subtitle: "容易焦虑、暴躁脾气" },
  { id: "PARENT_CHILD_COMMUNICATION", title: "亲子沟通", subtitle: "不愿沟通、冲突较多" },
  { id: "DEVICE_USE_CONTEXT", title: "手机依赖", subtitle: "沉迷手机、使用失控" },
  { id: "SELF_REGULATION", title: "自律能力", subtitle: "缺乏自律、依赖监督" },
] as const;
