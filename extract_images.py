#!/usr/bin/env python3
import zipfile
import os
from pathlib import Path

# Define paths
repo_root = Path(__file__).parent
zip_file = repo_root / "bassday" / "bass-day-ever-product-images.zip"
extract_to = repo_root / "bassday"

# Extract the ZIP file
if zip_file.exists():
    print(f"Extracting {zip_file}...")
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    print(f"Successfully extracted to {extract_to}")
    print("Extracted files:")
    for item in os.listdir(extract_to):
        item_path = extract_to / item
        if os.path.isfile(item_path):
            print(f"  - {item}")
else:
    print(f"ZIP file not found at {zip_file}")
