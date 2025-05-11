import React, { useEffect, useCallback } from 'react';
import { AlertCircle, Sun, Moon, Trash2, Loader2 } from 'lucide-react';
import useChat from './hooks/useChat';
import useFileUpload from './hooks/useFileUpload'; // useFileUpload をインポート
import Message from './components/Message'; // Message をインポート
import ChatInput from './components/ChatInput';
import AnalogClock from './components/AnalogClock'; // アナログ時計コンポーネントをインポート

function App() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    // setError, // App.jsx では使用しないため削除
    messagesEndRef,
    handleSend,
    handleClearChat: originalHandleClearChat, // useChat のクリア関数を別名で取得
    selectedModel,
    setSelectedModel,
    availableModels,
    isModelsLoading,
  } = useChat();

  const { // useFileUpload フックを呼び出し
    uploadedFiles,
    isDragging,
    // addFiles, // ChatInput に渡す必要はない
    removeFile,
    clearFiles, // カンマを追加
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
  } = useFileUpload();

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
    if (window.confirm('チャット履歴と添付ファイルをクリアしますか？この操作は元に戻せません。')) {
      originalHandleClearChat(); // useChat のクリア処理を呼び出す
      clearFiles(); // useFileUpload のファイルクリア処理を呼び出す
    }
  }, [originalHandleClearChat, clearFiles]); // 依存配列を修正
  // --- /チャット履歴クリアハンドラ ---

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-dark-background">
      {/* --- 左サイドバー --- */}
      <aside className="w-full md:w-72 md:flex-shrink-0 border-b md:border-r md:border-b-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* タイトルバー */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <img
              src="https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg"
              alt="Groqロゴ"
              className="h-6 w-6 hover:opacity-75 transition-opacity"
            />
            <span>チャットボット</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">日本語でチャット！</p>
        </div>
      </div>

      {/* コントロールエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* モデル選択 */}
        <div className="space-y-2">
          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            モデル選択
          </label>
          {isModelsLoading ? (
            <div className="flex items-center justify-center p-2 gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : (
            <select
              id="model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isLoading || availableModels.length === 0}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:focus:border-blue-500 dark:focus:ring-blue-500/50 disabled:opacity-50"
              title="使用するAIモデルを選択"
            >
              {availableModels.length === 0 ? (
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

        {/* アナログ時計 */}
        <div className="my-4" aria-label="アナログ時計" role="presentation"> {/* 上下にマージンを追加 */}
          <AnalogClock
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            aria-hidden="true" // 装飾的な要素として扱う
          />
          <div className="sr-only">現在時刻: {new Date().toLocaleTimeString('ja-JP')}</div>
        </div>

        {/* ボタングループ */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleClearChat}
            className="flex items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            disabled={isLoading}
            title="チャット履歴をクリア"
          >
            <Trash2 className="h-4 w-4" />
            <span>クリア</span>
          </button>

          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={isDarkMode ? "ライトモード" : "ダークモード"}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            <span>テーマ</span>
          </button>
        </div>
      </div>
    </aside>
    {/* --- /左サイドバー --- */}

    {/* --- 右ペイン（メインコンテンツ + 入力欄） --- */}
    <div className="flex-1 flex flex-col overflow-y-auto md:overflow-y-hidden"> {/* overflow-y-auto md:overflow-y-hidden を追加 */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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

      {/* --- 入力欄 --- */}
      <ChatInput
        input={input}
        handleInputChange={handleInputChange} // 入力変更ハンドラ
        isLoading={isLoading || isModelsLoading} // 通常の送信 or モデル読み込み中
        handleSend={handleSend} // メッセージ送信ハンドラ (useChat から)
        // FileUpload props
        uploadedFiles={uploadedFiles}
        isDragging={isDragging}
        removeFile={removeFile}
        clearAllFiles={clearFiles} // ChatInput内部のclearFilesと区別するため別名で渡すことも検討したが、ChatInput側でprops名としてclearFilesを受け取る想定
        handleDragEnter={handleDragEnter}
        handleDragLeave={handleDragLeave}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleFileChange={handleFileChange}
      />
    </div>
  </div>
);
}

export default App;
