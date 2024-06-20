import { AssemblyAI } from 'assemblyai';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import SrtParser from 'srt-parser-2';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Create a client instance
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_KEY,
});

// Specify the path to your local MP4 video file
const videoPath = './video.mp4';
const outputPath = './outputvideo.mp4';
const subtitlesPath = './subtitles.srt';

async function addData(videoPath, subtitlesPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions('-vf', `subtitles=${subtitlesPath}`)
      .save(outputPath)
      .on('end', () => {
        console.log('Subtitles added successfully!');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error adding subtitles:', err);
        reject(err);
      });
  });
}

async function createGifForSubtitleSegment(videoPath, start, duration, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .setStartTime(start)
      .duration(duration)
      .outputOptions('-vf', 'fps=10,scale=320:-1:flags=lanczos')
      .save(outputPath)
      .on('end', () => {
        console.log(`GIF created: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error creating GIF: ${outputPath}`, err);
        reject(err);
      });
  });
}

async function addSubtitlesAndCreateGifs() {
  try {
    // Transcribe the video
    const transcript = await client.transcripts.transcribe({ audio: videoPath });

    if (transcript.status === 'error') {
      throw new Error(transcript.error);
    }

    const subtitles = await client.transcripts.subtitles(transcript.id, 'srt');

    // Save the subtitles to a file
    fs.writeFileSync(subtitlesPath, subtitles);

    await addData(videoPath, subtitlesPath, outputPath);

    // Parse the subtitles
    const parser = new SrtParser();
    const subtitleSegments = parser.fromSrt(subtitles);

    // Create GIFs for each subtitle segment
    for (const segment of subtitleSegments) {
      const start = segment.startTime.replace(',', '.');
      const end = segment.endTime.replace(',', '.');
      const duration = ffmpegUtil.getDuration(start, end);

      const outputGifPath = path.join('gifs', `gif_${segment.id}.gif`);
      await createGifForSubtitleSegment(outputPath, start, duration, outputGifPath);
    }

  } catch (error) {
    console.error(error);
  }
}

const ffmpegUtil = {
  getDuration: (start, end) => {
    const startParts = start.split(':').map(parseFloat);
    const endParts = end.split(':').map(parseFloat);

    const startSeconds = startParts[0] * 3600 + startParts[1] * 60 + startParts[2];
    const endSeconds = endParts[0] * 3600 + endParts[1] * 60 + endParts[2];

    return endSeconds - startSeconds;
  }
};

async function cleanUp() {
  const directories = ['gifs'];
  const files = [subtitlesPath, videoPath, outputPath];

  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        fs.unlinkSync(filePath);
      });
      console.log(`Cleaned up directory: ${dir}`);
    }
  }

  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Deleted file: ${file}`);
    }
  }
}

// Ensure the gifs directory exists
if (!fs.existsSync('gifs')) {
  fs.mkdirSync('gifs');
}

async function main() {
  // await cleanUp();
  await addSubtitlesAndCreateGifs();
}

main();
