const express = require('express');
const path = require('path');
const { startRecordingSession, stopRecordingSession } = require('./recorder');
const app = express();
const port = process.env.PORT || 3000;

let recordingSession = null;
let outputFilePath = path.join(__dirname, 'recording.mp4');
let outputDir = path.join(__dirname, 'screenshots');

app.use(express.json());

app.post('/start', async (req, res) => {
    const url = req.body.url;
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        recordingSession = await startRecordingSession(url, outputDir);
        res.status(200).send('Recording started');
    } catch (err) {
        console.error('Error starting recording:', err);
        res.status(500).send('Error starting recording');
    }
});

app.post('/stop', async (req, res) => {
    if (!recordingSession) {
        return res.status(400).send('No recording session active');
    }

    try {
        await stopRecordingSession(recordingSession, outputFilePath);
        recordingSession = null;
        res.status(200).send('Recording stopped and uploaded');
    } catch (err) {
        console.error('Error stopping recording:', err);
        res.status(500).send('Error stopping recording');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
