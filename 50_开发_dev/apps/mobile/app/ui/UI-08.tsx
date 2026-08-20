import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";

interface RemoteReview {
  state?: string;
  recorded_actions?: { receipt_id: string; source_ui: string; kind: string; occurred_at: string }[];
  reflection_prompt?: string | null;
  next_hint?: { text: string } | null;
}

interface ReviewItem {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  source: string;
}

export default function GrowthReviewScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, lastReceipt, campCompletedDays, uiActionReceipts, activeOnboardingId } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const [remote, setRemote] = useState<RemoteReview | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !activeOnboardingId) return;
    let active = true;
    familyApi.getFamilyReviewReadback<RemoteReview>(session.token, session.selectedFamily.family_id, activeOnboardingId)
      .then((result) => { if (active) setRemote(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token]);

  const records = useMemo<ReviewItem[]>(() => {
    const items: ReviewItem[] = [];
    if (lastReceipt) {
      items.push({ id: lastReceipt.actionId, title: "完成一次家庭行动", detail: lastReceipt.reflection || "这次行动已记录，没有填写反思。", occurredAt: lastReceipt.checkedInAt, source: "今日家庭行动" });
    }
    campCompletedDays.slice(-5).forEach((day) => {
      items.push({ id: `camp-${day}`, title: `21 天成长营 Day ${day}`, detail: "完成只表示当日行动发生。", occurredAt: "", source: "成长营行动" });
    });
    uiActionReceipts.slice(-5).forEach((receipt) => {
      items.push({ id: `${receipt.screenId}-${receipt.kind}`, title: receipt.label, detail: receipt.message, occurredAt: receipt.recordedAt, source: `${receipt.screenId} · ${receipt.loop}循环` });
    });
    remote?.recorded_actions?.slice(-8).forEach((receipt) => {
      if (items.some((item) => item.id === receipt.receipt_id)) return;
      items.push({ id: receipt.receipt_id, title: "家庭行动记录", detail: receipt.kind.replaceAll("_", " "), occurredAt: receipt.occurred_at, source: "家庭同步记录" });
    });
    return items.sort((left, right) => (right.occurredAt || "").localeCompare(left.occurredAt || ""));
  }, [campCompletedDays, lastReceipt, remote?.recorded_actions, uiActionReceipts]);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "成长报告", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.tint }]}>阶段回顾</Text>
            <Text style={[styles.title, { color: colors.text }]}>我们做过什么，比一个总分更重要</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>这里汇总行动和反思来源，不把过程记录自动解释为孩子或家庭已经改变。</Text>
            <DataSourceBanner />
            <View style={styles.summaryRow}>
              <SummaryValue label="行动记录" value={records.length.toString()} color="#2563EB" />
              <SummaryValue label="成长营" value={`${campCompletedDays.length}/21`} color="#16866D" />
              <SummaryValue label="当前重点" value={focus?.title ?? "待选择"} color="#F28C45" compact />
            </View>
            <View style={[styles.boundaryPanel, { backgroundColor: "#09295A" }]}>
              <Text style={styles.boundaryLabel}>证据边界</Text>
              <Text style={styles.boundaryTitle}>行动已记录 ≠ 成长结果</Text>
              <Text style={styles.boundaryText}>家长反思属于家长视角；只有来源清楚、经过确认的观察才能进入后续评估。</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>最近的家庭行动</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.recordRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.recordDot, { backgroundColor: colors.success }]} />
            <View style={styles.recordCopy}>
              <Text style={[styles.recordTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.recordDetail, { color: colors.muted }]}>{item.detail}</Text>
              <Text style={[styles.recordSource, { color: colors.tint }]}>{item.source}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>还没有行动记录</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>从一件低负担的今日任务开始，完成后这里会回读过程。</Text>
            <Pressable onPress={() => router.push("/ui/UI-09" as Href)} style={[styles.smallButton, { backgroundColor: colors.tint }]}>
              <Text style={styles.smallButtonText}>去看今日任务</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={[styles.nextHint, { color: colors.muted }]}>{remote?.next_hint?.text ?? "下一步由家庭决定：继续一个小行动，或先回到成长解读。"}</Text>
            <Pressable onPress={() => router.push("/ui/UI-04" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>查看 90 天成长方案</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function SummaryValue({ label, value, color, compact }: { label: string; value: string; color: string; compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.summaryItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[compact ? styles.summaryCompactValue : styles.summaryValue, { color }]} numberOfLines={2}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 12 },
  header: { gap: 15, marginBottom: 4 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  summaryRow: { flexDirection: "row", gap: 9 },
  summaryItem: { flex: 1, minHeight: 90, borderWidth: 1, borderRadius: 18, padding: 12, justifyContent: "center", gap: 4 },
  summaryValue: { fontSize: 23, lineHeight: 29, fontWeight: "900" },
  summaryCompactValue: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 11, lineHeight: 15 },
  boundaryPanel: { borderRadius: 23, padding: 19, gap: 6 },
  boundaryLabel: { color: "#67D5FF", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  boundaryTitle: { color: "#FFFFFF", fontSize: 19, lineHeight: 25, fontWeight: "800" },
  boundaryText: { color: "#C4D7EE", fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  recordRow: { minHeight: 104, borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", gap: 12 },
  recordDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  recordCopy: { flex: 1, gap: 4 },
  recordTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  recordDetail: { fontSize: 14, lineHeight: 21 },
  recordSource: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  empty: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 8 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21 },
  smallButton: { minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 4 },
  smallButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  footer: { gap: 12, paddingTop: 12 },
  nextHint: { fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
