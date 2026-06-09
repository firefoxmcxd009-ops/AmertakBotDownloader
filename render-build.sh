#!/usr/bin/env bash

echo "Installing dependencies..."

apt-get update

apt-get install -y ffmpeg python3 python3-pip

pip3 install -U yt-dlp

npm install

echo "yt-dlp version:"
yt-dlp --version