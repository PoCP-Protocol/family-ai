import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";

interface Ui03ScoreDimension {
  dimension_ref: string;
  label: string;
  score: number;
  peer_reference: number;
}

interface Ui03Scorecard {
  generated_by: "FAMILI_PRINCIPAL_FAMILY_EDUCATION_MODEL";
  overall_score: number;
  overall_band: string;
  dimensions: Ui03ScoreDimension[];
  core_issue_tags: string[];
  recommendations: string[];
  score_boundary: "SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING";
}

interface RemoteHypothesisProjection {
  projection_version: "UI03_GROWTH_HYPOTHESIS_V1";
  availability: "READY" | "NO_SUBMITTED_ASSESSMENT" | "POLICY_BLOCKED";
  ai_state: "NOT_INVOKED" | "MODEL_DRAFT_READY" | "MODEL_GATEWAY_BLOCKED";
  hypothesis: null | {
    hypothesis_ref: string;
    subject_display_name: string;
    focus_ref: string;
    title: string;
    statement: string;
    source_refs: {
      assessment_session_id: string;
      assessment_response_id: string;
      assessment_evidence_id: string;
      tool_ref: string;
      tool_version: number;
      assessment_submitted_at?: string | null;
    };
    limitations: string[];
    fact_boundary: "HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS";
    scorecard?: Ui03Scorecard;
  };
}

interface HypothesisDecisionReceipt { outcome: "INTENT_CREATED" | "NO_ACTION"; intent: { intent_id: string } | null; replayed: boolean }

const RADAR_CENTER = { x: 120, y: 104 };
const RADAR_POINTS = [
  { x: 120, y: 24, labelX: 120, labelY: 14, anchor: "middle" as const },
  { x: 196, y: 80, labelX: 217, labelY: 78, anchor: "start" as const },
  { x: 168, y: 170, labelX: 188, labelY: 190, anchor: "start" as const },
  { x: 72, y: 170, labelX: 52, labelY: 190, anchor: "end" as const },
  { x: 44, y: 80, labelX: 23, labelY: 78, anchor: "end" as const },
] as const;

