import { useColorScheme } from "react-native";
import { BRAND } from "./brand";

export type Theme = ReturnType<typeof useTheme>;

export function useTheme() {
  const dark = useColorScheme() === "dark";
  return {
    dark,
    bg: dark ? "#121212" : "#F6F5F2",
    card: dark ? "#1E1E1E" : "#FFFFFF",
    ink: dark ? "#F2F0EC" : "#1B1A18",
    muted: dark ? "#A39F98" : "#6B6760",
    line: dark ? "#2E2D2B" : "#E4E1DB",
    accent: dark ? BRAND.accentDark : BRAND.accent,
    onAccent: "#FFFFFF",
    good: dark ? "#6FD39B" : "#1E7A4A",
    warn: dark ? "#F2C14E" : "#9A6A00",
    bad: dark ? "#FF8A80" : "#B3261E",
    soft: dark ? "#262523" : "#EFECE6",
    radius: 14,
  };
}
