import React, { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const DEFAULT_SYSTEM_PROMPT =
  'When responding with data, always use a structured format such as tables, bullet lists, or code blocks. Do not return long unformatted paragraphs.';

function linkify(text: string) {
  const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part && urlRegex.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return <a key={i} href={href} className="chat-link" target="_blank" rel="noopener noreferrer">{part}</a>;
    }
    return part;
  });
}

// For bot messages: convert URLs in HTML to clickable <a> tags with chat-link class
function linkifyHtml(html: string) {
  const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
  return html.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" class="chat-link" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Create a thread on first load
  useEffect(() => {
    const createThread = async () => {
      const res = await fetch('/api/thread', { method: 'POST' });
      const data = await res.json();
      setThreadId(data.threadId);
    };
    createThread();
  }, []);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId) return;
    const userMessage: Message = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMessage, { sender: 'bot', text: 'Thinking...' }]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `${DEFAULT_SYSTEM_PROMPT}\n${input}`, threadId }),
      });
      const data = await res.json();
      setThreadId(data.threadId); // In case backend ever returns a new one
      setMessages((msgs) => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: data.reply || 'No response.' }
      ]);
    } catch (err) {
      setMessages((msgs) => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: 'Error contacting backend.' }
      ]);
    }
  };

  // Scroll to bottom on new message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  return (
    <div className="chatbot-container">
      <h2>Onchain Agent Chatbot</h2>
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-message ${msg.sender}`}
            {...(msg.sender === 'bot'
              ? { dangerouslySetInnerHTML: { __html: linkifyHtml(msg.text) } }
              : {})}
          >
            {msg.sender === 'user' ? linkify(msg.text) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          className="chat-input"
        />
        <button type="submit" className="send-btn" disabled={!threadId}>Send</button>
      </form>
    </div>
  );
}

export default App; 