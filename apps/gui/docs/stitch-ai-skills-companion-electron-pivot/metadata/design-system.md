# Arcane Ivory Design System

Source: Stitch design system `assets/a77fb7d66c7b4003a0aee2ca7108c756`, version `1`.

## Creative Direction

The design direction is "The Tactile Architect": a warm, premium workspace for an AI Skills Companion. It favors soft utility, tonal layering, high-density information layouts, and editorial-grade typography.

The system avoids cold developer-tool styling and explicit dividing lines. Section boundaries should come from tonal shifts, material stacking, spacing, and muted surface contrast.

## Core Tokens

```json
{
  "colorMode": "LIGHT",
  "colorVariant": "FIDELITY",
  "font": "INTER",
  "bodyFont": "INTER",
  "headlineFont": "INTER",
  "labelFont": "INTER",
  "roundness": "ROUND_EIGHT",
  "spacingScale": 1,
  "customColor": "#2F3A32",
  "overrideNeutralColor": "#F7F5EF",
  "overridePrimaryColor": "#2F3A32",
  "overrideSecondaryColor": "#6C655B",
  "overrideTertiaryColor": "#F0ECE4"
}
```

## Color Palette

```json
{
  "background": "#fbf9f3",
  "surface": "#fbf9f3",
  "surface_container_lowest": "#ffffff",
  "surface_container_low": "#f5f3ed",
  "surface_container": "#f0eee8",
  "surface_container_high": "#eae8e2",
  "surface_container_highest": "#e4e2dd",
  "surface_variant": "#e4e2dd",
  "surface_dim": "#dcdad4",
  "primary": "#1a241d",
  "primary_container": "#2f3a32",
  "primary_fixed": "#d9e6da",
  "primary_fixed_dim": "#bdcabe",
  "secondary": "#645d54",
  "secondary_container": "#ebe1d4",
  "outline": "#747873",
  "outline_variant": "#c3c8c2",
  "on_surface": "#1b1c18",
  "on_surface_variant": "#434844",
  "on_primary": "#ffffff",
  "on_primary_fixed": "#131e17"
}
```

## Implementation Notes

- Use tonal layering instead of default 1px borders.
- If a boundary is required, use a low-opacity ghost border based on `outline_variant`.
- Use the deep charcoal-green `primary` for important text and primary actions.
- Use `primary_fixed` for AI skill chips.
- Keep component radii around 8px, with 4px for nested chips and small internal elements.
- Prefer dense but breathable layouts: wide main columns, narrow utility rails, careful metadata hierarchy.
