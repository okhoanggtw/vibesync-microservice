const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());


const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/music_db';

mongoose.connect(MONGO_URL)
    .then(() => console.log('✅ Music Service đã kết nối MongoDB'))
    .catch(err => console.error('❌ Lỗi kết nối DB:', err));

// Lưu lịch sử bài đã phát trong phòng
const SongSchema = new mongoose.Schema({
    trackId:    String,
    trackName:  String,
    artistName: String,
    coverUrl:   String,
    previewUrl: String,
    playedAt:   { type: Date, default: Date.now }
});
const Song = mongoose.model('Song', SongSchema);

// GET /songs — Lấy lịch sử 20 bài gần nhất
app.get('/songs', async (req, res) => {
    const songs = await Song.find().sort({ playedAt: -1 }).limit(20);
    res.send(songs);
});

// POST /songs — Lưu bài vừa phát vào lịch sử
app.post('/songs', async (req, res) => {
    const { trackId, trackName, artistName, coverUrl, previewUrl } = req.body;
    const song = new Song({ trackId, trackName, artistName, coverUrl, previewUrl });
    await song.save();
    res.status(201).send({ message: 'Đã lưu lịch sử!', song });
});

// GET /health
app.get('/health', (req, res) => res.send({ status: 'ok' }));

app.listen(3002, () => console.log('🚀 Music Service chạy tại cổng 3002'));
