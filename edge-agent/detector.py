"""
Detection backends for the edge agent. Every backend returns the same thing:
    [ (class_name, confidence, (x1, y1, x2, y2) in pixels), ... ]

Recommended (commercially safe, Apache-2.0): export RF-DETR-Nano / D-FINE-N / DEIM-N (or YOLOX-Nano) to ONNX and
run it with ONNX Runtime, which picks the best execution provider on the box:
    TensorRT / CUDA (Jetson, NVIDIA)  ->  OpenVINO (Intel N100 iGPU/NPU)  ->  CPU
Hailo-8/8L (Raspberry Pi AI HAT+) needs the model compiled to .hef with Hailo's Dataflow Compiler; plug it in as
another backend with the same return shape.

Ultralytics YOLO is supported for development only: it is AGPL-3.0, so shipping it inside a closed product needs
an Ultralytics Enterprise licence.
"""
import numpy as np

COCO = ["person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light", "fire hydrant", "stop sign",
        "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
        "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
        "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
        "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv",
        "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
        "scissors", "teddy bear", "hair drier", "toothbrush"]


def _nms(boxes, scores, iou=0.5):
    order, keep = scores.argsort()[::-1], []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0]); yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2]); yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        area = lambda b: (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
        ious = inter / (area(boxes[i:i + 1]) + area(boxes[order[1:]]) - inter + 1e-9)
        order = order[1:][ious < iou]
    return keep


class OnnxDetector:
    """Handles the three common ONNX output layouts: YOLO raw [1, 4+nc, N], end-to-end [1, N, 6] (YOLO26/v10 NMS-free),
    and DETR-style (RF-DETR, D-FINE, DEIM): boxes [1, N, 4] (cx, cy, w, h normalised) + logits [1, N, nc]."""

    def __init__(self, path, classes=None, size=640, conf=0.45):
        import onnxruntime as ort
        prefer = ["TensorrtExecutionProvider", "CUDAExecutionProvider", "OpenVINOExecutionProvider", "CPUExecutionProvider"]
        providers = [p for p in prefer if p in ort.get_available_providers()]
        self.sess = ort.InferenceSession(path, providers=providers)
        self.inp = self.sess.get_inputs()[0].name
        self.size, self.conf, self.classes = size, conf, classes or COCO
        self.provider = self.sess.get_providers()[0]

    def __call__(self, frame):
        import cv2
        h, w = frame.shape[:2]
        s = self.size / max(h, w)
        img = cv2.resize(frame, (int(w * s), int(h * s)))
        pad = np.full((self.size, self.size, 3), 114, np.uint8)
        pad[: img.shape[0], : img.shape[1]] = img
        x = pad[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255.0
        outs = self.sess.run(None, {self.inp: x})
        if len(outs) >= 2 and outs[0].ndim == 3 and outs[0].shape[-1] == 4:                 # DETR-style
            boxes, logits = outs[0][0], outs[1][0]
            probs = 1 / (1 + np.exp(-logits))
            cls, sc = probs.argmax(1), probs.max(1)
            cx, cy, bw, bh = (boxes * self.size).T
            xyxy = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
        elif outs[0].ndim == 3 and outs[0].shape[-1] == 6:                                       # end-to-end
            o = outs[0][0]
            xyxy, sc, cls = o[:, :4], o[:, 4], o[:, 5].astype(int)
        else:                                                                                     # YOLO raw
            o = outs[0][0].T
            cls, sc = o[:, 4:].argmax(1), o[:, 4:].max(1)
            cx, cy, bw, bh = o[:, :4].T
            xyxy = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
            m = sc >= self.conf
            keep = _nms(xyxy[m], sc[m]) if m.any() else []
            xyxy, sc, cls = xyxy[m][keep], sc[m][keep], cls[m][keep]
        m = sc >= self.conf
        return [(self.classes[int(c)] if int(c) < len(self.classes) else str(int(c)), float(p), tuple((b / s).tolist()))
                for b, p, c in zip(xyxy[m], sc[m], cls[m])]


class UltralyticsDetector:
    """Development convenience only (AGPL-3.0)."""

    def __init__(self, path, conf=0.45):
        from ultralytics import YOLO
        self.model, self.conf, self.provider = YOLO(path), conf, "ultralytics"

    def __call__(self, frame):
        r = self.model(frame, conf=self.conf, verbose=False)[0]
        return [(r.names[int(c)], float(p), tuple(b.tolist())) for c, p, b in zip(r.boxes.cls, r.boxes.conf, r.boxes.xyxy)]


def load(spec, classes=None, conf=0.45):
    if not spec:
        return None
    return UltralyticsDetector(spec, conf) if spec.endswith(".pt") else OnnxDetector(spec, classes, conf=conf)


PPE_CLASSES = ("hairnet", "no_hairnet", "gloves", "no_gloves", "apron", "no_apron")


def attach_ppe(person_box, ppe_dets):
    """PPE detections whose centre falls inside the person box decide that person's attributes (True / False / None)."""
    x1, y1, x2, y2 = person_box
    attrs = {"hairnet": None, "gloves": None, "apron": None}
    for name, conf, (a, b, c, d) in ppe_dets:
        cx, cy = (a + c) / 2, (b + d) / 2
        if not (x1 <= cx <= x2 and y1 <= cy <= y2):
            continue
        key = name.replace("no_", "")
        if key in attrs:
            attrs[key] = not name.startswith("no_") if attrs[key] is None else attrs[key] and not name.startswith("no_")
    return attrs
