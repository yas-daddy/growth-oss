

# Hero Background Image

## Change
Move the hero image from being displayed inline below the CTA buttons to being a full background of the hero section. Add a gradient overlay on top to keep text legible.

## Implementation

**File: `src/pages/LandingPage.tsx`** (lines 126-153)

- Add the hero image as an `absolute inset-0` background with `object-cover`, reduced opacity (~15-20%)
- Layer a gradient overlay on top: dark-to-transparent from top, plus a radial blur accent
- Remove the inline `<img>` tag and its wrapper `<div>` (lines 150-152)
- Keep the existing gradient-primary and blur decorations but adjust for the new background

The result: hero image fills the entire section background, overlaid with a gradient (top-heavy for nav contrast + center radial for text legibility), text and buttons remain crisp on top.

