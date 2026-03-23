// --- VARIÁVEIS GLOBAIS DE ESTADO ---
let ably, channel;
let currentRole = "user";
let currentUsername = "";
let typingTimer;
let f5Blocked = false;

// --- 1. INJEÇÃO DE CSS (UI, MODAIS E SISTEMA SUPREMO) ---
const style = document.createElement('style');
style.innerHTML = `
    #supremo-alert-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); display: none; align-items: center; justify-content: center;
        z-index: 10000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; color: white;
    }
    .supremo-content {
        background: #050505; border: 2px solid #00ff88; padding: 40px;
        border-radius: 20px; box-shadow: 0 0 30px #00ff88; max-width: 450px; position: relative;
    }
    .close-modal-master {
        position: absolute; top: 20px; right: 25px; font-size: 32px;
        color: #00ff88; cursor: pointer; font-weight: bold; transition: 0.3s;
        z-index: 10001;
    }
    .close-modal-master:hover { color: #fff; transform: scale(1.2) rotate(90deg); }
    
    .user-item-float { 
        display: flex; align-items: center; gap: 12px; padding: 12px; 
        border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff !important; 
    }
    .mini-av { 
        width: 35px; height: 35px; background: #00ff88; color: #000; 
        border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; 
    }
    #typing-monitor { 
        font-style: italic; font-size: 0.85em; color: #00ff88; min-height: 1.5em; padding-left: 15px; margin-bottom: 8px;
    }
    .btn-kick { 
        background: #ff8800; color: #000; border: none; padding: 5px 10px; 
        cursor: pointer; font-size: 0.75em; font-weight: bold; border-radius: 4px; 
    }
    .btn-f5-lock { 
        background: #333; color: #fff; border: none; padding: 5px 10px; 
        cursor: pointer; font-size: 0.75em; font-weight: bold; border-radius: 4px; 
    }
    .btn-f5-lock.active { background: #00ff88; color: #000; box-shadow: 0 0 10px #00ff88; }
    
    .modal.open { display: flex !important; }
    #side-menu.open { transform: translateX(0) !important; }
    
    #theme-loader {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 9999;
    }
    .admin-del { transition: 0.2s; }
    .admin-del:hover { color: #ff0000 !important; transform: scale(1.2); }
`;
document.head.appendChild(style);

