# Spray GenX Image Inbox

Upload mixed image files here when you want GitHub to convert them into web-ready JPEG files.

Supported input types:

- HEIC
- HEIF
- JPG / JPEG
- PNG
- WEBP
- TIFF / TIF
- BMP
- GIF first frame

After upload, the GitHub Action converts files into:

```text
images/converted/
```

The conversion manifest is saved at:

```text
data/converted-images.json
```

Use this as a raw intake folder. The public image library still uses curated image blocks from `data/image-library.json`.
