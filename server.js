const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Kết nối MongoDB (thay connection string bằng của bạn)
mongoose.connect('mongodb+srv://admin:admin12345@taixiu.3vtek.mongodb.net/?retryWrites=true&w=majority&appName=taixiu', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Kết nối MongoDB thành công');
}).catch(err => {
    console.error('Lỗi kết nối MongoDB:', err);
});

// Định nghĩa schema cho người chơi
const playerSchema = new mongoose.Schema({
    playerId: String,
    name: String,
    balance: Number,
});

const Player = mongoose.model('Player', playerSchema);

app.use(express.static('public'));

let taiBets = [];
let xiuBets = [];
let timer = Math.floor(Math.random() * (40 - 20 + 1)) + 20;
let isRolling = false;
let sessionNumber = Math.floor(Math.random() * (999999 - 900000 + 1)) + 900000;
let taiTotalBet = Math.floor(Math.random() * (1000000000 - 500000000 + 1)) + 500000000;
let xiuTotalBet = Math.floor(Math.random() * (1000000000 - 500000000 + 1)) + 500000000;
let taiPlayersCount = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
let xiuPlayersCount = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;

function startTimer() {
    io.emit('updateTimer', timer);
    const countdown = setInterval(() => {
        timer--;
        io.emit('updateTimer', timer);
        if (timer <= 0) {
            clearInterval(countdown);
            rollDice();
        }
    }, 1000);
}

function rollDice() {
    if (isRolling) return;
    isRolling = true;

    io.emit('rollDice');

    setTimeout(async () => {
        const diceValue1 = Math.floor(Math.random() * 6) + 1;
        const diceValue2 = Math.floor(Math.random() * 6) + 1;
        const diceValue3 = Math.floor(Math.random() * 6) + 1;
        const total = diceValue1 + diceValue2 + diceValue3;
        const result = total >= 11 ? 'tai' : 'xiu';

        io.emit('diceResult', { dice1: diceValue1, dice2: diceValue2, dice3: diceValue3, total, result, sessionNumber });

        taiBets = [];
        xiuBets = [];
        taiTotalBet = Math.floor(Math.random() * (1000000000 - 500000000 + 1)) + 500000000;
        xiuTotalBet = Math.floor(Math.random() * (1000000000 - 500000000 + 1)) + 500000000;
        taiPlayersCount = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
        xiuPlayersCount = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
        sessionNumber++;
        timer = Math.floor(Math.random() * (40 - 20 + 1)) + 20;
        isRolling = false;

        io.emit('updateBets', { taiBets, xiuBets, taiTotalBet, xiuTotalBet, taiPlayersCount, xiuPlayersCount, sessionNumber });
        startTimer();
    }, 10000);
}

io.on('connection', async (socket) => {
    console.log('Người chơi mới kết nối:', socket.id);

    socket.emit('requestName');

    socket.on('setName', async (name) => {
        let player = await Player.findOne({ playerId: socket.id });
        if (!player) {
            const initialBalance = 10000000;
            player = new Player({ playerId: socket.id, name: name, balance: initialBalance });
            await player.save();
        } else {
            player.name = name;
            await player.save();
        }

        socket.emit('init', {
            playerId: socket.id,
            name: player.name,
            balance: player.balance,
            taiBets,
            xiuBets,
            taiTotalBet,
            xiuTotalBet,
            taiPlayersCount,
            xiuPlayersCount,
            sessionNumber,
            timer
        });

        io.emit('notification', `${player.name} đã tham gia trò chơi!`);
    });

    socket.on('placeBet', async (data) => {
        const player = await Player.findOne({ playerId: socket.id });
        if (data.amount > player.balance) {
            socket.emit('error', 'Số dư không đủ để đặt cược!');
            return;
        }

        player.balance -= data.amount;
        await player.save();

        if (data.choice === 'tai') {
            taiBets.push({ player: socket.id, name: player.name, amount: data.amount });
            taiTotalBet += data.amount;
            taiPlayersCount++;
        } else {
            xiuBets.push({ player: socket.id, name: player.name, amount: data.amount });
            xiuTotalBet += data.amount;
            xiuPlayersCount++;
        }

        io.emit('updateBets', { taiBets, xiuBets, taiTotalBet, xiuTotalBet, taiPlayersCount, xiuPlayersCount, sessionNumber });
        socket.emit('updateBalance', player.balance);
        io.emit('notification', `${player.name} đã đặt ${data.amount.toLocaleString()} vào ${data.choice.toUpperCase()}`);
    });

    socket.on('updateBalance', async (newBalance) => {
        const player = await Player.findOne({ playerId: socket.id });
        if (player) {
            player.balance = newBalance;
            await player.save();
            socket.emit('updateBalance', player.balance);
        }
    });

    socket.on('chatMessage', async (message) => {
        const player = await Player.findOne({ playerId: socket.id });
        io.emit('chatMessage', { name: player.name, message });
    });

    socket.on('disconnect', async () => {
        const player = await Player.findOne({ playerId: socket.id });
        if (player) {
            io.emit('notification', `${player.name} đã rời trò chơi!`);
        }
        console.log('Người chơi ngắt kết nối:', socket.id);
    });
});

startTimer();

server.listen(3000, () => {
    console.log('Server chạy tại http://localhost:3000');
});