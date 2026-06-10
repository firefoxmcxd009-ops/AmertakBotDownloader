#!/usr/bin/env bash
set -o errexit

npm install

mkdir -p bin

curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod a+rx bin/yt-dlp

curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz
tar -xf ffmpeg.tar.xz
mv ffmpeg-*-amd64-static/ffmpeg bin/
mv ffmpeg-*-amd64-static/ffprobe bin/
chmod a+rx bin/ffmpeg bin/ffprobe

rm -rf ffmpeg.tar.xz ffmpeg-*-amd64-static
