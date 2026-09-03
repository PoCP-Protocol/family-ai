import type { Href } from "expo-router";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { UI01_HOME_TARGETS } from "@/lib/family/ui01-home-entry-map";
import { createMobileRequestId, familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";

const assessmentBanner = require("@/assets/images/ui01/assessment-banner.png");
const recommendationLive = require("@/assets/images/ui01/recommendation-live.png");
const recommendationCourse = require("@/assets/images/ui01/recommendation-course.png");
const recommendationCase = require("@/assets/images/ui01/recommendation-case.png");

type HomeIcon = "heart.fill" | "gift.fill" | "calendar.fill" | "photo.fill" | "video.fill" | "headphones.fill" | "checkmark.circle.fill" | "book.fill";

const QUICK_ENTRIES: readonly { label: string; icon: HomeIcon; color: string; target: Href }[] = [
  { label: "AI诊断", icon: "heart.fill", color: "#35B9D7", target: `/ui/${UI01_HOME_TARGETS.aiInterpretation}` as Href },
  { label: "21天挑战营", icon: "gift.fill", color: "#F59D34", target: `/ui/${UI01_HOME_TARGETS.camp21}` as Href },
  { label: "90天成长计划", icon: "calendar.fill", color: "#36A866", target: `/ui/${UI01_HOME_TARGETS.plan90}` as Href },
  { label: "成长案例", icon: "photo.fill", color: "#F0A337", target: `/ui/${UI01_HOME_TARGETS.growthStories}` as Href },
  { label: "专家直播", icon: "video.fill", color: "#55A6E9", target: `/ui/${UI01_HOME_TARGETS.expertLive}` as Href },
  { label: "家庭顾问", icon: "headphones.fill", color: "#EC725D", target: `/ui/${UI01_HOME_TARGETS.familyAdvisor}` as Href },
];

const RECOMMENDATIONS: readonly { title: string; image: number; target: Href }[] = [
  { title: "妈妈总问我：为什么？", image: recommendationLive, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
  { title: "高效学习习惯养成课", image: recommendationCourse, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
  { title: "从紧张冲突到亲子和谐", image: recommendationCase, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
];

type FamilyMember = { person_id: string; person_type: "PARENT" | "CHILD"; display_name: string };
type HomeMinimalProjection = {
  family_id: string;
  prompt: string;
  active_case: { case_id: string; status: string; intent_goal_text: string; opened_at: string } | null;
  pending_followup_required: boolean;
};
type GrowthHelpResult = {
  signal_id: string;
  proposed_need_type: string | null;
  confirm_prompt: string;
  supported: boolean;
  safety_route: "NORMAL" | "REVIEW" | "HIGH_RISK";
  next_action: "CONFIRM_INTENT" | "REFRAME_NEED" | "HUMAN_REVIEW" | "URGENT_HUMAN_SUPPORT";
};
type GrowthRecommendation = {
  recommendation_id: string;
  intent_id: string;
  version: number;
  candidates: { offer_ref: string; why_this: string; limitations: string[] }[];
  recommended_offer_refs: string[];
  why_now: string;
};
type GrowthDecision = {
  decision_id: string;
  outcome: "SERVICE_STARTED" | "NO_ACTION" | "RE_RECOMMEND_REQUIRED" | string;
  case_id: string | null;
  executed_resource_type: string | null;
};

export default function TodayScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { todayAction } = useFamilyMobile();
  const communicationDone = todayAction.status === "checked_in";
  const tasks = [
    { label: "亲子沟通小练习", icon: "checkmark.circle.fill" as const, color: "#39AC7A", done: communicationDone },
    { label: "完成今日阅读打卡", icon: "book.fill" as const, color: "#F1A136", done: false },
    { label: "情绪记录", icon: "heart.fill" as const, color: "#F1A136", done: false },
  ];

  const [home, setHome] = useState<HomeMinimalProjection | null>(null);
  const [children, setChildren] = useState<FamilyMember[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [helpText, setHelpText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [helpResult, setHelpResult] = useState<GrowthHelpResult | null>(null);
  const [recommendation, setRecommendation] = useState<GrowthRecommendation | null>(null);
  const [decision, setDecision] = useState<GrowthDecision | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const helpRetryKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const intentRetryKeys = useRef<{ fingerprint: string; confirmKey: string; recommendationKey: string } | null>(null);
  const decisionRetryKey = useRef<{ fingerprint: string; key: string } | null>(null);

  const loadHome = useCallback(async () => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    try {
      const [homeResult, aggregate] = await Promise.all([
        familyApi.getFamilyHome<HomeMinimalProjection>(session.token, session.selectedFamily.family_id),
        familyApi.getFamilyAggregate<{ members: FamilyMember[] }>(session.token, session.selectedFamily.family_id),
      ]);
      setHome(homeResult);
      const kids = aggregate.members.filter((member) => member.person_type === "CHILD");
      setChildren(kids);
      setSelectedChildId((current) => (current && kids.some((kid) => kid.person_id === current) ? current : kids[0]?.person_id ?? null));
    } catch {
      // 首页求助面板是增强能力,拉取失败时静默降级为不展示,不阻塞首页其余内容。
    }
  }, [session.selectedFamily, session.status, session.token]);

  useEffect(() => { void loadHome(); }, [loadHome]);

  const submitHelp = async () => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !selectedChildId || !helpText.trim()) return;
    const rawText = helpText.trim();
    const fingerprint = `${session.selectedFamily.family_id}:${selectedChildId}:${rawText}`;
    if (helpRetryKey.current?.fingerprint !== fingerprint) {
      helpRetryKey.current = { fingerprint, key: createMobileRequestId("ui01-growth-help") };
    }
    setSubmitting(true);
    setHelpError(null);
    setHelpResult(null);
    setRecommendation(null);
    setDecision(null);
    try {
      const result = await familyApi.requestGrowthHelp<GrowthHelpResult>(
        session.token, session.selectedFamily.family_id,
        { subject_person_id: selectedChildId, raw_text: rawText },
        helpRetryKey.current.key,
      );
      setHelpResult(result);
    } catch {
      setHelpError("暂时没有提交成功。原文仍留在本机输入框中,请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDirection = async () => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !helpResult || helpResult.next_action !== "CONFIRM_INTENT" || !helpText.trim()) return;
    const fingerprint = `${helpResult.signal_id}:${helpText.trim()}`;
    if (intentRetryKeys.current?.fingerprint !== fingerprint) {
      intentRetryKeys.current = {
        fingerprint,
        confirmKey: createMobileRequestId("ui01-confirm-growth-intent"),
        recommendationKey: createMobileRequestId("ui01-growth-recommendation"),
      };
    }
    setAdvancing(true);
    setHelpError(null);
    try {
      const intent = await familyApi.confirmGrowthIntent<{ intent_id: string }>(
        session.token, session.selectedFamily.family_id,
        { signal_id: helpResult.signal_id, goal_text: helpText.trim() },
        intentRetryKeys.current.confirmKey,
      );
      const rec = await familyApi.requestGrowthRecommendation<GrowthRecommendation>(
        session.token, session.selectedFamily.family_id, intent.intent_id, intentRetryKeys.current.recommendationKey,
      );
      setRecommendation(rec);
    } catch {
      setHelpError("方向确认暂时没有完成,请稍后重试;重复点击不会重复创建记录。");
    } finally {
      setAdvancing(false);
    }
  };

  const decide = async (decisionType: "ACCEPT_RECOMMENDATION" | "DISMISS") => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !recommendation) return;
    const selectedOfferRefs = decisionType === "ACCEPT_RECOMMENDATION"
      ? recommendation.recommended_offer_refs.filter((offerRef) => offerRef !== "resource:v1:no_action")
      : [];
    if (decisionType === "ACCEPT_RECOMMENDATION" && selectedOfferRefs.length === 0) return;
    const fingerprint = `${recommendation.recommendation_id}:${decisionType}:${selectedOfferRefs.join(",")}`;
    if (decisionRetryKey.current?.fingerprint !== fingerprint) decisionRetryKey.current = { fingerprint, key: createMobileRequestId("ui01-growth-decision") };
    setAdvancing(true);
    setHelpError(null);
    try {
      const result = await familyApi.decideGrowthService<GrowthDecision>(session.token, session.selectedFamily.family_id, {
        intent_id: recommendation.intent_id, recommendation_id: recommendation.recommendation_id,
        recommendation_version: recommendation.version, decision_type: decisionType, selected_offer_refs: selectedOfferRefs,
      }, decisionRetryKey.current.key);
      setDecision(result);
      void loadHome();
    } catch {
      setHelpError("这次选择暂时没有保存,请稍后重试;系统不会重复启动服务。");
    } finally {
      setAdvancing(false);
    }
  };

  const open = (target: Href) => router.push(target);

  return (
    <ScreenContainer containerClassName="bg-surface">
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.page}>
            <View style={styles.topBar}>
              <Text style={[styles.platformTitle, { color: colors.text }]}>家庭成长平台</Text>
              <View style={styles.topActions}>
                <IconSymbol name="ellipsis" size={25} color={colors.text} />
                <IconSymbol name="eye.fill" size={22} color={colors.text} />
              </View>
            </View>

            <View style={styles.welcomeRow}>
              <Text style={[styles.welcome, { color: colors.text }]}>早上好，{"\n"}今天也一起陪孩子成长 ☀</Text>
              <IconSymbol name="bell.fill" size={25} color={colors.text} />
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="免费家庭测评" onPress={() => open(`/ui/${UI01_HOME_TARGETS.freeAssessment}` as Href)} style={({ pressed }) => [styles.assessmentBanner, pressed && styles.pressed]}>
              <Image source={assessmentBanner} resizeMode="cover" style={styles.assessmentImage} />
            </Pressable>

            {home?.active_case ? (
              <View style={[styles.activeCaseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.activeCaseTitle, { color: colors.text }]}>{home.active_case.intent_goal_text}</Text>
                <Text style={[styles.activeCaseMeta, { color: colors.muted }]}>状态:{home.active_case.status}</Text>
                {home.pending_followup_required ? <Text style={[styles.activeCaseHint, { color: colors.tint }]}>这次帮助有用吗?去反馈一下</Text> : null}
              </View>
            ) : null}

            <View style={[styles.growthHelpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="问法咪莉校长" accessibilityHint="展开后选择孩子并描述现在最需要帮助的事情" onPress={() => setHelpOpen((value) => !value)} style={({ pressed }) => [styles.growthHelpHeader, pressed && styles.pressed]}>
                <View style={[styles.growthHelpIcon, { backgroundColor: `${colors.tint}18` }]}><IconSymbol name="heart.fill" size={22} color={colors.tint} /></View>
                <View style={styles.growthHelpHeading}>
                  <Text style={[styles.growthHelpTitle, { color: colors.text }]}>问法咪莉校长</Text>
                  <Text style={[styles.growthHelpSubtitle, { color: colors.muted }]}>说说现在最需要帮助的一件事</Text>
                </View>
                <View style={{ transform: [{ rotate: helpOpen ? "90deg" : "0deg" }] }}>
                  <IconSymbol name="chevron.right" size={18} color={colors.muted} />
                </View>
              </Pressable>
              {helpOpen ? (
                <View style={[styles.growthHelpBody, { borderTopColor: colors.border }]}>
                  {!session.selectedFamily ? <Text style={[styles.growthHelpNotice, { color: colors.muted }]}>连接家庭会话后,可以为孩子发起帮助。</Text> : null}
                  {session.selectedFamily && children.length === 0 ? <Text style={[styles.growthHelpNotice, { color: colors.muted }]}>当前家庭还没有登记孩子,请先在家庭档案中添加。</Text> : null}
                  {children.length > 0 ? (
                    <>
                      <Text style={[styles.growthHelpLabel, { color: colors.text }]}>这次想为谁寻求帮助?</Text>
                      <View style={styles.subjectRow}>
                        {children.map((child) => {
                          const selected = selectedChildId === child.person_id;
                          return (
                            <Pressable key={child.person_id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={child.display_name} onPress={() => { setSelectedChildId(child.person_id); setHelpResult(null); setRecommendation(null); setDecision(null); setHelpError(null); }} style={[styles.subjectChip, { borderColor: selected ? colors.tint : colors.border, backgroundColor: selected ? `${colors.tint}12` : colors.background }]}>
                              <Text style={[styles.subjectChipText, { color: selected ? colors.tint : colors.text }]}>{child.display_name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.growthHelpLabel, { color: colors.text }]}>现在发生了什么?</Text>
                      <TextInput accessibilityLabel="描述需要帮助的事情" multiline maxLength={500} textAlignVertical="top" value={helpText} onChangeText={(value) => { setHelpText(value); setHelpResult(null); setRecommendation(null); setDecision(null); setHelpError(null); }} placeholder="例如:孩子刚摔门,我今晚不知道怎么重新开口……" placeholderTextColor={colors.muted} style={[styles.growthHelpInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
                      <Text style={[styles.growthHelpBoundary, { color: colors.muted }]}>只有点击"提交并获取下一步"后才会发送;首页不会自动分析家庭文字。</Text>
                      <Pressable disabled={!selectedChildId || !helpText.trim() || submitting} accessibilityRole="button" accessibilityLabel="提交并获取下一步" onPress={() => void submitHelp()} style={({ pressed }) => [styles.growthHelpSubmit, { backgroundColor: selectedChildId && helpText.trim() && !submitting ? colors.tint : colors.border }, pressed && styles.pressed]}>
                        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.growthHelpSubmitText}>提交并获取下一步</Text>}
                      </Pressable>
                    </>
                  ) : null}
                  {helpError ? <Text accessibilityRole="alert" style={[styles.growthHelpResult, { color: colors.error, borderColor: `${colors.error}40`, backgroundColor: `${colors.error}08` }]}>{helpError}</Text> : null}
                  {helpResult ? (
                    <View accessibilityRole="summary" style={[styles.growthHelpResult, { borderColor: helpResult.safety_route === "NORMAL" ? `${colors.tint}40` : "#D9783048", backgroundColor: helpResult.safety_route === "NORMAL" ? `${colors.tint}08` : "#FFF5EA" }]}>
                      <Text style={[styles.growthHelpResultTitle, { color: helpResult.safety_route === "NORMAL" ? colors.tint : "#A65318" }]}>
                        {helpResult.safety_route === "NORMAL" ? "已收到,我们先确认方向" : helpResult.safety_route === "HIGH_RISK" ? "请优先获得紧急支持" : "请先获得专业支持"}
                      </Text>
                      <Text style={[styles.growthHelpResultText, { color: colors.text }]}>{helpResult.confirm_prompt}</Text>
                      {helpResult.next_action === "CONFIRM_INTENT" && !recommendation ? (
                        <Pressable disabled={advancing} accessibilityRole="button" accessibilityLabel="确认这个方向并查看可用帮助" onPress={() => void confirmDirection()} style={[styles.growthHelpInlineAction, { borderColor: colors.tint }]}>
                          {advancing ? <ActivityIndicator color={colors.tint} /> : <Text style={[styles.growthHelpNext, { color: colors.tint }]}>确认这个方向并查看可用帮助 →</Text>}
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {recommendation ? (
                    <View style={[styles.recommendationDecision, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.growthHelpResultTitle, { color: colors.text }]}>可用帮助</Text>
                      <Text style={[styles.growthHelpResultText, { color: colors.muted }]}>{recommendation.why_now}</Text>
                      {recommendation.candidates.map((candidate) => (
                        <View key={candidate.offer_ref} style={styles.candidateRow}>
                          <Text style={[styles.candidateTitle, { color: colors.text }]}>{offerLabel(candidate.offer_ref)}</Text>
                          <Text style={[styles.growthHelpResultText, { color: colors.muted }]}>{candidate.why_this}</Text>
                        </View>
                      ))}
                      {!decision ? (
                        <View style={styles.decisionActions}>
                          {recommendation.recommended_offer_refs.some((offerRef) => offerRef !== "resource:v1:no_action") ? (
                            <Pressable disabled={advancing} accessibilityRole="button" accessibilityLabel="接受建议并开始" onPress={() => void decide("ACCEPT_RECOMMENDATION")} style={[styles.growthHelpSubmit, { backgroundColor: colors.tint }]}>
                              <Text style={styles.growthHelpSubmitText}>接受建议并开始</Text>
                            </Pressable>
                          ) : null}
                          <Pressable disabled={advancing} accessibilityRole="button" accessibilityLabel="今晚先不安排" onPress={() => void decide("DISMISS")} style={[styles.growthHelpSecondary, { borderColor: colors.border }]}>
                            <Text style={[styles.growthHelpSecondaryText, { color: colors.text }]}>今晚先不安排</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={[styles.decisionReceipt, { backgroundColor: decision.outcome === "SERVICE_STARTED" ? "#EAF8F3" : "#F1F5F9" }]}>
                          <Text style={[styles.growthHelpResultTitle, { color: decision.outcome === "SERVICE_STARTED" ? colors.success : colors.text }]}>
                            {decision.outcome === "SERVICE_STARTED" ? "服务已启动" : decision.outcome === "NO_ACTION" ? "已记录:今晚先不安排" : "服务状态已更新"}
                          </Text>
                          <Text style={[styles.growthHelpResultText, { color: colors.muted }]}>
                            {decision.outcome === "SERVICE_STARTED" ? "系统已保存可追溯服务回执,稍后可以反馈是否有帮助。" : "没有创建下游成长任务或效果结论。"}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={[styles.quickGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {QUICK_ENTRIES.map((entry) => (
                <Pressable key={entry.label} accessibilityRole="button" accessibilityLabel={entry.label} onPress={() => open(entry.target)} style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}>
                  <IconSymbol name={entry.icon} size={29} color={entry.color} />
                  <Text style={[styles.quickLabel, { color: colors.text }]}>{entry.label}</Text>
                </Pressable>
              ))}
            </View>

            <SectionTitle title="今日成长任务" action="查看全部" onPress={() => open(`/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href)} colors={colors} />
            <View style={[styles.taskList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {tasks.map((task, index) => (
                <Pressable key={task.label} accessibilityRole="button" accessibilityLabel={task.label} onPress={() => open(`/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href)} style={({ pressed }) => [styles.taskRow, index < tasks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pressed && styles.pressed]}>
                  <IconSymbol name={task.icon} size={21} color={task.color} />
                  <Text style={[styles.taskLabel, { color: colors.text }]}>{task.label}</Text>
                  {task.done ? <IconSymbol name="checkmark.circle.fill" size={22} color="#32B276" /> : <Text style={[styles.completePill, { color: colors.tint, borderColor: `${colors.tint}55` }]}>去完成</Text>}
                </Pressable>
              ))}
            </View>

            <SectionTitle title="推荐内容/服务" action="更多" onPress={() => open(`/ui/${UI01_HOME_TARGETS.recommendations}` as Href)} colors={colors} />
            <View style={styles.recommendationRow}>
              {RECOMMENDATIONS.map((item) => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`查看${item.title}`} onPress={() => open(item.target)} style={({ pressed }) => [styles.recommendationCard, pressed && styles.pressed]}>
                  <Image source={item.image} resizeMode="cover" style={styles.recommendationImage} />
                </Pressable>
              ))}
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function offerLabel(offerRef: string) {
  if (offerRef === "resource:v1:ai_coach") return "AI 沟通陪练";
  if (offerRef === "resource:v1:no_action") return "今晚先不安排";
  if (offerRef.startsWith("resource:v1:external_referral")) return "专业支持转介";
  return "家庭成长支持";
}

function SectionTitle({ title, action, onPress, colors }: { title: string; action: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionTopline}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
        <Text style={[styles.moreText, { color: colors.muted }]}>{action}</Text>
        <IconSymbol name="chevron.right" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  page: { gap: 14 },
  topBar: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  platformTitle: { fontSize: 22, lineHeight: 29, fontWeight: "900" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 4 },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 2 },
  welcome: { fontSize: 23, lineHeight: 31, fontWeight: "900" },
  assessmentBanner: { height: 110, borderRadius: 17, overflow: "hidden" },
  assessmentImage: { width: "100%", height: "100%" },
  quickGrid: { borderWidth: 1, borderRadius: 17, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  quickEntry: { width: "33.333%", minHeight: 94, alignItems: "center", justifyContent: "center", gap: 7, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#EDF1F5" },
  quickLabel: { fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  sectionTopline: { marginTop: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "900" },
  moreButton: { flexDirection: "row", alignItems: "center", gap: 1, minHeight: 32, paddingLeft: 8 },
  moreText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  taskList: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  taskRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 },
  taskLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  completePill: { minWidth: 62, minHeight: 28, borderWidth: 1, borderRadius: 14, textAlign: "center", textAlignVertical: "center", fontSize: 12, lineHeight: 26, fontWeight: "800" },
  recommendationRow: { flexDirection: "row", gap: 9 },
  recommendationCard: { flex: 1, height: 128, borderRadius: 12, overflow: "hidden", backgroundColor: "#E6ECF3" },
  recommendationImage: { width: "100%", height: "100%" },
  activeCaseCard: { borderWidth: 1, borderRadius: 14, padding: 13, gap: 4 },
  activeCaseTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  activeCaseMeta: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  activeCaseHint: { fontSize: 13, lineHeight: 19, fontWeight: "800" },
  growthHelpCard: { borderWidth: 1, borderRadius: 17, overflow: "hidden" },
  growthHelpHeader: { minHeight: 78, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  growthHelpIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  growthHelpHeading: { flex: 1, gap: 2 },
  growthHelpTitle: { fontSize: 17, lineHeight: 23, fontWeight: "900" },
  growthHelpSubtitle: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  growthHelpBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  growthHelpNotice: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
  growthHelpLabel: { fontSize: 13, lineHeight: 19, fontWeight: "800" },
  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectChip: { minHeight: 36, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  subjectChipText: { fontSize: 13, lineHeight: 18, fontWeight: "800" },
  growthHelpInput: { minHeight: 104, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 21 },
  growthHelpBoundary: { fontSize: 11, lineHeight: 17, fontWeight: "600" },
  growthHelpSubmit: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  growthHelpSubmitText: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  growthHelpResult: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  growthHelpResultTitle: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  growthHelpResultText: { fontSize: 13, lineHeight: 20, fontWeight: "600" },
  growthHelpNext: { paddingTop: 4, fontSize: 13, lineHeight: 19, fontWeight: "900" },
  growthHelpInlineAction: { minHeight: 40, marginTop: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  recommendationDecision: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  candidateRow: { gap: 3, paddingVertical: 4 },
  candidateTitle: { fontSize: 14, lineHeight: 20, fontWeight: "900" },
  decisionActions: { gap: 8, paddingTop: 2 },
  growthHelpSecondary: { minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  growthHelpSecondaryText: { fontSize: 14, lineHeight: 20, fontWeight: "800" },
  decisionReceipt: { borderRadius: 10, padding: 11, gap: 4 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
