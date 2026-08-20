import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { commerceProductsForDisplay, type CommercePresentationProduct } from "@/lib/family/commerce-entitlements";
import { familyApi } from "@/lib/family/family-api-client";
import type { FamilyApiCommerceProductsProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";

export default function FamilyGrowthMallScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const [remoteCatalog, setRemoteCatalog] = useState<FamilyApiCommerceProductsProjection | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    familyApi.getCommerceProducts<FamilyApiCommerceProductsProjection>(session.token, session.selectedFamily.family_id)
      .then((result) => { if (active) setRemoteCatalog(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const products = useMemo(() => commerceProductsForDisplay(remoteCatalog?.products), [remoteCatalog?.products]);
  const openProduct = (product: CommercePresentationProduct) => {
    router.push(`/ui/UI-14?productRef=${encodeURIComponent(product.productRef)}` as Href);
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "家庭成长商城", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={products}
        keyExtractor={(item) => item.productRef}
        numColumns={3}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.greeting, { color: colors.text }]}>早上好，今天想先照顾家里的哪件事？</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>课程、工具和服务都从家庭成长路径出发，不用一次做很多。</Text>
            <DataSourceBanner />

            <Pressable onPress={() => router.push("/ui/UI-15" as Href)} style={({ pressed }) => [styles.inviteBanner, pressed && styles.pressed]}>
              <View style={styles.inviteCopy}>
                <Text style={styles.inviteLabel}>邀请熟悉的家庭一起成长</Text>
                <Text style={styles.inviteTitle}>邀请 3 个家庭，解锁成长权益</Text>
                <View style={styles.inviteAction}>
                  <Text style={styles.inviteActionText}>查看邀请进度</Text>
                  <IconSymbol name="chevron.right" size={18} color="#2563EB" />
                </View>
              </View>
              <View style={styles.familyMark}>
                <IconSymbol name="person.2.fill" size={42} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.categoryGrid}>
              <CategoryTile label="同行计划" detail="和熟悉家庭一起" icon="person.2.fill" color="#F28C45" target="UI-16" />
              <CategoryTile label="家庭成长" detail="课程与工具" icon="book.fill" color="#16866D" target="UI-14" />
              <CategoryTile label="成长积分" detail="任务与账本" icon="star.fill" color="#E49B18" target="UI-17" />
              <CategoryTile label="会员专享" detail="当前权益" icon="crown.fill" color="#2563EB" target="UI-18" />
              <CategoryTile label="邀请有礼" detail="单层成长权益" icon="gift.fill" color="#D7604F" target="UI-15" />
              <CategoryTile label="进阶支持" detail="专家与服务" icon="headphones.fill" color="#7556C8" target="UI-19" />
            </View>

            <View style={styles.sectionTopline}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>今日推荐</Text>
              <Text style={[styles.sectionHint, { color: colors.muted }]}>按家庭场景组织</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openProduct(item)} style={({ pressed }) => [styles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.productVisual, { backgroundColor: `${item.accent}18` }]}>
              <IconSymbol name={item.category === "COURSE" ? "book.fill" : item.category === "ASSESSMENT" ? "chart.bar.fill" : "gift.fill"} size={30} color={item.accent} />
            </View>
            <Text style={[styles.productTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.productPrice, { color: item.accent }]}>{item.familyPriceLabel.replace("家庭意向 ", "")}</Text>
            <Text style={[styles.productSource, { color: colors.muted }]}>{item.source === "FAMILY_API" ? "家庭目录" : "推荐方案"}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={[styles.footerNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="lock.fill" size={22} color={colors.success} />
            <Text style={[styles.footerText, { color: colors.muted }]}>查看和保存意向不会扣款，也不会自动开通权益。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

type CommerceIcon = "person.2.fill" | "book.fill" | "star.fill" | "crown.fill" | "gift.fill" | "headphones.fill";

function CategoryTile({ label, detail, icon, color, target }: { label: string; detail: string; icon: CommerceIcon; color: string; target: string }) {
  const colors = useColors();
  return (
    <Pressable onPress={() => router.push(`/ui/${target}` as Href)} style={({ pressed }) => [styles.categoryTile, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
      <View style={[styles.categoryIcon, { backgroundColor: `${color}18` }]}>
        <IconSymbol name={icon} size={23} color={color} />
      </View>
      <Text style={[styles.categoryLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.categoryDetail, { color: colors.muted }]}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36, gap: 12 },
  header: { gap: 14, marginBottom: 12 },
  greeting: { fontSize: 24, lineHeight: 32, fontWeight: "900" },
  subtitle: { fontSize: 14, lineHeight: 21 },
  inviteBanner: { minHeight: 146, borderRadius: 25, backgroundColor: "#2563EB", padding: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  inviteCopy: { flex: 1, gap: 7 },
  inviteLabel: { color: "#CFE0FF", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  inviteTitle: { color: "#FFFFFF", fontSize: 20, lineHeight: 27, fontWeight: "900" },
  inviteAction: { alignSelf: "flex-start", minHeight: 34, borderRadius: 17, paddingHorizontal: 11, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 2 },
  inviteActionText: { color: "#2563EB", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  familyMark: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFFFFF20", alignItems: "center", justifyContent: "center" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  categoryTile: { width: "31%", minHeight: 112, borderWidth: 1, borderRadius: 19, padding: 10, alignItems: "center", justifyContent: "center", gap: 4 },
  categoryIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  categoryDetail: { fontSize: 10, lineHeight: 14, textAlign: "center" },
  sectionTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "900" },
  sectionHint: { fontSize: 12, lineHeight: 17 },
  productRow: { gap: 8 },
  productCard: { flex: 1, minHeight: 194, borderWidth: 1, borderRadius: 18, padding: 9, gap: 6, marginBottom: 10 },
  productVisual: { height: 72, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  productTitle: { minHeight: 38, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  productPrice: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  productSource: { fontSize: 10, lineHeight: 14 },
  footerNote: { minHeight: 74, borderWidth: 1, borderRadius: 19, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  footerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
