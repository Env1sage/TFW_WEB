# Phase 5 – Advanced Editor Features — Completion Document

## Date Completed
Phase 5 implementation complete.

---

## Goals Achieved

| Feature | Status |
|---|---|
| Multi-side support (FRONT / BACK) | ✅ |
| Per-side JSON storage | ✅ |
| Safe zone + bleed overlay | ✅ |
| Undo / Redo stack (per-side) | ✅ |
| Snap alignment guides (center) | ✅ |
| DPI validation warning | ✅ |
| Preview image generation | ✅ |
| Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) | ✅ |
| Multi-side save to backend | ✅ |
| Clean architecture (Context + Hook) | ✅ |

---

## Architecture

### EditorContext (`context/EditorContext.tsx`)
- React Context providing `activeSide`, `setActiveSide`, `sidesStateRef`
- `sidesStateRef` holds per-side: `json` (canvas state), `history[]`, `redoStack[]`
- `EditorProvider` wraps the entire editor layout

### useFabricCanvas Hook (`hooks/useFabricCanvas.ts`)
- Accepts `side: PrintSide` and `sidesStateRef` parameters
- **Canvas init**: 800×1000, white background, preserveObjectStacking
- **Guide overlays**: Bleed (red dashed, 50px inset) + Safe zone (green dashed, 100px inset) — non-selectable, non-evented, named `__bleed` / `__safeZone`
- **History**: Records JSON snapshot on `object:added`, `object:modified`, `object:removed`. Guarded by `isLoadingRef` to prevent recording during side switches and undo/redo.
- **Side switching**: Saves current side JSON → loads new side JSON (or initializes blank canvas with guides)
- **Snap alignment**: Snaps object center to canvas center within 10px threshold
- **Exposes**: `canvasRef`, `canvas`, `layerCount`, `deleteSelected`, `undo`, `redo`, `generatePreview`

### CanvasEditor (`components/CanvasEditor.tsx`)
- Wraps layout in `EditorProvider`
- `EditorLayout` inner component:
  - Side switcher tabs (FRONT / BACK) with active state styling
  - Wires hook to Toolbar, Canvas, LayerPanel
  - Keyboard shortcuts: `Ctrl+Z` → undo, `Ctrl+Shift+Z` / `Ctrl+Y` → redo
  - Guide legend (bleed = red, safe zone = green)
  - `handleSave` collects all sides' JSON and calls `saveDesignToBackend`

---

## Files Created / Modified

### New Files
| File | Purpose |
|---|---|
| `features/customization/context/EditorContext.tsx` | Editor state context (active side, per-side state ref) |

### Modified Files
| File | Changes |
|---|---|
| `features/customization/types/canvas.types.ts` | Added `PrintSide`, `SideState` types |
| `features/customization/hooks/useFabricCanvas.ts` | Complete rewrite: multi-side, guides, undo/redo, snap, preview |
| `features/customization/utils/canvasHelpers.ts` | `getLayers` filters guides; `saveDesignToBackend` accepts multi-side `sidesData` |
| `features/customization/components/Toolbar.tsx` | Added undo/redo/preview buttons, DPI validation on image upload |
| `features/customization/components/LayerPanel.tsx` | `moveDown` prevents moving below guide objects |
| `features/customization/components/CanvasEditor.tsx` | EditorProvider + side tabs + keyboard shortcuts + save orchestration |

---

## Key Design Decisions

1. **Single canvas, JSON swap**: Instead of multiple Fabric Canvas instances, we maintain one canvas and swap JSON data on side switch. This is more memory-efficient and avoids multiple DOM canvases.

2. **Guide objects by name**: Safe zone and bleed rects are identified by `name` property (`__safeZone`, `__bleed`). This allows filtering in `getLayers`, preventing deletion, and preventing layer reorder below guides.

3. **History per side**: Each side has its own `history[]` and `redoStack[]` in `sidesStateRef`. Undo/redo operates only on the active side's history.

4. **isLoadingRef guard**: Prevents history recording during programmatic canvas changes (side switching, undo/redo, loading from JSON).

5. **Fabric.js v7 adaptations**: All code uses named exports (`Canvas`, `Rect`, `IText`, `FabricImage`), `toObject(['name'])` for serialization with custom properties, promise-based `loadFromJSON`.

---

## Testing Verification

- ✅ Zero TypeScript errors
- ✅ Next.js production build succeeds (`pnpm exec next build`)
- ✅ `/editor` page returns HTTP 200
- ✅ API multi-side save tested: created design with FRONT + BACK sides, both saved successfully, confirmed via GET

---

## Canvas Dimensions

| Zone | Left | Top | Width | Height |
|---|---|---|---|---|
| Canvas | 0 | 0 | 800 | 1000 |
| Bleed line (red) | 50 | 50 | 700 | 900 |
| Safe zone (green) | 100 | 100 | 600 | 800 |

---

## What's Ready for Phase 6

The editor now supports:
- Multi-side design with per-side state persistence
- Visual print boundaries (bleed + safe zone)
- Full undo/redo with keyboard shortcuts
- Center snap alignment
- DPI quality warnings on image upload
- Preview export (2x PNG)
- Multi-side backend save
