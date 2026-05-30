const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Lưu trạng thái từng phòng
const rooms = {};
// rooms[roomId] = {
//   hostId: socket.id,         ← người đầu tiên vào = host
//   currentSong: {...},        ← bài đang phát
//   queue: [],                 ← hàng đợi
//   members: { socketId: username }
//   playback: { position: ms, isPlaying: bool, updatedAt: Date.now() }
// }

io.on('connection', (socket) => {
    console.log(`🔌 Kết nối: ${socket.id}`);

    socket.on('join-room', ({ roomId, username }) => {
        socket.join(roomId);

        // Tạo phòng nếu chưa có
        if (!rooms[roomId]) {
            rooms[roomId] = {
                hostId: socket.id,   // ← người đầu tiên = host
                currentSong: null,
                queue: [],
                members: {},
                playback: { position: 0, isPlaying: false, updatedAt: Date.now() }
            };
            console.log(`🏠 Phòng ${roomId} tạo mới — Host: ${username}`);
        }

        // Lưu thành viên
        rooms[roomId].members[socket.id] = username;

        const isHost = rooms[roomId].hostId === socket.id;

        // Thông báo vai trò cho người vừa vào
        socket.emit('role-assigned', {
            isHost,
            currentSong: rooms[roomId].currentSong,
            queue: rooms[roomId].queue,
            playback: rooms[roomId].playback
        });

        // Thông báo cho cả phòng có người mới vào
        socket.to(roomId).emit('sync-music', {
            action: 'user-joined',
            username
        });

        console.log(`👤 ${username} vào phòng ${roomId} — vai trò: ${isHost ? 'HOST' : 'LISTENER'}`);
    });

    socket.on('music-control', (data) => {
        const { roomId, action } = data;
        if (!rooms[roomId]) return;

        // Chỉ host mới được gửi lệnh change-song và sync-queue
        const isHost = rooms[roomId].hostId === socket.id;
        if ((action === 'change-song' || action === 'sync-queue') && !isHost) {
            console.log(`⛔ Listener ${socket.id} cố điều khiển — bị từ chối`);
            return; // Bỏ qua lệnh từ listener
        }

        // Cập nhật trạng thái phòng
        if (action === 'change-song') {
            rooms[roomId].currentSong = {
                id: data.trackId, name: data.trackName,
                artist: data.artistName, cover: data.coverUrl,
                preview: data.previewUrl
            };
            rooms[roomId].playback = { position: 0, isPlaying: true, updatedAt: Date.now() };
        }
        if (action === 'sync-queue') {
            rooms[roomId].queue = data.queue;
        }
        // Đồng bộ vị trí phát (host gửi mỗi giây)
        if (action === 'sync-playback' && isHost) {
            rooms[roomId].playback = {
                position: data.position,
                isPlaying: data.isPlaying,
                updatedAt: Date.now()
            };
        }
        // Tua nhạc từ host
        if (action === 'seek' && isHost) {
            rooms[roomId].playback = {
                position: data.position,
                isPlaying: true,
                updatedAt: Date.now()
            };
        }
        // Play/pause từ host
        if (action === 'play-pause' && isHost) {
            rooms[roomId].playback.isPlaying = data.isPlaying;
            rooms[roomId].playback.position = data.position;
            rooms[roomId].playback.updatedAt = Date.now();
        }

        console.log(`🎵 Phòng ${roomId} — ${action} (${isHost ? 'host' : 'listener'})`);

        // Broadcast cho tất cả NGƯỜI KHÁC trong phòng
        socket.to(roomId).emit('sync-music', data);
    });

    socket.on('disconnect', () => {
        // Nếu host rời phòng → chuyển host cho người tiếp theo
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.members[socket.id]) {
                const username = room.members[socket.id];
                delete room.members[socket.id];

                if (room.hostId === socket.id) {
                    const remaining = Object.keys(room.members);
                    if (remaining.length > 0) {
                        room.hostId = remaining[0];
                        const newHostName = room.members[remaining[0]];
                        // Thông báo host mới
                        io.to(room.hostId).emit('role-assigned', {
                            isHost: true,
                            currentSong: room.currentSong,
                            queue: room.queue
                        });
                        io.to(roomId).emit('sync-music', {
                            action: 'chat',
                            clientId: 'system',
                            user: 'Hệ thống',
                            text: `👑 ${newHostName} trở thành Host mới!`
                        });
                        console.log(`👑 Host mới: ${newHostName}`);
                    } else {
                        delete rooms[roomId];
                        console.log(`🗑️ Phòng ${roomId} đã xóa`);
                    }
                }
                console.log(`❌ ${username} rời phòng ${roomId}`);
            }
        }
    });
});

app.get('/health', (req, res) => res.send({ status: 'ok', rooms: Object.keys(rooms).length }));

server.listen(3003, () => console.log('🚀 Room Service chạy tại cổng 3003'));
