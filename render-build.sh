#!/usr/bin/env bash

echo "Installing yt-dlp..."

apt-get update

apt-get install -y ffmpeg python3 python3-pip

pip3 install -U yt-dlp

echo "yt-dlp version:"
yt-dlp --version

npm install