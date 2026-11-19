"""
Renders the OutletOS marketing promo (1280x720, 30 fps, H.264 MP4) from real product screenshots.

    python -I marketing/make_promo.py          # writes marketing/OutletOS-Promo.mp4

Requires Pillow, numpy and imageio-ffmpeg (bundled ffmpeg binary).
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "OutletOS-Promo.mp4")
W, H, FPS = 1280, 720, 30
XFADE = 0.5

CRIMSON = (217, 45, 58)
ORANGE = (249, 115, 22)
WINE = (26, 11, 14)
CREAM = (247, 245, 244)
INK = (26, 18, 20)
MUTED = (107, 95, 98)

FONT_DIR = "C:/Windows/Fonts"
def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
BOLD = lambda s: font("segoeuib.ttf", s)
SEMI = lambda s: font("seguisb.ttf", s)
REG = lambda s: font("segoeui.ttf", s)

ease = lambda t: 1 - (1 - max(0.0, min(1.0, t))) ** 3          # easeOutCubic
clamp = lambda t: max(0.0, min(1.0, t))


# ---------- drawing helpers ----------
def gradient(w, h, c1, c2, angle=135):
    a = math.radians(angle)
    x = np.linspace(0, 1, w)[None, :] * math.cos(a)
    y = np.linspace(0, 1, h)[:, None] * math.sin(a)
    t = (x + y - min(0, math.cos(a)) - min(0, math.sin(a)))
    t = t / t.max()
    arr = (np.array(c1)[None, None, :] * (1 - t[..., None]) + np.array(c2)[None, None, :] * t[..., None]).astype(np.uint8)
    return Image.fromarray(arr, "RGB")

def radial_glow(w, h, cx, cy, r, color, strength=0.55):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 2 * strength * 255
    layer = np.zeros((h, w, 4), np.uint8)
    layer[..., :3] = color
    layer[..., 3] = a.astype(np.uint8)
    return Image.fromarray(layer, "RGBA")

def text_img(text, fnt, fill, max_w=None, spacing=6):
    """Render (optionally wrapped) text to a tight RGBA image."""
    lines = [text]
    if max_w:
        words, lines, cur = text.split(), [], ""
        for w_ in words:
            test = (cur + " " + w_).strip()
            if fnt.getlength(test) <= max_w or not cur:
                cur = test
            else:
                lines.append(cur); cur = w_
        lines.append(cur)
    asc, desc = fnt.getmetrics()
    lh = asc + desc
    width = int(max(fnt.getlength(l) for l in lines)) + 4
    img = Image.new("RGBA", (width, lh * len(lines) + spacing * (len(lines) - 1)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        d.text((0, i * (lh + spacing)), l, font=fnt, fill=fill)
    return img

def pill(text, fnt, fg, bg, pad=(16, 8)):
    t = text_img(text, fnt, fg)
    img = Image.new("RGBA", (t.width + pad[0] * 2, t.height + pad[1] * 2), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=img.height // 2, fill=bg)
    img.alpha_composite(t, (pad[0], pad[1] - 2))
    return img

def logo(size):
    g = gradient(size, size, CRIMSON, ORANGE).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.25), fill=255)
    g.putalpha(mask)
    d = ImageDraw.Draw(g)
    s = size / 64
    d.arc([20 * s, 22 * s, 44 * s, 46 * s], start=0, end=180, fill="white", width=max(2, int(5 * s)))
    d.ellipse([27 * s, 17 * s, 37 * s, 27 * s], fill="white")
    return g

def fade(img, k):
    if k >= 1: return img
    out = img.copy()
    a = out.getchannel("A").point(lambda v: int(v * max(0, k)))
    out.putalpha(a)
    return out

def put(base, el, x, y, k=1.0, dy=24):
    """Paste element with fade + slide-up entrance driven by k in [0,1]."""
    if k <= 0: return
    base.alpha_composite(fade(el, k), (int(x), int(y + (1 - ease(k)) * dy)))

def browser_frame(content_w, content_h, dark=False):
    """Window chrome + soft shadow, returns (frame RGBA, content offset)."""
    bar = 30
    fw, fh = content_w, content_h + bar
    pad = 40
    img = Image.new("RGBA", (fw + pad * 2, fh + pad * 2), (0, 0, 0, 0))
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 14, pad + fw, pad + fh + 14], radius=18, fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    shadow = Image.new("RGBA", img.size, (40, 10, 14, 0)); shadow.putalpha(sh)
    img.alpha_composite(shadow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([pad, pad, pad + fw, pad + fh], radius=16, fill=(30, 22, 25) if dark else (255, 255, 255))
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        d.ellipse([pad + 16 + i * 20, pad + 10, pad + 28 + i * 20, pad + 22], fill=c)
    d.rounded_rectangle([pad + fw // 2 - 130, pad + 7, pad + fw // 2 + 130, pad + 24], radius=8, fill=(45, 36, 40) if dark else (241, 238, 236))
    return img, (pad, pad + bar)

def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


# ---------- assets ----------
def load(name, blur_box=None):
    im = Image.open(os.path.join(SHOTS, name)).convert("RGB")
    if blur_box:  # hide secrets (e.g. API key) in marketing footage
        region = im.crop(blur_box).filter(ImageFilter.GaussianBlur(9))
        im.paste(region, blur_box)
    return im

SHOT = {n: load(n) for n in sorted(os.listdir(SHOTS)) if n.endswith(".jpg") and n != "14-integrations.jpg"}
SHOT["14-integrations.jpg"] = load("14-integrations.jpg", blur_box=(300, 280, 900, 320))
LOGO_BIG, LOGO_SM = logo(132), logo(40)

LIGHT_BG = Image.new("RGBA", (W, H), CREAM + (255,))
LIGHT_BG.alpha_composite(radial_glow(W, H, W * 0.85, H * 0.1, 700, CRIMSON, 0.16))
LIGHT_BG.alpha_composite(radial_glow(W, H, W * 0.1, H * 1.0, 600, ORANGE, 0.12))
DARK_BG = gradient(W, H, (40, 12, 18), (10, 5, 7), 120).convert("RGBA")
DARK_BG.alpha_composite(radial_glow(W, H, W * 0.8, H * 0.15, 650, CRIMSON, 0.35))
DARK_BG.alpha_composite(radial_glow(W, H, W * 0.15, H * 0.95, 520, ORANGE, 0.22))


# ---------- scenes ----------
def scene_intro(t, dur):
    f = DARK_BG.copy()
    for i in range(5):  # drifting bokeh
        cx = (W * (0.15 + 0.18 * i) + math.sin(t * 0.6 + i) * 40) % W
        cy = H * (0.3 + 0.12 * (i % 3)) + math.cos(t * 0.5 + i * 2) * 30
        f.alpha_composite(radial_glow(W, H, cx, cy, 120 + 30 * (i % 2), ORANGE if i % 2 else CRIMSON, 0.18))
    k = ease(t / 0.9)
    lg = LOGO_BIG.resize((int(132 * (0.6 + 0.4 * k)),) * 2, Image.LANCZOS)
    put(f, lg, W / 2 - lg.width / 2, 170 + (132 - lg.height) / 2, k, 0)
    put(f, TXT["brand"], W / 2 - TXT["brand"].width / 2, 320, clamp((t - 0.5) / 0.7))
    put(f, TXT["tag1"], W / 2 - TXT["tag1"].width / 2, 458, clamp((t - 1.1) / 0.7))
    put(f, TXT["tag2"], W / 2 - TXT["tag2"].width / 2, 525, clamp((t - 1.6) / 0.7))
    return f

def scene_problem(t, dur):
    f = DARK_BG.copy()
    y = 200
    for i, key in enumerate(["p1", "p2"]):
        put(f, TXT[key], W / 2 - TXT[key].width / 2, y + i * 90, clamp((t - 0.2 - i * 0.6) / 0.6))
    put(f, TXT["p3"], W / 2 - TXT["p3"].width / 2, 420, clamp((t - 1.5) / 0.6))
    return f

def feature_scene(spec):
    shot = SHOT[spec["shot"]]
    dark = spec.get("dark", False)
    left = spec.get("side", "left") == "left"     # text on the left, screenshot on the right
    cw = 760; ch = int(cw * shot.height / shot.width)
    frame, (ox, oy) = browser_frame(cw, ch, dark)
    mask = rounded_mask(cw, ch, 10)
    kick = text_img(spec["kicker"].upper(), SEMI(17), CRIMSON if not dark else (255, 140, 120))
    title = text_img(spec["title"], BOLD(46), INK if not dark else (255, 255, 255), max_w=410, spacing=0)
    body = text_img(spec["body"], REG(21), MUTED if not dark else (225, 210, 214), max_w=410, spacing=4)
    chips = [pill(c, SEMI(15), CRIMSON if not dark else (255, 255, 255), (253, 228, 230) if not dark else (90, 30, 38)) for c in spec["chips"]]
    fx, fy = spec.get("focus", (0.5, 0.5))
    zoom_to = spec.get("zoom", 1.18)

    def render(t, dur):
        f = (DARK_BG if dark else LIGHT_BG).copy()
        # Ken Burns crop that drifts toward the focus point
        z = 1 + (zoom_to - 1) * ease(t / dur * 0.95)
        cw_src, ch_src = shot.width / z, shot.height / z
        cx = shot.width / 2 + (fx * shot.width - shot.width / 2) * (z - 1) / (zoom_to - 1 + 1e-6)
        cy = shot.height / 2 + (fy * shot.height - shot.height / 2) * (z - 1) / (zoom_to - 1 + 1e-6)
        x0 = min(max(0, cx - cw_src / 2), shot.width - cw_src); y0 = min(max(0, cy - ch_src / 2), shot.height - ch_src)
        crop = shot.crop((int(x0), int(y0), int(x0 + cw_src), int(y0 + ch_src))).resize((cw, ch), Image.BILINEAR).convert("RGBA")
        win = frame.copy(); crop.putalpha(mask); win.alpha_composite(crop, (ox, oy))
        wx = W - win.width + 18 if left else -22
        put(f, win, wx, (H - win.height) / 2 + 10, clamp(t / 0.7), 50)
        tx = 70 if left else W - 70 - 410
        put(f, kick, tx, 190, clamp((t - 0.15) / 0.5))
        put(f, title, tx, 222, clamp((t - 0.3) / 0.55))
        by = 222 + title.height + 18
        put(f, body, tx, by, clamp((t - 0.5) / 0.55))
        cx2, cy2 = tx, by + body.height + 26
        for i, c in enumerate(chips):
            if cx2 + c.width > tx + 430: cx2, cy2 = tx, cy2 + c.height + 10
            put(f, c, cx2, cy2, clamp((t - 0.75 - i * 0.12) / 0.4), 12)
            cx2 += c.width + 10
        return f
    return render

def scene_roles(t, dur):
    f = LIGHT_BG.copy()
    put(f, TXT["roles_k"], 70, 70, clamp(t / 0.5))
    put(f, TXT["roles_t"], 70, 100, clamp((t - 0.15) / 0.5))
    for i, (name, cap) in enumerate([("13-access.jpg", "Owner: every branch, every permission"), ("17-cook.jpg", "Line Cook: only the Grill station")]):
        shot = SHOT[name]
        cw = 545; ch = int(cw * shot.height / shot.width)
        frame, (ox, oy) = browser_frame(cw, ch)
        z = 1 + 0.08 * ease(t / dur)
        crop = shot.crop((0, 0, int(shot.width / z), int(shot.height / z))).resize((cw, ch), Image.BILINEAR).convert("RGBA")
        crop.putalpha(rounded_mask(cw, ch, 10)); frame.alpha_composite(crop, (ox, oy))
        x = 30 + i * 610
        put(f, frame, x, 185, clamp((t - 0.3 - i * 0.35) / 0.6), 40)
        c = pill(cap, SEMI(16), (255, 255, 255), CRIMSON if i == 0 else (245, 179, 0))
        put(f, c, x + 40 + cw / 2 - c.width / 2, 185 + frame.height - 40, clamp((t - 0.9 - i * 0.35) / 0.4), 10)
    return f

def scene_stats(t, dur):
    f = DARK_BG.copy()
    put(f, TXT["stats_t"], W / 2 - TXT["stats_t"].width / 2, 120, clamp(t / 0.5))
    items = [("9", "modules"), ("8", "team roles"), ("6", "themes"), ("1", "screen")]
    for i, (n, l) in enumerate(items):
        k = clamp((t - 0.3 - i * 0.2) / 0.5)
        x = 140 + i * 260
        num = text_img(n, BOLD(96), (255, 255, 255)); lab = text_img(l, SEMI(22), (240, 190, 195))
        put(f, num, x + 60 - num.width / 2, 260, k, 30)
        put(f, lab, x + 60 - lab.width / 2, 390, k, 30)
    put(f, TXT["stats_s"], W / 2 - TXT["stats_s"].width / 2, 500, clamp((t - 1.3) / 0.6))
    return f

def scene_outro(t, dur):
    bg = SHOT["16-login.jpg"].resize((int(H * 1280 / 665), H)).filter(ImageFilter.GaussianBlur(14)).convert("RGBA")
    f = Image.new("RGBA", (W, H), WINE + (255,)); f.alpha_composite(bg, ((W - bg.width) // 2, 0))
    f.alpha_composite(Image.new("RGBA", (W, H), (20, 6, 9, 200)))
    f.alpha_composite(radial_glow(W, H, W / 2, H / 2, 520, CRIMSON, 0.35))
    k = ease(t / 0.8)
    put(f, LOGO_BIG, W / 2 - 66, 120, k, 20)
    put(f, TXT["brand"], W / 2 - TXT["brand"].width / 2, 270, clamp((t - 0.3) / 0.6))
    put(f, TXT["out1"], W / 2 - TXT["out1"].width / 2, 392, clamp((t - 0.7) / 0.6))
    cta = pill("Book a live demo  →", BOLD(24), (255, 255, 255), CRIMSON, pad=(30, 14))
    put(f, cta, W / 2 - cta.width / 2, 470, clamp((t - 1.2) / 0.5), 14)
    put(f, TXT["out2"], W / 2 - TXT["out2"].width / 2, 570, clamp((t - 1.6) / 0.6))
    return f


TXT = {
    "brand": text_img("OutletOS", BOLD(84), (255, 255, 255)),
    "tag1": text_img("Every branch. One screen.", BOLD(44), (255, 255, 255)),
    "tag2": text_img("The operating system for multi-location restaurants", REG(24), (240, 200, 205)),
    "p1": text_img("Too many apps.", BOLD(64), (255, 255, 255)),
    "p2": text_img("Too little visibility.", BOLD(64), (255, 120, 110)),
    "p3": text_img("POS, CCTV, rotas, fridge logs and reviews, all in different places.", REG(24), (235, 205, 210)),
    "roles_k": text_img("ACCESS CONTROL", SEMI(17), CRIMSON),
    "roles_t": text_img("Everyone sees exactly what they need. Nothing more.", BOLD(38), INK),
    "stats_t": text_img("Built for the whole team", BOLD(44), (255, 255, 255)),
    "stats_s": text_img("Owners · Area managers · Branch managers · Chefs · Hosts · Auditors", REG(22), (235, 205, 210)),
    "out1": text_img("Run every restaurant like your best one.", BOLD(38), (255, 255, 255)),
    "out2": text_img("Sales · Kitchen · Vision AI · Guests · Workforce · Food safety · Access control", REG(19), (230, 195, 200)),
}

FEATURES = [
    dict(shot="01-dashboard.jpg", kicker="Command center", title="Your whole group, live", body="Net sales, branch score and six health signals update in real time across every location.", chips=["Today vs yesterday", "Prime cost", "Branch score"], focus=(0.55, 0.45)),
    dict(shot="02-sales-mix.jpg", kicker="Sales intelligence", title="Online vs in-store, at a glance", body="Every channel and delivery app side by side, plus the dishes that drive revenue.", chips=["Uber Eats", "Swiggy", "Zomato", "Top dishes"], side="right", focus=(0.6, 0.45)),
    dict(shot="03-week-heatmap.jpg", kicker="Demand patterns", title="Know your rush hours", body="Seven-day trends and an hourly heatmap tell you when to staff up and prep ahead.", chips=["7-day trend", "Busiest hours"], focus=(0.72, 0.4)),
    dict(shot="04-branches.jpg", kicker="Multi-location", title="Every branch, ranked", body="Spot the outlet that needs you before customers do. One tap focuses the whole app on it.", chips=["Live sparklines", "Score rings"], side="right", focus=(0.5, 0.45)),
    dict(shot="06-kitchen.jpg", kicker="Kitchen operations", title="Speed of service, station by station", body="Live tickets from dine-in, takeaway and delivery with timers against each dish's target.", chips=["Live tickets", "On-time %", "Slowest dishes"], focus=(0.55, 0.62)),
    dict(shot="08-vision-midnight.jpg", kicker="Vision intelligence", title="AI on the CCTV you already have", body="Hygiene, gloves, hand-washing, station coverage and greeting times, processed on-premise.", chips=["Hygiene & PPE", "Hand-wash", "Privacy-first"], side="right", dark=True, focus=(0.42, 0.45)),
    dict(shot="09-guests.jpg", kicker="Guest intelligence", title="Recognise regulars the moment they arrive", body="Opt-in Face ID, loyalty QR or phone, then smart suggestions from their order history.", chips=["Usual order", "Allergy alerts", "Win-back offers"], focus=(0.45, 0.55)),
    dict(shot="05-staffing.jpg", kicker="Workforce", title="Staffing that matches demand", body="Transactions per labour hour, sales per labour hour and hour-by-hour over/under staffing.", chips=["TPPH", "Sales / labour hr", "Rota gaps"], side="right", focus=(0.6, 0.5)),
    dict(shot="11-safety.jpg", kicker="Food safety & HACCP", title="A cold chain that logs itself", body="Every fridge and freezer reports each minute. Excursions are captured automatically.", chips=["Auto HACCP log", "Live sensors"], focus=(0.5, 0.55)),
    dict(shot="12-alerts.jpg", kicker="Alerts & incidents", title="Only what needs a decision", body="Repeated problems escalate to the right role; one-off blips are filtered out.", chips=["Smart escalation", "One-tap resolve"], side="right", focus=(0.5, 0.5)),
    dict(shot="14-integrations.jpg", kicker="Integrations", title="Plugs into everything you run", body="Any POS, delivery platform, attendance device, camera or sensor via REST, webhooks or CSV.", chips=["No-code mapping", "Open API"], focus=(0.45, 0.5)),
    dict(shot="15-themes.jpg", kicker="Make it yours", title="Light, Dark or Midnight", body="Six brand palettes and three modes, remembered for every user.", chips=["6 palettes", "3 modes"], side="right", dark=True, focus=(0.72, 0.3), zoom=1.25),
]

# ---------- voice-over script (one line per scene; "|" = short pause) ----------
NARRATION = [
    "Meet OutletOS. | Every branch. One screen. | The operating system for multi-location restaurants.",
    "Running restaurants today means too many apps, | and too little visibility.",
    "Start with the command center. | Live sales, branch scores, and six health signals, updating in real time across every location.",
    "See online versus in-store sales, every delivery app side by side, | and the dishes that really drive revenue.",
    "Seven-day trends and an hourly heat map show exactly when your rush hits, | so you can staff up, and prep ahead.",
    "Every branch is ranked and scored, | so you spot the outlet that needs you, before your customers do.",
    "In the kitchen, live tickets from dine-in, takeaway, and delivery are timed against every dish's target.",
    "Vision intelligence turns the cameras you already have into an assistant for hygiene, gloves, hand washing, and greeting times, | all processed on site.",
    "Guest intelligence recognises your regulars the moment they arrive, | and tells your team their usual order, their allergies, and what to suggest next.",
    "Workforce analytics track transactions per labour hour, | and show every hour you are over, or under staffed.",
    "Your cold chain logs itself. | Every fridge and freezer reports each minute, and every excursion is captured automatically.",
    "Smart alerts escalate only what needs a decision, | to the right person.",
    "And it plugs into everything you run. | Any point of sale, delivery platform, camera, or sensor.",
    "Make it yours, | with light, dark, and midnight modes, and six brand palettes.",
    "With role and branch level access, | owners see everything, | while a line cook sees only their own station.",
    "Built for the whole team, | from owners, to chefs.",
    "OutletOS. | Run every restaurant like your best one. | Book a live demo today.",
]
SCENES = [scene_intro, scene_problem] + [feature_scene(s) for s in FEATURES] + [scene_roles, scene_stats, scene_outro]
MIN_DUR = [4.0, 3.6] + [4.6] * len(FEATURES) + [4.8, 4.0, 5.5]
VO_LEAD = 0.45          # narration starts this long after a scene begins
AUDIO_SR = 24000
VO_DIR = os.path.join(HERE, "build", "vo")


def synth_voice():
    import json, wave
    os.makedirs(VO_DIR, exist_ok=True)
    js = os.path.join(HERE, "build", "lines.json")
    with open(js, "w", encoding="utf-8") as fh:
        json.dump([{"id": f"{i:02d}", "text": t} for i, t in enumerate(NARRATION)], fh)
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", os.path.join(HERE, "tts.ps1"), js, VO_DIR], check=True, capture_output=True)
    clips = []
    for i in range(len(NARRATION)):
        with wave.open(os.path.join(VO_DIR, f"{i:02d}.wav")) as w:
            a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        clips.append(polish_voice(a))
    return clips


def polish_voice(a):
    """Trim silence, high-pass (remove rumble), gentle compression, normalise."""
    nz = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, nz[0] - 200): nz[-1] + 1200] if len(nz) else a
    k = 64
    a = a - np.convolve(a, np.ones(k) / k, mode="same")        # simple high-pass
    a = np.tanh(a / (np.max(np.abs(a)) + 1e-9) * 1.8) / np.tanh(1.8)  # soft compression
    return a * 0.89


def music_bed(seconds):
    """Warm ambient pad + soft plucked arpeggio, generated procedurally (royalty-free)."""
    sr = AUDIO_SR
    n = int(seconds * sr)
    t = np.arange(n) / sr
    out = np.zeros(n, np.float32)
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]  # Am7, Fmaj7, Cmaj7, Gmaj7
    bar = 4.0
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    for b in range(int(seconds / bar) + 1):
        ch = chords[b % 4]
        s0, s1 = int(b * bar * sr), min(n, int((b + 1) * bar * sr + sr))
        if s0 >= n: break
        tt = t[s0:s1] - b * bar
        env = np.clip(tt / 1.2, 0, 1) * np.clip((bar + 1 - tt) / 1.2, 0, 1)
        for m in ch:
            f = hz(m)
            out[s0:s1] += env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt + 0.5)) * 0.045
        for k, m in enumerate(ch * 2):   # eighth-note arpeggio, one octave up
            st = s0 + int(k * bar / 8 * sr)
            if st >= n: break
            ln = min(int(0.6 * sr), n - st)
            tp = np.arange(ln) / sr
            out[st:st + ln] += np.sin(2 * np.pi * hz(m + 12) * tp) * np.exp(-tp * 6) * 0.05
    out += np.convolve(out, np.exp(-np.arange(int(0.25 * sr)) / (0.06 * sr)), mode="full")[:n] * 0.012  # cheap room reverb
    out *= np.clip(t / 2.0, 0, 1) * np.clip((seconds - t) / 3.0, 0, 1)        # fade in/out
    return out / (np.max(np.abs(out)) + 1e-9) * 0.5


def build_audio(clips, starts, total, path):
    import wave
    sr = AUDIO_SR
    n = int(total * sr)
    voice = np.zeros(n, np.float32)
    for c, s in zip(clips, starts):
        i = int((s + VO_LEAD) * sr)
        voice[i:i + len(c)] += c[: max(0, n - i)]
    music = music_bed(total)
    env = np.convolve((np.abs(voice) > 0.02).astype(np.float32), np.ones(int(0.4 * sr)) / (0.4 * sr), mode="same")
    duck = 1 - 0.7 * np.clip(env * 4, 0, 1)                    # duck music under the voice
    mix = voice * 0.95 + music * 0.32 * duck
    mix = np.clip(mix / max(1.0, np.max(np.abs(mix)) / 0.97), -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())


def main():
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    print("synthesising voice-over…", flush=True)
    clips = synth_voice()
    durs = [max(m, VO_LEAD + len(c) / AUDIO_SR + 0.9) for m, c in zip(MIN_DUR, clips)]
    global TIMELINE
    TIMELINE = list(zip(SCENES, durs))
    total = sum(d for _, d in TIMELINE) - XFADE * (len(TIMELINE) - 1)
    n = int(total * FPS)
    starts, acc = [], 0.0
    for _, d in TIMELINE:
        starts.append(acc); acc += d - XFADE
    audio = os.path.join(HERE, "build", "audio.wav")
    build_audio(clips, starts, total, audio)
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                             "-i", audio, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                             "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    for i in range(n):
        T = i / FPS
        active = [(j, T - starts[j]) for j, (_, d) in enumerate(TIMELINE) if 0 <= T - starts[j] < d]
        j, lt = active[0]
        frame = TIMELINE[j][0](lt, TIMELINE[j][1])
        if len(active) > 1:   # crossfade into the next scene
            j2, lt2 = active[1]
            frame = Image.blend(frame, TIMELINE[j2][0](lt2, TIMELINE[j2][1]), ease(lt2 / XFADE))
        frame = frame.convert("RGB")
        d = ImageDraw.Draw(frame)   # progress bar
        d.rectangle([0, H - 4, int(W * T / total), H], fill=CRIMSON)
        proc.stdin.write(frame.tobytes())
        if i % (FPS * 5) == 0:
            print(f"  {T:5.1f}s / {total:.1f}s", flush=True)
    proc.stdin.close(); proc.wait()
    print(f"wrote {OUT} ({total:.1f}s, {os.path.getsize(OUT) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
