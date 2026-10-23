import * as Linking from "expo-linking";
import { Share } from "react-native";

/** Open WhatsApp with the message ready to send FROM THE USER's own account (Wasl never messages clients). */
export async function sendWhatsApp(text: string, phone?: string) {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(url); }
  catch { await Share.share({ message: text }); }
}
