"""
extract_pdf_styles.py
Renders each PDF page as a high-res image, then runs OCR with pytesseract
to extract text blocks with bounding boxes. Also samples colors at each
text position from the rendered image.

Usage:
    pip install pymupdf pytesseract Pillow
    brew install tesseract   # macOS
    python3 extract_pdf_styles.py "/Users/ashir/Downloads/Muhammad Waqar Resume.pdf"
"""

import sys
import json
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import io


SCALE = 3  # render at 3× for better OCR accuracy


def sample_color(img, x, y, w=4, h=4):
    """Sample dominant color in a small region around (x, y)."""
    region = img.crop((max(0, x - w), max(0, y - h), x + w, y + h))
    pixels = list(region.getdata())
    # filter near-white (background)
    fg = [p for p in pixels if not (p[0] > 240 and p[1] > 240 and p[2] > 240)]
    if not fg:
        return "#000000"
    avg = tuple(sum(c[i] for c in fg) // len(fg) for i in range(3))
    return "#{:02x}{:02x}{:02x}".format(*avg)


def extract(pdf_path: str):
    doc = fitz.open(pdf_path)
    page = doc[0]

    # Render page to image
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    img_w, img_h = img.size

    # page size in pixels at 96dpi
    PT_TO_PX = 96 / 72
    page_w_px = round(page.rect.width * PT_TO_PX)
    page_h_px = round(page.rect.height * PT_TO_PX)

    # OCR with bounding boxes
    ocr_data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT, lang="eng")

    spans = []
    n = len(ocr_data["text"])
    for i in range(n):
        text = ocr_data["text"][i].strip()
        if not text or int(ocr_data["conf"][i]) < 30:
            continue

        # coords are in rendered (SCALE×) image space; convert to 96dpi px
        sx = ocr_data["left"][i]
        sy = ocr_data["top"][i]
        sw = ocr_data["width"][i]
        sh = ocr_data["height"][i]

        # estimate font size from bounding box height
        font_size_px = round(sh / SCALE * 0.85)  # ~85% of line height

        # sample text color near center of bounding box
        cx = sx + sw // 2
        cy = sy + sh // 2
        color = sample_color(img, cx, cy)

        # scale back to 96dpi page coordinates
        x_px = round(sx / SCALE)
        y_px = round(sy / SCALE)

        spans.append({
            "text": text,
            "x_px": x_px,
            "y_px": y_px,
            "w_px": round(sw / SCALE),
            "h_px": round(sh / SCALE),
            "font_size_est_px": font_size_px,
            "color": color,
        })

    # save annotated image for visual inspection
    img_out = pdf_path.replace(".pdf", "_render.png")
    # downscale back to 1× for saving
    img_1x = img.resize((img_w // SCALE, img_h // SCALE), Image.LANCZOS)
    img_1x.save(img_out)

    return {
        "page": {"width_px": page_w_px, "height_px": page_h_px},
        "render_image": img_out,
        "spans": spans,
    }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/Users/ashir/Downloads/Muhammad Waqar Resume.pdf"
    print(f"Processing: {path}")
    data = extract(path)

    print(f"\n=== PAGE SIZE: {data['page']['width_px']}px × {data['page']['height_px']}px ===")
    print(f"Render saved to: {data['render_image']}")
    print(f"\n=== {len(data['spans'])} TEXT SPANS ===")
    for s in data["spans"]:
        print(f"  [{s['color']} ~{s['font_size_est_px']}px] ({s['x_px']},{s['y_px']})  \"{s['text']}\"")

    out_path = path.replace(".pdf", "_extracted.json")
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n=== JSON saved to: {out_path} ===")
