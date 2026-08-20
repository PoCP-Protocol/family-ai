import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { buildFamilyRhythmEvents } from "@/lib/family/child-growth";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { selectPersonalGrowthJourney, type FamilyApiPlatformSurfacesProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";

interface RhythmDisplayItem {
  id: string;
  title: string;
  detail: string;
  sourceLabel: string;
}

export default function FamilyRhythmScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const state = useFamilyMobile();
  const focus = getGrowthFocus(state.selectedGrowthFocus);
  const [remoteProjection, setRemoteProjection] = useState<FamilyApiPlatformSurfacesProjection | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    familyApi.getDevPlatformSurfaces<FamilyApiPlatformSurfacesProjection>(session.token, session.selectedFamily.family_id)
      .then((result) => { if (active) setRemoteProjection(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const localEvents = useMemo(() => buildFamilyRhythmEvents({
    selectedGrowthFocus: state.selectedGrowthFocus,
    lastReceipt: state.lastReceipt,
    campCompletedDays: state.campCompletedDays,
    uiActionReceipts: state.uiActionReceipts,
    childChoiceDraft: state.childChoiceDraft,
  }), [state.campCompletedDays, state.childChoiceDraft, state.lastReceipt, state.selectedGrowthFocus, state.uiActionReceipts]);

  const remoteJourney = selectPersonalGrowthJourney(remoteProjection);
  const events = useMemo<RhythmDisplayItem[]>(() => {
    if (!remoteJourney?.entries.length) {
      return localEvents.map((event) => ({ id: event.id, title: event.title, detail: event.detail, sourceLabel: event.sourceUi }));
    }
    const serverEvents = remoteJourney.entries.map((event) => ({ id: event.event_id, title: event.label, detail: event.detail, sourceLabel: "家庭过程记录" }));
    const offlineChildChoice = localEvents
      .filter((event) => event.sourceUi === "UI-10")
      .map((event) => ({ id: event.id, title: event.title, detail: event.detail, sourceLabel: "孩子的本机选择" }));
    return [...serverEvents, ...offlineChildChoice].slice(-8);
  }, [localEvents, remoteJourney?.entries]);

  const rhythmLabel = remoteJourney?.headline ?? (events.length === 0
    ? "从一件愿意做的小事开始"
    : localEvents.some((event) => event.kind === "family_review")
      ? "已经开始回看自己的过程"
      : "正在形成适合我们家的节奏");

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "我们的成长节奏", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.tint }]}>只和自己的过去比较</Text>
            <Text style={[styles.title, { color: colors.text }]}>我们已经一起走过哪些小步骤？</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>这里没有名次、总分、百分位或连续打卡要求，只回看同一家庭真实发生过的过程。</Text>
            <DataSourceBanner />

            <View style={[styles.rhythmPanel, { backgroundColor: "#09295A" }]}>
              <View style={styles.rhythmTopline}>
                <Text style={styles.rhythmLabel}>当前节奏</Text>
                <Text style={styles.rhythmCount}>{events.length} 个过程片段</Text>
              </View>
              <Text style={styles.rhythmTitle}>{rhythmLabel}</Text>
              <Text style={styles.rhythmText}>{focus ? `当前关注：${focus.title}` : "家庭还没有选择关注场景，可以先从一次测评或今日行动开始。"}</Text>
            </View>

            <View style={styles.pillRow}>
              <RhythmPill label="可暂停" active color="#2563EB" />
              <RhythmPill label="可调整" active color="#16866D" />
              <RhythmPill label="不排名" active color="#F28C45" />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>家庭过程时间线</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: index === events.length - 1 ? colors.tint : colors.success }]} />
              {index < events.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.eventTopline}>
                <Text style={[styles.eventSource, { color: colors.tint }]}>{item.sourceLabel}</Text>
                <Text style={[styles.eventKind, { color: colors.muted }]}>过程记录</Text>
              </View>
              <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.eventDetail, { color: colors.muted }]}>{item.detail}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>还没有过程记录</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>从选择一个家庭关注场景，或记录一次今天愿意尝试的小行动开始。</Text>
            <View style={styles.emptyActions}>
              <Pressable onPress={() => router.push("/ui/UI-07" as Href)} style={[styles.smallButton, { backgroundColor: colors.tint }]}>
                <Text style={styles.smallButtonText}>选择关注场景</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/ui/UI-09" as Href)} style={[styles.smallButton, { backgroundColor: colors.success }]}>
                <Text style={styles.smallButtonText}>查看今日行动</Text>
              </Pressable>
            </View>
          </View>
        }
        ListFooterComponent={events.length > 0 ? (
          <View style={styles.footer}>
            <Pressable onPress={() => router.push("/ui/UI-12" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>整理成家庭私有故事</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.footerRow}>
              <Pressable onPress={() => router.push("/ui/UI-05" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>回到陪跑</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/ui/UI-08" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>查看回顾</Text>
              </Pressable>
            </View>
            <Text style={[styles.boundary, { color: colors.muted }]}>过程片段不代表教育效果，不用于比较不同家庭或孩子。</Text>
          </View>
        ) : null}
      />
    </ScreenContainer>
  );
}

function RhythmPill({ label, color }: { label: string; active: boolean; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 12 },
  header: { gap: 15, marginBottom: 4 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  rhythmPanel: { borderRadius: 25, padding: 20, gap: 8 },
  rhythmTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rhythmLabel: { color: "#FFD9B8", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  rhythmCount: { color: "#BFD3EC", fontSize: 12, lineHeight: 17 },
  rhythmTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 30, fontWeight: "800" },
  rhythmText: { color: "#D7E8FF", fontSize: 14, lineHeight: 21 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 18, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 20 },
  timelineLine: { width: 2, flex: 1, minHeight: 74 },
  eventCard: { flex: 1, minHeight: 112, borderWidth: 1, borderRadius: 20, padding: 16, gap: 5, marginBottom: 2 },
  eventTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventSource: { fontSize: 11, lineHeight: 16, fontWeight: "800" },
  eventKind: { fontSize: 11, lineHeight: 16 },
  eventTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  eventDetail: { fontSize: 13, lineHeight: 19 },
  empty: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 10 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21 },
  emptyActions: { flexDirection: "row", gap: 9 },
  smallButton: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  smallButtonText: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  footer: { gap: 11, paddingTop: 12 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  footerRow: { flexDirection: "row", gap: 9 },
  secondaryButton: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  boundary: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
