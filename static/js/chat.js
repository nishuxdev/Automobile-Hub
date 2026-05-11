/**
 * Chat Widget Module
 * Reusable by both customer and mechanic dashboards.
 * 
 * Usage:
 *   ChatWidget.open(bookingId, otherPartyName, currentUserId);
 *   ChatWidget.close();
 */
const ChatWidget = (function () {
    let _bookingId = null;
    let _currentUserId = null;
    let _otherName = '';
    let _pollTimer = null;
    let _lastMsgId = 0;
    let _isOpen = false;

    const token = () => localStorage.getItem('access_token');

    // ───────────── DOM Injection ─────────────
    function ensureDOM() {
        if (document.getElementById('chat-overlay')) return;

        const html = `
            <div id="chat-overlay" class="chat-overlay"></div>
            <div id="chat-panel" class="chat-panel">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-avatar" id="chat-avatar">💬</div>
                        <div>
                            <div class="chat-header-name" id="chat-header-name">Chat</div>
                            <div class="chat-header-sub" id="chat-header-sub">Booking Chat</div>
                        </div>
                    </div>
                    <button class="chat-close-btn" id="chat-close-btn" title="Close chat">✕</button>
                </div>
                <div class="chat-messages" id="chat-messages">
                    <div class="chat-empty">
                        <div class="chat-empty-icon">💬</div>
                        <div class="chat-empty-text">Start the conversation! Send a message below.</div>
                    </div>
                </div>
                <div class="chat-input-area">
                    <textarea class="chat-input" id="chat-input" placeholder="Type a message..." rows="1"></textarea>
                    <button class="chat-send-btn" id="chat-send-btn" title="Send">➤</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Bind events
        document.getElementById('chat-close-btn').addEventListener('click', close);
        document.getElementById('chat-overlay').addEventListener('click', close);
        document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
        document.getElementById('chat-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('chat-input').addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
    }

    // ───────────── Open / Close ─────────────
    function open(bookingId, otherPartyName, currentUserId) {
        ensureDOM();

        _bookingId = bookingId;
        _currentUserId = currentUserId;
        _otherName = otherPartyName || 'Chat';
        _lastMsgId = 0;

        // Set header
        document.getElementById('chat-header-name').textContent = _otherName;
        document.getElementById('chat-header-sub').textContent = `Booking #${bookingId}`;
        document.getElementById('chat-avatar').textContent = _otherName.charAt(0).toUpperCase();

        // Clear messages
        document.getElementById('chat-messages').innerHTML = `
            <div class="chat-empty">
                <div class="chat-empty-icon">💬</div>
                <div class="chat-empty-text">Start the conversation! Send a message below.</div>
            </div>
        `;

        // Show panel
        document.getElementById('chat-overlay').classList.add('open');
        document.getElementById('chat-panel').classList.add('open');
        _isOpen = true;

        // Load messages immediately then start polling
        fetchMessages(true);
        startPolling();

        // Focus input
        setTimeout(() => document.getElementById('chat-input').focus(), 400);
    }

    function close() {
        stopPolling();
        _isOpen = false;
        _bookingId = null;
        document.getElementById('chat-overlay').classList.remove('open');
        document.getElementById('chat-panel').classList.remove('open');
    }

    function isOpen() {
        return _isOpen;
    }

    // ───────────── Messaging ─────────────
    function fetchMessages(fullLoad) {
        if (!_bookingId) return;

        let url = `/auth/bookings/${_bookingId}/chat/`;
        if (!fullLoad && _lastMsgId > 0) {
            url += `?after=${_lastMsgId}`;
        }

        $.ajax({
            url: url,
            type: 'GET',
            headers: { 'Authorization': 'Bearer ' + token() },
            success: function (data) {
                const msgs = data.messages || [];
                if (msgs.length === 0 && fullLoad) return;

                if (fullLoad && msgs.length > 0) {
                    document.getElementById('chat-messages').innerHTML = '';
                }

                msgs.forEach(function (msg) {
                    appendMessage(msg);
                    if (msg.id > _lastMsgId) _lastMsgId = msg.id;
                });

                scrollToBottom();
            },
            error: function (xhr) {
                console.error('Chat fetch error:', xhr.status, xhr.responseText);
            }
        });
    }

    function sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text || !_bookingId) return;

        const sendBtn = document.getElementById('chat-send-btn');
        sendBtn.disabled = true;

        $.ajax({
            url: `/auth/bookings/${_bookingId}/chat/send/`,
            type: 'POST',
            headers: { 'Authorization': 'Bearer ' + token() },
            contentType: 'application/json',
            data: JSON.stringify({ message: text }),
            success: function (msg) {
                input.value = '';
                input.style.height = 'auto';
                appendMessage(msg);
                if (msg.id > _lastMsgId) _lastMsgId = msg.id;
                scrollToBottom();
                sendBtn.disabled = false;
                input.focus();
            },
            error: function (xhr) {
                console.error('Chat send error:', xhr.responseText);
                alert('Failed to send message.');
                sendBtn.disabled = false;
            }
        });
    }

    function appendMessage(msg) {
        const container = document.getElementById('chat-messages');
        // Remove empty state if present
        const empty = container.querySelector('.chat-empty');
        if (empty) empty.remove();

        // Check if message already exists (prevent duplicates)
        if (container.querySelector(`[data-msg-id="${msg.id}"]`)) return;

        const isSent = msg.sender === _currentUserId;
        const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const div = document.createElement('div');
        div.className = `chat-msg ${isSent ? 'sent' : 'received'}`;
        div.setAttribute('data-msg-id', msg.id);

        let senderLabel = '';
        if (!isSent) {
            senderLabel = `<div class="chat-msg-sender">${escapeHtml(msg.sender_name)}</div>`;
        }

        div.innerHTML = `
            ${senderLabel}
            <div>${escapeHtml(msg.message)}</div>
            <div class="chat-msg-meta">${time}</div>
        `;

        container.appendChild(div);
    }

    function scrollToBottom() {
        const el = document.getElementById('chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
    }

    // ───────────── Polling ─────────────
    function startPolling() {
        stopPolling();
        _pollTimer = setInterval(function () {
            if (_isOpen && _bookingId) {
                fetchMessages(false);
            }
        }, 3000);
    }

    function stopPolling() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    }

    // ───────────── Helpers ─────────────
    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Create a chat button element.
     * @param {number} bookingId
     * @param {string} otherName - Name of the other party
     * @param {number} currentUserId
     * @returns {string} HTML string for the chat button
     */
    function createChatButton(bookingId, otherName, currentUserId) {
        return `<button class="chat-fab" onclick="ChatWidget.open(${bookingId}, '${escapeHtml(otherName)}', ${currentUserId})">💬 Chat</button>`;
    }

    // ───────────── Public API ─────────────
    return {
        open: open,
        close: close,
        isOpen: isOpen,
        createChatButton: createChatButton,
    };
})();
