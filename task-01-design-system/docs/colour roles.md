# Colour roles

## Purpose

This document records the exported semantic colour roles for the light and dark themes, the palette tokens each role references, and the contrast ratios for the intended foreground/background role pairs. Components should consume semantic roles (for example, `primary` and `on-primary`) rather than hard-coded primitive palette colours.

**Brand key colours in this export:** primary `#037171`, secondary `#F18F01`, and tertiary `#8BD7D2`. These are primitive key-colour values; semantic roles resolve through the tonal palettes. In this export, light-theme `secondary` references `secondary.secondary40` (`#F18F01`), and light-theme `on-secondary` references `secondary.secondary20` (`#4A2800`).

## Semantic role mapping


| Role | Intended use | Light theme token (resolved value) | Dark theme token (resolved value) |
|---|---|---|---|
| `primary` | Primary brand actions and emphasis | `primary.primary40` (`#037171`) | `primary.primary80` (`#80D4D4`) |
| `on-primary` | Text/icons placed on primary | `primary.primary100` (`#FFFFFF`) | `primary.primary20` (`#003737`) |
| `primary-container` | Low-emphasis primary-tinted container | `primary.primary90` (`#9DF1F0`) | `primary.primary30` (`#004F50`) |
| `on-primary-container` | Text/icons on primary-container | `primary.primary30` (`#004F50`) | `primary.primary90` (`#9DF1F0`) |
| `secondary` | Secondary actions and emphasis | `secondary.secondary40` (`#F18F01`) | `secondary.secondary80` (`#FFB871`) |
| `on-secondary` | Text/icons placed on secondary | `secondary.secondary20` (`#4A2800`) | `secondary.secondary20` (`#4A2800`) |
| `secondary-container` | Low-emphasis secondary-tinted container | `secondary.secondary90` (`#FFDCBE`) | `secondary.secondary30` (`#6A3C00`) |
| `on-secondary-container` | Text/icons on secondary-container | `secondary.secondary30` (`#6A3C00`) | `secondary.secondary90` (`#FFDCBE`) |
| `tertiary` | Tertiary accents and supporting actions | `tertiary.tertiary40` (`#106966`) | `tertiary.tertiary80` (`#88D4CF`) |
| `on-tertiary` | Text/icons placed on tertiary | `tertiary.tertiary100` (`#FFFFFF`) | `tertiary.tertiary20` (`#003735`) |
| `tertiary-container` | Low-emphasis tertiary-tinted container | `tertiary.tertiary90` (`#A4F0EB`) | `tertiary.tertiary30` (`#00504D`) |
| `on-tertiary-container` | Text/icons on tertiary-container | `tertiary.tertiary30` (`#00504D`) | `tertiary.tertiary90` (`#A4F0EB`) |
| `error` | Error and destructive state emphasis | `error.error40` (`#BA1A1A`) | `error.error80` (`#FFB4AB`) |
| `on-error` | Text/icons placed on error | `error.error100` (`#FFFFFF`) | `error.error20` (`#690005`) |
| `error-container` | Error message or state container | `error.error90` (`#FFDAD6`) | `error.error30` (`#93000A`) |
| `on-error-container` | Text/icons on error-container | `error.error30` (`#93000A`) | `error.error90` (`#FFDAD6`) |
| `warning` | Warning state emphasis | `warning.warning40` (`#855400`) | `warning.warning80` (`#FFB95C`) |
| `on-warning` | Text/icons placed on warning | `warning.warning100` (`#FFFFFF`) | `warning.warning20` (`#462A00`) |
| `warning-container` | Warning message or state container | `warning.warning90` (`#FFDDB7`) | `warning.warning30` (`#653E00`) |
| `on-warning-container` | Text/icons on warning-container | `warning.warning30` (`#653E00`) | `warning.warning90` (`#FFDDB7`) |
| `success` | Successful state emphasis | `success.success40` (`#006E2E`) | `success.success80` (`#70DD85`) |
| `on-success` | Text/icons placed on success | `success.success100` (`#FFFFFF`) | `success.success20` (`#003915`) |
| `success-container` | Success message or state container | `success.success90` (`#8CFA9F`) | `success.success30` (`#005321`) |
| `on-success-container` | Text/icons on success-container | `success.success30` (`#005321`) | `success.success90` (`#8CFA9F`) |
| `background` | Default page/app background | `neutral.neutral98` (`#F3FBFB`) | `neutral.neutral6` (`#0D1515`) |
| `on-background` | Default text/icons on background | `neutral.neutral10` (`#151D1D`) | `neutral.neutral90` (`#DCE4E4`) |
| `surface` | Cards, sheets, panels and other surfaces | `neutral.neutral98` (`#F3FBFB`) | `neutral.neutral6` (`#0D1515`) |
| `on-surface` | Primary text/icons on surface | `neutral.neutral10` (`#151D1D`) | `neutral.neutral90` (`#DCE4E4`) |
| `surface-variant` | Alternate surface for grouped or differentiated content | `neutral variant.neutral-variant90` (`#D6E6E5`) | `neutral variant.neutral-variant30` (`#3B494A`) |
| `on-surface-variant` | Secondary text/icons on surface-variant | `neutral variant.neutral-variant30` (`#3B494A`) | `neutral variant.neutral-variant80` (`#BACAC9`) |
| `outline` | Borders and controls needing clear separation | `neutral variant.neutral-variant50` (`#6B7A7A`) | `neutral variant.neutral-variant60` (`#849494`) |
| `outline-variant` | Subtle borders/dividers | `neutral variant.neutral-variant80` (`#BACAC9`) | `neutral variant.neutral-variant30` (`#3B494A`) |
| `inverse-surface` | Inverse/emphasized surface | `neutral.neutral20` (`#2A3232`) | `neutral.neutral90` (`#DCE4E4`) |
| `inverse-on-surface` | Text/icons on inverse-surface | `neutral.neutral95` (`#EAF2F2`) | `neutral.neutral20` (`#2A3232`) |
| `inverse-primary` | Primary accent on inverse surfaces | `primary.primary80` (`#80D4D4`) | `primary.primary40` (`#037171`) |
| `surface-dim` | Dimmed surface treatment | `neutral.neutral87` (`#D4DCDB`) | `neutral.neutral6` (`#0D1515`) |
| `surface-bright` | Bright surface treatment | `neutral.neutral98` (`#F3FBFB`) | `neutral.neutral24` (`#333B3B`) |
| `surface-container-lowest` | Lowest-emphasis surface container | `neutral.neutral100` (`#FFFFFF`) | `neutral.neutral4` (`#080F10`) |
| `surface-container-low` | Low-emphasis surface container | `neutral.neutral96` (`#EDF5F5`) | `neutral.neutral10` (`#151D1D`) |
| `surface-container` | Standard surface container | `neutral.neutral94` (`#E8EFEF`) | `neutral.neutral12` (`#192121`) |
| `surface-container-high` | Higher-emphasis surface container | `neutral.neutral92` (`#E2EAE9`) | `neutral.neutral17` (`#242B2C`) |
| `surface-container-highest` | Highest-emphasis surface container | `neutral.neutral90` (`#DCE4E4`) | `neutral.neutral22` (`#2E3636`) |
| `shadow` | Semantic color for shadow effects | `neutral.neutral0` (`#000000`) | `neutral.neutral0` (`#000000`) |
| `scrim` | Overlay behind modal/dialog content | `neutral.neutral0` (`#000000`) | `neutral.neutral0` (`#000000`) |
| `surface-tint` | Brand tint applied to surfaces | `primary.primary40` (`#037171`) | `primary.primary80` (`#80D4D4`) |
| `primary-fixed` | Stable primary container across themes | `primary.primary90` (`#9DF1F0`) | `primary.primary90` (`#9DF1F0`) |
| `primary-fixed-dim` | Dimmed stable primary container | `primary.primary80` (`#80D4D4`) | `primary.primary80` (`#80D4D4`) |
| `on-primary-fixed` | Text/icons on primary-fixed | `primary.primary10` (`#002020`) | `primary.primary10` (`#002020`) |
| `on-primary-fixed-variant` | Variant text/icons on primary-fixed | `primary.primary30` (`#004F50`) | `primary.primary30` (`#004F50`) |
| `secondary-fixed` | Stable secondary container across themes | `secondary.secondary90` (`#FFDCBE`) | `secondary.secondary90` (`#FFDCBE`) |
| `secondary-fixed-dim` | Dimmed stable secondary container | `secondary.secondary80` (`#FFB871`) | `secondary.secondary80` (`#FFB871`) |
| `on-secondary-fixed` | Text/icons on secondary-fixed | `secondary.secondary10` (`#2D1600`) | `secondary.secondary10` (`#2D1600`) |
| `on-secondary-fixed-variant` | Variant text/icons on secondary-fixed | `secondary.secondary30` (`#6A3C00`) | `secondary.secondary30` (`#6A3C00`) |
| `tertiary-fixed` | Stable tertiary container across themes | `tertiary.tertiary90` (`#A4F0EB`) | `tertiary.tertiary90` (`#A4F0EB`) |
| `tertiary-fixed-dim` | Dimmed stable tertiary container | `tertiary.tertiary80` (`#88D4CF`) | `tertiary.tertiary80` (`#88D4CF`) |
| `on-tertiary-fixed` | Text/icons on tertiary-fixed | `tertiary.tertiary10` (`#00201F`) | `tertiary.tertiary10` (`#00201F`) |
| `on-tertiary-fixed-variant` | Variant text/icons on tertiary-fixed | `tertiary.tertiary30` (`#00504D`) | `tertiary.tertiary30` (`#00504D`) |

