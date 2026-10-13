import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0B152A",
  surfaceSecondary: "#F5F7FA",
  onSurfaceSecondary: "#0B152A",
  surfaceTertiary: "#E5E9F0",
  onSurfaceTertiary: "#4C566A",
  surfaceInverse: "#0B152A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#0B152A",
  onBrand: "#FFFFFF",
  brandPrimary: "#0B152A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D4AF37",
  onBrandSecondary: "#0B152A",
  brandTertiary: "#FDF8E8",
  onBrandTertiary: "#8A6D1C",

  success: "#166534",
  onSuccess: "#F0FDF4",
  warning: "#B45309",
  onWarning: "#FFFBEB",
  error: "#991B1B",
  onError: "#FEF2F2",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",

  border: "#E5E9F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radii = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;
