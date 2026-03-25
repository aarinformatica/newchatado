document.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('card');
    const authSection = document.getElementById('authSection');
    const chatSection = document.getElementById('chatSection');
    const nameInput = document.getElementById('userName');
    const startBtn = document.getElementById('startBtn');
    const userIcon = document.getElementById('userIcon');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const themeBtn = document.getElementById('themePickerBtn');
    const themeMenu = document.getElementById('themeMenu');
    const onlineCounterBtn = document.getElementById('onlineCounterBtn');
    const presenceMenu = document.getElementById('presenceMenu');
    const userListUl = document.getElementById('userList');
    const onlineCountSpan = document.getElementById('onlineCount');
    const typingIndicator = document.getElementById('typingIndicator');
    const typingText = document.getElementById('typingText');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiMenu = document.getElementById('emojiMenu');

    let myUserName = "";
    let ably, channel;
    let typingTimer;

    // --- LÓGICA DE PARTÍCULAS ---
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];

    function initParticles() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        let themeColor = getComputedStyle(document.body).getPropertyValue('--accent').trim();
        if (!themeColor) themeColor = '#3b82f6'; 

        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                size: Math.random() * 2 + 0.5,
                color: themeColor
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.5;
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    initParticles(); animate();

    // --- LOGICA ABLY ---
    function initAbly(username) {
        ably = new Ably.Realtime({
            key: 'zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o',
            clientId: username
        });
        channel = ably.channels.get('chat-room');

        channel.subscribe('message', (msg) => {
            const isMe = msg.clientId === username;
            renderMessage(msg.data.text, msg.clientId, isMe);
        });

        channel.presence.subscribe(['enter', 'leave', 'present', 'update'], () => {
            channel.presence.get((err, members) => {
                if (!err) {
                    updatePresenceUI(members);
                    updateTypingUI(members);
                }
            });
        });

        renderMessage(`BEM-VINDO, ${username.toUpperCase()}!`, "Sistema", false, true);
        channel.presence.enter();
    }

    function updatePresenceUI(members) {
        onlineCountSpan.innerText = members.length;
        userListUl.innerHTML = "";
        members.forEach(m => {
            const li = document.createElement('li');
            li.innerHTML = `<div class="dot"></div> ${m.clientId} ${m.clientId === myUserName ? '(Você)' : ''}`;
            userListUl.appendChild(li);
        });
    }

    function updateTypingUI(members) {
        const typers = members.filter(m => m.data && m.data.isTyping && m.clientId !== myUserName).map(m => m.clientId);
        if (typers.length > 0) {
            typingText.innerText = typers.length === 1 ? `${typers[0]} está digitando...` : `${typers.length} pessoas estão digitando...`;
            typingIndicator.classList.add('visible');
        } else {
            typingIndicator.classList.remove('visible');
        }
    }

    function renderMessage(text, sender, isMe, isWelcome = false) {
        const msgDiv = document.createElement('div');
        if (isWelcome) {
            msgDiv.className = `msg system welcome-fx`;
            msgDiv.innerHTML = `<i class="fa-solid fa-star"></i> ${text} <i class="fa-solid fa-star"></i>`;
        } else {
            msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
            if (isMe) { msgDiv.innerText = text; } 
            else { msgDiv.innerHTML = `<small style="display:block; font-size:0.6rem; opacity:0.6; margin-bottom:2px;">${sender}</small>${text}`; }
        }
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- EMOJIS ---
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiMenu.classList.toggle('open');
    });

    document.querySelectorAll('.emoji-item').forEach(emoji => {
        emoji.addEventListener('click', () => {
            chatInput.value += emoji.innerText;
            emojiMenu.classList.remove('open');
            chatInput.focus();
        });
    });

    // --- EVENTOS ---
    chatInput.addEventListener('input', () => {
        if(channel) channel.presence.update({ isTyping: true });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => { if(channel) channel.presence.update({ isTyping: false }); }, 1500);
    });

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || !channel) return;
        channel.presence.update({ isTyping: false });
        channel.publish('message', { text: text });
        chatInput.value = '';
    }

    startBtn.addEventListener('click', () => {
        myUserName = nameInput.value.trim();
        if (myUserName.length < 3) return;
        document.getElementById('displayUserName').innerText = myUserName;
        initAbly(myUserName);
        themeBtn.classList.add('in-chat'); 
        authSection.classList.remove('active');
        setTimeout(() => {
            authSection.style.display = 'none';
            chatSection.style.display = 'flex';
            setTimeout(() => chatSection.classList.add('active'), 50);
        }, 400);
    });

    logoutBtn.addEventListener('click', () => {
        if (ably) { channel.presence.leave(); ably.close(); }
        themeBtn.classList.remove('in-chat');
        chatSection.classList.remove('active');
        setTimeout(() => {
            chatSection.style.display = 'none';
            authSection.style.display = 'flex';
            nameInput.value = ''; myUserName = "";
            startBtn.disabled = true;
            chatMessages.innerHTML = '';
            setTimeout(() => authSection.classList.add('active'), 50);
        }, 400);
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());

    themeBtn.addEventListener('click', (e) => { e.stopPropagation(); themeMenu.classList.toggle('open'); presenceMenu.classList.remove('open'); emojiMenu.classList.remove('open'); });
    onlineCounterBtn.addEventListener('click', (e) => { e.stopPropagation(); presenceMenu.classList.toggle('open'); themeMenu.classList.remove('open'); emojiMenu.classList.remove('open'); });
    
    document.addEventListener('click', () => { 
        themeMenu.classList.remove('open'); 
        presenceMenu.classList.remove('open'); 
        emojiMenu.classList.remove('open');
    });
    
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.body.className = `theme-${opt.dataset.theme}`;
            document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
            opt.classList.add('active');
            initParticles();
        });
    });

    window.addEventListener('resize', initParticles);
    window.addEventListener('mousemove', (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 80;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 80;
        if(card) card.style.transform = `rotateY(${xAxis}deg) rotateX(${-yAxis}deg)`;
    });

    nameInput.addEventListener('input', () => {
        startBtn.disabled = nameInput.value.trim().length < 3;
        nameInput.value.trim().length >= 3 ? userIcon.classList.add('active-user') : userIcon.classList.remove('active-user');
    });
});
