from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1280
HEIGHT = 720
FRAMES = 84
FPS = 24
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "public" / "previews"


def clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    return 3 * t * t - 2 * t * t * t


def lerp(a, b, t):
    return a + (b - a) * t


def path_point(t):
    anchors = [
        (640, 520),
        (640, 440),
        (640, 330),
        (760, 330),
        (760, 190),
    ]
    segments = len(anchors) - 1
    scaled = clamp(t) * segments
    index = min(int(scaled), segments - 1)
    local_t = scaled - index
    x0, y0 = anchors[index]
    x1, y1 = anchors[index + 1]
    return lerp(x0, x1, local_t), lerp(y0, y1, local_t)


def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_SMALL = load_font(24)
FONT_MED = load_font(34, bold=True)
FONT_BIG = load_font(72, bold=True)


def draw_gradient(draw, top_color, bottom_color):
    for y in range(HEIGHT):
        mix = y / HEIGHT
        r = int(lerp(top_color[0], bottom_color[0], mix))
        g = int(lerp(top_color[1], bottom_color[1], mix))
        b = int(lerp(top_color[2], bottom_color[2], mix))
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))


def draw_hidden_badge(base):
    badge = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
    badge_draw = ImageDraw.Draw(badge)
    center = 110
    badge_draw.ellipse((20, 20, 200, 200), outline=(210, 210, 220, 70), width=5)
    badge_draw.ellipse((45, 45, 175, 175), fill=(18, 18, 20, 75))
    quad_colors = [
        (200, 220, 255, 90),
        (245, 245, 250, 85),
        (245, 245, 250, 85),
        (200, 220, 255, 90),
    ]
    boxes = [
        (67, 67, center, center),
        (center, 67, 153, center),
        (67, center, center, 153),
        (center, center, 153, 153),
    ]
    for color, box in zip(quad_colors, boxes):
        badge_draw.rectangle(box, fill=color)
    badge = badge.filter(ImageFilter.GaussianBlur(0.6))
    base.alpha_composite(badge, (945, 108))


