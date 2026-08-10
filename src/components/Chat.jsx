// src/components/Chat.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';

export default function Chat({ chatMessages, onSendMessage }) {
  const [text, setText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <div className="chat-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '0.85rem', color: '#e5c158', marginBottom: '8px' }}>
        <MessageSquare size={16} /> ROOM CHAT & LOG
      </div>

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
    </div>
  );
}
