// react-textarea-autosize をインポート
import TextareaAutosize from 'react-textarea-autosize';
import { useState, useEffect, useRef } from 'react';
// Sun, Moon, Trash2 アイコンをインポート
import { Send, User, Bot, BrainCircuit, AlertCircle, Sun, Moon, Trash2 } from 'lucide-react'; // Trash2 を追加
import ReactMarkdown from 'react-markdown';

function App() {
  // メッセージの初期状態を変数として定義 (クリア時に再利用するため)
  const initialMessages = [
    { role: 'system', content: 'Responding in fluent Japanese.', hidden: true },
  ];

  const [messages, setMessages] = useState(initialMessages); // 初期値を initialMessages に変更
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // --- ダークモード関連 ---
  // 現在のモードを管理する状態 (false: ライト, true: ダーク)
  const [isDarkMode, setIsDarkMode] = useState(false); // 初期値はライトモード

  // モードを切り替える関数
  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode); // 現在の状態を反転
  };

  // isDarkMode の状態が変わった時、または最初に読み込まれた時に実行
  useEffect(() => {
    // isDarkMode が true なら <html> タグに 'dark' クラスを追加
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      // isDarkMode が false なら <html> タグから 'dark' クラスを削除
      document.documentElement.classList.remove('dark');
    }
    // isDarkMode が変更されたら、この useEffect を再度実行する
  }, [isDarkMode]);
  // --- /ダークモード関連 ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    const lowerCaseInput = userInput.toLowerCase();

    const newUserMessage = { role: 'user', content: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    if (lowerCaseInput === 'quit' || lowerCaseInput === 'exit') {
      setMessages(prev => [...prev, { role: 'assistant', content: 'チャットを終了します。' }]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const messagesForApi = messages
        .filter(msg => !msg.hidden)
        .map(({ role, content }) => ({ role, content }));

    try {
      const response = await fetch('http://localhost:8002/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messagesForApi, { role: 'user', content: userInput }] }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
        }
        throw new Error(`API エラー (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.content, reasoning: data.reasoning },
      ]);
    } catch (err) {
      console.error("API呼び出しエラー:", err);
      setError(err.message);
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

  // --- チャットクリア処理 ---
  const handleClearChat = () => {
    // 確認ダイアログを表示
    if (window.confirm("チャット履歴をクリアしますか？")) {
      // messages state を初期状態に戻す
      setMessages(initialMessages);
      // (任意) エラー表示もクリアする
      setError(null);
      // (任意) ローディング状態も解除する
      setIsLoading(false);
      // (任意) 入力中の内容もクリアする
      setInput('');
    }
  };
  // --- /チャットクリア処理 ---

  return (
    // ルート要素: ダークモード用の背景色を追加
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-dark-background">
      {/* ヘッダー: ダークモード用の背景色、影、テキスト色を追加。flex で要素を配置 */}
      <header className="bg-white dark:bg-dark-card p-4 shadow-md dark:shadow-lg sticky top-0 z-10 flex justify-between items-center">
        {/* タイトルと説明文 */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-dark-text">Groq チャットボット</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">日本語でチャット！「quit」か「exit」で終了。</p>
        </div>
        {/* ボタン類をまとめる div */}
        <div className="flex items-center gap-2">
          {/* クリアボタン */}
          <button
            onClick={handleClearChat}
            aria-label="チャット履歴をクリア"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 transition-colors"
            title="チャット履歴をクリア" // マウスオーバー時のツールチップ
          >
            <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" /> {/* アイコンの色を赤系に */}
          </button>

          {/* ダークモード切り替えボタン */}
          <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors"
            title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"} // マウスオーバー時のツールチップ
          >
            {/* isDarkMode の状態に応じて Sun または Moon アイコンを表示 */}
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* メインコンテンツ (チャット履歴) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages
          .filter(msg => !msg.hidden)
          .map((msg, index) => (
            <div key={index}>
              {/* ユーザーメッセージ */}
              {msg.role === 'user' && (
                <div className="flex justify-end items-start mb-4 group">
                  <div className="max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-blue-100 dark:bg-blue-900 dark:bg-opacity-80 mr-2 break-words">
                    <p className="text-gray-800 dark:text-dark-text">{msg.content}</p>
                  </div>
                  <User className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </div>
              )}

              {/* AI メッセージ */}
              {msg.role === 'assistant' && (
                <div className="mb-4">
                  {/* 思考プロセス */}
                  {msg.reasoning && msg.reasoning !== "（Reasoningなし）" && (
                    <div className="flex justify-start items-start mb-2 group">
                      <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                      <div className="max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 break-words">
                        <pre className="whitespace-pre-wrap font-sans">{msg.reasoning}</pre>
                      </div>
                    </div>
                  )}

                  {/* AI 回答本文 */}
                  <div className="flex justify-start items-start group">
                    <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 mr-2 flex-shrink-0 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
                    {/* prose-invert で typography プラグインのダークモードスタイルを適用 */}
                    <div className="prose prose-sm max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-white dark:bg-dark-card dark:prose-invert break-words">
                      <ReactMarkdown>
                        {msg.content || "..."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex justify-start items-center mb-4 group">
            <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 mr-2 flex-shrink-0 animate-pulse group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            <div className="px-4 py-2 rounded-lg shadow bg-white dark:bg-dark-card">
              <p className="text-gray-500 dark:text-gray-400 animate-pulse">応答中...</p>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-50 rounded-lg mb-4 shadow">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* スクロール用の空要素 */}
        <div ref={messagesEndRef} />
      </main>

      {/* フッター (入力欄) */}
      <footer className="bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10">
        {/* items-end でテキストエリアとボタンの下端を揃える */}
        <div className="flex items-end gap-2">
          {/* TextareaAutosize コンポーネントを使用 */}
          <TextareaAutosize
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress} // Enterキーでの送信処理
            placeholder="メッセージを入力... (Shift+Enterで改行)"
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-hidden" // resize-none, overflow-hidden 追加
            disabled={isLoading}
            minRows={1} // 最小1行
            maxRows={6} // 最大6行 (超えるとスクロール)
            aria-label="メッセージ入力" // アクセシビリティのためのラベル
          />
          {/* 送信ボタン: ホバー時のスケールアニメーションを追加 */}
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="送信"
            className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${ // transition と transform を調整
              isLoading || !input.trim()
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card' // hover:scale-110 追加
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
