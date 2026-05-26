---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Align Local-Transformers runtime identity between Translation Test and page translation
so both paths persist the same selected model/profile snapshot.

Block incompatible directional local models before document translation starts, including
page-level detected source-language groups, instead of letting ONNX runtime fail later.