// --- 2. SEGURANÇA DE TECLADO E NOTIFICAÇÕES ---
window.addEventListener('keydown', (e) => {
    if (f5Blocked && (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r'))) {
        e.preventDefault();
        window.showSupremoModal("SISTEMA BLOQUEADO", "Um administrador restringiu seu acesso às funções de atualização.");
    }
});

function inicializarNotificacoes() {
    if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}
function dispararNotificacao(msg) {
    if (document.visibilityState === "hidden" && Notification.permission === "granted") {
        const n = new Notification(`Mensagem de ${msg.clientId}`, {
            body: msg.data.texto,
            icon: "https://copilot.microsoft.com/th/id/BCO.ef5dee9c-b0aa-41cf-b7dc-bc84ef4f50e3.png"
        });
        n.onclick = () => { window.focus(); n.close(); };
    }
}
inicializarNotificacoes();

// --- 3. CRIAÇÃO DINÂMICA DE ELEMENTOS DE INTERFACE ---
const supremoAlert = document.createElement('div');
supremoAlert.id = "supremo-alert-modal";
supremoAlert.innerHTML = `
    <div class="supremo-content">
        <h2 id="supremo-target-name" style="margin-top:0; color:#00ff88;">AVISO</h2>
        <p id="supremo-msg-text" style="font-size:1.1em; line-height:1.5;"></p>
        <button onclick="window.fecharModalSupremo()" style="background:#00ff88; border:none; padding:12px 25px; cursor:pointer; font-weight:bold; margin-top:20px; border-radius:8px; text-transform:uppercase;">Entendido</button>
    </div>
`;
document.body.appendChild(supremoAlert);

window.showSupremoModal = (titulo, msg) => {
    document.getElementById('supremo-target-name').textContent = titulo;
    document.getElementById('supremo-msg-text').innerHTML = msg;
    document.getElementById('supremo-alert-modal').style.display = 'flex';
};
window.fecharModalSupremo = () => { document.getElementById('supremo-alert-modal').style.display = 'none'; };
window.fecharMaster = () => { 
    const m = document.getElementById('master-modal');
    if(m) { m.classList.remove('open'); m.style.display = 'none'; }
};

// --- 4. LÓGICA DE LOGIN E IDENTIFICAÇÃO DE CARGOS ---
const usernameInput = document.getElementById('username');
if (usernameInput) {
    usernameInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        const isAdmin = ['alex', 'arthur', 'leticia'].includes(val);
        const passContainer = document.getElementById('admin-pass');
        if (passContainer) passContainer.style.display = isAdmin ? 'block' : 'none';
    });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('username').value.trim();
        const pass = document.getElementById('admin-pass').value;
        const loader = document.getElementById('theme-loader');
        
        if (loader) loader.style.display = 'flex';

        // Inicialização do Ably
        ably = new Ably.Realtime({ key: 'zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o', clientId: name });
        channel = ably.channels.get('chat-geral');

        channel.presence.get((err, members) => {
            if ((members || []).some(m => m.clientId.toLowerCase() === name.toLowerCase())) {
                alert("Este usuário já está online no chat!");
                if (loader) loader.style.display = 'none';
                ably.close(); return;
            }
            
            const lowerName = name.toLowerCase();
            if (lowerName === 'alex' && pass === 'admin123') currentRole = "alex";
            else if (lowerName === 'arthur' && pass === 'brogiato123') currentRole = "arthur";
            else if (lowerName === 'leticia' && pass === 'leticiabrogiato') currentRole = "leticia";
            else currentRole = "user";

            currentUsername = name;
            confirmarEntrada();
        });
    };
}

