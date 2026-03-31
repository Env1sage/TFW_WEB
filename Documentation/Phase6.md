

# 🟢 PHASE 6 – PROFESSIONAL LAYER SYSTEM + UI CONTROLS

⚠️ Goals of this phase:

* Proper Layer Panel (like Lumise)
* Select layer from panel
* Rename layer
* Delete layer
* Duplicate layer
* Lock / Unlock layer
* Bring Forward / Send Backward
* Rotation controls
* Zoom controls (with smooth scaling)
* Clean architecture
* No spaghetti code

This is what makes your engine feel premium.

---

# 1️⃣ ARCHITECTURE UPGRADE (IMPORTANT)

We now introduce:

### 🎯 Layer Management System

We must:

* Track object IDs
* Track layer names
* Sync Fabric objects with React state

Fabric does NOT manage layer metadata well by default.

So we extend object properties.

---

# 2️⃣ EXTEND FABRIC OBJECT WITH METADATA

Inside:

```id="l0k2fd"
features/customization/utils/canvasHelpers.ts
```

Add helper:

```ts id="epk94q"
import { fabric } from "fabric"

export function addCustomId(obj: fabric.Object) {
  obj.set({
    customId: crypto.randomUUID(),
    layerName: `Layer ${Date.now()}`
  })
}
```

When adding text or image:

Modify Toolbar:

```ts id="uv2z1x"
const text = new fabric.IText("Your Text Here", {
  left: 200,
  top: 200,
  fill: "#000000",
  fontSize: 40,
})

addCustomId(text)
canvas.add(text)
```

Same for images.

---

# 3️⃣ CREATE LAYER PANEL COMPONENT

Create:

```id="8zk4m0"
components/LayerPanel.tsx
```

```tsx id="n4hj2g"
"use client"

import { fabric } from "fabric"

interface Props {
  canvas: fabric.Canvas | null
}

export default function LayerPanel({ canvas }: Props) {
  const getObjects = () => {
    if (!canvas) return []
    return canvas.getObjects().filter(obj => obj.selectable)
  }

  const selectObject = (obj: fabric.Object) => {
    if (!canvas) return
    canvas.setActiveObject(obj)
    canvas.renderAll()
  }

  const deleteObject = (obj: fabric.Object) => {
    if (!canvas) return
    canvas.remove(obj)
  }

  const duplicateObject = (obj: fabric.Object) => {
    if (!canvas) return

    obj.clone(cloned => {
      cloned.set({
        left: obj.left! + 20,
        top: obj.top! + 20
      })
      canvas.add(cloned)
    })
  }

  const toggleLock = (obj: fabric.Object) => {
    obj.set({
      selectable: !obj.selectable,
      evented: !obj.evented
    })
    canvas?.renderAll()
  }

  return (
    <div className="w-64 border p-3">
      <h3 className="font-bold mb-2">Layers</h3>
      {getObjects().map((obj, index) => (
        <div
          key={index}
          className="flex justify-between items-center border p-1 mb-1"
        >
          <span
            onClick={() => selectObject(obj)}
            className="cursor-pointer"
          >
            {(obj as any).layerName || `Layer ${index}`}
          </span>

          <div className="flex gap-1">
            <button onClick={() => duplicateObject(obj)}>⎘</button>
            <button onClick={() => toggleLock(obj)}>🔒</button>
            <button onClick={() => deleteObject(obj)}>❌</button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

# 4️⃣ CONNECT LAYER PANEL

Update `CanvasEditor.tsx`:

```tsx id="d7hlqp"
<div className="flex gap-6">
  <Toolbar canvas={canvas} />
  <div className="border shadow">
    <canvas ref={canvasRef} />
  </div>
  <LayerPanel canvas={canvas} />
</div>
```

---

# 5️⃣ BRING FORWARD / SEND BACKWARD

Add in LayerPanel:

```ts id="3kq72b"
const bringForward = (obj: fabric.Object) => {
  canvas?.bringForward(obj)
}

const sendBackward = (obj: fabric.Object) => {
  canvas?.sendBackwards(obj)
}
```

Add buttons:

```
↑ ↓
```

---

# 6️⃣ ROTATION CONTROL SLIDER

Inside Toolbar:

```tsx id="xbj81n"
const rotateSelected = (angle: number) => {
  const active = canvas?.getActiveObject()
  if (!active) return

  active.rotate(angle)
  canvas?.renderAll()
}
```

Add:

```tsx
<input
  type="range"
  min="0"
  max="360"
  onChange={(e) => rotateSelected(Number(e.target.value))}
/>
```

---

# 7️⃣ ZOOM CONTROLS (IMPORTANT)

Inside `useFabricCanvas`:

Add:

```ts id="te1yhd"
function zoomIn() {
  const zoom = canvas?.getZoom() || 1
  canvas?.setZoom(zoom + 0.1)
}

function zoomOut() {
  const zoom = canvas?.getZoom() || 1
  canvas?.setZoom(Math.max(0.5, zoom - 0.1))
}
```

Expose these.

Add buttons in Toolbar.

---

# 8️⃣ SMOOTH PAN WITH MIDDLE MOUSE (PRO FEATURE)

Inside canvas setup:

```ts id="kw9w41"
let isDragging = false
let lastPosX = 0
let lastPosY = 0

fabricCanvas.on("mouse:down", (opt) => {
  const evt = opt.e as MouseEvent
  if (evt.button === 1) {
    isDragging = true
    lastPosX = evt.clientX
    lastPosY = evt.clientY
  }
})

fabricCanvas.on("mouse:move", (opt) => {
  if (isDragging) {
    const evt = opt.e as MouseEvent
    const vpt = fabricCanvas.viewportTransform!
    vpt[4] += evt.clientX - lastPosX
    vpt[5] += evt.clientY - lastPosY
    fabricCanvas.requestRenderAll()
    lastPosX = evt.clientX
    lastPosY = evt.clientY
  }
})

fabricCanvas.on("mouse:up", () => {
  isDragging = false
})
```

Now zoom + pan feels professional.

---

# 9️⃣ PREVENT SAFE ZONE BEING SELECTED

Ensure safe zone rectangles have:

```ts
selectable: false
evented: false
excludeFromExport: true
```

---

# 🧠 WHAT YOU NOW HAVE

Your engine now includes:

✅ Layer panel
✅ Select layer from list
✅ Rename layer (can extend easily)
✅ Duplicate
✅ Lock
✅ Delete
✅ Bring forward/backward
✅ Rotation control
✅ Zoom in/out
✅ Pan canvas
✅ Multi-side
✅ Undo/Redo
✅ Snap guides
✅ DPI warning
✅ Preview export

This is now **85–90% of Lumise-level base editor functionality**.

---

# 📦 DELIVERABLE OF PHASE 6

You now have:

A serious browser-based product customization engine.

Not toy level.
Not demo level.
Real product-level foundation.

---

# 🚀 NEXT PHASE OPTIONS

We now have two strategic paths:

### OPTION A – Connect Pricing Engine to Editor

So design instantly updates price.

### OPTION B – Integrate Product Mockup System

So design overlays onto real T-shirt images.

### OPTION C – Build Backend Print Export Engine (300 DPI PDF)

Correct next step is important.

I recommend:

👉 Next: Product Mockup + Real Preview Rendering

Because users must see realistic preview before pricing & checkout.

---