export default function GrowthExplanationScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const [remote, setRemote] = useState<RemoteHypothesisProjection | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [decisionState, setDecisionState] = useState<"idle" | "saving" | "error">("idle");
  const [confirmed, setConfirmed] = useState(false);
  const decisionKeys = useRef<Record<string, string>>({});
  const hypothesis = remote?.hypothesis ?? null;
  const scorecard = hypothesis?.scorecard ?? null;

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) { setRemoteState("idle"); return; }
    let active = true;
    setRemoteState("loading");
    familyApi.getGrowthHypothesis<RemoteHypothesisProjection>(session.token, session.selectedFamily.family_id)
      .then((result) => {
        if (!active) return;
        setRemote(result);
        setRemoteState("ready");
      })
      .catch(() => {
        if (active) setRemoteState("fallback");
      });
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const generatePlan = async () => {
    if (confirmed) { router.push("/ui/UI-04" as Href); return; }
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !hypothesis) return;
    const fingerprint = `${hypothesis.hypothesis_ref}:CONFIRM`;
    decisionKeys.current[fingerprint] ??= `confirm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    setDecisionState("saving");
    try {
      const result = await familyApi.decideGrowthHypothesis<HypothesisDecisionReceipt>(session.token, session.selectedFamily.family_id, {
        assessment_session_id: hypothesis.source_refs.assessment_session_id,
        hypothesis_ref: hypothesis.hypothesis_ref,
        decision_type: "CONFIRM",
      }, decisionKeys.current[fingerprint]);
      setDecisionState("idle");
      if (result.outcome === "INTENT_CREATED") {
        setConfirmed(true);
        router.push("/ui/UI-04" as Href);
      }
    } catch { setDecisionState("error"); }
  };

  if (remoteState === "loading" || !hypothesis || !scorecard) {
    return (
      <ScreenContainer edges={["left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: true, title: "AI成长诊断", headerBackTitle: "返回" }} />
        <View style={styles.emptyPage}>
          {remoteState === "loading" ? <ActivityIndicator color={colors.tint} /> : null}
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{remoteState === "loading" ? "AI 正在生成成长诊断报告" : "先完成免费家庭测评"}</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>AI 会基于你提交的免费测评生成成长诊断报告；这不是儿童诊断结论、能力测验或排名。</Text>
          <Pressable onPress={() => router.replace("/ui/UI-02" as Href)} style={[styles.primaryButton, { backgroundColor: colors.tint }]}>
            <Text style={styles.primaryButtonText}>进入免费测评</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const submittedAt = formatDate(hypothesis.source_refs.assessment_submitted_at);
  const summaryRows = [
    hypothesis.subject_display_name ? `姓名：${hypothesis.subject_display_name}` : null,
    submittedAt ? `测评时间：${submittedAt}` : null,
    `测评版本：v${hypothesis.source_refs.tool_version}`,
  ].filter(Boolean);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "AI成长诊断",
          headerBackTitle: "返回",
          headerRight: () => <IconSymbol name="ellipsis" size={24} color="#111827" />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.assessmentSummary}>
          <View style={styles.summaryAvatar}><IconSymbol name="person.crop.circle.fill" size={58} color="#FFFFFF" /></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryBadge}>AI成长诊断报告</Text>
            <Text style={styles.summaryTitle}>{hypothesis.subject_display_name ? `${hypothesis.subject_display_name}的成长诊断` : "家庭成长诊断"}</Text>
            {summaryRows.map((row) => <Text key={row} style={styles.summaryMeta}>{row}</Text>)}
          </View>
          <View style={styles.summaryScorePill}>
            <Text style={styles.summaryScore}>{scorecard.overall_score}</Text>
            <Text style={styles.summaryScoreLabel}>参考分</Text>
          </View>
          <IconSymbol name="chevron.right" size={19} color="#FFFFFF" />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>综合成长评估</Text>
        <GrowthRadarOverview scorecard={scorecard} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>核心问题</Text>
        <View style={styles.tags}>
          {scorecard.core_issue_tags.slice(0, 3).map((tag, index) => (
            <View key={tag} style={[styles.tag, { backgroundColor: tagColors[index].background }]}>
              <Text style={[styles.tagText, { color: tagColors[index].text }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>成长建议</Text>
        <View style={styles.suggestions}>
          {scorecard.recommendations.slice(0, 3).map((item, index) => (
            <View key={`${index}-${item}`} style={styles.suggestionRow}>
              <View style={styles.suggestionIndex}><Text style={styles.suggestionIndexText}>{index + 1}</Text></View>
              <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        {decisionState === "error" ? <Text style={[styles.errorText, { color: "#D96464" }]}>支持方案暂时未形成，请稍后重试。</Text> : null}
        <Pressable disabled={decisionState === "saving"} onPress={() => void generatePlan()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
          <IconSymbol name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{decisionState === "saving" ? "正在生成" : "生成个性化方案"}</Text>
        </Pressable>
        <Text style={[styles.boundaryText, { color: colors.muted }]}>以上内容用于家庭支持参考，不是儿童诊断结论、能力测验或排名。</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function GrowthRadarOverview({ scorecard }: { scorecard: Ui03Scorecard }) {
  const childPoints = radarPolygon(scorecard.dimensions.map((item) => item.score));
  const peerPoints = radarPolygon(scorecard.dimensions.map((item) => item.peer_reference));
  return (
    <View style={styles.radarCard}>
      <Svg width={240} height={224} viewBox="0 0 240 224" accessibilityLabel="综合成长评估雷达图">
        <Polygon points={RADAR_POINTS.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#C6DBF6" strokeWidth={1} />
        <Polygon points={radarPolygon([50, 50, 50, 50, 50])} fill="none" stroke="#E1ECFA" strokeWidth={1} />
        {RADAR_POINTS.map((point, index) => <Line key={`axis-${scorecard.dimensions[index]?.dimension_ref ?? index}`} x1={RADAR_CENTER.x} y1={RADAR_CENTER.y} x2={point.x} y2={point.y} stroke="#E1ECFA" strokeWidth={1} />)}
        <Polygon points={peerPoints} fill="rgba(247, 181, 77, 0.16)" stroke="#F2A23A" strokeWidth={2} />
        <Polygon points={childPoints} fill="rgba(47, 143, 251, 0.22)" stroke="#2F8FFB" strokeWidth={2} />
        <Circle cx={RADAR_CENTER.x} cy={RADAR_CENTER.y} r={35} fill="#FFFFFF" stroke="#D5E6FA" strokeWidth={1} />
        <SvgText x={RADAR_CENTER.x} y={RADAR_CENTER.y - 2} textAnchor="middle" fill="#2563EB" fontSize={24} fontWeight="800">{scorecard.overall_score}</SvgText>
        <SvgText x={RADAR_CENTER.x} y={RADAR_CENTER.y + 17} textAnchor="middle" fill="#6B7280" fontSize={10}>参考分</SvgText>
        {scorecard.dimensions.slice(0, 5).map((dimension, index) => {
          const point = RADAR_POINTS[index];
          return <SvgText key={dimension.dimension_ref} x={point.labelX} y={point.labelY} textAnchor={point.anchor} fill="#5B6B7F" fontSize={11} fontWeight="700">{dimension.label}{dimension.score}</SvgText>;
        })}
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2F8FFB" }]} /><Text style={styles.legendText}>家庭自查线索</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#F2A23A" }]} /><Text style={styles.legendText}>参考方向</Text></View>
      </View>
    </View>
  );
}

function radarPolygon(values: number[]) {
  return RADAR_POINTS.map((point, index) => {
    const value = Math.max(0, Math.min(100, values[index] ?? 0)) / 100;
    const x = RADAR_CENTER.x + (point.x - RADAR_CENTER.x) * value;
    const y = RADAR_CENTER.y + (point.y - RADAR_CENTER.y) * value;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const tagColors = [
  { background: "#FDEBEC", text: "#D96464" },
  { background: "#EEF2FF", text: "#5B6FEF" },
  { background: "#FFF3E5", text: "#B87530" },
] as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34, gap: 16, backgroundColor: "#FFFFFF" },
  emptyPage: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  emptyTitle: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  emptyText: { fontSize: 15, lineHeight: 23 },
  assessmentSummary: { minHeight: 138, borderRadius: 16, backgroundColor: "#2F8FFB", padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#2F8FFB", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  summaryAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#77B8FF", alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, gap: 4 },
  summaryBadge: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontSize: 11, lineHeight: 15, fontWeight: "800" },
  summaryTitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "800" },
  summaryMeta: { color: "#E8F3FF", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  summaryScorePill: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  summaryScore: { color: "#2563EB", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  summaryScoreLabel: { color: "#6B7280", fontSize: 9, lineHeight: 12, fontWeight: "800" },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: "800" },
  radarCard: { alignItems: "center", borderRadius: 14, paddingTop: 10, paddingBottom: 12, backgroundColor: "#FFFFFF" },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: -4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#6B7280", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  suggestions: { gap: 12 },
  suggestionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  suggestionIndex: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: "#EAF0FF" },
  suggestionIndexText: { fontSize: 12, lineHeight: 17, fontWeight: "800", color: "#2F8FFB" },
  suggestionText: { flex: 1, fontSize: 14, lineHeight: 22 },
  errorText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  primaryButton: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  boundaryText: { marginTop: -6, fontSize: 11, lineHeight: 17, textAlign: "center" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
