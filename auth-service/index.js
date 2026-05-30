const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Đọc cấu hình từ biến môi trường (dùng khi chạy Docker)
// Nếu chạy local thì tự động dùng localhost
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/auth_db';
const JWT_SECRET = process.env.JWT_SECRET || 'microservices_music_secret_2024';

mongoose.connect(MONGO_URL)
    .then(() => console.log('✅ Auth Service đã kết nối MongoDB'))
    .catch(err => console.error('❌ Lỗi kết nối DB:', err));

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// POST /register — Đăng ký tài khoản mới
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).send({ message: 'Đăng ký thành công!' });
    } catch (error) {
        res.status(400).send({ error: 'Username đã tồn tại' });
    }
});

// POST /login — Đăng nhập, trả về JWT token
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });
        res.send({ message: 'Đăng nhập thành công', token });
    } else {
        res.status(401).send({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
});

app.listen(3001, () => console.log('🚀 Auth Service chạy tại cổng 3001'));