## Contrast method and acceptance criteria

Ratios below were calculated from the resolved opaque sRGB hex values using the WCAG relative-luminance contrast formula. For normal text, use **4.5:1 or higher**; for large text, use **3:1 or higher**. This table checks the intended `on-*` foreground against its matching base/container surface in both exported themes. It does not prove every combination in the application is safe: any additional foreground/background combination actually used in the UI must also be checked.

## Intended text and container pair contrast

Hex values are listed as **background / foreground**.

| Foreground on background | Light hex background / foreground | Light ratio | Dark hex background / foreground | Dark ratio | AA normal text |
|---|---|---:|---|---:|---|
| `on-primary` on `primary` | #037171 / #FFFFFF | 5.83:1 | #80D4D4 / #003737 | 7.67:1 | Pass |
| `on-primary-container` on `primary-container` | #9DF1F0 / #004F50 | 7.28:1 | #004F50 / #9DF1F0 | 7.28:1 | Pass |
| `on-secondary` on `secondary` | #F18F01 / #4A2800 | 5.44:1 | #FFB871 / #4A2800 | 7.74:1 | Pass |
| `on-secondary-container` on `secondary-container` | #FFDCBE / #6A3C00 | 7.19:1 | #6A3C00 / #FFDCBE | 7.19:1 | Pass |
| `on-tertiary` on `tertiary` | #106966 / #FFFFFF | 6.49:1 | #88D4CF / #003735 | 7.74:1 | Pass |
| `on-tertiary-container` on `tertiary-container` | #A4F0EB / #00504D | 7.20:1 | #00504D / #A4F0EB | 7.20:1 | Pass |
| `on-error` on `error` | #BA1A1A / #FFFFFF | 6.46:1 | #FFB4AB / #690005 | 7.72:1 | Pass |
| `on-error-container` on `error-container` | #FFDAD6 / #93000A | 7.24:1 | #93000A / #FFDAD6 | 7.24:1 | Pass |
| `on-warning` on `warning` | #855400 / #FFFFFF | 6.43:1 | #FFB95C / #462A00 | 7.76:1 | Pass |
| `on-warning-container` on `warning-container` | #FFDDB7 / #653E00 | 7.26:1 | #653E00 / #FFDDB7 | 7.26:1 | Pass |
| `on-success` on `success` | #006E2E / #FFFFFF | 6.42:1 | #70DD85 / #003915 | 7.75:1 | Pass |
| `on-success-container` on `success-container` | #8CFA9F / #005321 | 7.21:1 | #005321 / #8CFA9F | 7.21:1 | Pass |
| `on-background` on `background` | #F3FBFB / #151D1D | 16.32:1 | #0D1515 / #DCE4E4 | 14.32:1 | Pass |
| `on-surface` on `surface` | #F3FBFB / #151D1D | 16.32:1 | #0D1515 / #DCE4E4 | 14.32:1 | Pass |
| `on-surface-variant` on `surface-variant` | #D6E6E5 / #3B494A | 7.29:1 | #3B494A / #BACAC9 | 5.53:1 | Pass |
| `inverse-on-surface` on `inverse-surface` | #2A3232 / #EAF2F2 | 11.55:1 | #DCE4E4 / #2A3232 | 10.16:1 | Pass |
| `on-primary-fixed` on `primary-fixed` | #9DF1F0 / #002020 | 13.26:1 | #9DF1F0 / #002020 | 13.26:1 | Pass |
| `on-primary-fixed-variant` on `primary-fixed` | #9DF1F0 / #004F50 | 7.28:1 | #9DF1F0 / #004F50 | 7.28:1 | Pass |
| `on-secondary-fixed` on `secondary-fixed` | #FFDCBE / #2D1600 | 13.24:1 | #FFDCBE / #2D1600 | 13.24:1 | Pass |
| `on-secondary-fixed-variant` on `secondary-fixed` | #FFDCBE / #6A3C00 | 7.19:1 | #FFDCBE / #6A3C00 | 7.19:1 | Pass |
| `on-tertiary-fixed` on `tertiary-fixed` | #A4F0EB / #00201F | 13.24:1 | #A4F0EB / #00201F | 13.24:1 | Pass |
| `on-tertiary-fixed-variant` on `tertiary-fixed` | #A4F0EB / #00504D | 7.20:1 | #A4F0EB / #00504D | 7.20:1 | Pass |

## Usage notes

- Use `on-primary` with `primary`, `on-secondary` with `secondary`, and so on; use the matching `on-*-container` role for each container.
- Use `on-background` for text on `background`, `on-surface` for text on `surface`, and `on-surface-variant` for text on `surface-variant`.
- `outline` and `outline-variant` are intended for borders and dividers, not as default text colours. If used for meaningful non-text controls, check the relevant non-text contrast requirement against the actual adjacent surface.
- `shadow` and `scrim` are effect roles, not text colours.

