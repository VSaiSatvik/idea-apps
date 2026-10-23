"""Write package.json main/scripts and app.json for an app: make-config.py <dir> <json-overrides>"""
import json, sys
d, o = sys.argv[1], json.loads(sys.argv[2])
p = json.load(open(f"{d}/package.json"))
p["main"] = "expo-router/entry"
p["scripts"].update({"typecheck": "tsc --noEmit", "export:web": "expo export --platform web"})
json.dump(p, open(f"{d}/package.json", "w"), indent=2)
a = {"expo": {
  "name": o["name"], "slug": o["slug"], "version": "1.0.0", "scheme": o["scheme"], "orientation": "portrait",
  "icon": "./assets/icon.png", "userInterfaceStyle": "automatic",
  "ios": {"supportsTablet": False, "bundleIdentifier": o["bundle"], "buildNumber": "1",
          "infoPlist": {"ITSAppUsesNonExemptEncryption": False, **o.get("infoPlist", {})}},
  "android": {"package": o["bundle"], "versionCode": 1,
              "adaptiveIcon": {"backgroundColor": o["color"], "foregroundImage": "./assets/android-icon-foreground.png",
                               "backgroundImage": "./assets/android-icon-background.png", "monochromeImage": "./assets/android-icon-monochrome.png"},
              "predictiveBackGestureEnabled": False, "permissions": o.get("permissions", []),
              **({"blockedPermissions": o["blockedPermissions"]} if "blockedPermissions" in o else {})},
  "web": {"favicon": "./assets/favicon.png", "bundler": "metro", "output": "single"},
  "plugins": ["expo-router", "expo-secure-store", "expo-web-browser", *o.get("plugins", [])],
  "experiments": {"typedRoutes": False},
  "extra": {"appId": o["appId"], "apiUrl": "https://YOUR-BACKEND.onrender.com",
            "privacyUrl": f"https://YOUR-GITHUB-USERNAME.github.io/idea-apps/privacy/{o['appId']}.html",
            "supportEmail": "YOUR-SUPPORT-EMAIL"}}}
json.dump(a, open(f"{d}/app.json", "w"), indent=2)
print("configured", d)
