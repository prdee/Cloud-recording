const puppeteer = require('puppeteer');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
});

const uploadToS3 = async (filePath) => {
    console.log(filePath)
    const fileContent = fs.readFileSync(filePath);
    const uploadParams = {
        Bucket: S3_BUCKET,
        Key: path.basename(filePath),
        Body: fileContent,
        ContentType: 'video/mp4',
    };

    try {
        const data = await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`File uploaded successfully. ${data.Location}`);
        return data;
    } catch (err) {
        console.error('Error uploading to S3:', err);
    }
};

const startRecordingSession = async (url, outputDir) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    let count = 0;
    const intervalId = setInterval(async () => {
        const screenshotPath = path.join(outputDir, `screenshot-${count}.png`);
        await page.screenshot({ path: screenshotPath });
        count += 1;
    }, 1000); // Take screenshot every second

    return { browser, intervalId, count, outputDir };
};

const stopRecordingSession = async (session, outputPath) => {
    clearInterval(session.intervalId);
    await session.browser.close();

    const screenshotsPattern = path.join(session.outputDir, 'screenshot-%d.png');
    const ffmpegCommand = `"${ffmpeg.path}" -framerate 1 -i "${screenshotsPattern}" -c:v libx264 -r 30 "${outputPath}"`;

    exec(ffmpegCommand, async (error, stdout, stderr) => {
        if (error) {
            console.error('Error creating video:', error);
            return;
        }
        console.log('Video created successfully');

        try {
            const uploadResult = await uploadToS3(outputPath);
            console.log('Uploaded to S3:', uploadResult);
        } catch (err) {
            console.error('Error uploading to S3:', err);
        }

        // Clean up screenshots
        fs.rmdirSync(session.outputDir, { recursive: true });
    });
};

module.exports = {
    startRecordingSession,
    stopRecordingSession
};
