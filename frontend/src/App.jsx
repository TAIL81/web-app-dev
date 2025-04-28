// react-textarea-autosize をインポート
import { useState, useEffect } from 'react';
// Sun, Moon, Trash2, AlertCircle, Bot アイコンをインポート
import { AlertCircle, Sun, Moon, Trash2, Bot } from 'lucide-react';
import useChat from './hooks/useChat'; // useChat フックをインポート
import Message from './components/Message'; // Message コンポーネントをインポート
import ChatInput from './components/ChatInput'; // ChatInput コンポーネントをインポート

function App() {
  // useChat フックからチャット関連の状態と関数を取得
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError, // setError を追加
    messagesEndRef,
    handleSend,
    handleClearChat,
    isExpanding,
    setIsExpanding,
    handleFileSelect // ← useChat から取得
  } = useChat();

  // --- ダークモード関連 ---
  const [isDarkMode, setIsDarkMode] = useState(false); // 初期値はライトモード
  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode);
  };
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  // --- /ダークモード関連 ---

  // messagesEndRef は useChat フック内で管理されているため、App.jsx から削除
  // scrollToBottom 関数とそれに関連する useEffect も useChat フックに移動済み

  // handleSend, handleKeyPress, handleClearChat は useChat フックから取得

  // --- ▼▼▼ プロンプト拡張ボタンのハンドラー (修正版) ▼▼▼ ---
  // App.jsx の handleExpandPrompt 関数の修正案
  const handleExpandPrompt = async () => {
    if (!input.trim() || isLoading || isExpanding) return;
  
    setIsExpanding(true);
    setError(null);
    try {
      // APIエンドポイント (環境変数から取得推奨)
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/chat';
  
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // ★ バックエンドに送信するメッセージ形式を合わせる
          //    バックエンドが最後のユーザーメッセージのみを使う場合でも、
          //    一貫性のため messages 配列で送るのが良い場合もある
          messages: [{ role: 'user', content: input }],
          purpose: 'expand_prompt', // ★ プロンプト拡張リクエストであることを示す
          // stream: false // ストリーミングしないことを明示する場合
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      // ★ バックエンド (main.py) が返す ChatResponse モデルの content を取得
      const expandedPrompt = data.content || '';
  
      if (expandedPrompt) {
        setInput(expandedPrompt); // 拡張されたプロンプトを入力欄に設定
      } else {
        console.warn("Received empty expanded prompt from backend:", data);
        // エラーにするか、ユーザーに通知するか検討
        // setError('プロンプトの拡張に失敗しました。応答が空です。');
      }
  
    } catch (err) {
      console.error("Error expanding prompt:", err);
      setError(err instanceof Error ? err.message : 'プロンプトの拡張中に不明なエラーが発生しました。');
    } finally {
      setIsExpanding(false);
    }
  };
  // --- ▲▲▲ プロンプト拡張ボタンのハンドラーここまで ▲▲▲ ---


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
          .map((msg, index) => (
            <Message key={index} message={msg} />
          ))}

        {/* ローディング表示 (通常の送信時) */}
        {isLoading && !isExpanding && ( // 拡張中は表示しないように条件追加
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
      <ChatInput
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        isExpanding={isExpanding}
        handleSend={handleSend}
        handleExpandPrompt={handleExpandPrompt}
        handleFileSelect={handleFileSelect} // ← これを追加
      />
    </div>
  );
}

export default App;
