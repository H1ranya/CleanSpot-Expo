import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { RootStackScreenProps } from "../navigation/types";
import { useAuth } from "../hooks/useAuth";
import { colors, spacing, borderRadius, shadows } from "../utils/theme";

export function HomeScreen({ navigation }: RootStackScreenProps<"Home">) {
  const { userId } = useAuth();
  const avatarInitials = userId ? userId.slice(0, 2).toUpperCase() : "CS";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          {/* CleanSpot Eco Badge */}
          <View style={styles.ecoBadge}>
            <Ionicons name="leaf" size={14} color={colors.forest700} />
            <Text style={styles.ecoBadgeText}>CLEANSPOT</Text>
          </View>

          {/* Top Actions: Notification & Profile */}
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <Ionicons
                name="notifications-outline"
                size={18}
                color={colors.slate700}
              />
              <View style={styles.notificationDot} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Settings")}
            >
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>
            User Waste{"\n"}
            <Text style={styles.titleHighlight}>Reporting</Text>
          </Text>
          <Text style={styles.subtitle}>
            Report illegal dumping and overflowing bins even when offline.
          </Text>
        </View>

        {/* Primary Action Hero Card */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => navigation.navigate("NewReport")}
          style={styles.heroCardContainer}
        >
          <LinearGradient
            colors={[colors.forest950, colors.forest900, "#047857"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Background Decorative Glow Circles */}
            <View style={styles.heroGlow1} />
            <View style={styles.heroGlow2} />

            {/* Hero Main Row */}
            <View style={styles.heroMainRow}>
              <View style={styles.heroLeftSection}>
                {/* 3D Styled Camera Badge */}
                <LinearGradient
                  colors={["rgba(4, 120, 87, 0.95)", "rgba(16, 185, 129, 0.4)"]}
                  style={styles.cameraBadge}
                >
                  <Ionicons name="camera" size={26} color="#A7F3D0" />
                  <View style={styles.sparkleBadge}>
                    <Text style={styles.sparkleText}>✦</Text>
                  </View>
                </LinearGradient>

                {/* Hero Titles */}
                <View style={styles.heroTitles}>
                  <View style={styles.heroTitleRow}>
                    <Text style={styles.heroTitle}>New Report</Text>
                    <View style={styles.offlineBadge}>
                      <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                    </View>
                  </View>
                  <Text style={styles.heroSubtitle}>
                    Capture photo & location offline
                  </Text>
                </View>
              </View>

              {/* Forward Arrow Circle */}
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Explore Section Header */}
        <View style={styles.exploreHeader}>
          <Text style={styles.exploreTitle}>Explore</Text>
          <Text style={styles.quickAccessText}>Quick Access</Text>
        </View>

        {/* Explore 2x2 Grid */}
        <View style={styles.grid}>
          {/* Card 1: My Reports */}
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("MyReports")}
          >
            <View
              style={[
                styles.cardIconBox,
                {
                  backgroundColor: colors.amber100,
                  borderColor: colors.amber200,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color={colors.amber600}
              />
            </View>
            <Text style={styles.cardTitle}>My Reports</Text>
            <Text style={styles.cardDescription}>
              Local offline queue & sync status
            </Text>
          </TouchableOpacity>

          {/* Card 2: Shared Map */}
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Map")}
          >
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: colors.sky100, borderColor: colors.sky200 },
              ]}
            >
              <Ionicons name="map-outline" size={22} color={colors.sky600} />
            </View>
            <Text style={styles.cardTitle}>Shared Map</Text>
            <Text style={styles.cardDescription}>
              View community reported spots
            </Text>
          </TouchableOpacity>

          {/* Card 3: Statistics */}
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Statistics")}
          >
            <View
              style={[
                styles.cardIconBox,
                {
                  backgroundColor: colors.indigo100,
                  borderColor: colors.indigo200,
                },
              ]}
            >
              <Ionicons
                name="bar-chart-outline"
                size={22}
                color={colors.indigo600}
              />
            </View>
            <Text style={styles.cardTitle}>Statistics</Text>
            <Text style={styles.cardDescription}>
              Waste categories & synced metrics
            </Text>
          </TouchableOpacity>

          {/* Card 4: Settings */}
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Settings")}
          >
            <View
              style={[
                styles.cardIconBox,
                {
                  backgroundColor: colors.slate100,
                  borderColor: colors.slate200,
                },
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.slate700}
              />
            </View>
            <Text style={styles.cardTitle}>Settings</Text>
            <Text style={styles.cardDescription}>
              Anonymous auth & app details
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNavBar}>
          {/* Home Tab (Active) */}
          <TouchableOpacity
            style={styles.navTab}
            activeOpacity={0.7}
            onPress={() => {}}
          >
            <Ionicons name="home" size={20} color={colors.forest700} />
            <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
          </TouchableOpacity>

          {/* Map Tab */}
          <TouchableOpacity
            style={styles.navTab}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Map")}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={colors.slate400}
            />
            <Text style={styles.navLabel}>Map</Text>
          </TouchableOpacity>

          {/* Center Elevated Camera FAB */}
          <View style={styles.fabWrapper}>
            <TouchableOpacity
              style={styles.fabButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("NewReport")}
            >
              <LinearGradient
                colors={[colors.forest800, colors.forest600]}
                style={styles.fabGradient}
              >
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Reports Tab */}
          <TouchableOpacity
            style={styles.navTab}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("MyReports")}
          >
            <View style={styles.tabIconWrapper}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.slate400}
              />
              <View style={styles.badgeDot} />
            </View>
            <Text style={styles.navLabel}>Reports</Text>
          </TouchableOpacity>

          {/* Settings Tab */}
          <TouchableOpacity
            style={styles.navTab}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={colors.slate400}
            />
            <Text style={styles.navLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.xs,
    paddingBottom: 110,
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  ecoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.forest50,
    borderWidth: 1,
    borderColor: "rgba(187, 247, 208, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
    gap: 6,
  },
  ecoBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.forest800,
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: colors.slate200,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.forest500,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.forest700,
    borderWidth: 1,
    borderColor: colors.forest600,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  titleSection: {
    marginBottom: spacing.lg,
  },
  mainTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: colors.slate900,
    lineHeight: 35,
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: colors.forest800,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.slate600,
    marginTop: 6,
  },
  heroCardContainer: {
    marginBottom: spacing.lg,
    borderRadius: 24,
    ...shadows.hero,
  },
  heroCard: {
    borderRadius: 24,
    padding: spacing.md + 4,
    overflow: "hidden",
  },
  heroGlow1: {
    position: "absolute",
    right: -30,
    bottom: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  heroGlow2: {
    position: "absolute",
    right: 50,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  cameraBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#FDE047",
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#0F172A",
  },
  heroTitles: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  offlineBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.4)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.forest200,
    letterSpacing: 0.6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(209, 250, 229, 0.85)",
    marginTop: 2,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm + 2,
    paddingHorizontal: 2,
  },
  exploreTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.slate900,
    letterSpacing: -0.3,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.forest700,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: spacing.md,
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    ...shadows.card,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm + 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.slate900,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16.5,
    color: colors.slate500,
  },
  floatingNavContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  floatingNavBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: borderRadius.round,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.85)",
    ...shadows.floatingBar,
  },
  navTab: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.slate500,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.forest800,
    fontWeight: "800",
  },
  tabIconWrapper: {
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: -1,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.forest500,
  },
  fabWrapper: {
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
  },
  fabButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3.5,
    borderColor: "#FFFFFF",
    ...shadows.fab,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
});
