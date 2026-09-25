// src/components/Chat.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

export default function Chat({ chatMessages, onSendMessage, isBiddingPhase = false }) {
  const [isCollapsed, setIsCollapsed] = useState(Boolean(isBiddingPhase));
  const [text, setText] = useState('');
  const chatEndRef = useRef(null);

  // Automatically collapse chat when bidding starts, and expand when bidding ends
  useEffect(() => {
    setIsCollapsed(Boolean(isBiddingPhase));
  }, [isBiddingPhase]);

  useEffect(() => {
    if (!isCollapsed) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isCollapsed]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <div className={`chat-container ${isCollapsed ? 'chat-collapsed' : ''}`}>
      <div
        className="chat-header-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Click to expand chat log' : 'Click to collapse chat log'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#e5c158' }}>
          <MessageSquare size={16} /> ROOM CHAT & LOG
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.75rem' }}>
          <span className="chat-count-badge">{chatMessages.length} msgs</span>
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="chat-history">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="chat-msg">
                <span className="chat-sender">{msg.sender}:</span>
                <span>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-bar">
            <input
              type="text"
              className="chat-input"
              placeholder="Type message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="send-btn">
              <Send size={14} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
