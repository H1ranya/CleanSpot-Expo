import React from "react";
import { StyleSheet, Text, View, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function PlaceholderScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4FBF7" />
      <View style={styles.container}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌱 Sustainability & GreenTech</Text>
        </View>

        <Text style={styles.title}>CleanSpot</Text>
        <Text style={styles.subtitle}>
          Offline-first user waste & illegal dumping reporting
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4FBF7",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  badge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  badgeText: {
    fontSize: 13,
    color: "#2E7D32",
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1B3B2B",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B6B5B",
    textAlign: "center",
    maxWidth: 320,
  },
});
