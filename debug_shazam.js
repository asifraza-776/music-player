const fs = require("fs");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const { Shazam, s16LEToSamplesArray } = require("shazam-api");
const shazam = new Shazam();
const path = require("path");

async function testShazam() {
    console.log("Starting test...");
    // Let's create a known 5-second PCM file of a famous song using ffmpeg
    // e.g., Shape of You or something we download, but we don't have a source file here easily.
    // Instead we can use a built in windows sound just to see if shazam API returns properly.
    
    // Better, let's just download a 5 second snippet of a song via youtube-dl or yt-dlp.
    // Wait, let me just curl a sample mp3.
    const sampleUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    console.log("Downloading sample...");
    
    try {
        const fetch = require('node-fetch'); // If not available, use native fetch in latest node
    } catch(e) {}
    
    try {
        await execPromise(`curl -s ${sampleUrl} -o sample.mp3`);
        console.log("Converting to PCM...");
        await execPromise(`ffmpeg -v quiet -i sample.mp3 -t 5 -ar 16000 -ac 1 -f s16le sample.pcm -y`);
        
        console.log("Reading PCM...");
        const pcmData = fs.readFileSync("sample.pcm");
        console.log("PCM Data size:", pcmData.length);
        
        const samples = s16LEToSamplesArray(pcmData);
        console.log("Samples array length:", samples.length);
        
        console.log("Sending to Shazam...");
        const songData = await shazam.recognizeSong(samples);
        
        console.log("Result:", JSON.stringify(songData, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testShazam();
