// src/App.jsx
import React, { useEffect } from 'react';
import { AlertCircle, Sun, Moon, Trash2, Bot, Loader2 } from 'lucide-react'; // Loader2 をインポート
import useChat from './hooks/useChat';
import Message from './components/Message';
import ChatInput from './components/ChatInput';

function App() {
  const {
    messages,
    input,
    setInput,
    isLoading, // メッセージ送受信ローディング
    error,
    setError,
    messagesEndRef,
    handleSend,
    handleClearChat,
    isExpanding,
    setIsExpanding,
    selectedModel,
    setSelectedModel,
    availableModels, // 動的に取得されるモデルIDリスト
    isModelsLoading, // ★ モデルリスト取得中のローディング状態
  } = useChat();

  // --- ダークモード関連 (変更なし) ---
  const [isDarkMode, setIsDarkMode] = React.useState(true);
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);
  // --- /ダークモード関連 ---

  // --- プロンプト拡張ボタンのハンドラー (変更なし) ---
  const handleExpandPrompt = async () => {
    // ... (変更なし)
    if (!input.trim() || isLoading || isExpanding) return;
    setIsExpanding(true);
    setError(null);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/chat';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input }],
          purpose: 'expand_prompt',
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const expandedPrompt = data.content || '';
      if (expandedPrompt) {
        setInput(expandedPrompt);
      } else {
        console.warn("Received empty expanded prompt from backend:", data);
      }
    } catch (err) {
      console.error("Error expanding prompt:", err);
      setError(err instanceof Error ? err.message : 'プロンプトの拡張中に不明なエラーが発生しました。');
    } finally {
      setIsExpanding(false);
    }
  };
  // --- /プロンプト拡張ボタンのハンドラー ---

  // モデル選択ハンドラ (変更なし)
  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-dark-background">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-dark-card p-4 shadow-md dark:shadow-lg sticky top-0 z-10 flex justify-between items-center flex-wrap gap-2">
        {/* タイトルとバッジ */}
        <div className="flex-shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-dark-text">Groq チャットボット</h1>
          {/* ↓ pタグとaタグを横並びにするためにdivで囲み、flexとitems-centerを追加 */}
          <div className="flex items-center gap-1.5"> {/* gap-1.5 でテキストとバッジの間隔を調整 */}
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">日本語でチャット！</p>
            {/* ↓ ここに指定されたバッジのHTMLをJSX形式で挿入 */}
            <a
              href="https://groq.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by Groq for fast inference." // マウスオーバー時のツールチップ
            >
              <img
                src="https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg"
                alt="Powered by Groq for fast inference."
                // ↓ Tailwind CSSで高さを調整 (h-4は約16px)。テキストサイズに合わせて調整してください (例: h-3.5)
                className="h-4"
              />
            </a>
          </div>
        </div>

        {/* モデル選択とボタン類 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* モデル選択 */}
          <div className="flex items-center">
            <label htmlFor="model-select" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              モデル:
            </label>
            {/* ★ モデルリスト取得中はローディングアイコンを表示 */}
            {isModelsLoading ? (
              <div className="flex items-center justify-center p-2" style={{ minWidth: '220px' }}>
                <Loader2 className="w-5 h-5 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : (
              <select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                // ★ モデルリスト取得中、メッセージ送信中、または利用可能なモデルがない場合は選択不可
                disabled={isLoading || isExpanding || isModelsLoading || availableModels.length === 0}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 disabled:opacity-50"
                style={{ minWidth: '220px' }}
              >
                {/* ★ availableModels 配列から option を動的に生成 */}
                {availableModels.length === 0 && !isModelsLoading ? (
                   // モデルリストが空で、ロード中でもない場合
                   <option value="" disabled>利用可能なモデルなし</option>
                ) : (
                   availableModels.map((modelId) => (
                     // ★ value と表示テキストの両方に modelId を使用
                     <option key={modelId} value={modelId}>
                       {modelId}
                     </option>
                   ))
                )}
              </select>
            )}
          </div>

          {/* クリアボタン (変更なし) */}
          <button
            onClick={handleClearChat}
            aria-label="チャット履歴をクリア"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 transition-colors"
            title="チャット履歴をクリア"
            disabled={isLoading || isExpanding}
          >
            <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
          </button>

          {/* ダークモード切り替えボタン (変更なし) */}
          <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors"
            title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* メインコンテンツ (チャット履歴) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* ... メッセージ表示、ローディング、エラー表示 (変更なし) ... */}
        {messages.map((msg, index) => (
          <Message key={index} message={msg} />
        ))}
        {/* メッセージ送受信中のローディング表示 */}
        {isLoading && !isExpanding && (
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
        <div ref={messagesEndRef} />
      </main>

      {/* フッター (入力欄) */}
      <ChatInput
        input={input}
        setInput={setInput}
        // ★ モデルリスト取得中も入力不可にする
        isLoading={isLoading || isModelsLoading}
        isExpanding={isExpanding}
        handleSend={handleSend}
        handleExpandPrompt={handleExpandPrompt}
        // handleFileSelect={handleFileSelect} // 必要なら
      />
    </div>
  );
}

export default App;
