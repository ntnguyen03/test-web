const socket = io();

let playerBet = null;
let betAmount = 0;
let history = [];
let taiBets = [];
let xiuBets = [];
let balance = 0;
let playerName = '';
let diceResultData = null;
let previousBet = null;
let hasViewedResult = false;
let isLoggedIn = false;

// Âm thanh
const rollSound = document.getElementById('roll-sound');
const winSound = document.getElementById('win-sound');
const loseSound = document.getElementById('lose-sound');

// Hiển thị form đăng nhập
socket.on('requestAuth', () => {
    document.getElementById('auth-container').style.display = 'block';
});

// Xử lý đăng ký
function register() {
    const email = document.getElementById('register-email').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();

    if (!email || !username || !password) {
        document.getElementById('auth-error').textContent = 'Vui lòng điền đầy đủ thông tin!';
        return;
    }

    socket.emit('register', { email, username, password });
}

// Xử lý đăng nhập
function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        document.getElementById('auth-error').textContent = 'Vui lòng điền đầy đủ thông tin!';
        return;
    }

    socket.emit('login', { email, password });
}

// Chuyển đổi giữa form đăng nhập và đăng ký
function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('auth-error').textContent = '';
}

function showLoginForm() {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('auth-error').textContent = '';
}

// Xử lý phản hồi đăng nhập/đăng ký
socket.on('authSuccess', (data) => {
    playerName = data.username;
    balance = data.balance;
    isLoggedIn = true; // Đặt isLoggedIn thành true khi đăng nhập thành công
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    socket.emit('initGame');
});

socket.on('authError', (message) => {
    document.getElementById('auth-error').textContent = message;
});

// Khởi tạo trò chơi
socket.on('init', (data) => {
    balance = data.balance;
    document.getElementById('balance').textContent = balance.toLocaleString();
    taiBets = data.taiBets;
    xiuBets = data.xiuBets;
    document.getElementById('tai-bet').textContent = data.taiTotalBet.toLocaleString();
    document.getElementById('xiu-bet').textContent = data.xiuTotalBet.toLocaleString();
    document.getElementById('tai-players').innerHTML = `${data.taiPlayersCount} <img src="https://img.icons8.com/ios-filled/20/ffffff/user.png" alt="user">`;
    document.getElementById('xiu-players').innerHTML = `${data.xiuPlayersCount} <img src="https://img.icons8.com/ios-filled/20/ffffff/user.png" alt="user">`;
    document.getElementById('game-id').textContent = `#${data.sessionNumber}`;
    document.getElementById('timer').textContent = data.timer;
    updatePlayerBets();
});

// Cập nhật timer
socket.on('updateTimer', (timer) => {
    document.getElementById('timer').textContent = timer;
});

// Cập nhật danh sách cược
socket.on('updateBets', (data) => {
    taiBets = data.taiBets;
    xiuBets = data.xiuBets;
    document.getElementById('tai-bet').textContent = data.taiTotalBet.toLocaleString();
    document.getElementById('xiu-bet').textContent = data.xiuTotalBet.toLocaleString();
    document.getElementById('tai-players').innerHTML = `${data.taiPlayersCount} <img src="https://img.icons8.com/ios-filled/20/ffffff/user.png" alt="user">`;
    document.getElementById('xiu-players').innerHTML = `${data.xiuPlayersCount} <img src="https://img.icons8.com/ios-filled/20/ffffff/user.png" alt="user">`;
    document.getElementById('game-id').textContent = `#${data.sessionNumber}`;
    updatePlayerBets();
});

// Cập nhật số dư
socket.on('updateBalance', (newBalance) => {
    balance = newBalance;
    document.getElementById('balance').textContent = balance.toLocaleString();
});

// Hiển thị thông báo
socket.on('notification', (message) => {
    addNotification(message);
});

// Hiệu ứng lăn xúc xắc
socket.on('rollDice', () => {
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    const dice3 = document.getElementById('dice3');
    const diceResult = document.getElementById('dice-result');

    if (!hasViewedResult && previousBet && diceResultData) {
        const { total, result } = diceResultData;
        if (previousBet.choice === result) {
            balance += previousBet.amount * 2;
            socket.emit('updateBalance', balance);
            document.getElementById('bet-result').textContent = `Chúc mừng! Bạn đã thắng ${previousBet.amount.toLocaleString()}! Kết quả: ${total} (${result.toUpperCase()})`;
            if (isLoggedIn) winSound.play();
        } else {
            document.getElementById('bet-result').textContent = `Rất tiếc! Bạn đã thua ${previousBet.amount.toLocaleString()}. Kết quả: ${total} (${result.toUpperCase()})`;
            if (isLoggedIn) loseSound.play();
        }
        history.push({ session: diceResultData.sessionNumber, total: total, result: result.toUpperCase() });
        const historyList = document.getElementById('history-list');
        const li = document.createElement('li');
        li.textContent = `Phiên #${diceResultData.sessionNumber}: Tổng ${total} - ${result.toUpperCase()}`;
        historyList.insertBefore(li, historyList.firstChild);
    }

    // Chỉ thực hiện các hành động liên quan đến giao diện nếu đã đăng nhập
    if (isLoggedIn) {
        dice1.classList.add('rolling');
        dice2.classList.add('rolling');
        dice3.classList.add('rolling');
        diceResult.style.display = 'none';
        hasViewedResult = false;
        previousBet = playerBet ? { choice: playerBet, amount: betAmount } : null;
        playerBet = null;
        betAmount = 0;
        document.getElementById('bet-amount').value = '';
        document.getElementById('bet-input').style.display = 'none';
        rollSound.play(); // Âm thanh roll chỉ phát khi đã đăng nhập
        positionDiceRandomly();
    }
});

