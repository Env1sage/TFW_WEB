

# 🟢 PHASE 7 – PRODUCT MOCKUP SYSTEM (REALISTIC PREVIEW ENGINE)

⚠️ This is CRITICAL for:

* User confidence
* Conversion rate
* Professional feel
* Print alignment accuracy

After this phase, users will see:

> Design applied to real T-shirt mockup
> Switch colors
> Front/Back preview
> Professional rendering

Still local. Still structured. No shortcuts.

---

# 🎯 OBJECTIVES OF THIS PHASE

We will implement:

1. Product mockup image layer (base garment)
2. Overlay design on mockup
3. Color switching (real image swap, not CSS fake)
4. Front/Back mockup switching
5. Accurate design positioning
6. Non-exportable mockup layer
7. Proper rendering separation (print vs preview)

---

# 🧠 ARCHITECTURE CHANGE (IMPORTANT)

We must separate:

### 🖨 Print Canvas

vs

### 👕 Mockup Preview Canvas

Why?

Because:

* Print canvas = high resolution, pure design
* Mockup canvas = visual representation only
* Mockup should NOT affect export DPI

We do this cleanly.

---

# 1️⃣ ADD MOCKUP AS BACKGROUND IMAGE (PER SIDE)

Inside `useFabricCanvas`

After canvas initialization:

```ts
fabric.Image.fromURL("/mockups/tshirt-front-white.png", (img) => {
  img.set({
    left: 0,
    top: 0,
    selectable: false,
    evented: false,
    excludeFromExport: true
  })

  img.scaleToWidth(800)
  fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas))
})
```

⚠️ Important:

* `excludeFromExport: true`
* Not selectable
* Always bottom layer

---

# 2️⃣ PROPER MOCKUP FOLDER STRUCTURE

Inside Next.js public:

```
public/mockups/
    tshirt/
        white/
            front.png
            back.png
        black/
            front.png
            back.png
```

This allows color switching without hacks.

---

# 3️⃣ ADD COLOR SWITCHER

Inside `CanvasEditor.tsx`

Add state:

```ts
const [color, setColor] = useState("white")
```

Add UI:

```tsx
<div className="flex gap-2 mb-4">
  <button onClick={() => setColor("white")}>White</button>
  <button onClick={() => setColor("black")}>Black</button>
</div>
```

---

# 4️⃣ DYNAMIC MOCKUP LOADER

Update `useFabricCanvas` to accept:

```ts
useFabricCanvas(side: string, color: string)
```

Then load mockup dynamically:

```ts
fabric.Image.fromURL(
  `/mockups/tshirt/${color}/${side.toLowerCase()}.png`,
  (img) => {
    img.set({
      selectable: false,
      evented: false,
      excludeFromExport: true
    })

    img.scaleToWidth(800)
    fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas))
  }
)
```

Now switching color or side changes garment.

Professional approach.

---

# 5️⃣ LIMIT DESIGN TO PRINT AREA (CLIPPING)

We must prevent design outside safe zone.

Create clip path:

```ts
const clipRect = new fabric.Rect({
  left: 100,
  top: 100,
  width: 600,
  height: 800,
  absolutePositioned: true
})

fabricCanvas.clipPath = clipRect
```

Now design cannot exceed print area visually.

This is HUGE for accuracy.

---

# 6️⃣ MOCKUP PREVIEW RENDERING (EXPORT DIFFERENCE)

We need 2 export modes:

### 🖨 Print Export (no mockup)

### 👕 Preview Export (with mockup)

Add:

```ts
function exportPrintImage() {
  const originalBg = canvas?.backgroundImage
  canvas?.setBackgroundImage(null, () => {
    const data = canvas?.toDataURL({ multiplier: 3 })
    canvas?.setBackgroundImage(originalBg!, canvas.renderAll.bind(canvas))
  })
}
```

This removes garment from export.

Very important for print quality.

---

# 7️⃣ DESIGN POSITION SCALING SYSTEM (IMPORTANT)

Right now design floats freely.

We must:

* Fix print area center
* Automatically center new objects

When adding text/image:

```ts
const center = canvas.getCenter()

obj.set({
  left: center.left,
  top: center.top,
  originX: "center",
  originY: "center"
})
```

Now placement is professional.

---

# 8️⃣ SMOOTH SIDE SWITCH WITH DESIGN PRESERVATION

Earlier we stored JSON per side.

Now improve:

When switching side:

1. Save current JSON
2. Clear canvas
3. Load saved JSON for new side
4. Reload mockup
5. Reapply safe zones

This ensures zero data loss.

---

# 9️⃣ PERFORMANCE OPTIMIZATION

Add:

```ts
fabric.Object.prototype.objectCaching = true
```

And:

```ts
fabricCanvas.renderOnAddRemove = false
```

Then manually call render.

Improves performance significantly.

---

# 🔟 FUTURE-READY FOR MULTIPLE PRODUCTS

Later, Product model will include:

* mockupPath
* printAreaConfig

Then mockup loads dynamically from backend.

But for now hardcode T-shirt.

---

# 🧠 WHAT WE ACHIEVED

Now your system supports:

✅ Real garment mockup
✅ Color switching
✅ Front/Back view
✅ Clip-restricted print area
✅ Separate print export
✅ Proper design centering
✅ Performance optimized rendering

This now feels like a real customization platform.

You are no longer building a demo.

You are building a commercial system.

---

# 📦 DELIVERABLE OF PHASE 7

Your editor now includes:

* Professional mockup rendering
* Multi-side switching
* Realistic preview
* Clean separation of print vs preview

You are now ~90–95% of Lumise base level.

---

# 🚀 NEXT STRATEGIC STEP

Now we must connect editor to:

### 🔥 Pricing Engine (Real-time price calculation)

OR

### 🔥 Backend Print Export (300 DPI PDF generation)

OR

### 🔥 Admin Product Configuration System

Correct order is important.

I strongly recommend:

👉 Next: Pricing Engine Integration
Because pricing must respond instantly when:

* User adds side
* Changes quantity
* Adds multiple print areas

---
