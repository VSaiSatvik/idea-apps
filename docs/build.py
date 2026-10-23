"""Builds the privacy + support pages for GitHub Pages. Edit DEVELOPER/EMAIL, then run: python3 docs/build.py"""
import html, pathlib
DEVELOPER = "Sai Satvik"            # the name shown on your store listings
EMAIL = "YOUR-SUPPORT-EMAIL"        # a support inbox you check (it is published)
UPDATED = "22 October 2026"
HOST = "Render (our server provider)"
COMMON_ACCOUNT = "Your name, email address and a scrambled (hashed) version of your password, so you can sign in."
APPS = {
 "circles": ("AskOnce Circles", "#3B4CCA",
  [COMMON_ACCOUNT,
   "The circles you create or join, and the questions and answers you choose to share into a circle. Shared answers are visible to every member of that circle.",
   "Reports and blocks you make, so we can hide content and keep circles safe."],
  ["Your AI provider API key (Anthropic, OpenAI or Google) is stored only in your phone's secure storage. It is never sent to our server.",
   "When you ask a question with your own key, the question goes directly from your phone to the provider you picked, under that provider's terms. We do not see it unless you share the answer into a circle.",
   "If you use the 'try without a key' demo, your question is sent to our server and, if enabled, to Anthropic to generate the answer. Demo questions are not stored after the answer is returned."],
  "Members can delete their own entries. Circle owners can remove entries and members."),
 "wasl": ("Wasl", "#0F6B4F",
  [COMMON_ACCOUNT,
   "Invoices you enter: invoice number, amounts, dates, description, and your client's name and (optionally) phone and email.",
   "WhatsApp chat text you paste in so the app can find where your client acknowledged the debt.",
   "When your client opens a confirmation link and confirms, we record the name they type, the optional phone number, the time, and their IP address, as evidence of the confirmation."],
  ["Reminder messages are sent by you through WhatsApp or your share sheet. Wasl does not message your clients itself.",
   "Evidence packs are generated on request and shared only where you send them."],
  "Delete an invoice or your account at any time."),
 "vouch": ("Vouch Crawls", "#C2410C",
  [COMMON_ACCOUNT,
   "For venues: venue name, address, offer details and the venue's location, which you set by tapping 'Use my current location'.",
   "For creators: your public social handles, follower details you enter, and your advertiser permit number for verification.",
   "Crawl activity: which crawls you joined, when you went live, and offer redemptions recorded at the venue's till."],
  ["Location is used only when you tap the button to set a venue's location. We do not track your location in the background.",
   "Venues on a crawl can see the creator's public handle; creators can see the venue's public details."],
  "Venue and creator profiles are kept while your account exists."),
 "sidedesk": ("SideDesk", "#6D28D9",
  [COMMON_ACCOUNT,
   "For businesses: your business name and the task briefs you post.",
   "For students: your university email, university, skills, the age you confirm (to check you are 18 or over), sponsor approval status and dates you are unavailable.",
   "Work records: tasks claimed, deliverables submitted, quality checks and hours worked, so we can respect working-hour limits and pay you."],
  ["Businesses see the deliverable for their own task, not the student's personal details.",
   "Work records may need to be kept for longer where employment or tax law requires it; we will tell you if this applies when you delete your account."],
  "Task briefs and deliverables are kept for as long as needed to complete and pay for the task."),
 "familyshield": ("Family Shield", "#B3261E",
  [COMMON_ACCOUNT,
   "The family link between a parent's phone and their family members' phones (names and the linking code).",
   "The notification token of a family member's phone, so we can tell them when the parent taps 'Let my family know'.",
   "Check-ins: the time and the short reason shown on the pause screen, sent only when the parent taps 'Let my family know' (or has turned on automatic check-ins)."],
  ["Family Shield never records calls and never reads the content of your messages or chats.",
   "On the parent's Android phone, the app reads call notifications (to notice a call from an unsaved number), delivery-app notifications (so delivery calls are not flagged), one-time-password text in notifications, and which app is opened during or shortly after such a call. All of this is processed on the phone and is not sent to our server.",
   "Fraud reports are written on the phone. You choose whether to copy them into Chakshu (Sanchar Saathi) or give them to the 1930 cyber crime helpline. Family Shield never reports anyone automatically.",
   "Push notifications are delivered through Expo's push service and Apple or Google's notification services."],
  "On-device pause history is kept on the phone and removed when you uninstall the app."),
}
CSS = "body{font:16px/1.6 system-ui,-apple-system,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1b1b1f;background:#fff}h1{color:var(--c)}h2{margin-top:28px;font-size:1.1rem}li{margin:6px 0}a{color:var(--c)}@media(prefers-color-scheme:dark){body{background:#121214;color:#e6e6ea}}"
def page(title, color, body):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>:root{{--c:{color}}}{CSS}</style></head><body>{body}</body></html>'
ul = lambda xs: "<ul>" + "".join(f"<li>{html.escape(x)}</li>" for x in xs) + "</ul>"
out = pathlib.Path(__file__).parent
for app, (name, color, collect, how, keep) in APPS.items():
    body = f"""<h1>{name} — Privacy Policy</h1><p>Last updated {UPDATED}. {name} is made by {DEVELOPER} ("we"). This page explains what the app collects and why.</p>
<h2>What we collect</h2>{ul(collect)}
<h2>How it works</h2>{ul(how)}
<h2>Why we use it</h2><p>Only to run the features of {name}: signing you in, showing your data across your devices, and keeping the service safe. We do not sell your data, show ads, or use it to track you across other apps or websites.</p>
<h2>Who processes it</h2><p>Our server is hosted by {HOST}. Data is stored there and sent over encrypted connections (HTTPS). We share data with no one else except where the law requires it.</p>
<h2>How long we keep it</h2><p>{html.escape(keep)} When you delete your account, your account and the data linked to it are deleted from our server.</p>
<h2>Deleting your account</h2><p>In the app, open <b>Account → Delete account</b>. Or email <a href="mailto:{EMAIL}">{EMAIL}</a> from the address you signed up with and we will delete it within 30 days.</p>
<h2>Children</h2><p>{name} is not intended for anyone under 18.</p>
<h2>Contact</h2><p><a href="mailto:{EMAIL}">{EMAIL}</a></p>"""
    (out / "privacy" / f"{app}.html").write_text(page(f"{name} Privacy Policy", color, body))
links = "".join(f'<li><b>{n}</b> — <a href="privacy/{a}.html">Privacy policy</a></li>' for a, (n, *_r) in APPS.items())
(out / "index.html").write_text(page(f"{DEVELOPER} — Apps & Support", "#3B4CCA", f"<h1>{DEVELOPER} — Apps</h1><p>Support for all apps: <a href='mailto:{EMAIL}'>{EMAIL}</a>. We reply within 2 working days.</p><ul>{links}</ul><h2>Delete your account</h2><p>Every app has <b>Account → Delete account</b>. You can also email us from your sign-up address.</p>"))
print("built", len(APPS), "privacy pages")
