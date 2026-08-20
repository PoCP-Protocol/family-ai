import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { ProjectionStateCard } from "@/components/family/projection-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { getLocalGrowthExplanation, summarizeAssessmentPerspective } from "@/lib/family/growth-explanations";

interface RemoteExplanation {
  title?: string;
  state?: string;
  observations?: { label: string; detail: string; kind: "PERSPECTIVE"; evidence_refs: string[] }[];
  hypotheses?: { text: string; uncertainty: string }[];
  recommendations?: { text: string; source: string; status: string }[];
  ai_ready?: { evidence_boundary?: string; recommendation_source?: string; model_gateway_status?: string };
}

export default function GrowthExplanationScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, assessmentAnswers, activeOnboardingId, setActiveOnboardingId } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const local = getLocalGrowthExplanation(selectedGrowthFocus);
  const [remote, setRemote] = useState<RemoteExplanation | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    setRemoteState("loading");
    familyApi.getActiveOnboarding(session.token, session.selectedFamily.family_id)
      .then(async (onboarding) => {
        const onboardingId = typeof onboarding?.onboarding_id === "string" ? onboarding.onboarding_id : activeOnboardingId;
        if (!onboardingId) throw new Error("NO_ACTIVE_ONBOARDING");
        if (active) setActiveOnboardingId(onboardingId);
        return familyApi.getReportExplanation<RemoteExplanation>(session.token!, session.selectedFamily!.family_id, onboardingId);
      })
      .then((result) => {
        if (!active) return;
        setRemote(result);
        setRemoteState("ready");
      })
      .catch(() => {
        if (active) setRemoteState("fallback");
      });
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token, setActiveOnboardingId]);

  if (!focus || !local) {
    return (
      <ScreenContainer edges={["left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: true, title: "家庭成长解读", headerBackTitle: "返回" }} />
        <View style={styles.emptyPage}>
          <Text style={[styles.title, { color: colors.text }]}>先完成一次家庭测评</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>选择一个当前关注场景后，我们再为你整理来源清楚的成长解读。</Text>
          <Pressable onPress={() => router.replace("/ui/UI-02" as Href)} style={[styles.primaryButton, { backgroundColor: colors.tint }]}>
            <Text style={styles.primaryButtonText}>进入家庭测评</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const title = remote?.title ?? local.headline;
  const perspective = remote?.observations?.[0]?.detail ?? summarizeAssessmentPerspective(assessmentAnswers);
  const hypothesis = remote?.hypotheses?.[0]?.text ?? local.hypothesis;
  const recommendation = remote?.recommendations?.[0]?.text ?? local.recommendation;

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "家庭成长解读", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.tint }]}>家庭成长解读</Text>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{local.summary}</Text>
        <DataSourceBanner />
        <ProjectionStateCard
          compact
          state={remoteState === "loading" ? "loading" : remoteState === "fallback" ? "fallback" : remoteState === "ready" && !remote ? "empty" : "hidden"}
          title={remoteState === "loading" ? "正在整理家庭成长解读" : undefined}
          detail={remoteState === "loading" ? "先保留本机可读内容，家庭空间中的最新记录会在连接后更新。" : undefined}
        />

        <LayerCard index="01" label="已确认的输入" kind="FACT" color="#16866D" text={`家庭选择先关注“${focus.title}”，并完成了 ${Object.keys(assessmentAnswers).length} 个场景回答。`} />
        <LayerCard index="02" label="家长视角" kind="PERSPECTIVE" color="#2563EB" text={perspective} />
        <LayerCard index="03" label="一个可能的解释" kind="HYPOTHESIS" color="#8B5CF6" text={hypothesis} note="这不是儿童诊断，也不是唯一解释。" />
        <LayerCard index="04" label="本周建议" kind="RECOMMENDATION" color="#F28C45" text={recommendation} note={`如果当下不适合：${local.fallback}`} />

        <View style={[styles.aiPanel, { backgroundColor: "#09295A" }]}>
          <Text style={styles.aiLabel}>解释方式</Text>
          <Text style={styles.aiTitle}>{remote ? "家庭空间规则化解读" : "本机规则化建议"}</Text>
          <Text style={styles.aiText}>没有使用自动生成内容修改家庭核心资料。建议只有在家庭确认后，才会成为行动。</Text>
        </View>

        <Pressable onPress={() => router.push("/ui/UI-04" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>查看 90 天成长方案</Text>
          <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={() => router.push("/ui/UI-08" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>查看阶段成长报告</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function LayerCard({ index, label, kind, color, text, note }: { index: string; label: string; kind: string; color: string; text: string; note?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.layerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.layerTopline}>
        <Text style={[styles.layerIndex, { color }]}>{index}</Text>
        <View style={[styles.kindBadge, { backgroundColor: `${color}18` }]}><Text style={[styles.kindText, { color }]}>{kind}</Text></View>
      </View>
      <Text style={[styles.layerLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.layerText, { color: colors.muted }]}>{text}</Text>
      {note ? <Text style={[styles.layerNote, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 14 },
  emptyPage: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  loading: { fontSize: 13, lineHeight: 18 },
  layerCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 },
  layerTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  layerIndex: { fontSize: 13, lineHeight: 18, fontWeight: "900" },
  kindBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  kindText: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 0.5 },
  layerLabel: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  layerText: { fontSize: 15, lineHeight: 23 },
  layerNote: { fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  aiPanel: { borderRadius: 24, padding: 20, gap: 7 },
  aiLabel: { color: "#67D5FF", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  aiTitle: { color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "800" },
  aiText: { color: "#C4D7EE", fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  secondaryButton: { minHeight: 52, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
