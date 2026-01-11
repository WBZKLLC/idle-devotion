#!/usr/bin/env bash
# verify-cinematics-codecs.sh
# Verify all cinematics use web-compatible codecs (H.264 + AAC)
#
# Usage: ./verify-cinematics-codecs.sh [directory]
#
# Expected codecs for web compatibility:
#   Video: h264 (AVC) with yuv420p pixel format
#   Audio: aac
#
# Prerequisites: ffprobe (comes with ffmpeg)
#   macOS: brew install ffmpeg
#   Ubuntu: sudo apt install ffmpeg

set -euo pipefail

DIR="${1:-./assets/videos/hero_5plus}"

echo "================================================"
echo "Hero Cinematics Codec Verification"
echo "================================================"
echo ""
echo "Directory: $DIR"
echo ""

# Check for ffprobe
if ! command -v ffprobe &> /dev/null; then
    echo "Error: ffprobe is not installed (comes with ffmpeg)."
    echo "Install it with:"
    echo "  macOS:   brew install ffmpeg"
    echo "  Ubuntu:  sudo apt install ffmpeg"
    exit 1
fi

bad=0
good=0
total=0

for f in "$DIR"/*.mp4; do
    [ -e "$f" ] || continue
    
    base="$(basename "$f")"
    ((total++))

    # Get video codec and pixel format
    vcodec="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of csv=p=0 "$f" 2>/dev/null | head -n 1)"
    
    # Get audio codec
    acodec="$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$f" 2>/dev/null | head -n 1)"

    # Check if web-compatible
    # vcodec line looks like: h264,yuv420p
    if [[ "$vcodec" == h264,*yuv420p* ]] && [[ "$acodec" == "aac" ]]; then
        echo "✅ $base"
        echo "   video: $vcodec | audio: $acodec"
        ((good++))
    else
        echo "❌ $base (NOT WEB-SAFE)"
        echo "   video: $vcodec | audio: $acodec"
        echo "   expected: h264,yuv420p | aac"
        ((bad++))
    fi
done

echo ""
echo "================================================"
echo "Summary: $good/$total web-compatible"
echo "================================================"

if [[ "$bad" -gt 0 ]]; then
    echo ""
    echo "⚠️  $bad file(s) need re-encoding for web playback."
    echo "Run: ./scripts/reencode-cinematics.sh"
    exit 1
fi

echo ""
echo "✅ All files are web-compatible!"
exit 0