def draw_console(base, draw):
    draw.rounded_rectangle((190, 70, 1090, 650), radius=52, fill=(18, 14, 12))
    draw.rounded_rectangle((215, 95, 1065, 625), radius=42, outline=(85, 69, 56), width=2)
    draw.rounded_rectangle((330, 120, 950, 600), radius=46, fill=(30, 24, 21))
    draw.rounded_rectangle((390, 170, 890, 560), radius=30, fill=(12, 12, 15))

    for x in range(430, 851, 70):
        draw.line((x, 210, x, 525), fill=(45, 45, 48), width=1)
    for y in range(215, 526, 62):
        draw.line((425, y, 855, y), fill=(45, 45, 48), width=1)

    gate = [(640, 520), (640, 330), (760, 330), (760, 190)]
    for index in range(len(gate) - 1):
        draw.line((gate[index], gate[index + 1]), fill=(209, 145, 70, 180), width=10)

    positions = {
        "R": (530, 215),
        "1": (640, 215),
        "3": (760, 215),
        "2": (640, 340),
        "4": (760, 340),
        "LAST": (760, 110),
    }
    for label, (x, y) in positions.items():
        font = FONT_SMALL if label != "LAST" else FONT_MED
        fill = (220, 220, 225, 180) if label != "LAST" else (217, 145, 70, 230)
        bbox = draw.textbbox((0, 0), label, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text((x - w / 2, y - h / 2), label, font=font, fill=fill)


def draw_shifter(base, progress):
    px, py = path_point(progress)
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((px - 85, py - 85, px + 85, py + 85), fill=(217, 145, 70, 58))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    base.alpha_composite(glow)

    knob = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    knob_draw = ImageDraw.Draw(knob)
    knob_draw.rounded_rectangle((px - 24, py - 95, px + 24, py + 16), radius=22, fill=(190, 192, 198))
    knob_draw.ellipse((px - 48, py - 142, px + 48, py - 52), fill=(228, 230, 235))
    knob_draw.ellipse((px - 36, py - 130, px + 36, py - 64), outline=(110, 110, 115), width=3)
    knob = knob.filter(ImageFilter.GaussianBlur(0.2))
    base.alpha_composite(knob)


def draw_hand(base, progress):
    palm_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(palm_layer)

    px, py = path_point(progress)
    intro = clamp((progress - 0.08) / 0.25)
    grip = clamp((progress - 0.2) / 0.18)
    wrist_x = lerp(980, px + 65, ease_out_cubic(intro))
    wrist_y = lerp(620, py + 120, ease_out_cubic(intro))

    skin = (219, 173, 138, 255)
    skin_shadow = (177, 129, 98, 255)

    draw.polygon(
        [
            (wrist_x - 54, wrist_y + 28),
            (wrist_x + 12, wrist_y - 12),
            (px + 45, py - 22),
            (px + 18, py + 35),
            (wrist_x - 30, wrist_y + 58),
        ],
        fill=skin_shadow,
    )
    draw.ellipse((wrist_x - 62, wrist_y - 12, wrist_x + 42, wrist_y + 74), fill=skin)

    finger_bases = [
        (wrist_x - 8, wrist_y + 10),
        (wrist_x + 18, wrist_y - 8),
        (wrist_x + 43, wrist_y - 18),
        (wrist_x + 66, wrist_y - 14),
    ]
    for idx, (fx, fy) in enumerate(finger_bases):
        finger_tip_x = lerp(fx + 38, px + 10 - idx * 4, grip)
        finger_tip_y = lerp(fy - 62, py - 96 + idx * 7, grip)
        width = 18 - idx * 2
        draw.line((fx, fy, finger_tip_x, finger_tip_y), fill=skin, width=width)
        draw.ellipse((finger_tip_x - width / 1.5, finger_tip_y - width / 1.5, finger_tip_x + width / 1.5, finger_tip_y + width / 1.5), fill=skin)

    thumb_base = (wrist_x - 18, wrist_y + 25)
    thumb_tip_x = lerp(thumb_base[0] - 45, px + 55, grip)
    thumb_tip_y = lerp(thumb_base[1] - 40, py - 32, grip)
    draw.line((thumb_base[0], thumb_base[1], thumb_tip_x, thumb_tip_y), fill=skin, width=18)
    draw.ellipse((thumb_tip_x - 10, thumb_tip_y - 10, thumb_tip_x + 10, thumb_tip_y + 10), fill=skin)

    palm_layer = palm_layer.filter(ImageFilter.GaussianBlur(0.45))
    base.alpha_composite(palm_layer)


def draw_text(draw, progress):
    phase = clamp((progress - 0.68) / 0.32)
    alpha = int(255 * ease_in_out(phase))
    glow_alpha = int(180 * ease_in_out(phase))
    draw.text((140, 110), "SCROLL TO SHIFT", font=FONT_SMALL, fill=(240, 240, 245, 110))
    draw.text((140, 155), "INTO THE", font=FONT_MED, fill=(240, 240, 245, 185))
    draw.text((140, 210), "LAST GEAR", font=FONT_BIG, fill=(217, 145, 70, alpha))
    draw.text((140, 296), "A cinematic scroll moment for the landing page", font=FONT_SMALL, fill=(235, 235, 238, 145))
    if phase > 0:
        draw.rounded_rectangle((128, 198, 490, 305), radius=28, outline=(217, 145, 70, glow_alpha), width=2)


def create_frame(index):
    t = index / (FRAMES - 1)
    progress = ease_in_out(t)

    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 255))
    draw = ImageDraw.Draw(image)
    draw_gradient(draw, (8, 8, 10), (20, 13, 10))
    draw_hidden_badge(image)
    draw_console(image, draw)

    accent = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    pulse = 0.5 + 0.5 * sin(t * 4 * pi)
    accent_draw.ellipse((190, 90, 1180, 760), fill=(217, 145, 70, int(18 + 18 * pulse)))
    accent = accent.filter(ImageFilter.GaussianBlur(65))
    image.alpha_composite(accent)

    draw_console(image, ImageDraw.Draw(image))
    draw_shifter(image, progress)
    draw_hand(image, progress)
    draw_text(ImageDraw.Draw(image), progress)

    return image.convert("P", palette=Image.ADAPTIVE)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = [create_frame(index) for index in range(FRAMES)]
    gif_path = OUTPUT_DIR / "last-gear-shift-preview.gif"
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        duration=int(1000 / FPS),
        loop=0,
        disposal=2,
    )
    print(gif_path)


if __name__ == "__main__":
    main()
