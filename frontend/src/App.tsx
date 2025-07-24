import React, { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import ReactMarkdown from 'react-markdown';
import { FaMicrophone } from 'react-icons/fa';
import { FaUpload } from 'react-icons/fa';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

// Helper to render message with clickable links
function renderMessageWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, idx) => {
    if (urlRegex.test(part)) {
      return (
        <a key={idx} href={part} className="chat-link" target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

// Helper to render message as bullet points with emojis and styled links
function renderBotMessage(text: string) {
  // Split by newlines or numbered/bullet points
  const lines = text.split(/\n|\r|\d+\.|\* /).filter(Boolean);
  return (
    <ul style={{ paddingLeft: '1.2em', margin: 0 }}>
      {lines.map((line, idx) => {
        // Emoji for each bullet (cycle through a few for fun)
        const emojis = ['💡', '🔗', '✅', '📌', '✨', '📝', '🚀', '🔍'];
        const emoji = emojis[idx % emojis.length];
        // Find and style links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = line.split(urlRegex);
        return (
          <li key={idx} style={{ marginBottom: 4, listStyle: 'none', display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ marginRight: 6 }}>{emoji}</span>
            <span>
              {parts.map((part, i) =>
                urlRegex.test(part) ? (
                  <a
                    key={i}
                    href={part}
                    className="chat-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#d97706', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    {part}
                  </a>
                ) : (
                  <React.Fragment key={i}>{part}</React.Fragment>
                )
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function parseToolCommand(input: string): { tool: string, params: any } | null {
  // Example: tool: get_balance {"wallet":"0x..."}
  const match = input.match(/^tool:\s*(\w+)\s*(\{.*\})?$/);
  if (!match) return null;
  try {
    const tool = match[1];
    const params = match[2] ? JSON.parse(match[2]) : {};
    return { tool, params };
  } catch {
    return null;
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [listening, setListening] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastDebug, setLastDebug] = useState<{threadId?: string, runId?: string, assistantId?: string}>({});
  const [isThinking, setIsThinking] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);

  // Scroll to bottom on new message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isThinking && lastDebug.runId) {
      interval = setInterval(async () => {
        const res = await fetch(`http://localhost:3001/api/chat/status?runId=${lastDebug.runId}`);
        const data = await res.json();
        setStatusMessages(data.status || []);
      }, 1000);
    } else {
      setStatusMessages([]);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isThinking, lastDebug.runId]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage: Message = { sender: 'user', text: input };
    setMessages((msgs) => [...msgs, userMessage, { sender: 'bot', text: 'Thinking...' }]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, threadId }),
      });
      const data = await res.json();
      setThreadId(data.threadId);
      setLastDebug({ threadId: data.threadId, runId: data.runId, assistantId: data.assistantId });
      setMessages((msgs) => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: data.reply || data.error || 'No response.' }
      ]);
    } catch (err) {
      setMessages((msgs) => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: 'Error contacting backend at http://localhost:3001.' }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Voice input handler
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      alert('Voice recognition error: ' + event.error);
    };

    recognition.start();
  };

  const handleUploadIconClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Ask for confirmation before uploading
      if (window.confirm(`Upload ${selectedFile.name} to IPFS?`)) {
        uploadFileToIpfs(selectedFile);
      }
    }
  };

  const uploadFileToIpfs = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setMessages(msgs => [...msgs, { sender: 'user', text: `Uploading file: ${file.name}` }, { sender: 'bot', text: 'Uploading to IPFS...' }]);
    try {
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setMessages(msgs => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: data.url ? `File uploaded! [View on IPFS](${data.url})` : data.error }
      ]);
    } catch (err) {
      setMessages(msgs => [
        ...msgs.slice(0, -1),
        { sender: 'bot', text: 'Error uploading to IPFS.' }
      ]);
    }
  };

  return (
    <div className="chatbot-container">
      <h2>Onchain Agent Chatbot</h2>
      {/* Show status messages (thinking process) above the input */}
      {isThinking && statusMessages.length > 0 && (
        <div style={{
          background: '#23272f',
          color: '#a259ff',
          borderRadius: 12,
          padding: '1rem 1.5rem',
          margin: '0 0 1.5rem 0',
          fontSize: 16,
          fontFamily: 'monospace',
          maxHeight: 180,
          overflowY: 'auto',
          boxShadow: '0 2px 12px 0 #a259ff20',
        }}>
          {statusMessages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 4 }}>{msg}</div>
          ))}
        </div>
      )}
      <div className="chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.sender}`}>
            {msg.sender === 'bot' ? (
              msg.text === 'Thinking...'
                ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="spinner" />
                    <span style={{ color: '#a259ff', fontWeight: 600, fontSize: 18 }}>Thinking...</span>
                  </span>
                )
                : <ReactMarkdown
                    components={{
                      a: ({node, ...props}) => <a {...props} style={{ color: '#ffb300', textDecoration: 'underline', fontWeight: 600 }} target="_blank" rel="noopener noreferrer" />,
                      li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />
                    }}
                  >{msg.text}</ReactMarkdown>
            ) : renderMessageWithLinks(msg.text)}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message or use the mic..."
          className="chat-input"
        />
        <button
          type="button"
          className="mic-btn"
          onClick={handleVoiceInput}
          style={{
            background: listening
              ? 'linear-gradient(90deg, #ff4ecd 0%, #43e7fe 100%)'
              : 'linear-gradient(90deg, #43e7fe 0%, #a259ff 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 60,
            height: 60,
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            boxShadow: '0 2px 12px 0 #a259ff80',
          }}
        >
          <FaMicrophone size={32} color="#fff" />
        </button>
        <button
          type="button"
          className="upload-btn"
          onClick={handleUploadIconClick}
          style={{
            background: 'linear-gradient(90deg, #43e7fe 0%, #a259ff 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 60,
            height: 60,
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            boxShadow: '0 2px 12px 0 #a259ff80',
          }}
        >
          <FaUpload size={30} color="#fff" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button type="submit" className="send-btn">Send</button>
      </form>
    </div>
  );
}

export default App; 