// Kết quả xúc xắc
socket.on('diceResult', (data) => {
    const { dice1, dice2, dice3, total, result, sessionNumber } = data;
    if (isLoggedIn) { // Chỉ cập nhật giao diện nếu đã đăng nhập
        document.getElementById('dice1').src = `${dice1}.jpg`;
        document.getElementById('dice2').src = `${dice2}.jpg`;
        document.getElementById('dice3').src = `${dice3}.jpg`;
        document.getElementById('dice1').classList.remove('rolling');
        document.getElementById('dice2').classList.remove('rolling');
        document.getElementById('dice3').classList.remove('rolling');
        document.getElementById('dice-result').textContent = total;
        document.getElementById('dice-result').style.display = 'block';
    }

    diceResultData = { total, result, sessionNumber };
    hasViewedResult = true;

    if (previousBet && isLoggedIn) { // Chỉ xử lý âm thanh nếu đã đăng nhập
        if (previousBet.choice === result) {
            balance += previousBet.amount * 2;
            socket.emit('updateBalance', balance);
            document.getElementById('bet-result').textContent = `Chúc mừng! Bạn đã thắng ${previousBet.amount.toLocaleString()}! Kết quả: ${total} (${result.toUpperCase()})`;
            winSound.play();
        } else {
            document.getElementById('bet-result').textContent = `Rất tiếc! Bạn đã thua ${previousBet.amount.toLocaleString()}. Kết quả: ${total} (${result.toUpperCase()})`;
            loseSound.play();
        }
    }

    if (isLoggedIn) { // Chỉ cập nhật lịch sử nếu đã đăng nhập
        history.push({ session: sessionNumber, total: total, result: result.toUpperCase() });
        const historyList = document.getElementById('history-list');
        const li = document.createElement('li');
        li.textContent = `Phiên #${sessionNumber}: Tổng ${total} - ${result.toUpperCase()}`;
        historyList.insertBefore(li, historyList.firstChild);
    }
});

// Phát âm thanh khi thắng/thua
socket.on('win', (amount) => {
    if (isLoggedIn) winSound.play();
});

socket.on('lose', (amount) => {
    if (isLoggedIn) loseSound.play();
});

// Hiển thị lỗi
socket.on('error', (message) => {
    document.getElementById('bet-result').textContent = message;
});

// Hiển thị tin nhắn chat
socket.on('chatMessage', (data) => {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${data.name}: ${data.message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

function showBetInput(choice) {
    playerBet = choice;
    document.getElementById('bet-input').style.display = 'block';
    document.getElementById('bet-result').textContent = `Bạn đang đặt cược cho ${choice.toUpperCase()}`;
}

function setBetAmount(amount) {
    document.getElementById('bet-amount').value = amount;
}

function confirmBet() {
    const amount = parseInt(document.getElementById('bet-amount').value) || 0;
    if (amount <= 0) {
        document.getElementById('bet-result').textContent = 'Vui lòng nhập số tiền cược hợp lệ!';
        return;
    }

    betAmount = amount;
    socket.emit('placeBet', { choice: playerBet, amount: betAmount });
}

function cancelBet() {
    playerBet = null;
    betAmount = 0;
    document.getElementById('bet-amount').value = '';
    document.getElementById('bet-input').style.display = 'none';
    document.getElementById('bet-result').textContent = '';
}

function updatePlayerBets() {
    const taiBetsList = document.getElementById('tai-bets-list');
    const xiuBetsList = document.getElementById('xiu-bets-list');
    taiBetsList.innerHTML = '';
    xiuBetsList.innerHTML = '';

    taiBets.forEach(bet => {
        const li = document.createElement('li');
        li.textContent = `${bet.name}: ${bet.amount.toLocaleString()}`;
        taiBetsList.appendChild(li);
    });

    xiuBets.forEach(bet => {
        const li = document.createElement('li');
        li.textContent = `${bet.name}: ${bet.amount.toLocaleString()}`;
        xiuBetsList.appendChild(li);
    });
}

function addNotification(message) {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notifications.insertBefore(notification, notifications.firstChild);
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chatMessage', message);
        chatInput.value = '';
    }
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function positionDiceRandomly() {
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    const dice3 = document.getElementById('dice3');
    const containerWidth = 100;
    const containerHeight = 100;
    const diceSize = 25;

    const positionDice = (dice) => {
        const maxX = containerWidth - diceSize;
        const maxY = containerHeight - diceSize;
        const randomX = Math.random() * maxX;
        const randomY = Math.random() * maxY;
        dice.style.left = `${randomX}px`;
        dice.style.top = `${randomY}px`;
    };

    positionDice(dice1);
    positionDice(dice2);
    positionDice(dice3);
}

function testAudio() {
    const rollSound = document.getElementById('roll-sound');
    rollSound.play().then(() => {
        console.log('Âm thanh lăn phát thành công');
    }).catch(err => {
        console.error('Lỗi phát âm thanh lăn:', err);
    });
}