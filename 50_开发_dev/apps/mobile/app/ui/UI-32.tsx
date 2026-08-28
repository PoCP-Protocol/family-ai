import type { Href } from "expo-router";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyFlatList as FlatList } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { familyApi } from "@/lib/family/family-api-client";
import type { FamilyApiCommerceCustomerProjection, FamilyApiMembershipProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import type { ThemeColorPalette } from "@/constants/theme";

type AssetItem = { id: string; title: string; state: string; tone: "primary" | "muted" };

export default function OrdersAssetsScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const state = useFamilyMobile();
  const [commerce, setCommerce] = useState<FamilyApiCommerceCustomerProjection | null>(null);
  const [membership, setMembership] = useState<FamilyApiMembershipProjection | null>(null);
  const [projectionState, setProjectionState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadProjections = useCallback(async () => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) {
      setProjectionState("idle");
      return;
    }
    setProjectionState("loading");
    try {
      const [nextCommerce, nextMembership] = await Promise.all([
        familyApi.getCommerceCustomerProjection<FamilyApiCommerceCustomerProjection>(session.token, session.selectedFamily.family_id),
        familyApi.getMembershipCustomerProjection<FamilyApiMembershipProjection>(session.token, session.selectedFamily.family_id),
      ]);
      setCommerce(nextCommerce);
      setMembership(nextMembership);
      setProjectionState("ready");
    } catch {
      setProjectionState("error");
    }
  }, [session.selectedFamily, session.status, session.token]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await loadProjections();
    })();
    return () => { active = false; };
  }, [loadProjections]);

  const intents = commerce?.order_intents ?? [];
  const entitlements = commerce?.entitlements ?? [];
  const benefits = membership?.benefits ?? [];
  const localItems: AssetItem[] = state.commerceIntentDraft
    ? [{ id: state.commerceIntentDraft.id, title: state.commerceIntentDraft.productTitle, state: "已保存意向", tone: "primary" }]
    : [];
  const assets: AssetItem[] = [
    ...intents.map((item) => ({ id: item.order_intent_id, title: item.product_ref, state: item.status === "SUBMITTED" ? "已保存意向" : "草稿中", tone: "primary" as const })),
    ...localItems,
  ].slice(0, 3);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "订单与资产", headerBackTitle: "返回" }} />
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <SummaryPanel colors={colors} intentsCount={intents.length + localItems.length} availableEntitlements={entitlements.filter((item) => item.status === "AVAILABLE").length} devPoints={membership?.dev_points ? String(membership.dev_points.balance) : "—"} campCompletedDays={state.campCompletedDays.length} />
            <DataSourceBanner />
            {projectionState === "error" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="暂时无法读取订单与资产，点击重试"
                onPress={() => void loadProjections()}
                style={styles.inlineNotice}
              >
                <Text style={[styles.inlineNoticeText, { color: colors.muted }]}>暂时无法读取订单与资产，点击重试</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>家庭资产</Text>
          </View>
        }
        renderItem={({ item }) => <AssetRow colors={colors} item={item} />}
        ListEmptyComponent={<EmptyState colors={colors} />}
        ListFooterComponent={
          <View style={styles.footer}>
            <RightsPanel colors={colors} benefitsAvailable={benefits.filter((item) => item.status === "AVAILABLE").length} intentsCount={intents.length + localItems.length} hasReceipt={!!state.lastReceipt} hasInvitation={!!state.invitationDraft} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看会员中心"
              onPress={() => router.push("/ui/UI-18" as Href)}
              style={({ pressed }) => [styles.primary, { backgroundColor: colors.warning }, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>查看会员中心</Text>
              <IconSymbol name="chevron.right" size={18} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.boundary, { color: colors.muted }]}>此页不会支付、核销、下载、导出或发送内容；资产仅供家庭私有回看。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function SummaryPanel({ colors, intentsCount, availableEntitlements, devPoints, campCompletedDays }: { colors: ThemeColorPalette; intentsCount: number; availableEntitlements: number; devPoints: string; campCompletedDays: number }) {
  return (
    <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Metric colors={colors} label="方案意向" value={String(intentsCount)} />
      <Metric colors={colors} label="可用权益" value={String(availableEntitlements)} />
      <Metric colors={colors} label="成长积分" value={devPoints} />
      <Metric colors={colors} label="课程资产" value={String(campCompletedDays)} />
    </View>
  );
}

function Metric({ colors, label, value }: { colors: ThemeColorPalette; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function AssetRow({ colors, item }: { colors: ThemeColorPalette; item: AssetItem }) {
  return (
    <View style={[styles.asset, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.assetIcon, { backgroundColor: colors.background }]}>
        <IconSymbol name="ticket.fill" size={25} color={colors.tint} />
      </View>
      <View style={styles.assetCopy}>
        <Text style={[styles.assetTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.assetSub, { color: colors.muted }]}>来自家庭已保存的方案和权益记录</Text>
      </View>
      <Text style={[styles.assetState, { color: item.tone === "primary" ? colors.tint : colors.muted }]}>{item.state}</Text>
    </View>
  );
}

function EmptyState({ colors }: { colors: ThemeColorPalette }) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <IconSymbol name="wallet.fill" size={32} color={colors.muted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>这里会慢慢汇集家庭资产</Text>
      <Text style={[styles.emptyCopy, { color: colors.muted }]}>当家庭保存方案意向、获得权益或完成课程后，可以在这里统一回看。</Text>
    </View>
  );
}

function RightsPanel({ colors, benefitsAvailable, intentsCount, hasReceipt, hasInvitation }: { colors: ThemeColorPalette; benefitsAvailable: number; intentsCount: number; hasReceipt: boolean; hasInvitation: boolean }) {
  return (
    <View style={[styles.rights, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.rightsTitle, { color: colors.text }]}>权益中心</Text>
      <View style={styles.rightsGrid}>
        <Right colors={colors} label="会员权益" value={String(benefitsAvailable)} icon="crown.fill" />
        <Right colors={colors} label="方案意向" value={String(intentsCount)} icon="cart.fill" />
        <Right colors={colors} label="成长报告" value={hasReceipt ? "可回看" : "等待行动"} icon="chart.bar.fill" />
        <Right colors={colors} label="邀请记录" value={hasInvitation ? "已保存" : "—"} icon="gift.fill" />
      </View>
    </View>
  );
}

function Right({ colors, label, value, icon }: { colors: ThemeColorPalette; label: string; value: string; icon: "crown.fill" | "cart.fill" | "chart.bar.fill" | "gift.fill" }) {
  return (
    <View style={styles.right}>
      <IconSymbol name={icon} size={23} color={colors.warning} />
      <Text style={[styles.rightLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rightValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 38, gap: 10 },
  header: { gap: 12 },
  summary: { minHeight: 102, borderWidth: 1, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  metric: { flex: 1, alignItems: "center", gap: 4 },
  metricValue: { fontSize: 22, lineHeight: 28, fontWeight: "900" },
  metricLabel: { fontSize: 10, lineHeight: 14, textAlign: "center" },
  inlineNotice: { paddingVertical: 4 },
  inlineNoticeText: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: "900" },
  asset: { minHeight: 76, borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  assetIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  assetCopy: { flex: 1, gap: 4 },
  assetTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  assetSub: { fontSize: 11, lineHeight: 16 },
  assetState: { fontSize: 11, fontWeight: "900" },
  empty: { marginTop: 10, borderWidth: 1, borderRadius: 18, padding: 18, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  footer: { gap: 12, paddingTop: 18 },
  rights: { borderWidth: 1, borderRadius: 20, padding: 15, gap: 12 },
  rightsTitle: { fontSize: 16, lineHeight: 22, fontWeight: "900" },
  rightsGrid: { flexDirection: "row", justifyContent: "space-between" },
  right: { flex: 1, alignItems: "center", gap: 4 },
  rightLabel: { fontSize: 10, lineHeight: 14, textAlign: "center" },
  rightValue: { fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  primary: { minHeight: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  boundary: { fontSize: 11, lineHeight: 17, textAlign: "center" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
