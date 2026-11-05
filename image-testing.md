# IMAGE INTEGRATION TEST RULES (from integration playbook)
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — objects, edges, textures, or shadows.
- If the image is not PNG/JPEG/WEBP, transcode to PNG or JPEG before upload and re-detect the MIME.
- If the image is animated (GIF, APNG, WEBP animation), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

App context: pothole report images are POSTed as multipart to `/api/ai/analyze-pothole` and `/api/reports`, and after-repair proof to `/api/reports/{id}/complete`. Test images should look like road surfaces with/without potholes.
