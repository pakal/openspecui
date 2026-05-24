## User Input

- Local-Transformers mode should describe itself as an ONNX Runtime-based local adapter with ONNX model files, not as a generic Transformers.js local runtime.
- The model search UI should replace `Unknown size · Size required` with wording that more accurately means the model cannot find the required ONNX files.
- The change should still support the planned local runtime sniff flow after download completion and manual translation test completion.
- Refactor the search panel to mix three data sources in this priority order: local, network, recommended.
- If the same model appears in multiple sources, merge it into the highest-priority source entry automatically.
- When the search keyword is empty, show all locally available models plus the recommended list generated from `opus-mt en-$TARGET_LANG` and `nllb-200-distilled-600M`.
- When the search keyword is present, show fuzzy-matched local models, network keyword search results, and fuzzy-matched recommended models.

## Objective Scope

- Refine the visible language for the Local-Transformers engine to emphasize ONNX Runtime and ONNX assets.
- Refine local model availability wording so missing ONNX files are described explicitly.
- Keep the scope aligned with the existing local model sniffing and verification flow for selected model groups.
- Add deterministic three-source search mixing and duplicate merge rules for the local model selector.
- Add the empty-query and keyed-query result laws for local, network, and recommended model sources.

## Non-Goals

- Do not introduce support for non-ONNX local model formats in this loop.
- Do not change the model selection or download mechanics beyond the wording and capability semantics needed for the sniff flow.
- Do not add historical compatibility records beyond the current selected model group verdict.
- Do not add a generalized recommendation service beyond the deterministic `opus-mt en-$TARGET_LANG` plus `nllb-200-distilled-600M` rule.

## Acceptance Boundary

- The Local-Transformers description clearly states that ONNX Runtime executes ONNX files.
- The model search UI no longer uses `Size required` wording for missing local assets.
- The missing-asset state explicitly refers to absent ONNX files.
- The wording changes remain compatible with the existing local runtime sniff and availability record flow.
- The search panel mixes local, network, and recommended sources in the required priority order.
- Duplicate models are represented once, at the highest-priority position, without losing useful metadata from lower-priority sources.
- Empty-query results show locally available models plus the deterministic recommended set.
- Keyed-query results show fuzzy-matched local entries, network keyword results, and fuzzy-matched recommended entries.
