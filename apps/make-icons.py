"""Generates distinct placeholder store icons for each app (replace with designed icons when you have them)."""
from PIL import Image, ImageDraw, ImageFont
import sys
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
APPS = {"circles": ("#3B4CCA", "A1"), "wasl": ("#0F6B4F", "W"), "vouch": ("#C2410C", "V"),
        "sidedesk": ("#6D28D9", "SD"), "familyshield": ("#B3261E", "FS")}
def glyph(size, text, fill, scale):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fs = int(size * scale / max(1, len(text) * 0.62)); fs = min(fs, int(size * scale))
    f = ImageFont.truetype(F, fs); b = d.textbbox((0, 0), text, font=f)
    d.text(((size - (b[2] - b[0])) / 2 - b[0], (size - (b[3] - b[1])) / 2 - b[1]), text, font=f, fill=fill)
    return im
for app, (color, text) in APPS.items():
    a = f"{app}/assets/"
    bg = Image.new("RGBA", (1024, 1024), color)
    # a soft ring so it reads as more than a letter
    ImageDraw.Draw(bg).ellipse((112, 112, 912, 912), outline=(255, 255, 255, 70), width=36)
    Image.alpha_composite(bg, glyph(1024, text, "white", 0.5)).convert("RGB").save(a + "icon.png")
    Image.new("RGBA", (1024, 1024), color).save(a + "android-icon-background.png")
    glyph(1024, text, "white", 0.36).save(a + "android-icon-foreground.png")
    glyph(1024, text, "black", 0.36).save(a + "android-icon-monochrome.png")
    glyph(1024, text, color, 0.5).save(a + "splash-icon.png")
    Image.alpha_composite(bg, glyph(1024, text, "white", 0.5)).resize((48, 48)).save(a + "favicon.png")
print("ok")
