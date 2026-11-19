"""
OCR on the edge, run only when triggered (never on every frame):

  * Use-by labels in the cold store: PaddleOCR PP-OCRv5 mobile (Apache-2.0, small and accurate on printed labels).
    Triggered when the PPE/object model sees a 'label' in the storage zone. Emits a 'label' vision event.
  * Fridge / oven / hot-hold displays (7-segment): ssocr (GPL tool, run as a separate process) on a fixed crop,
    with PaddleOCR as a fallback. Lets a camera stand in for a temperature sensor on legacy equipment.
    Emits a reading to POST /api/v1/readings with source 'ocr'.
  * Delivery bags / KOT tickets / number plates are the same pattern: fast-alpr + fast-plate-ocr (MIT, ONNX) for plates.

Everything here is optional: the agent runs without these packages and simply skips OCR.
"""
import datetime as dt
import re
import shutil
import subprocess
import tempfile

_paddle = None


def paddle():
    global _paddle
    if _paddle is None:
        try:
            from paddleocr import PaddleOCR
            _paddle = PaddleOCR(use_textline_orientation=False, lang="en")
        except Exception as e:  # not installed / no model: OCR disabled
            print(f"[ocr] PaddleOCR unavailable ({e}); label OCR disabled")
            _paddle = False
    return _paddle or None


DATE = re.compile(r"(?:USE\s*BY|BEST\s*BEFORE|EXP(?:IRY)?|UB)[:\s]*([0-3]?\d)[./-]([01]?\d)(?:[./-](\d{2,4}))?", re.I)


def parse_use_by(text, today=None):
    """'USE BY 17/11' -> (date, expired?)"""
    today = today or dt.date.today()
    m = DATE.search(text or "")
    if not m:
        return None, None
    d, mth, y = int(m.group(1)), int(m.group(2)), m.group(3)
    year = (2000 + int(y)) if y and len(y) == 2 else int(y) if y else today.year
    try:
        when = dt.date(year, mth, d)
    except ValueError:
        return None, None
    return when, when < today


def read_label(crop):
    ocr = paddle()
    if not ocr:
        return None
    result = ocr.predict(crop)
    text = " ".join(t for page in result for t in page.get("rec_texts", []))
    when, expired = parse_use_by(text)
    return {"text": text[:120], "use_by": when.isoformat() if when else None, "expired": bool(expired) if when else True}


def read_display(crop, digits=3):
    """7-segment display -> float, via ssocr when installed, else PaddleOCR."""
    import cv2
    if shutil.which("ssocr"):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            cv2.imwrite(f.name, crop)
            out = subprocess.run(["ssocr", "-d", str(digits), "-T", f.name], capture_output=True, text=True, timeout=5).stdout
    else:
        ocr = paddle()
        out = " ".join(t for page in (ocr.predict(crop) if ocr else []) for t in page.get("rec_texts", []))
    m = re.search(r"-?\d+(?:[.,]\d)?", out or "")
    return float(m.group(0).replace(",", ".")) if m else None
