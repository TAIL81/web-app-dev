import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, BrainCircuit, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // react-markdown をインポート

function App() {
  const [messages, setMessages] = useState([
    // 初期システムメッセージ（非表示）
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

    const userInput = input.trim(); // 送信するユーザー入力
    const lowerCaseInput = userInput.toLowerCase();

    // ユーザーメッセージをまず表示（quit/exit も含める）
    const newUserMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    setInput(''); // 入力欄をクリア

    if (lowerCaseInput === 'quit' || lowerCaseInput === 'exit') {
      // 終了メッセージをAIからの応答として表示
      setMessages(prev => [...prev, { role: 'assistant', content: 'チャットを終了します。' }]);
      setIsLoading(false);
      setError(null);
      return; // API呼び出しをスキップ
    }

    setIsLoading(true);
    setError(null);

    // APIに送るメッセージ履歴（非表示メッセージは除外し、最新のユーザー入力を含める）
    const messagesForApi = messages
        .filter(msg => !msg.hidden) // 非表示メッセージを除外
        .map(({ role, content }) => ({ role, content })); // roleとcontentのみ抽出

    try {
      const response = await fetch('http://localhost:8002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // APIには、現在の履歴（非表示除く）＋最新のユーザーメッセージを送る
        body: JSON.stringify({ messages: [...messagesForApi, { role: 'user', content: userInput }] }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail; // バックエンドからの詳細があれば使う
        } catch (jsonError) {
          // JSONパース失敗時は statusText を使う
          console.error("Error parsing error response:", jsonError);
        }
        throw new Error(`API エラー (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      // APIからの応答（本文とReasoning）を履歴に追加
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.content, reasoning: data.reasoning },
      ]);
    } catch (err) {
      console.error("API呼び出しエラー:", err); // コンソールに詳細エラー出力
      setError(err.message);
      // エラー発生時、ユーザーメッセージは表示されたままにする
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    // Shift+Enter で改行、Enterのみで送信
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // デフォルトの改行動作をキャンセル
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* --- ヘッダー --- */}
      <header className="bg-white p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Groq チャットボット</h1>
        <p className="text-xs sm:text-sm text-gray-500">日本語でチャット！「quit」か「exit」で終了。</p>
      </header>

      {/* --- メインコンテンツ (チャット履歴) --- */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages
          .filter(msg => !msg.hidden) // 非表示メッセージはレンダリングしない
          .map((msg, index) => (
            <div key={index}>
              {/* --- ユーザーメッセージ --- */}
              {msg.role === 'user' && (
                <div className="flex justify-end items-start mb-4 group"> {/* 右寄せコンテナ */}
                  {/* メッセージ本文 */}
                  <div className="max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-blue-100 mr-2 break-words">
                    <p className="text-gray-800">{msg.content}</p>
                  </div>
                  {/* ユーザーアイコン */}
                  <User className="w-8 h-8 text-gray-400 flex-shrink-0 mt-1 group-hover:text-gray-600 transition-colors" />
                </div>
              )}

              {/* --- AI メッセージ --- */}
              {msg.role === 'assistant' && (
                <div className="mb-4"> {/* AIメッセージ全体 */}
                  {/* --- 思考プロセス (あれば表示) --- */}
                  {msg.reasoning && msg.reasoning !== "（Reasoningなし）" && (
                    <div className="flex justify-start items-start mb-2 group"> {/* 左寄せコンテナ */}
                      {/* 思考アイコン */}
                      <BrainCircuit className="w-6 h-6 text-gray-400 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 transition-colors" />
                      {/* 思考プロセス本文 */}
                      <div className="max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-gray-200 text-xs text-gray-700 break-words">
                        <pre className="whitespace-pre-wrap font-sans">{msg.reasoning}</pre>
                      </div>
                    </div>
                  )}

                  {/* --- AI 回答本文 --- */}
                  <div className="flex justify-start items-start group"> {/* 左寄せコンテナ */}
                    {/* AIアイコン */}
                    <Bot className="w-8 h-8 text-blue-400 mr-2 flex-shrink-0 mt-1 group-hover:text-blue-600 transition-colors" />
                    {/* 回答本文 */}
                    <div className="prose prose-sm max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-white break-words">
                      <ReactMarkdown>
                        {msg.content || "..."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* --- ローディング表示 --- */}
        {isLoading && (
          <div className="flex justify-start items-center mb-4 group"> {/* 左寄せコンテナ */}
            <Bot className="w-8 h-8 text-blue-400 mr-2 flex-shrink-0 animate-pulse group-hover:text-blue-600 transition-colors" />
            <div className="px-4 py-2 rounded-lg shadow bg-white">
              <p className="text-gray-500 animate-pulse">応答中...</p>
            </div>
          </div>
        )}

        {/* --- エラー表示 --- */}
        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100 rounded-lg mb-4 shadow">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* スクロール用の空要素 */}
        <div ref={messagesEndRef} />
      </main>

      {/* --- フッター (入力欄) --- */}
      <footer className="bg-white p-4 shadow-inner sticky bottom-0 z-10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress} // Enterキーでの送信
            placeholder="メッセージを入力... (Shift+Enterで改行)"
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            disabled={isLoading}
            rows={1} // 初期表示は1行
            style={{ resize: 'none' }} // リサイズハンドル非表示
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="送信"
            className={`p-2 rounded-lg text-white flex-shrink-0 transition-colors duration-200 ease-in-out ${
              isLoading || !input.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
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
