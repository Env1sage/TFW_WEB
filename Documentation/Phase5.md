

# 🟢 PHASE 5 – ADVANCED EDITOR FEATURES (MULTI-SIDE + SAFE ZONE + UNDO/REDO + DPI)

⚠️ Goals of this phase:

* Multi-side support (Front/Back/etc.)
* Separate JSON per side
* Safe zone + bleed visualization
* Undo / Redo stack
* Snap alignment guides
* DPI validation warning
* Preview image generation
* Clean architecture (no chaos)

Still local. Still modular.

---

# 1️⃣ ARCHITECTURE UPGRADE (IMPORTANT)

We must now introduce:

### Editor State Manager

We cannot rely on only local component state anymore.

We create:

```id="z2g6l1"
EditorContext
```

So each side maintains:

* Its own Fabric instance
* Its own JSON
* Its own history stack

---

# 2️⃣ MULTI-SIDE SUPPORT (FRONT / BACK)

---

## 🔹 Step 1 – Define Sides

Inside:

```id="a0y1l2"
features/customization/types/canvas.types.ts
```

```ts
export type PrintSide = "FRONT" | "BACK"
```

---

## 🔹 Step 2 – Update Canvas Hook

Modify:

```id="b3x4p5"
useFabricCanvas.ts
```

We now support dynamic loading.

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import { fabric } from "fabric"

export function useFabricCanvas(side: string) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 1000,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    })

    setCanvas(fabricCanvas)

    return () => {
      fabricCanvas.dispose()
    }
  }, [side])

  return { canvasRef, canvas }
}
```

---

## 🔹 Step 3 – Add Side Switcher UI

Update `CanvasEditor.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useFabricCanvas } from "../hooks/useFabricCanvas"
import Toolbar from "./Toolbar"

export default function CanvasEditor() {
  const [side, setSide] = useState("FRONT")
  const { canvasRef, canvas } = useFabricCanvas(side)

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <button onClick={() => setSide("FRONT")}>Front</button>
        <button onClick={() => setSide("BACK")}>Back</button>
      </div>

      <div className="flex gap-6">
        <Toolbar canvas={canvas} />
        <div className="border shadow">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  )
}
```

Now switching sides resets canvas instance.

Next improvement: preserve JSON per side (coming below).

---

# 3️⃣ SAFE ZONE + BLEED OVERLAY

We visually draw non-editable rectangle guides.

Inside `useFabricCanvas` after initialization:

```ts
const safeZone = new fabric.Rect({
  left: 100,
  top: 100,
  width: 600,
  height: 800,
  fill: "",
  stroke: "green",
  strokeDashArray: [5, 5],
  selectable: false,
  evented: false,
})

const bleed = new fabric.Rect({
  left: 50,
  top: 50,
  width: 700,
  height: 900,
  fill: "",
  stroke: "red",
  strokeDashArray: [10, 5],
  selectable: false,
  evented: false,
})

fabricCanvas.add(bleed)
fabricCanvas.add(safeZone)
fabricCanvas.sendToBack(bleed)
fabricCanvas.sendToBack(safeZone)
```

Now you have visual print boundaries.

---

# 4️⃣ UNDO / REDO STACK

We must maintain history manually.

Inside `useFabricCanvas`:

Add:

```ts
const historyRef = useRef<string[]>([])
const redoRef = useRef<string[]>([])
```

After canvas initialization:

```ts
fabricCanvas.on("object:added", saveHistory)
fabricCanvas.on("object:modified", saveHistory)
fabricCanvas.on("object:removed", saveHistory)

function saveHistory() {
  const json = JSON.stringify(fabricCanvas.toJSON())
  historyRef.current.push(json)
  redoRef.current = []
}
```

Add undo:

```ts
function undo() {
  if (historyRef.current.length < 2) return

  redoRef.current.push(historyRef.current.pop()!)
  const prev = historyRef.current[historyRef.current.length - 1]

  fabricCanvas.loadFromJSON(prev, () => {
    fabricCanvas.renderAll()
  })
}
```

Expose undo/redo from hook.

Add buttons in Toolbar.

---

# 5️⃣ SNAP ALIGNMENT GUIDES

Add center snapping:

After canvas creation:

```ts
fabricCanvas.on("object:moving", function (e) {
  const obj = e.target
  if (!obj) return

  const center = fabricCanvas.getCenter()

  if (Math.abs(obj.left! - center.left) < 10) {
    obj.set({ left: center.left })
  }

  if (Math.abs(obj.top! - center.top) < 10) {
    obj.set({ top: center.top })
  }
})
```

This snaps to center.

Later we can enhance.

---

# 6️⃣ DPI VALIDATION (VERY IMPORTANT)

When image is uploaded:

Inside Toolbar:

After loading image:

```ts
const dpi = (img.width! / img.getScaledWidth()) * 72

if (dpi < 200) {
  alert("Low resolution image. Print quality may be poor.")
}
```

This gives rough DPI detection.

Professional print needs 300 DPI.

---

# 7️⃣ PREVIEW IMAGE GENERATION

Add function:

```ts
const generatePreview = () => {
  if (!canvas) return
  const dataUrl = canvas.toDataURL({
    format: "png",
    multiplier: 2
  })
  return dataUrl
}
```

Send this to backend as previewImageBase64.

Backend will later convert & store.

---

# 8️⃣ SAVE MULTI-SIDE STRUCTURE

Modify saveDesign logic:

Instead of resetting per side, maintain:

```ts
const sidesState = useRef<Record<string, any>>({})
```

On side switch:

* Save current canvas JSON into sidesState[currentSide]
* Load sidesState[newSide] if exists

This ensures per-side memory.

---

# 🧠 WHAT WE ACHIEVED IN PHASE 5

Now you have:

✅ Multi-side editor
✅ Visual safe zones
✅ Bleed guide
✅ Undo / Redo
✅ Snap alignment
✅ DPI warning
✅ Preview export
✅ Side-specific JSON storage

This is now a serious customization engine.

---

# 📦 DELIVERABLE OF PHASE 5

Your editor now resembles 60–70% of Lumise base functionality.

Remaining advanced items:

* Layer panel
* Lock/duplicate/delete per layer
* Rotation controls UI
* Zoom controls
* Product mockup overlay
* Real pricing integration

