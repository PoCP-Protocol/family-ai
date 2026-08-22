import type { Href } from "expo-router";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { commerceProductsForDisplay } from "@/lib/family/commerce-entitlements";
import { familyApi } from "@/lib/family/family-api-client";
import type { FamilyApiCommerceCustomerProjection, FamilyApiCommerceIntentReceipt, FamilyApiCommerceProductsProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

export default function GrowthProductDetailScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { productRef } = useLocalSearchParams<{ productRef?: string }>();
  const state = useFamilyMobile();
  const [catalog, setCatalog] = useState<FamilyApiCommerceProductsProjection | null>(null);
  const [commerceProjection, setCommerceProjection] = useState<FamilyApiCommerceCustomerProjection | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "saved" | "error">("idle");

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    Promise.all([
      familyApi.getCommerceProducts<FamilyApiCommerceProductsProjection>(session.token, session.selectedFamily.family_id),
      familyApi.getCommerceCustomerProjection<FamilyApiCommerceCustomerProjection>(session.token, session.selectedFamily.family_id),
    ]).then(([catalogResult, projectionResult]) => {
      if (!active) return;
      setCatalog(catalogResult);
      setCommerceProjection(projectionResult);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const products = useMemo(() => commerceProductsForDisplay(catalog?.products), [catalog?.products]);
  const product = products.find((item) => item.productRef === productRef)
    ?? products.find((item) => item.productRef === state.commerceIntentDraft?.productRef)
    ?? products[0];
  const matchingIntents = commerceProjection?.order_intents.filter((item) => item.product_ref === product.productRef) ?? [];
  const hasEntitlement = commerceProjection?.entitlements.some((item) => item.status === "AVAILABLE" && matchingIntents.some((intent) => intent.order_intent_id === item.source_order_intent_id)) ?? false;

  const saveIntent = async () => {
    state.saveCommerceIntentDraft(product.productRef, product.productVersion, product.title);
    setSubmitState("submitting");
    if (session.status !== "connected" || !session.token || !session.selectedFamily) {
      setSubmitState("saved");
      haptic.success();
      return;
    }
    try {
      const result = await familyApi.submitCommerceIntent<FamilyApiCommerceIntentReceipt>(
        session.token,
        session.selectedFamily.family_id,
        { page_id: "UI-14", product_ref: product.productRef, product_version: product.productVersion, attributes: { entry: "family_ai_mobile_product_detail" } },
        `family-mobile-ui14:${session.selectedFamily.family_id}:${product.productRef}:v${product.productVersion}`,
      );
      state.syncCommerceIntentReceipt(result.intent.order_intent_id, result.entitlement.entitlement_id);
      setSubmitState("saved");
      haptic.success();
    } catch {
      setSubmitState("error");
    }
  };

  const deliveryRows = product.delivery.map((item, index) => ({ id: `${product.productRef}-${index}`, label: item }));

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={deliveryRows}
        keyExtractor={(item) => item.id}
        numColumns={4}
        columnWrapperStyle={styles.deliveryRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.backButton}><IconSymbol name="chevron.left" size={26} color="#23272D" /></Pressable><Text style={styles.topTitle}>商品详情</Text><Text style={styles.more}>•••</Text></View>
            <View style={[styles.hero, { backgroundColor: `${product.accent}18` }]}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroLabel, { color: product.accent }]}>家庭成长好物</Text>
                <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>{product.subtitle}</Text>
              </View>
              <View style={[styles.heroIcon, { backgroundColor: product.accent }]}>
                <IconSymbol name="book.fill" size={42} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.priceArea}>
              <Text style={[styles.familyPrice, { color: "#E04E3E" }]}>{product.familyPriceLabel}</Text>
              <Text style={[styles.listPrice, { color: colors.muted }]}>{product.listPriceLabel}</Text>
              <Text style={[styles.memberPrice, { color: "#D88916" }]}>{product.memberPriceLabel}</Text>
              {hasEntitlement ? <Text style={[styles.entitlementBadge, { color: colors.success, borderColor: colors.success }]}>当前家庭已有可用权益</Text> : null}
            </View>

            <View style={[styles.assurance, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AssuranceItem label="21天成长陪伴" />
              <AssuranceItem label="行动卡与回顾" />
              <AssuranceItem label="家庭可暂停" />
            </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>你将获得</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.tint }]}>训练营 ＋ 打卡社群 ＋ 顾问答疑</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.deliveryItem}>
            <View style={[styles.deliveryIcon, { backgroundColor: `${product.accent}18` }]}>
              <IconSymbol name={index === 0 ? "book.fill" : index === 1 ? "calendar.fill" : index === 2 ? "person.2.fill" : "chart.bar.fill"} size={22} color={product.accent} />
            </View>
            <Text style={[styles.deliveryLabel, { color: colors.text }]}>{item.label}</Text>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={[styles.audiencePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.audienceLabel, { color: colors.tint }]}>适用家庭</Text>
              <Text style={[styles.audienceText, { color: colors.text }]}>{product.audience}</Text>
              <Text style={[styles.boundaryText, { color: colors.muted }]}>这是成长支持方案，不是诊断、治疗或教育效果承诺。预计投入以家庭节奏为准。</Text>
            </View>

            <Pressable onPress={() => router.push("/ui/UI-15" as Href)} style={({ pressed }) => [styles.inviteOffer, { backgroundColor: "#FFF6F1", borderColor: "#F5C9B1" }, pressed && styles.pressed]}>
              <View style={styles.inviteOfferCopy}>
                <Text style={styles.inviteOfferTitle}>分享给 3 位家长，领取专属优惠券</Text>
                <Text style={[styles.inviteOfferText, { color: colors.muted }]}>成功邀请可得 ¥20 优惠券</Text>
              </View>
              <Text style={styles.inviteOfferAction}>去看看</Text>
            </Pressable>

            {submitState === "saved" || state.commerceIntentDraft?.productRef === product.productRef ? (
              <View style={[styles.receipt, { backgroundColor: "#16866D12", borderColor: colors.success }]}>
                <IconSymbol name="checkmark.circle.fill" size={25} color={colors.success} />
                <View style={styles.receiptCopy}>
                  <Text style={[styles.receiptTitle, { color: colors.success }]}>方案意向已记下</Text>
                  <Text style={[styles.receiptText, { color: colors.muted }]}>当前不会扣款；你可以前往会员中心查看家庭权益。</Text>
                </View>
              </View>
            ) : submitState === "error" ? (
              <Text style={[styles.errorText, { color: colors.error }]}>暂时无法同步，但本机意向草稿已经保留。</Text>
            ) : null}

            <View style={styles.actionBar}>
              <Pressable disabled={submitState === "submitting"} onPress={saveIntent} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
                <Text style={styles.actionText}>{submitState === "submitting" ? "正在保存" : "立即购买"}</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/ui/UI-16?productRef=${encodeURIComponent(product.productRef)}` as Href)} style={({ pressed }) => [styles.groupAction, pressed && styles.pressed]}>
                <Text style={styles.actionText}>发起拼团</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function AssuranceItem({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.assuranceItem}>
      <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
      <Text style={[styles.assuranceText, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36, gap: 12 },
  header: { gap: 14, marginBottom: 8 },
  topBar: { minHeight: 44, alignItems: "center", justifyContent: "space-between", flexDirection: "row" },
  backButton: { width: 38, height: 38, justifyContent: "center", alignItems: "flex-start" },
  topTitle: { color: "#22272D", fontSize: 19, lineHeight: 26, fontWeight: "900" },
  more: { color: "#22272D", fontSize: 18, lineHeight: 20, fontWeight: "900", letterSpacing: 1 },
  hero: { minHeight: 190, borderRadius: 26, padding: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  heroCopy: { flex: 1, gap: 7 },
  heroLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  title: { fontSize: 27, lineHeight: 35, fontWeight: "900" },
  subtitle: { fontSize: 14, lineHeight: 21 },
  heroIcon: { width: 82, height: 82, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  priceArea: { gap: 5 },
  familyPrice: { fontSize: 25, lineHeight: 32, fontWeight: "900" },
  listPrice: { fontSize: 12, lineHeight: 17, textDecorationLine: "line-through" },
  memberPrice: { fontSize: 17, lineHeight: 23, fontWeight: "800" },
  entitlementBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, lineHeight: 15, fontWeight: "800" },
  assurance: { minHeight: 58, borderWidth: 1, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", gap: 5, paddingHorizontal: 8 },
  assuranceItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  assuranceText: { fontSize: 10, lineHeight: 14 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "900" },
  sectionSubtitle: { marginTop: -8, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  deliveryRow: { justifyContent: "space-between", gap: 7 },
  deliveryItem: { flex: 1, minHeight: 94, alignItems: "center", gap: 7 },
  deliveryIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  deliveryLabel: { fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center" },
  footer: { gap: 13, paddingTop: 8 },
  audiencePanel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 6 },
  audienceLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  audienceText: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  boundaryText: { fontSize: 12, lineHeight: 18 },
  inviteOffer: { minHeight: 76, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  inviteOfferCopy: { flex: 1, gap: 2 },
  inviteOfferTitle: { color: "#A64A2B", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  inviteOfferText: { fontSize: 11, lineHeight: 16 },
  inviteOfferAction: { color: "#F06E36", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  receipt: { minHeight: 76, borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  receiptCopy: { flex: 1, gap: 2 },
  receiptTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  receiptText: { fontSize: 11, lineHeight: 16 },
  errorText: { fontSize: 12, lineHeight: 18 },
  actionBar: { flexDirection: "row", gap: 9 },
  primaryAction: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  groupAction: { flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: "#F28C45", alignItems: "center", justifyContent: "center" },
  actionText: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "900" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
