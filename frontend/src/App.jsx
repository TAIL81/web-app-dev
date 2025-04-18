import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, BrainCircuit, AlertCircle } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Responding in fluent Japanese.', hidden: true },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // スクロールを最新メッセージに
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageContent = input.trim().toLowerCase();

    if (messageContent === 'quit' || messageContent === 'exit') {
      // 終了処理
      setMessages(prev => [...prev, { role: 'assistant', content: 'チャットを終了します。' }]);
      setInput('');
      setIsLoading(false);
      setError(null);
      return; // API呼び出しをスキップ
    }

    const newMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.content, reasoning: data.reasoning },
      ]);
    } catch (err) {
      setError(err.message);
      // エラー時、最新のユーザー入力を履歴から削除（私のコードに合わせて）
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white p-4 shadow">
        <h1 className="text-2xl font-bold text-gray-800">Groq チャットボット</h1>
        <p className="text-sm text-gray-500">日本語でチャット！「quit」か「exit」で終了。</p>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages
          .filter(msg => !msg.hidden) // システムメッセージ非表示
          .map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end items-start flex-row-reverse' : 'justify-start items-start'}`}
            >
              {msg.role === 'user' && (
                <User className="w-8 h-8 text-gray-500 ml-2 mt-1 order-2" />
              )}
              {msg.role === 'assistant' && (
                <Bot className="w-8 h-8 text-blue-500 mr-2 mt-1" />
              )}
              <div
                className={`max-w-md p-4 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-100' : 'bg-white'
                  } ${msg.role === 'user' ? 'order-1' : ''}`}
              >
                {msg.reasoning && (
                  <div className="mb-2 border-b pb-2">
                    <h4 className="text-sm font-semibold text-gray-500 flex items-center">
                      <BrainCircuit className="w-4 h-4 mr-1" />
                      思考プロセス
                    </h4>
                    <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {msg.reasoning}
                    </pre>
                  </div>
                )}
                <p>{msg.content}</p>
              </div>
            </div>
          ))}

        {isLoading && (
          <div className="flex justify-start">
            <Bot className="w-8 h-8 text-blue-500 mr-2" />
            <div className="p-4 bg-white rounded-lg shadow">
              <p className="text-gray-500 animate-pulse">応答中...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white p-4 shadow">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`p-2 rounded-lg text-white ${isLoading || !input.trim() ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
              }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
