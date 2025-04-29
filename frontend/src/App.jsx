/*
 * frontend/src/App.jsx
 * 2.5. アクセシビリティ向上: ローディング表示に aria-live 追加
 */
import React, { useEffect } from 'react';
import { AlertCircle, Sun, Moon, Trash2, Bot, Loader2 } from 'lucide-react';
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
    isModelsLoading, // モデルリスト取得中のローディング状態
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
      {/* ヘッダー (変更なし) */}
      <header className="bg-white dark:bg-dark-card p-4 shadow-md dark:shadow-lg sticky top-0 z-10 flex justify-between items-center flex-wrap gap-2">
        {/* タイトルとバッジ (変更なし) */}
        <div className="flex-shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-dark-text">Groq チャットボット</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">日本語でチャット！</p>
            <a
              href="https://groq.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by Groq for fast inference."
            >
              <img
                src="https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg"
                alt="Powered by Groq for fast inference."
                className="h-4"
              />
            </a>
          </div>
        </div>

        {/* モデル選択とボタン類 (変更なし) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* モデル選択 (変更なし) */}
          <div className="flex items-center">
            <label htmlFor="model-select" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              モデル:
            </label>
            {isModelsLoading ? (
              <div className="flex items-center justify-center p-2 gap-2 text-gray-500 dark:text-gray-400 min-w-[180px] sm:min-w-[220px]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">モデルを読み込み中...</span>
              </div>
            ) : (
              <select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                disabled={isLoading || isExpanding || isModelsLoading || availableModels.length === 0}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 disabled:opacity-50 min-w-[180px] sm:min-w-[220px]"
                title="バックエンドで設定可能なモデルを選択"
              >
                {availableModels.length === 0 && !isModelsLoading ? (
                   <option value="" disabled>利用可能なモデルなし</option>
                ) : (
                   availableModels.map((modelId) => (
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
        {messages.map((msg, index) => (
          <Message key={index} message={msg} />
        ))}

        {/* --- ▼ メッセージ送受信中のローディング表示に aria-live="polite" を追加 ▼ --- */}
        {isLoading && !isExpanding && (
          // この div がローディング表示全体のコンテナ
          <div
            className="flex justify-center items-center py-4"
            aria-live="polite" // スクリーンリーダーに状態変化を通知 (丁寧な方法で)
            aria-atomic="true" // 変更があった場合、要素全体を読み上げるように指示 (オプションだが推奨)
          >
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {/* 装飾的なアイコンは読み上げから除外 */}
              <span>応答を生成中...</span>
            </div>
          </div>
        )}
        {/* --- ▲ メッセージ送受信中のローディング表示に aria-live="polite" を追加 ▲ --- */}

        {/* エラー表示 (変更なし) */}
        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100/90 dark:bg-red-900/50 rounded-lg mb-4 shadow">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              エラー: {error}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* フッター (入力欄) (変更なし) */}
      <ChatInput
        input={input}
        setInput={setInput}
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
