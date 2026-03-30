document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const authSection = document.getElementById('authSection'),
          chatSection = document.getElementById('chatSection'),
          nameInput = document.getElementById('userName'),
          startBtn = document.getElementById('startBtn'),
          userIcon = document.getElementById('userIcon'), 
          chatMessages = document.getElementById('chatMessages'),
          logoutBtn = document.getElementById('logoutBtn'),
          themeBtn = document.getElementById('themePickerBtn'),
          themeMenu = document.getElementById('themeMenu'),
          onlineCounterBtn = document.getElementById('onlineCounterBtn'),
          presenceMenu = document.getElementById('presenceMenu'),
          userListUl = document.getElementById('userList'),
          onlineCountSpan = document.getElementById('onlineCount'),
          typingIndicator = document.getElementById('typingIndicator'),
          typingText = document.getElementById('typingText'),
          inputArea = document.getElementById('inputArea'),
          activeContactHeader = document.getElementById('activeContactHeader'),
          targetNameSpan = document.getElementById('targetName');

    // --- ESTADO DO APP ---
    let myUserName = "", ably, channel, typingTimer, selectedUser = null;
    let chatHistory = {}, unreadCount = {};
    const emojis = ['😀','😂','😍','😎','🤔','🔥','🚀','✨','❤️','👍','🎮','🌈'];

    // --- SISTEMA DE PARTÍCULAS (CORES POR TEMA) ---
    const canvas = document.getElementById('particleCanvas'), ctx = canvas.getContext('2d');
    let particles = [];

    const themeParticleColors = {
        'dark': '#f1c40f',    // Dourado
        'light': '#3498db',   // Azul
        'neon': '#00f2ff',    // Ciano
        'sunset': '#ff4757',  // Vermelho Coral
        'forest': '#2ecc71',  // Verde
        'amethyst': '#a29bfe' // Lilás
    };

    function initParticles() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        
        const currentTheme = document.body.className.replace('theme-', '') || 'dark';
        const color = themeParticleColors[currentTheme] || '#3b82f6';

        for (let i = 0; i < 45; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                size: Math.random() * 1.8 + 0.5,
                color: color
            });
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.2;
            ctx.fill();
        });
        requestAnimationFrame(animateParticles);
    }

    // --- INJEÇÃO DO INPUT DINÂMICO ---
    function injectInput() {
        inputArea.style.display = 'flex';
        inputArea.innerHTML = ''; 

        const emojiMenu = document.createElement('div');
        emojiMenu.className = 'dynamic-emoji-menu';
        emojiMenu.style.display = 'none';
        emojis.forEach(symbol => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.innerText = symbol;
            span.onclick = (e) => {
                e.stopPropagation();
                const inp = document.getElementById('chatInput');
                if(inp) { inp.value += symbol; inp.focus(); }
            };
            emojiMenu.appendChild(span);
        });

        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'dynamic-emoji-btn';
        emojiBtn.innerHTML = '<i class="fa-regular fa-face-smile"></i>';
        emojiBtn.onclick = (e) => {
            e.stopPropagation();
            emojiMenu.style.display = emojiMenu.style.display === 'none' ? 'grid' : 'none';
        };

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'dynamic-input';
        input.id = 'chatInput';
        input.placeholder = 'Digite aqui...';
        input.autocomplete = 'off';

        const sendBtn = document.createElement('button');
        sendBtn.className = 'dynamic-btn-send';
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';

        inputArea.appendChild(emojiMenu);
        inputArea.appendChild(emojiBtn);
        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);

        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };
        
        input.oninput = () => {
            if (!channel || !selectedUser) return;
            channel.presence.update({ isTyping: true, typingTo: selectedUser });
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if(channel) channel.presence.update({ isTyping: false, typingTo: null });
            }, 1500);
        };

        setTimeout(() => {
            inputArea.classList.add('show');
            input.focus();
        }, 50);
    }

    function closeCurrentChat() {
        selectedUser = null;
        activeContactHeader.style.display = 'none';
        inputArea.classList.remove('show');
        inputArea.style.display = 'none';
        chatMessages.innerHTML = '<div class="msg system">Selecione um contato para conversar.</div>';
        refreshUI();
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-chat-btn';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.onclick = closeCurrentChat;
    activeContactHeader.appendChild(closeBtn);

    // --- LÓGICA ABLY ---
    function initAbly(username) {
        ably = new Ably.Realtime({ 
            key: 'zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o', 
            clientId: username 
        });
        channel = ably.channels.get('chat-room');

        channel.subscribe('message', (msg) => {
            const { text, to } = msg.data;
            const from = msg.clientId;
            const partner = (from === myUserName ? to : from);

            if (to === myUserName || from === myUserName) {
                if (!chatHistory[partner]) chatHistory[partner] = [];
                chatHistory[partner].push({ text, from, isMe: (from === myUserName) });

                if (partner === selectedUser) {
                    renderMessage(text, from, from === myUserName);
                } else {
                    unreadCount[partner] = (unreadCount[partner] || 0) + 1;
                    refreshUI();
                }
            }
        });

        channel.presence.subscribe(['enter', 'leave', 'present'], () => refreshUI());
        channel.presence.subscribe('update', updateTypingUI);
        channel.presence.enter();
        renderMessage(`LOGADO COMO: ${username.toUpperCase()}`, "Sistema", false, true);
    }

    function refreshUI() {
        if(!channel) return;
        channel.presence.get((err, members) => {
            if (err) return;
            onlineCountSpan.innerText = members.length;
            userListUl.innerHTML = "";
            members.forEach(m => { 
                if(m.clientId !== myUserName) renderListItem(m.clientId); 
            });
        });
    }

    function renderListItem(id) {
        const li = document.createElement('li');
        if (selectedUser === id) li.classList.add('selected');
        const count = unreadCount[id] || 0;
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="status-dot" style="background:#22c55e; width:8px; height:8px; border-radius:50%"></div>
                <span>${id}</span>
            </div>
            ${count > 0 ? `<span class="unread-badge pulse-effect">${count}</span>` : ''}
        `;

        li.onclick = () => {
            selectedUser = id; 
            unreadCount[id] = 0;
            chatMessages.innerHTML = '';
            targetNameSpan.innerText = id;
            activeContactHeader.style.display = 'flex';
            injectInput(); 
            if (chatHistory[id]) chatHistory[id].forEach(m => renderMessage(m.text, m.from, m.isMe));
            presenceMenu.classList.remove('open');
            refreshUI();
        };
        userListUl.appendChild(li);
    }

    function updateTypingUI() {
        if(!channel) return;
        channel.presence.get((err, members) => {
            const isTyping = members.find(m => m.clientId === selectedUser && m.data?.isTyping && m.data?.typingTo === myUserName);
            typingIndicator.classList.toggle('visible', !!isTyping);
            if(isTyping) typingText.innerText = `${selectedUser} está digitando...`;
        });
    }

    function renderMessage(text, sender, isMe, isSys = false) {
        const div = document.createElement('div');
        div.className = `msg ${isSys ? 'system' : (isMe ? 'sent' : 'received')}`;
        div.innerText = isMe ? text : `${isSys ? '' : sender + ': '}${text}`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text || !selectedUser) return;
        channel.publish('message', { text: text, to: selectedUser });
        input.value = '';
        input.focus();
    }

    // --- EVENTOS DE INTERFACE ---
    nameInput.oninput = () => {
        const v = nameInput.value.trim();
        startBtn.disabled = v.length < 3;
        userIcon.classList.toggle('active-user', v.length >= 3);
    };

    startBtn.onclick = () => {
        myUserName = nameInput.value.trim();
        initAbly(myUserName);
        document.getElementById('displayUserName').innerText = myUserName;
        authSection.classList.remove('active');
        setTimeout(() => {
            authSection.style.display = 'none';
            chatSection.style.display = 'flex';
            setTimeout(() => chatSection.classList.add('active'), 50);
        }, 400);
    };

    // --- CORREÇÃO DO BOTÃO SAIR ---
    logoutBtn.onclick = () => {
        if (ably) {
            if (channel) channel.presence.leave();
            ably.close();
            ably = null;
            channel = null;
        }
        
        chatSection.classList.remove('active');
        setTimeout(() => {
            chatSection.style.display = 'none';
            authSection.style.display = 'flex';
            authSection.classList.add('active');
            
            // Reset de Estado
            myUserName = ""; 
            nameInput.value = ""; 
            selectedUser = null;
            chatHistory = {}; 
            unreadCount = {}; 
            chatMessages.innerHTML = "";
            activeContactHeader.style.display = 'none'; 
            inputArea.style.display = 'none';
            onlineCountSpan.innerText = "0"; 
            userListUl.innerHTML = "";
        }, 400);
    };

    // --- LÓGICA DO MENU DE TEMAS ---
    themeBtn.onclick = (e) => { 
        e.stopPropagation(); 
        themeMenu.classList.toggle('open'); 
        
        // Sincroniza visualmente o botão selecionado ao abrir o menu
        const currentTheme = document.body.className.replace('theme-', '') || 'dark';
        document.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === currentTheme);
        });
    };

    onlineCounterBtn.onclick = (e) => { e.stopPropagation(); presenceMenu.classList.toggle('open'); };
    
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.onclick = () => {
            const theme = opt.dataset.theme;
            
            // Remove 'active' de todos e adiciona no selecionado
            document.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
            opt.classList.add('active');

            document.body.classList.add('theme-transitioning');
            document.body.className = `theme-${theme}`;
            themeMenu.classList.remove('open');
            
            setTimeout(() => {
                initParticles();
            }, 150);

            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, 600);
        };
    });

    document.addEventListener('click', () => {
        themeMenu.classList.remove('open');
        presenceMenu.classList.remove('open');
    });

    initParticles();
    animateParticles();
    window.onresize = initParticles;
});