// --- 5. TRANSIÇÃO DE TELA E CARREGAMENTO DE PERFIL (CORRIGIDO) ---
function confirmarEntrada() {
    // 1. Esconde login, mostra chat
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-area').style.display = 'flex';
    if (document.getElementById('theme-loader')) document.getElementById('theme-loader').style.display = 'none';

    // 2. Preenchimento Vital dos Perfis
    const displayTop = document.getElementById('user-display');
    const profileNameSide = document.getElementById('profile-name');
    const profileRoleSide = document.getElementById('profile-role');
    const statusText = document.getElementById('chat-status');

    if (displayTop) displayTop.textContent = currentUsername;
    if (profileNameSide) profileNameSide.textContent = currentUsername;
    if (profileRoleSide) profileRoleSide.textContent = currentRole.toUpperCase();
    if (statusText) statusText.textContent = `${currentRole.toUpperCase()} (ONLINE)`;

    // 3. Configuração do Painel Master
    const btnMaster = document.getElementById('btn-master-panel');
    const masterModal = document.getElementById('master-modal');

    if (['alex', 'arthur', 'leticia'].includes(currentRole)) {
        if (btnMaster) btnMaster.style.display = 'flex';
        
        const contentArea = masterModal ? (masterModal.querySelector('.modal-content') || masterModal.querySelector('.master-box')) : null;
        if (contentArea) {
            contentArea.innerHTML = `
                <span class="close-modal-master" onclick="window.fecharMaster()">&times;</span>
                <h3 style="color:#00ff88; margin-top:0; border-bottom:1px solid #333; padding-bottom:10px;">CONTROLE SUPREMO</h3>
                <div id="master-admin-tools"></div>
                <div id="master-list-area" style="margin-top:20px;">
                    <h4 style="color:#00ff88; font-size:0.8em; margin-bottom:10px;">USUÁRIOS CONECTADOS</h4>
                    <ul id="master-user-list" style="list-style:none; padding:0;"></ul>
                </div>
            `;
            
            if (currentRole === 'alex') {
                const tools = document.getElementById('master-admin-tools');
                tools.innerHTML = `
                    <div style="background:#111; padding:15px; border-radius:10px; border:1px solid #222; margin-bottom:15px;">
                        <h4 style="color:#00ff88; font-size:0.7em; margin-top:0;">GERENCIAMENTO REMOTO</h4>
                        <select id="alex-target-select" style="width:100%; background:#000; color:#fff; border:1px solid #00ff88; padding:8px; margin-bottom:10px; border-radius:5px;">
                            <option value="leticia">Letícia</option><option value="arthur">Arthur</option>
                        </select>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <input type="text" id="alex-new-name" placeholder="Novo nome..." style="flex:1; background:#000; color:#fff; border:1px solid #333; padding:8px; border-radius:5px;">
                            <button onclick="window.alexMudarNomeRemoto()" style="background:#00ff88; border:none; padding:8px 15px; cursor:pointer; font-weight:bold; border-radius:5px;">ALTERAR</button>
                        </div>
                        <select id="alex-theme-select" style="width:100%; background:#000; color:#fff; border:1px solid #333; padding:8px; margin-bottom:10px; border-radius:5px;">
                            <option value="theme-clean">Clean</option><option value="theme-dark">Dark</option>
                            <option value="theme-kitty">Kitty</option><option value="theme-neon">Neon</option>
                            <option value="theme-gamer">Gamer</option><option value="theme-xbox-bsod">Xbox BSOD</option>
                        </select>
                        <button onclick="window.alexMudarTemaRemoto()" style="width:100%; background:#00ff88; color:#000; border:none; padding:10px; font-weight:bold; cursor:pointer; border-radius:5px;">APLICAR TEMA REMOTO</button>
                    </div>
                    <button id="clear-all-btn" style="width:100%; background:#ff4444; color:white; font-weight:bold; border:none; padding:12px; cursor:pointer; border-radius:8px;">LIMPAR TODO O HISTÓRICO</button>
                `;
                document.getElementById('clear-all-btn').onclick = () => { if(confirm("Deseja apagar todas as mensagens para todos?")) channel.publish('clear-chat', {}); };
            }
        }
    }

    // 4. Entrada oficial no canal
    channel.presence.enter({ role: currentRole }, () => {
        setupSubscriptions();
        atualizarListas();
    });
}

// --- 6. COMUNICAÇÃO REALTIME E EVENTOS ABLY ---
function setupSubscriptions() {
    channel.subscribe((msg) => {
        const me = currentUsername.toLowerCase();
        
        // Comandos Administrativos
        if (msg.name === 'kick-user' && msg.data.target === currentUsername) {
            alert("Você foi desconectado pelo Administrador.");
            window.location.reload();
        }
        if (msg.name === 'lock-f5-user' && msg.data.target === currentUsername) {
            f5Blocked = msg.data.state;
        }
        if (msg.name === 'clear-chat') {
            document.getElementById('messages-container').innerHTML = '';
        }
        if (msg.name === 'punish-user' && msg.data.target === currentUsername) {
            if (['arthur', 'leticia'].includes(msg.data.sender) && me === 'alex') return;
            window.executarCastigo();
        }
        
        // Controle Remoto
        if (msg.name === 'change-remote-theme' && me === msg.data.targetUser) {
            document.body.className = msg.data.newTheme;
        }
        if (msg.name === 'change-remote-name' && me === msg.data.targetUser) {
            currentUsername = msg.data.newName;
            document.getElementById('user-display').textContent = currentUsername;
            if(document.getElementById('profile-name')) document.getElementById('profile-name').textContent = currentUsername;
            channel.presence.update({ role: currentRole });
        }
        
        // Monitor de Digitação
        if (msg.name === 'typing' && msg.data.username !== currentUsername) {
            const typingMonitor = document.getElementById('typing-monitor');
            if (typingMonitor) {
                typingMonitor.textContent = msg.data.username + " está digitando...";
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => { typingMonitor.textContent = ''; }, 2000);
            }
        }

        // Mensagens e Deleção
        if (msg.name === 'mensagem' && !document.getElementById(msg.id)) {
            renderizarMensagem(msg);
            if (msg.clientId !== currentUsername) dispararNotificacao(msg);
        }
        if (msg.name === 'delete-msg') {
            const el = document.getElementById(msg.data.id);
            if (el) el.remove();
        }
    });

    channel.presence.subscribe(['enter', 'leave', 'update'], () => atualizarListas());
}

