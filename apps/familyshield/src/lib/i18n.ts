/**
 * Parent-facing text. Hindi and Telugu were written for this build — have a native
 * speaker review every line before release (and add Malayalam, Tamil, Bengali, Urdu).
 */
export type Lang = "hi" | "en" | "te";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "hi", label: "हिन्दी" },
  { value: "te", label: "తెలుగు" },
  { value: "en", label: "English" },
];

type Strings = {
  stop: string; body: (c: string) => string; callChild: (c: string) => string; tellFamily: string; told: string;
  secrecy: string; police: string; imOk: string; report: string; why: string;
  askedFor: string; claimed: string; moneyLost: string; amount: string; makeReport: string;
  opts: Record<"OTP" | "money" | "install an app" | "bank details" | "threatened arrest" | "other", string>;
};

export const T: Record<Lang, Strings> = {
  en: {
    stop: "Stop.",
    body: (c) => `Talk to ${c} before you share any OTP or send any money.`,
    callChild: (c) => `Call ${c} now`,
    tellFamily: "Let my family know",
    told: "Your family has been told you may need a call.",
    secrecy: "Were you told not to tell anyone? That is a sign of fraud.",
    police: "Police and government departments do not arrest anyone over a phone or video call.",
    imOk: "I'm fine, this call is genuine",
    report: "Report this as fraud",
    why: "Why this appeared",
    askedFor: "What did the caller ask for?",
    claimed: "Who did they say they were?",
    moneyLost: "Money has already been sent",
    amount: "Amount (₹)",
    makeReport: "Prepare the report",
    opts: { OTP: "OTP", money: "Money", "install an app": "Install an app", "bank details": "Bank details", "threatened arrest": "Threatened arrest", other: "Something else" },
  },
  hi: {
    stop: "रुकिए।",
    body: (c) => `कोई भी OTP बताने या पैसे भेजने से पहले ${c} से बात करें।`,
    callChild: (c) => `अभी ${c} को कॉल करें`,
    tellFamily: "परिवार को बताएं",
    told: "आपके परिवार को बता दिया गया है कि आपको कॉल की ज़रूरत हो सकती है।",
    secrecy: "क्या आपसे कहा गया है कि किसी को न बताएं? यह धोखाधड़ी का संकेत है।",
    police: "पुलिस या कोई सरकारी विभाग फोन या वीडियो कॉल पर गिरफ्तार नहीं करता।",
    imOk: "मैं ठीक हूँ, यह कॉल सही है",
    report: "धोखाधड़ी की रिपोर्ट करें",
    why: "यह क्यों दिखा",
    askedFor: "कॉल करने वाले ने क्या मांगा?",
    claimed: "उन्होंने खुद को कौन बताया?",
    moneyLost: "पैसे भेजे जा चुके हैं",
    amount: "राशि (₹)",
    makeReport: "रिपोर्ट तैयार करें",
    opts: { OTP: "OTP", money: "पैसे", "install an app": "ऐप इंस्टॉल करना", "bank details": "बैंक की जानकारी", "threatened arrest": "गिरफ्तारी की धमकी", other: "कुछ और" },
  },
  te: {
    stop: "ఆగండి.",
    body: (c) => `ఏ OTP చెప్పే ముందు లేదా డబ్బు పంపే ముందు ${c}తో మాట్లాడండి.`,
    callChild: (c) => `ఇప్పుడే ${c}కి కాల్ చేయండి`,
    tellFamily: "నా కుటుంబానికి తెలియజేయండి",
    told: "మీకు కాల్ అవసరం కావచ్చని మీ కుటుంబానికి తెలియజేశాం.",
    secrecy: "ఎవరికీ చెప్పవద్దని మీకు చెప్పారా? అది మోసానికి సంకేతం.",
    police: "పోలీసులు లేదా ప్రభుత్వ శాఖలు ఫోన్ లేదా వీడియో కాల్‌లో ఎవరినీ అరెస్ట్ చేయవు.",
    imOk: "నేను బాగానే ఉన్నాను, ఈ కాల్ నిజమైనదే",
    report: "మోసంగా రిపోర్ట్ చేయండి",
    why: "ఇది ఎందుకు కనిపించింది",
    askedFor: "కాల్ చేసిన వ్యక్తి ఏమి అడిగారు?",
    claimed: "వారు తమను ఎవరని చెప్పుకున్నారు?",
    moneyLost: "డబ్బు ఇప్పటికే పంపబడింది",
    amount: "మొత్తం (₹)",
    makeReport: "రిపోర్ట్ సిద్ధం చేయండి",
    opts: { OTP: "OTP", money: "డబ్బు", "install an app": "యాప్ ఇన్‌స్టాల్ చేయడం", "bank details": "బ్యాంక్ వివరాలు", "threatened arrest": "అరెస్ట్ బెదిరింపు", other: "ఇంకేదో" },
  },
};
