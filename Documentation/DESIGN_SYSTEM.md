# TheFramedWall — Design System

## Typography

| Token | Value | Usage |
|---|---|---|
| `--font-heading` | Poppins, Montserrat, Space Grotesk | Headings, hero text, CTAs |
| `--font-body` | Inter, Open Sans, Plus Jakarta Sans | Body, paragraphs, inputs |
| `--font-mono` | JetBrains Mono, Fira Code | Code, order IDs |
| `--font-weight-regular` | 400 | Body text |
| `--font-weight-medium` | 500 | Labels, secondary headings |
| `--font-weight-semibold` | 600 | Buttons, nav links |
| `--font-weight-bold` | 700 | Headings, emphasis |
| `--font-weight-extrabold` | 800 | Hero headlines, brand |

## Color Palette

### Brand Colors
| Token | Hex | Usage |
|---|---|---|
| `--primary` | #FF5C35 | Primary actions, CTAs, brand accent |
| `--primary-dark` | #E5431D | Hover states |
| `--primary-light` | #FF7A5C | Light accents |
| `--primary-50` | #FFF1EE | Subtle backgrounds |
| `--secondary` | #7C3AED | Design Studio accent, secondary CTAs |
| `--accent` | #F59E0B | Badges, highlights |
| `--success` | #22C55E | Success states |
| `--warning` | #F59E0B | Warning states |
| `--danger` | #EF4444 | Error states, destructive actions |

### Light Theme Surfaces
| Token | Hex | Usage |
|---|---|---|
| `--bg` | #FFFFFF | Page background |
| `--surface` | #F9FAFB | Card backgrounds |
| `--surface-2` | #F3F4F6 | Alternate surface |
| `--border` | #E5E7EB | Borders, dividers |
| `--text` | #111827 | Primary text |
| `--text-2` | #6B7280 | Secondary text |
| `--text-3` | #9CA3AF | Muted text, placeholders |

### Dark Theme Surfaces (Design Studio)
| Token | Hex | Usage |
|---|---|---|
| `--dark` | #0D0D12 | Studio background |
| `--dark-2` | #16161F | Panels, cards |
| `--dark-3` | #1E1E2C | Elevated cards |
| `--dark-4` | #2A2A38 | Hover/active states |
| `--dark-border` | rgba(255,255,255,0.08) | Borders |
| `--dark-text` | rgba(255,255,255,0.92) | Primary text on dark |
| `--dark-text-2` | rgba(255,255,255,0.55) | Secondary text on dark |

## Shape & Spacing

| Token | Value | Usage |
|---|---|---|
| `--radius` | 10px | Default border-radius |
| `--radius-sm` | 6px | Small buttons, inputs |
| `--radius-lg` | 14px | Cards |
| `--radius-xl` | 20px | Modal, large cards |
| `--radius-2xl` | 28px | Hero sections |

## Shadows

| Token | Usage |
|---|---|
| `--shadow` | Default card shadow |
| `--shadow-md` | Hover cards |
| `--shadow-lg` | Dropdowns, popovers |
| `--shadow-xl` | Modals |
| `--shadow-orange` | Primary button hover |

## Buttons

| Class | Description |
|---|---|
| `.btn-primary` | Orange primary CTA |
| `.btn-secondary` | Gray secondary |
| `.btn-outline` | Orange outline |
| `.btn-ghost` | Transparent ghost |
| `.btn-outline-dark` | Dark theme outline |
| `.btn-lg` | Large size |
| `.btn-block` | Full width |

## Transition
- Default: `--transition: 0.2s ease`
- All interactive elements use `transition: all var(--transition)`

## Responsive Breakpoints
- Desktop: > 1100px (full layout)
- Tablet: 768px - 1100px (compact sidebar)
- Mobile: < 768px (stacked, hidden panels)
- Design Studio mobile: < 700px (panels hidden, touch-friendly)
