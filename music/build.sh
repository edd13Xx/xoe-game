#!/usr/bin/env bash
# Regenerate the XOE theme (mp3 + ogg) and the music demo video. Requires python3+numpy and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 music/make-theme.py /tmp/xoe-theme-raw.wav
LUFS=$(ffmpeg -hide_banner -nostats -i /tmp/xoe-theme-raw.wav -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
GAIN=$(python3 -c "print(round(-16 - ($LUFS), 2))")
AF="volume=${GAIN}dB,alimiter=limit=0.84:level=disabled"
ffmpeg -loglevel error -y -i /tmp/xoe-theme-raw.wav -af "$AF" -c:a libmp3lame -q:a 2 media/xoe-theme.mp3
ffmpeg -loglevel error -y -i /tmp/xoe-theme-raw.wav -af "$AF" -c:a libvorbis -q:a 5 media/xoe-theme.ogg
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 media/demo-flow.mp4)
FOUT=$(python3 -c "print(max(0, $DUR - 2.5))")
ffmpeg -loglevel error -y -i media/demo-flow.mp4 -stream_loop -1 -i media/xoe-theme.mp3 \
  -filter_complex "[1:a]atrim=0:${DUR},afade=t=in:st=0:d=1.5,afade=t=out:st=${FOUT}:d=2.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest media/demo-flow-music.mp4
echo done
