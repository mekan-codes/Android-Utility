import React from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";

const brandMark = require("../assets/images/brand-mark.png");

interface BrandMarkProps {
  size?: number;
  framed?: boolean;
  style?: ViewStyle;
}

export default function BrandMark({ size = 38, framed = true, style }: BrandMarkProps) {
  const imageSize = framed ? Math.round(size * 0.76) : size;

  if (!framed) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Image
          source={brandMark}
          resizeMode="contain"
          style={styles.unframedImage}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: Math.round(size * 0.28) }, style]}>
      <Image
        source={brandMark}
        resizeMode="contain"
        style={{ width: imageSize, height: imageSize }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  unframedImage: {
    width: "100%",
    height: "100%",
  },
});
