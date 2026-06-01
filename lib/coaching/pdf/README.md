# Coaching PDF

Store coaching PDF assembly and styling code here.

This folder is for:

- Document-level PDF components.
- Page layout, margins, typography, colors, and theme tokens.
- Export helpers that turn a coaching plan into a PDF document.
- Shared PDF utilities used by multiple sections.

Mario should edit this folder when changing global PDF styling, page layout, document metadata, or export behavior. Edit `sections/` for individual content blocks inside the PDF.

## v1 behavior

PDFs are generated only after the associated coaching plan review state is `approved`. The
`/api/coaching/generate-pdf` route renders the approved plan on demand and returns the PDF bytes
directly as an `application/pdf` attachment response.

The v1 flow intentionally does not upload PDFs to Firebase Storage and does not require a
`PDF_STORAGE_BUCKET` environment variable. Persistent PDF metadata is deferred because there is no
stable storage path or reusable download URL to record while downloads are generated on demand.
