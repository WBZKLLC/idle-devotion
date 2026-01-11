#!/usr/bin/env bash
# reencode-cinematics.sh
# Re-encode hero cinematics to H.264 for web browser compatibility
#
# Usage: ./reencode-cinematics.sh [input_dir] [output_dir]
#
# Target format (maximum browser + mobile compatibility):
# - Video: H.264 (AVC), baseline profile, level 3.1
# - Audio: AAC-LC, 160kbps, stereo, 48kHz
# - Container: MP4 with faststart for instant playback
#
# Prerequisites: ffmpeg must be installed
#   macOS: brew install ffmpeg
#   Ubuntu: sudo apt install ffmpeg
#   Windows: choco install ffmpeg

set -euo pipefail

IN_DIR="${1:-./assets/videos/hero_5plus}"
OUT_DIR="${2:-./assets/videos/hero_5plus_h264}"

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed."
    echo "Install it with:"
    echo "  macOS:   brew install ffmpeg"
    echo "  Ubuntu:  sudo apt install ffmpeg"
    echo "  Windows: choco install ffmpeg"
    exit 1
fi

# Create output directory
mkdir -p "$OUT_DIR"

echo "================================================"
echo "Hero Cinematics Re-encoder (H.264 for Web)"
echo "================================================"
echo ""
echo "Input:  $IN_DIR"
echo "Output: $OUT_DIR"
echo ""

# Count files
file_count=$(find "$IN_DIR" -maxdepth 1 -name "*.mp4" | wc -l | tr -d ' ')
echo "Found $file_count MP4 files to process"
echo ""

# Process each file
processed=0
for f in "$IN_DIR"/*.mp4; do
    [ -e "$f" ] || continue
    
    base="$(basename "$f")"
    out="$OUT_DIR/$base"
    
    ((processed++))
    echo "[$processed/$file_count] Processing: $base"
    
    ffmpeg -y -i "$f" \
        -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p \
        -crf 20 -preset medium \
        -c:a aac -b:a 160k -ac 2 -ar 48000 \
        -movflags +faststart \
        -loglevel warning \
        "$out"
    
    # Show file size comparison
    original_size=$(stat -f%z "$f" 2>/dev/null || stat --printf="%s" "$f" 2>/dev/null)
    new_size=$(stat -f%z "$out" 2>/dev/null || stat --printf="%s" "$out" 2>/dev/null)
    
    if [ -n "$original_size" ] && [ -n "$new_size" ]; then
        orig_mb=$(echo "scale=2; $original_size / 1048576" | bc 2>/dev/null || echo "?")
        new_mb=$(echo "scale=2; $new_size / 1048576" | bc 2>/dev/null || echo "?")
        echo "    ✓ Done (${orig_mb}MB → ${new_mb}MB)"
    else
        echo "    ✓ Done"
    fi
done

echo ""
echo "================================================"
echo "Re-encoding complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Verify videos play in browser: open $OUT_DIR/*.mp4"
echo "2. Replace original assets:"
echo "   rm -rf $IN_DIR"
echo "   mv $OUT_DIR $IN_DIR"
echo "3. Commit changes and redeploy"
echo ""
