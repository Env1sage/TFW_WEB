

# 🟢 PHASE 4 – CUSTOMIZATION ENGINE FRONTEND (SINGLE SIDE – PROFESSIONAL STRUCTURE)

⚠️ Goals of this phase:

* Fabric.js integrated properly
* Clean architecture (no messy component)
* Canvas initialization system
* Add image
* Add text
* Move/resize/rotate
* Layer list panel
* Export JSON
* Save to backend
* Load from backend
* Proper state management
* No technical debt

Everything still local.

---

# 1️⃣ INSTALL FABRIC.JS

Go to:

```id="ad2g9f"
apps/web
```

Install:

```bash id="sd3j4k"
pnpm add fabric
```

---

# 2️⃣ CREATE PROPER FOLDER STRUCTURE

Inside:

```id="oqkpl3"
apps/web/src
```

Create:

```id="lck3pa"
features/customization/
```

Inside:

```id="m2x2fl"
components/
hooks/
utils/
types/
```

Final structure:

```id="i82kda"
features/customization/
│
├── components/
│   ├── CanvasEditor.tsx
│   ├── Toolbar.tsx
│   ├── LayerPanel.tsx
│
├── hooks/
│   └── useFabricCanvas.ts
│
├── utils/
│   └── canvasHelpers.ts
│
└── types/
    └── canvas.types.ts
```

We are building like a real product team.

---

# 3️⃣ CREATE CANVAS HOOK (CORE ENGINE)

Inside:

```id="e2j3lx"
hooks/useFabricCanvas.ts
```

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import { fabric } from "fabric"

export function useFabricCanvas() {
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
  }, [])

  return { canvasRef, canvas }
}
```

---

# 4️⃣ CREATE MAIN EDITOR COMPONENT

Inside:

```id="w34jfp"
components/CanvasEditor.tsx
```

```tsx
"use client"

import { useFabricCanvas } from "../hooks/useFabricCanvas"
import { useEffect } from "react"

export default function CanvasEditor() {
  const { canvasRef, canvas } = useFabricCanvas()

  return (
    <div className="flex gap-6">
      <div className="border shadow">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
```

---

# 5️⃣ CREATE TOOLBAR (ADD IMAGE + TEXT)

Inside:

```id="xw7a9q"
components/Toolbar.tsx
```

```tsx
"use client"

import { fabric } from "fabric"

interface Props {
  canvas: fabric.Canvas | null
}

export default function Toolbar({ canvas }: Props) {
  const addText = () => {
    if (!canvas) return

    const text = new fabric.IText("Your Text Here", {
      left: 200,
      top: 200,
      fill: "#000000",
      fontSize: 40,
    })

    canvas.add(text)
    canvas.setActiveObject(text)
  }

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canvas || !e.target.files) return

    const file = e.target.files[0]
    const reader = new FileReader()

    reader.onload = () => {
      fabric.Image.fromURL(reader.result as string, (img) => {
        img.set({
          left: 100,
          top: 100,
          scaleX: 0.5,
          scaleY: 0.5,
        })
        canvas.add(img)
      })
    }

    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={addText}
        className="px-4 py-2 bg-black text-white"
      >
        Add Text
      </button>

      <input type="file" accept="image/*" onChange={addImage} />
    </div>
  )
}
```

---

# 6️⃣ CONNECT TOOLBAR TO EDITOR

Update `CanvasEditor.tsx`:

```tsx
"use client"

import { useFabricCanvas } from "../hooks/useFabricCanvas"
import Toolbar from "./Toolbar"

export default function CanvasEditor() {
  const { canvasRef, canvas } = useFabricCanvas()

  return (
    <div className="flex gap-6">
      <Toolbar canvas={canvas} />
      <div className="border shadow">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
```

---

# 7️⃣ CREATE TEST PAGE

Inside:

```id="kx7ap9"
app/editor/page.tsx
```

```tsx
import CanvasEditor from "@/features/customization/components/CanvasEditor"

export default function EditorPage() {
  return (
    <div className="p-10">
      <CanvasEditor />
    </div>
  )
}
```

---

Now run:

```id="q5o91m"
pnpm dev
```

Visit:

```id="m0scja"
http://localhost:3000/editor
```

You should now have:

* Canvas
* Add text button
* Upload image
* Move objects
* Resize
* Rotate

---

# 8️⃣ ADD EXPORT & SAVE TO BACKEND

Update Toolbar:

Add save function:

```tsx
const saveDesign = async () => {
  if (!canvas) return

  const json = canvas.toJSON()

  const response = await fetch("http://localhost:4000/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Frontend Test Design",
      productId: "your-product-id"
    }),
  })

  const design = await response.json()

  await fetch(`http://localhost:4000/designs/${design.id}/sides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      side: "FRONT",
      canvasWidth: 800,
      canvasHeight: 1000,
      jsonData: json
    }),
  })

  alert("Design Saved")
}
```

Add button:

```tsx
<button onClick={saveDesign}>
  Save Design
</button>
```

---

# 🧠 WHAT WE BUILT

You now have:

* Fabric.js integration
* Editable canvas
* Text tool
* Image upload
* JSON export
* Backend storage
* Multi-side ready structure

This is the skeleton of Lumise-like engine.

---

# 📦 DELIVERABLE OF PHASE 4

Working:

* Single-side customization editor
* Saving layered JSON to backend

Not yet built:

* Layer panel
* Safe zones
* Undo/Redo
* Multi-side
* DPI validation

Those come next.

---
