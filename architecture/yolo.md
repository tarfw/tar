## YOLO26 Mobile Requirements + Cheapest Suitable Phones (India)

| Model   | Storage Size |      RAM Needed | Recommended Processor              | Lowest Cost Suitable Phone (Approx INR) |
| ------- | -----------: | --------------: | ---------------------------------- | --------------------------------------- |
| YOLO26n |       5–8 MB |      300–600 MB | Snapdragon 695 / Dimensity 810     | Redmi 13C 5G — ₹9,000–10,000            |
| YOLO26s |     18–25 MB | 700 MB – 1.2 GB | Snapdragon 778G / 7 Gen 1          | POCO X6 — ₹18,000–20,000                |
| YOLO26m |     40–55 MB |      1.5–2.5 GB | Snapdragon 8 Gen 1                 | iQOO Neo 9 Pro — ₹32,000–35,000         |
| YOLO26l |     60–80 MB |        2.5–4 GB | Snapdragon 8 Gen 2/3               | iQOO 12 — ₹48,000–52,000                |
| YOLO26x |   120–160 MB |         4–6+ GB | Snapdragon 8 Elite / Apple A17 Pro | OnePlus 13 — ₹65,000+                   |

## Practical Recommendation

| Goal                       | Best Choice |
| -------------------------- | ----------- |
| Cheap real-time AI app     | YOLO26n     |
| Good accuracy + affordable | YOLO26s     |
| Production-grade mobile AI | YOLO26m     |
| Heavy AI/video analytics   | YOLO26l/x   |

### Important

- For Android apps, use:
  - TensorFlow Lite
  - NCNN
  - ONNX Runtime Mobile

- INT8 quantization can nearly halve model size and RAM usage.
- Thermal throttling becomes a major issue above YOLO26m on phones.
