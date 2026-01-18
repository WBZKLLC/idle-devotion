#!/bin/bash
# /app/scripts/reencode-cinematics.sh
# Phase 3.49: Re-encode all cinematics to supported format
#
# Target format: H.264 (baseline) + AAC audio in MP4 container
# This is the most widely supported format for mobile and web.
#
# Usage: bash /app/scripts/reencode-cinematics.sh
# Idempotent: safe to re-run (skips already-processed files)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cinematic Re-encoder ===${NC}"
echo "Target: H.264 (baseline) + AAC in MP4"
echo ""

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}ERROR: ffmpeg not found. Please install ffmpeg.${NC}"
    exit 1
fi

# Video directories to process
VIDEO_DIRS=(
    "/app/frontend/assets/videos/hero_5plus"
    "/app/frontend/assets/videos"
)

# Output suffix for reencoded files
REENCODED_SUFFIX="_h264"

processed=0
skipped=0
failed=0

for dir in "${VIDEO_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}SKIP: Directory not found: $dir${NC}"
        continue
    fi
    
    echo "Processing: $dir"
    
    # Find all video files
    find "$dir" -maxdepth 1 -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" -o -name "*.webm" \) | while read -r file; do
        filename=$(basename "$file")
        dirname=$(dirname "$file")
        name="${filename%.*}"
        ext="${filename##*.}"
        
        # Skip already reencoded files
        if [[ "$name" == *"$REENCODED_SUFFIX" ]] || [[ "$name" == *"_reencoded" ]]; then
            echo -e "  ${YELLOW}SKIP${NC}: $filename (already processed)"
            ((skipped++))
            continue
        fi
        
        # Check if file is already H.264
        codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "unknown")
        
        if [ "$codec" = "h264" ]; then
            # Check audio codec
            audio_codec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "none")
            
            if [ "$audio_codec" = "aac" ] || [ "$audio_codec" = "none" ]; then
                echo -e "  ${GREEN}OK${NC}: $filename (already H.264/AAC)"
                ((skipped++))
                continue
            fi
        fi
        
        # Re-encode to H.264 + AAC
        output="${dirname}/${name}${REENCODED_SUFFIX}.mp4"
        
        echo -e "  ${YELLOW}ENCODING${NC}: $filename -> ${name}${REENCODED_SUFFIX}.mp4"
        
        if ffmpeg -y -i "$file" \
            -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p \
            -c:a aac -b:a 128k \
            -movflags +faststart \
            "$output" 2>/dev/null; then
            
            # Replace original with reencoded version
            mv "$output" "$file"
            echo -e "  ${GREEN}DONE${NC}: $filename"
            ((processed++))
        else
            echo -e "  ${RED}FAILED${NC}: $filename"
            rm -f "$output" 2>/dev/null
            ((failed++))
        fi
    done
done

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Processed: $processed"
echo "Skipped: $skipped"
echo "Failed: $failed"

if [ $failed -gt 0 ]; then
    exit 1
fi

exit 0