// --- 7. GERENCIAMENTO DE USUÁRIOS E LISTAS ---
function atualizarListas() {
    channel.presence.get((err, members) => {
        const listGeral = document.getElementById('user-list');
        const listMaster = document.getElementById('master-user-list');
        const countDisplay = document.getElementById('online-count');
        
        if (listGeral) listGeral.innerHTML = '';
        if (listMaster) listMaster.innerHTML = '';
        if (countDisplay) countDisplay.textContent = (members || []).length;

        (members || []).forEach(m => {
            // Lista Lateral Simples
            const li = document.createElement('li');
            li.className = 'user-item-float';
            li.innerHTML = `<div class="mini-av">${m.clientId.charAt(0).toUpperCase()}</div><span>${m.clientId}</span>`;
            if (listGeral) listGeral.appendChild(li);

            // Lista do Painel Master com Ações
            if (listMaster && m.clientId !== currentUsername) {
                const mLi = document.createElement('li');
                mLi.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; background:#1a1a1a; margin-bottom:8px; border-radius:6px; border-left:4px solid #00ff88;";
                mLi.innerHTML = `
                    <span style="color:#fff; font-size:0.9em; font-weight:bold;">${m.clientId}</span>
                    <div style="display:flex; gap:6px;">
                        <button onclick="window.enviarCastigo('${m.clientId}')" style="background:#ff4444; color:#fff; border:none; padding:4px 8px; cursor:pointer; font-size:0.7em; font-weight:bold; border-radius:4px;">PUNIR</button>
                        <button onclick="window.enviarKick('${m.clientId}')" class="btn-kick">SAIR</button>
                        <button onclick="window.toggleF5('${m.clientId}', this)" class="btn-f5-lock">F5</button>
                    </div>
                `;
                listMaster.appendChild(mLi);
            }
        });
    });
}

// --- 8. FUNÇÕES GLOBAIS DE COMANDO (window.) ---
window.enviarKick = (target) => {
    if (target.toLowerCase() === 'alex') return alert("O Supremo é imune à expulsão!");
    if (confirm(`Tem certeza que deseja expulsar ${target}?`)) {
        channel.publish('kick-user', { target: target });
    }
};

window.toggleF5 = (target, btn) => {
    if (target.toLowerCase() === 'alex') return;
    const isActive = !btn.classList.contains('active');
    btn.classList.toggle('active');
    channel.publish('lock-f5-user', { target: target, state: isActive });
};

window.alexMudarNomeRemoto = () => {
    const target = document.getElementById('alex-target-select').value;
    const newName = document.getElementById('alex-new-name').value.trim();
    if (newName) {
        channel.publish('change-remote-name', { newName: newName, targetUser: target });
        document.getElementById('alex-new-name').value = '';
    }
};

window.alexMudarTemaRemoto = () => {
    const target = document.getElementById('alex-target-select').value;
    const theme = document.getElementById('alex-theme-select').value;
    channel.publish('change-remote-theme', { newTheme: theme, targetUser: target });
};

window.enviarCastigo = (target) => {
    if (target.toLowerCase() === 'alex') {
        window.showSupremoModal("AUDÁCIA!", "Tentar punir o Alex é um erro grave. O castigo foi refletido.");
        channel.publish('punish-user', { target: currentUsername, sender: 'SISTEMA' });
        return;
    }
    channel.publish('punish-user', { target: target, sender: currentRole });
};

