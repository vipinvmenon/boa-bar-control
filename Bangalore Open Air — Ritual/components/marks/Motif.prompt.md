**Motif** — drop-in ritual atmosphere (green aura + grain/halftone texture + optional venom wash). Absolutely positioned; put it inside a `position:relative` hero container, behind text.

```jsx
<div style={{ position:'relative' }}>
  <Motif aura texture="grain" />
  <Motif wash /> {/* over a photo, to protect bottom text */}
  {/* hero content on top */}
</div>
```

Use `wash` only over photography. `texture="halftone"` for the grungy dot look; `intensity` dials the aura.
