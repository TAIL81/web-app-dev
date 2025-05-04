import React, { useEffect, useCallback } from 'react';
import { AlertCircle, Sun, Moon, Trash2, Bot, Loader2, Info } from 'lucide-react';
import useChat from './hooks/useChat';
import Message from './components/Message';
import ChatInput from './components/ChatInput';

function App() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError, // エラー設定用 (現在は useChat 内で使用)
    messagesEndRef,
    handleSend,
    handleClearChat: originalHandleClearChat, // useChat のクリア関数を別名で取得
    selectedModel,
    setSelectedModel,
    availableModels,
    isModelsLoading,
  } = useChat();

  // --- ダークモード関連 ---
  const [isDarkMode, setIsDarkMode] = React.useState(true); // デフォルトをダークモードに
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);
  // --- /ダークモード関連 ---

  // --- 入力変更ハンドラ (手動変更時に翻訳リセット状態を解除) ---
  const handleInputChange = useCallback((newInput) => {
    setInput(newInput); // useChat の setInput を呼び出す
    // 翻訳リセットロジック削除
  }, [setInput]); // 依存配列を修正
  // --- ▲ 入力変更ハンドラ ▲ ---

  // --- モデル選択ハンドラ ---
  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };
  // --- /モデル選択ハンドラ ---

  // --- チャット履歴クリアハンドラ ---
  const handleClearChat = useCallback(() => {
    // 確認ダイアログなどを挟む場合はここに追加
    originalHandleClearChat(); // useChat のクリア処理を呼び出す
  }, [originalHandleClearChat]); // 依存配列を修正
  // --- /チャット履歴クリアハンドラ ---

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-dark-background">
      {/* --- ヘッダー --- */}
      <header className="bg-white dark:bg-dark-card p-4 shadow dark:shadow-md sticky top-0 z-10 flex justify-between items-center flex-wrap gap-2">
        {/* タイトルとバッジ (変更なし) */}
        <div className="flex-shrink-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-dark-text">Groq チャットボット</h1>
          <div className="flex items-center gap-1.5">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">日本語でチャット！</p>
            <a
              href="https://groq.com"
              target="_blank" // 新しいタブで開く
              rel="noopener noreferrer"
              title="Powered by Groq for fast inference."
            >
              <img
                src="https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg"
                alt="Powered by Groq" // より簡潔なaltテキスト
                className="h-4"
              />
            </a>
          </div>
        </div>

        {/* モデル選択とボタン類 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* モデル選択 (変更なし) */}
          <div className="flex items-center">
            <label htmlFor="model-select" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              モデル:
            </label>
            {isModelsLoading ? (
              // モデル読み込み中表示
              <div className="flex items-center justify-center p-2 gap-2 text-gray-500 dark:text-gray-400 min-w-[180px] sm:min-w-[220px]">
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span className="text-sm">モデルを読み込み中...</span>
              </div>
            ) : (
              // モデル選択肢
              <select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                disabled={isLoading || isModelsLoading || availableModels.length === 0} // isExpanding を削除
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-2xl focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 disabled:opacity-50 min-w-[180px] sm:min-w-[220px]"
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

          {/* クリアボタン */}
          <button
            onClick={handleClearChat} // 修正済みのハンドラを使用
            aria-label="チャット履歴をクリア"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 transition-colors"
            title="チャット履歴をクリア"
            disabled={isLoading} // isExpanding を削除
          >
            <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" aria-hidden="true" />
          </button>

          {/* ダークモード切り替えボタン */}
          <button
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors"
            title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </header>
      {/* --- /ヘッダー --- */}

      {/* --- メインコンテンツ (チャット履歴) --- */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* 初期表示メッセージ */}
        {messages.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 mt-10">
            <Bot size={48} className="mb-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">こんにちは！</h2>
            <p className="mb-1">何でも聞いてくださいね。</p>
            <p className="text-sm">下の入力欄にして送信してください。</p>
            <p className="text-sm mt-4 flex items-center gap-1">
              <Info size={14} />
              ヒント: ファイルも添付できます。
            </p>
          </div>
        )}

        {/* メッセージリスト */}
        {messages.map((msg, index) => (
          // メッセージに一意なIDが付与されている前提 (useChat.jsで対応)
          <Message key={msg.id || index} message={msg} /> // key に msg.id を使用 (フォールバックとして index)
        ))}

        {/* メッセージ送受信中のローディング表示 */}
        {isLoading && ( // isExpanding チェックを削除
          <div
            className="flex justify-center items-center py-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>応答を生成中...</span>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100/90 dark:bg-red-900/50 rounded-2xl mb-4 shadow-sm" role="alert">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-red-600 dark:text-red-400 text-sm font-medium break-words max-w-full">
              エラー: {error}
            </p>
          </div>
        )}
        {/* スクロール位置調整用の空div */}
        <div ref={messagesEndRef} />
      </main>
      {/* --- /メインコンテンツ --- */}

      {/* --- フッター (入力欄) --- */}
      <ChatInput
        input={input}
        handleInputChange={handleInputChange} // 入力変更ハンドラ
        isLoading={isLoading || isModelsLoading} // 通常の送信 or モデル読み込み中
        handleSend={handleSend} // メッセージ送信ハンドラ (useChat から)
        // 翻訳関連の props を削除
      />
    </div>
  );
}

export default App;