window.executarCastigo = () => {
    const modal = document.getElementById('punish-modal');
    if (!modal) return;
    let count = 10;
    modal.classList.add('open');
    modal.style.display = 'flex';
    if (document.getElementById('msg-input')) document.getElementById('msg-input').disabled = true;
    
    const countdown = setInterval(() => {
        count--;
        const timerText = document.getElementById('punish-timer');
        if (timerText) timerText.textContent = count;
        if (count <= 0) {
            clearInterval(countdown);
            modal.classList.remove('open');
            modal.style.display = 'none';
            if (document.getElementById('msg-input')) document.getElementById('msg-input').disabled = false;
        }
    }, 1000);
};

// --- 9. EVENTOS DE INTERFACE E CLIQUES ---
document.addEventListener('click', (e) => {
    const el = e.target;

    if (el.closest('#menu-toggle')) {
        document.getElementById('side-menu').classList.toggle('open');
    } else if (!el.closest('#side-menu')) {
        document.getElementById('side-menu').classList.remove('open');
    }

    if (el.id === 'btn-sair' || el.closest('#btn-sair')) {
        if (confirm("Deseja desconectar sua sessão agora?")) {
            if (channel) channel.presence.leave();
            if (ably) ably.close();
            window.location.reload();
        }
    }
    
    if (el.closest('#btn-master-panel')) {
        const modal = document.getElementById('master-modal');
        if(modal) {
            modal.classList.add('open');
            modal.style.display = 'flex';
        }
    }

    if (el.closest('#open-themes-btn') || el.closest('#chat-theme-btn')) {
        document.getElementById('theme-modal').classList.add('open');
        document.getElementById('theme-modal').style.display = 'flex';
    }

    if (el.closest('.theme-opt-circle')) {
        const theme = el.closest('.theme-opt-circle').dataset.theme;
        document.body.className = theme;
        document.querySelectorAll('.modal').forEach(m => { m.classList.remove('open'); m.style.display = 'none'; });
    }

    if (el.classList.contains('modal') || el.classList.contains('close-modal') || el.classList.contains('close-modal-master')) {
        document.querySelectorAll('.modal').forEach(m => {
            m.classList.remove('open');
            m.style.display = 'none';
        });
    }
});

// --- 10. ENVIO E RENDERIZAÇÃO DE MENSAGENS ---
function enviarMensagem() {
    const input = document.getElementById('msg-input');
    if (input && input.value.trim()) {
        channel.publish('mensagem', { texto: input.value });
        input.value = '';
    }
}

if (document.getElementById('btn-enviar')) {
    document.getElementById('btn-enviar').onclick = enviarMensagem;
}

if (document.getElementById('msg-input')) {
    document.getElementById('msg-input').onkeydown = (e) => { if(e.key === 'Enter') enviarMensagem(); };
    document.getElementById('msg-input').oninput = () => {
        channel.publish('typing', { username: currentUsername });
    };
}

function renderizarMensagem(msg) {
    const container = document.getElementById('messages-container');
    const isMe = msg.clientId === currentUsername;
    const div = document.createElement('div');
    div.id = msg.id;
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    
    // Lógica de Permissão de Deleção
    let podeDeletar = (currentRole === 'alex') || (['arthur', 'leticia'].includes(currentRole) && msg.clientId.toLowerCase() !== 'alex');
    let lixeira = podeDeletar ? `<i class="fa-solid fa-trash-can admin-del" style="cursor:pointer; margin-left:12px; color:rgba(255,255,255,0.3); font-size:0.9em;" onclick="window.enviarDeletar('${msg.id}')"></i>` : '';
    
    div.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            ${!isMe ? `<small style="color:#00ff88; font-weight:bold; margin-bottom:4px; font-size:0.75em;">${msg.clientId}</small>` : ''}
            <div style="display:flex; align-items:center;">
                <span style="word-break:break-word;">${msg.data.texto}</span>
                ${lixeira}
            </div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.enviarDeletar = (id) => {
    channel.publish('delete-msg', { id: id });
};
