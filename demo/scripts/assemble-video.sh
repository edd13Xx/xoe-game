#!/usr/bin/env bash
# Assemble the demo video from the Playwright clips made by capture-video.mjs.
# Usage: assemble-video.sh [clips_dir] [out.mp4]   (needs ffmpeg)
set -euo pipefail
C=${1:-/tmp/xoe-video/clips}
OUT=${2:-../../media/demo-flow-music.mp4}
M=$(dirname "$0")/../../media/xoe-theme.mp3
F="fps=30,format=yuv420p"
FONT=$(fc-match -f "%{file}" "DejaVu Sans:bold")
# scene lengths after speed-up (s): s0 3.6, s1 18.8, s2 23.7, s3 20.6 = 65.5 s total; 0.4 s crossfades
ffmpeg -y -v error \
  -i "$C/s0-intro.webm" -i "$C/s1-phone.webm" -i "$C/s2-desk.webm" -i "$C/s3-near.webm" -i "$M" -i "$M" \
  -filter_complex "
 [0:v]trim=0:5.4,setpts=(PTS-STARTPTS)/1.5,scale=1280:720,$F[v0];
 [1:v]trim=1:33,setpts=(PTS-STARTPTS)/1.7,fps=30,split[p1][p2];
 [p1]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=28:4,eq=brightness=-0.12:saturation=0.9,drawtext=fontfile=$FONT:text='Real gameplay':fontsize=44:fontcolor=white:x=60:y=300,drawtext=fontfile=$FONT:text='mech · colony · sim':fontsize=26:fontcolor=0xb9a6ff:x=60:y=360,drawtext=fontfile=$FONT:text='Testnet XOE · no real money':fontsize=26:fontcolor=0xb9a6ff:x=860:y=330[bg];
 [p2]scale=-2:720[ph];
 [bg][ph]overlay=(W-w)/2:0,$F[v1];
 [2:v]trim=2.4:38,setpts=(PTS-STARTPTS)/1.5,scale=1280:720,$F[v2];
 [3:v]trim=1.2:31.2,setpts=(PTS-STARTPTS)/1.4,scale=1280:720,$F[v3];
 [v0][v1]xfade=transition=fade:duration=0.4:offset=3.2[a];
 [a][v2]xfade=transition=fade:duration=0.4:offset=21.6[b];
 [b][v3]xfade=transition=fade:duration=0.4:offset=44.9[c];
 [c]fade=t=out:st=64.3:d=1.2[vout];
 [4:a][5:a]acrossfade=d=2,atrim=0:65.5,asetpts=PTS-STARTPTS,volume=0.9,afade=t=in:st=0:d=1.5,afade=t=out:st=61.7:d=3.8[aout]" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset slow -crf 22 -profile:v high -level 4.0 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart -t 65.5 "$OUT"
