import { type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "./theme";

export function Screen({ children, refreshing, onRefresh, scroll = true, edges }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  const t = useTheme();
  const inner = <View style={{ padding: 16, gap: 12, width: "100%", maxWidth: 640, alignSelf: "center" }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={edges ?? ["bottom", "left", "right"]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.muted} /> : undefined}>
          {inner}
        </ScrollView>
      ) : inner}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "700", color: t.ink }}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "700", color: t.ink, marginTop: 8 }}>{children}</Text>;
}
export function P({ children, muted, style, selectable }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  const t = useTheme();
  return <Text selectable={selectable} style={[{ fontSize: 16, lineHeight: 23, color: muted ? t.muted : t.ink }, style]}>{children}</Text>;
}
export function Small({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={{ fontSize: 13, lineHeight: 18, color: color ?? t.muted }}>{children}</Text>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const base: ViewStyle = { backgroundColor: t.card, borderRadius: t.radius, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = "primary", busy, disabled, small }: {
  title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger" | "ghost"; busy?: boolean; disabled?: boolean; small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === "primary" ? t.accent : kind === "danger" ? t.bad : kind === "secondary" ? t.soft : "transparent";
  const fg = kind === "primary" || kind === "danger" ? t.onAccent : kind === "ghost" ? t.accent : t.ink;
  const off = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!busy }} disabled={off} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1, borderRadius: 12, paddingVertical: small ? 9 : 14, paddingHorizontal: 16, alignItems: "center", minHeight: small ? 38 : 48, justifyContent: "center" })}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: small ? 15 : 17, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      <TextInput placeholderTextColor={t.muted} accessibilityLabel={label} {...props}
        style={[{ backgroundColor: t.card, color: t.ink, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: props.multiline ? 110 : 48, textAlignVertical: props.multiline ? "top" : "center" }, props.style]} />
      {hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 16 }}>{label}</Text>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

export function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "warn" | "bad" | "accent" }) {
  const t = useTheme();
  const color = tone === "good" ? t.good : tone === "warn" ? t.warn : tone === "bad" ? t.bad : tone === "accent" ? t.accent : t.muted;
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: color, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 13, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

export function Row({ children, gap = 8, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>;
}

export function Choice<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card }}>
              <Text style={{ color: on ? t.onAccent : t.ink, fontSize: 15 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  const t = useTheme();
  if (!message) return null;
  return <Text accessibilityRole="alert" style={{ color: t.bad, fontSize: 15 }}>{message}</Text>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 6 }}>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600", textAlign: "center" }}>{title}</Text>
      {body ? <Text style={{ color: t.muted, fontSize: 15, textAlign: "center", lineHeight: 21 }}>{body}</Text> : null}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={t.muted} /></View>;
}
