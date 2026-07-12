#!/usr/bin/env python3
import sys
import os
import sqlite3
from PyQt6.QtCore import Qt, QUrl, QObject, pyqtSlot
from PyQt6.QtGui import QIcon
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel

# Chave fornecida do Ably
ABLY_API_KEY = "zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o"

# Configuração Inicial do Banco de Dados SQLite
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chatado.db")
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("CREATE TABLE IF NOT EXISTS contatos (username TEXT UNIQUE)")
conn.commit()

class ChatBridge(QObject):
    """Classe de comunicação para fazer a ponte entre o JavaScript e o Python SQLite"""
    
    @pyqtSlot(result=list)
    def obterContatos(self):
        """Busca todos os contatos salvos no SQLite"""
        try:
            cursor.execute("SELECT username FROM contatos")
            return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"Erro ao buscar contatos: {e}")
            return []

    @pyqtSlot(str)
    def salvarContato(self, username):
        """Salva um novo contato no SQLite (ignora se já existir)"""
        try:
            cursor.execute("INSERT OR IGNORE INTO contatos (username) VALUES (?)", (username,))
            conn.commit()
        except Exception as e:
            print(f"Erro ao salvar contato: {e}")


HTML_CONTENT = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chatado Premium</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.ably.com/lib/ably.min-1.js"></script>
    <!-- Script necessário para a comunicação QWebChannel do PyQt -->
    <script src="qrc:///qtwebchannel/qwebchannel.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }}

        body {{
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #03001e;
            background-image: 
                radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%),
                radial-gradient(at 50% 0%, hsla(225,39%,30%,0.3) 0, transparent 50%),
                radial-gradient(at 100% 0%, hsla(339,49%,30%,0.3) 0, transparent 50%),
                radial-gradient(at 100% 100%, hsla(253,16%,7%,1) 0, transparent 50%),
                radial-gradient(at 0% 100%, hsla(260,85%,40%,0.2) 0, transparent 50%);
            overflow: hidden;
            position: relative;
        }}

        .bg-overlay {{
            position: absolute;
            inset: 0;
            background: linear-gradient(rgba(18, 16, 35, 0) 0%, rgba(18, 16, 35, 0.4) 100%);
            z-index: 0;
        }}

        .card {{
            width: 95%;
            max-width: 950px;
            height: 620px;
            border-radius: 30px;
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.09);
            box-shadow: 0 30px 70px rgba(0, 0, 0, 0.6);
            z-index: 1;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }}

        /* TELA 1: LOGIN */
        #loginScreen {{
            width: 100%;
            max-width: 410px;
            padding: 2rem;
            text-align: center;
        }}

        .logo-container {{
            position: relative;
            width: 125px;
            height: 100px;
            margin: 0 auto 10px;
            display: flex;
            justify-content: center;
            align-items: center;
        }}

        .logo-badge {{
            font-size: 64px;
            background: linear-gradient(135deg, #ffffff 10%, #a855f7 65%, #06b6d4 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .logo-title {{
            font-size: 2.8rem;
            font-weight: 900;
            letter-spacing: -1.5px;
            margin-bottom: 12px;
        }}

        .title-wrapper {{
            background: linear-gradient(90deg, #00f2fe, #4facfe, #ff4ecf, #a855f7, #00f2fe);
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shineText 4s linear infinite;
        }}

        @keyframes shineText {{
            0% {{ background-position: 0% center; }}
            100% {{ background-position: 200% center; }}
        }}

        .subtitle {{
            color: #7e7c9c;
            font-size: 14px;
            margin-bottom: 35px;
            line-height: 1.5;
        }}

        .input-group {{
            margin-bottom: 24px;
            text-align: left;
        }}

        .input-label {{
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: #a855f7;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 8px;
            margin-left: 6px;
        }}

        .input-wrapper {{
            position: relative;
            border-radius: 16px;
            background: rgba(5, 3, 15, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }}

        .input-wrapper i {{
            position: absolute;
            left: 18px;
            top: 50%;
            transform: translateY(-50%);
            color: #4d496d;
            font-size: 16px;
        }}

        .input-field {{
            width: 100%;
            padding: 18px 18px 18px 52px;
            border: none;
            background: transparent;
            color: #ffffff;
            outline: none;
            font-size: 15px;
        }}

        .btn-enter {{
            width: 100%;
            padding: 18px;
            border: none;
            border-radius: 16px;
            background: linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #06b6d4 100%);
            color: white;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }}

        /* TELA 2: LOBBY */
        #lobbyScreen {{
            display: none;
            width: 100%;
            height: 100%;
        }}

        .split-container {{
            display: flex;
            width: 100%;
            height: 100%;
        }}

        .sidebar {{
            width: 340px;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            padding: 20px;
            background: rgba(5, 3, 15, 0.2);
        }}

        .lobby-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }}

        .lobby-title-mini {{
            font-size: 1.2rem;
            font-weight: 800;
            color: #fff;
        }}

        .add-contact-box {{
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
        }}

        .add-contact-input {{
            flex: 1;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.08);
            padding: 10px 12px;
            border-radius: 10px;
            color: white;
            font-size: 13px;
            outline: none;
        }}

        .btn-add-contact {{
            background: rgba(168, 85, 247, 0.2);
            border: 1px solid rgba(168, 85, 247, 0.4);
            color: #c084fc;
            padding: 0 14px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }}

        .btn-add-contact:hover {{
            background: #a855f7;
            color: white;
        }}

        .user-list {{
            list-style: none;
            flex: 1;
            overflow-y: auto;
            margin-bottom: 15px;
            padding-right: 5px;
        }}

        .user-list::-webkit-scrollbar, .chat-messages::-webkit-scrollbar {{
            width: 5px;
        }}
        .user-list::-webkit-scrollbar-thumb, .chat-messages::-webkit-scrollbar-thumb {{
            background: rgba(168, 85, 247, 0.2);
            border-radius: 10px;
        }}

        .user-item {{
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 14px;
            margin-bottom: 8px;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}

        .user-item:hover:not(.is-me) {{
            background: rgba(168, 85, 247, 0.1);
            border-color: rgba(168, 85, 247, 0.3);
        }}

        .user-item.active-chat {{
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(99, 102, 241, 0.2));
            border-color: rgba(168, 85, 247, 0.5);
        }}

        .user-item.is-me {{
            cursor: default;
            opacity: 0.6;
        }}

        .user-avatar {{
            width: 34px;
            height: 34px;
            background: linear-gradient(135deg, #4b5563, #374151);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
        }}

        .user-item.is-online .user-avatar {{
            background: linear-gradient(135deg, #6366f1, #a855f7);
        }}

        .user-name {{
            flex: 1;
            text-align: left;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}

        .user-status-dot {{
            width: 8px;
            height: 8px;
            background-color: #4b5563;
            border-radius: 50%;
        }}

        .user-item.is-online .user-status-dot {{
            background-color: #22c55e;
            box-shadow: 0 0 8px #22c55e;
        }}

        .user-me-badge {{
            font-size: 9px;
            background: rgba(168, 85, 247, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
            color: #c084fc;
            font-weight: 700;
        }}

        .btn-disconnect {{
            width: 100%;
            padding: 12px;
            background: transparent;
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            border-radius: 12px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
        }}

        /* ÁREA DO CHAT */
        .chat-area {{
            flex: 1;
            display: flex;
            flex-direction: column;
            background: rgba(0, 0, 0, 0.15);
            position: relative;
        }}

        .chat-empty {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #4d496d;
            text-align: center;
            padding: 20px;
        }}

        .chat-empty i {{
            font-size: 50px;
            margin-bottom: 15px;
            background: linear-gradient(135deg, #4d496d, #2e2a47);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .chat-window {{
            display: none;
            flex-direction: column;
            height: 100%;
        }}

        .chat-header {{
            padding: 18px 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(5, 3, 15, 0.4);
        }}

        .chat-target-name {{
            color: #fff;
            font-weight: 600;
            font-size: 15px;
        }}

        .chat-messages {{
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }}

        .msg-line {{
            display: flex;
            width: 100%;
        }}

        .msg-line.me {{
            justify-content: flex-end;
        }}

        .msg-line.received {{
            justify-content: flex-start;
        }}

        .msg-bubble {{
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.4;
            color: #fff;
            word-break: break-word;
        }}

        .msg-line.me .msg-bubble {{
            background: linear-gradient(135deg, #a855f7, #6366f1);
            border-bottom-right-radius: 4px;
            box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
        }}

        .msg-line.received .msg-bubble {{
            background: rgba(255, 255, 255, 0.06);
            border-bottom-left-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }}

        .typing-line {{
            display: none;
            justify-content: flex-start;
            padding-left: 20px;
            margin-bottom: 8px;
        }}

        .typing-container {{
            display: flex;
            align-items: center;
            gap: 7px;
            background: rgba(168, 85, 247, 0.07);
            border: 1px solid rgba(168, 85, 247, 0.15);
            padding: 10px 18px;
            border-radius: 18px;
            border-bottom-left-radius: 4px;
        }}

        .typing-dots {{
            display: flex;
            gap: 4px;
        }}

        .typing-dots span {{
            width: 7px;
            height: 7px;
            background: #06b6d4;
            border-radius: 50%;
            display: inline-block;
            opacity: 0.3;
            animation: kineticWaveNeon 1.4s infinite ease-in-out both;
        }}

        .typing-dots span:nth-child(1) {{ animation-delay: 0s; }}
        .typing-dots span:nth-child(2) {{ animation-delay: 0.2s; background: #6366f1; }}
        .typing-dots span:nth-child(3) {{ animation-delay: 0.4s; background: #a855f7; }}

        @keyframes kineticWaveNeon {{
            0%, 100% {{ transform: translateY(0) scale(1); opacity: 0.3; }}
            35% {{ transform: translateY(-7px) scale(1.3); opacity: 1; filter: drop-shadow(0 0 5px #a855f7); }}
            70% {{ transform: translateY(3px) scale(0.95); opacity: 0.5; }}
        }}

        .chat-footer {{
            padding: 15px 20px;
            background: rgba(5, 3, 15, 0.4);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }}

        .chat-input-wrapper {{
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 14px;
            padding: 6px 6px 6px 16px;
            align-items: center;
        }}

        .chat-input {{
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 14px;
        }}

        .btn-send {{
            background: #a855f7;
            border: none;
            width: 38px;
            height: 38px;
            border-radius: 10px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
    </style>
</head>
<body>

<div class="bg-overlay"></div>

<div class="card">
    <!-- TELA 1: LOGIN -->
    <div id="loginScreen">
        <div class="logo-container">
            <i class="fa-solid fa-comments logo-badge"></i>
        </div>
        <h1 class="logo-title"><span class="title-wrapper">Chatado</span></h1>
        <p class="subtitle">Insira o seu nome para acessar o chat. O sufixo será colocado automaticamente.</p>

        <div class="input-group">
            <label class="input-label">Nome de Usuário</label>
            <div class="input-wrapper">
                <i class="fa-solid fa-user"></i>
                <input 
                    id="usernameInput"
                    class="input-field" 
                    type="text" 
                    placeholder="Ex: alex" 
                    autocomplete="off">
            </div>
        </div>

        <button class="btn-enter" id="btnConnect">
            Acessar o Chat
            <i class="fa-solid fa-arrow-right"></i>
        </button>
    </div>

    <!-- TELA 2: LOBBY -->
    <div id="lobbyScreen">
        <div class="split-container">
            <div class="sidebar">
                <div class="lobby-header">
                    <div class="lobby-title-mini">Contatos</div>
                </div>

                <!-- CAMPO ADICIONAR NOVO USUÁRIO PERMANENTE -->
                <div class="add-contact-box">
                    <input type="text" id="addContactInput" class="add-contact-input" placeholder="Adicionar apelido...">
                    <button class="btn-add-contact" id="btnAddContact"><i class="fa-solid fa-user-plus"></i></button>
                </div>
                
                <ul class="user-list" id="usersContainer">
                    <!-- Contatos renderizados aqui -->
                </ul>

                <button class="btn-disconnect" id="btnLeave">Sair</button>
            </div>

            <div class="chat-area">
                <div class="chat-empty" id="chatEmptyState">
                    <i class="fa-solid fa-comments-blur"></i>
                    <h3>Nenhuma conversa activa</h3>
                    <p style="font-size: 13px; color: #5c597d; margin-top: 5px;">Selecione um usuário para iniciar o chat privado</p>
                </div>

                <div class="chat-window" id="chatWindow">
                    <div class="chat-header">
                        <div class="user-avatar" id="chatHeaderAvatar">--</div>
                        <div class="chat-target-name" id="chatHeaderName">Usuário</div>
                        <div class="user-status-dot" id="chatHeaderStatusDot"></div>
                    </div>

                    <div class="chat-messages" id="chatMessagesContainer"></div>

                    <div class="typing-line" id="typingIndicatorElement">
                        <div class="typing-container">
                            <div class="typing-dots"><span></span><span></span><span></span></div>
                        </div>
                    </div>

                    <div class="chat-footer">
                        <div class="chat-input-wrapper">
                            <input type="text" id="chatInputField" class="chat-input" placeholder="Digite sua mensagem...">
                            <button class="btn-send" id="btnSendMessage"><i class="fa-solid fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    const ablyKey = "{ABLY_API_KEY}";
    let ably, presenceChannel, p2pChannel, myUsername, activeTargetUser = null;
    let typingTimeout = null, amITyping = false;
    let onlineUsersSet = new Set();
    let pyBridge = null; // Guardará o objeto do Python

    // Elementos da Interface
    const loginScreen = document.getElementById('loginScreen');
    const lobbyScreen = document.getElementById('lobbyScreen');
    const usernameInput = document.getElementById('usernameInput');
    const btnConnect = document.getElementById('btnConnect');
    const btnLeave = document.getElementById('btnLeave');
    const usersContainer = document.getElementById('usersContainer');
    const addContactInput = document.getElementById('addContactInput');
    const btnAddContact = document.getElementById('btnAddContact');
    
    const chatEmptyState = document.getElementById('chatEmptyState');
    const chatWindow = document.getElementById('chatWindow');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatHeaderStatusDot = document.getElementById('chatHeaderStatusDot');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');
    const chatInputField = document.getElementById('chatInputField');
    const btnSendMessage = document.getElementById('btnSendMessage');
    const typingIndicatorElement = document.getElementById('typingIndicatorElement');

    // Inicialização do Canal de comunicação com Python
    new QWebChannel(qt.webChannelTransport, function (channel) {{
        pyBridge = channel.objects.pyBridge;
    }});

    // FLUXO DE LOGIN COM AUTO-COMPLETAR @CHATEADO
    btnConnect.addEventListener('click', () => {{
        let inputRaw = usernameInput.value.trim().toLowerCase();
        
        if (!inputRaw) {{
            alert('Por favor, insira um nome válido.');
            return;
        }}

        const nomeBase = inputRaw.split('@')[0];
        myUsername = `${{nomeBase}}@chateado`;

        btnConnect.disabled = true;
        btnConnect.innerHTML = 'Conectando...';

        try {{
            ably = new Ably.Realtime({{ key: ablyKey, clientId: myUsername }});
            presenceChannel = ably.channels.get('chatado:lobby');
            p2pChannel = ably.channels.get(`chatado:private:${{myUsername}}`);
            
            p2pChannel.subscribe('message', (msg) => receberMensagemPrivada(msg.data));
            p2pChannel.subscribe('typing-status', (msg) => {{
                if (activeTargetUser && msg.data.remetente === activeTargetUser) {{
                    msg.data.status === 'typing' ? mostrarIndicadorDigitando() : ocultarIndicadorDigitando();
                }}
            }});

            presenceChannel.presence.subscribe(() => sincronizarPresencaAtiva());

            presenceChannel.presence.enter('online', (err) => {{
                if(err) {{
                    alert('Erro de conexão à rede.');
                    resetLoginBtn();
                    return;
                }}
                
                // Grava o próprio usuário gerado no SQLite via Python
                if (pyBridge) {{
                    pyBridge.salvarContato(myUsername);
                }}
                
                loginScreen.style.display = 'none';
                lobbyScreen.style.display = 'block';
                sincronizarPresencaAtiva();
            }});

        }} catch (error) {{
            alert('Falha interna ao inicializar.');
            resetLoginBtn();
        }}
    }});

    // ADICIONAR NOVO CONTATO MANUALMENTE COM AUTO-COMPLETAR
    btnAddContact.addEventListener('click', () => {{
        let targetRaw = addContactInput.value.trim().toLowerCase();
        if(!targetRaw || !pyBridge) return;

        const nomeBase = targetRaw.split('@')[0];
        const targetFormatado = `${{nomeBase}}@chateado`;

        // Busca assincronamente a lista atualizada do SQLite para validar duplicidade
        pyBridge.obterContatos((salvos) => {{
            if(salvos.includes(targetFormatado)) {{
                alert('Este usuário já se encontra cadastrado em sua lista.');
                return;
            }}

            pyBridge.salvarContato(targetFormatado);
            addContactInput.value = '';
            renderizarListaContatosEstática();
        }});
    }});

    function sincronizarPresencaAtiva() {{
        if (!presenceChannel) return;
        presenceChannel.presence.get((err, members) => {{
            if (err) return console.error(err);
            
            onlineUsersSet.clear();
            members.forEach(m => onlineUsersSet.add(m.clientId));

            renderizarListaContatosEstática();
        }});
    }}

    function renderizarListaContatosEstática() {{
        if (!pyBridge) return;
        
        // Pede a lista definitiva guardada no SQLite do Python
        pyBridge.obterContatos((contatosDefinitivos) => {{
            usersContainer.innerHTML = '';

            contatosDefinitivos.forEach((clientId) => {{
                const isMe = clientId === myUsername;
                const isOnline = onlineUsersSet.has(clientId);

                const li = document.createElement('li');
                li.className = `user-item ${{isMe ? 'is-me' : ''}} ${{isOnline ? 'is-online' : ''}} ${{activeTargetUser === clientId ? 'active-chat' : ''}}`;
                
                const nomeExibicao = clientId.split('@')[0];
                const avatarLetras = nomeExibicao.substring(0, 2);
                
                li.innerHTML = `
                    <div class="user-avatar">${{avatarLetras}}</div>
                    <div class="user-name">
                        ${{nomeExibicao}}<span style="opacity: 0.35; font-size:11px;">@chateado</span>
                        ${{isMe ? ' <span class="user-me-badge">Você</span>' : ''}}
                    </div>
                    <div class="user-status-dot"></div>
                `;

                if (!isMe) {{
                    li.addEventListener('click', () => abrirChatCom(clientId, isOnline));
                }}

                usersContainer.appendChild(li);
            }});

            if(activeTargetUser) {{
                if(onlineUsersSet.has(activeTargetUser)) {{
                    chatHeaderStatusDot.style.backgroundColor = '#22c55e';
                }} else {{
                    chatHeaderStatusDot.style.backgroundColor = '#4b5563';
                }}
            }}
        }});
    }}

    function abrirChatCom(targetUser, isOnline) {{
        activeTargetUser = targetUser;
        renderizarListaContatosEstática();

        chatHeaderName.innerText = targetUser;
        chatHeaderAvatar.innerText = targetUser.substring(0,2);

        chatEmptyState.style.display = 'none';
        chatWindow.style.display = 'flex';
        
        chatMessagesContainer.innerHTML = '';
        ocultarIndicadorDigitando();
        chatInputField.value = '';
        chatInputField.focus();
    }}

    function fecharChatAtual() {{
        activeTargetUser = null;
        chatWindow.style.display = 'none';
        chatEmptyState.style.display = 'flex';
    }}

    function enviarMensagemPrivada() {{
        const texto = chatInputField.value.trim();
        if(!texto || !activeTargetUser) return;

        notificarStatusDigitando('stopped');
        amITyping = false;
        clearTimeout(typingTimeout);

        const payload = {{ remetente: myUsername, texto: texto }};
        const destinoChannel = ably.channels.get(`chatado:private:${{activeTargetUser}}`);
        
        destinoChannel.publish('message', payload, (err) => {{
            if(err) return console.error(err);
            renderizarMensagem(texto, 'me');
            chatInputField.value = '';
            chatInputField.focus();
        }});
    }}

    function receberMensagemPrivada(data) {{
        if(activeTargetUser && data.remetente === activeTargetUser) {{
            ocultarIndicadorDigitando();
            renderizarMensagem(data.texto, 'received');
        }}
    }}

    function renderizarMensagem(texto, tipo) {{
        const divLine = document.createElement('div');
        divLine.className = `msg-line ${{tipo}}`;
        divLine.innerHTML = `<div class="msg-bubble">${{texto}}</div>`;
        chatMessagesContainer.appendChild(divLine);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }}

    chatInputField.addEventListener('input', () => {{
        if(!activeTargetUser) return;
        if(!amITyping) {{
            amITyping = true;
            notificarStatusDigitando('typing');
        }}
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {{
            amITyping = false;
            notificarStatusDigitando('stopped');
        }}, 1500);
    }});

    function notificarStatusDigitando(status) {{
        if(!activeTargetUser) return;
        const destinoChannel = ably.channels.get(`chatado:private:${{activeTargetUser}}`);
        destinoChannel.publish('typing-status', {{ remetente: myUsername, status: status }});
    }}

    function mostrarIndicadorDigitando() {{
        typingIndicatorElement.style.display = 'flex';
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }}

    function ocultarIndicadorDigitando() {{
        typingIndicatorElement.style.display = 'none';
    }}

    btnLeave.addEventListener('click', () => {{
        if (presenceChannel) {{
            presenceChannel.presence.leave(() => {{
                ably.close();
                lobbyScreen.style.display = 'none';
                loginScreen.style.display = 'block';
                fecharChatAtual();
                resetLoginBtn();
                usernameInput.value = '';
            }});
        }}
    }});

    function resetLoginBtn() {{
        btnConnect.disabled = false;
        btnConnect.innerHTML = 'Acessar o Chat <i class="fa-solid fa-arrow-right"></i>';
    }}

    btnSendMessage.addEventListener('click', enviarMensagemPrivada);
    chatInputField.addEventListener('keypress', (e) => {{ if(e.key === 'Enter') enviarMensagemPrivada(); }});
</script>

</body>
</html>
"""

class ChatadoApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Chatado")
        self.resize(950, 650)
        self.setMinimumSize(850, 580)
        
        caminho_icone = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo.png")
        if os.path.exists(caminho_icone):
            self.setWindowIcon(QIcon(caminho_icone))
        
        self.browser = QWebEngineView()
        self.browser.setStyleSheet("background: transparent;")
        
        # Configurando o canal de comunicação (Bridge) antes do carregamento do HTML
        self.channel = QWebChannel()
        self.bridge = ChatBridge()
        self.channel.registerObject("pyBridge", self.bridge)
        self.browser.page().setWebChannel(self.channel)
        
        self.browser.setHtml(HTML_CONTENT, QUrl("https://cdnjs.cloudflare.com/"))
        self.browser.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.setCentralWidget(self.browser)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    caminho_logo_global = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logo.png")
    if os.path.exists(caminho_logo_global):
        app.setWindowIcon(QIcon(caminho_logo_global))
        if sys.platform == "win32":
            import ctypes
            myappid = "meuapp.chatadopremium.v1.0"
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)

    janela = ChatadoApp()
    janela.show()
    sys.exit(app.exec())
