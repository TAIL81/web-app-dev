/*
 * frontend/src/App.jsx
 * 修正: ファイル添付関連の state とハンドラを useChat フックに統合
 */
import React, { useEffect, useCallback } from 'react'; // useState を削除
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
    setError, // setError は直接使っていないが、将来的に使う可能性あり
    messagesEndRef,
    handleSend, // useChat から直接 handleSend を取得
    handleClearChat: originalHandleClearChat, // 元の handleClearChat を別名で保持
    isExpanding,
    setIsExpanding,
    selectedModel,
    setSelectedModel,
    availableModels,
    isModelsLoading,
    handleFileSelect, // useChat から handleFileSelect を取得
  } = useChat();

  // --- ▼ ファイル添付関連の状態とハンドラを削除 ▼ ---
  // const [attachedFiles, setAttachedFiles] = useState([]); // 削除
  // const handleFileSelect = useCallback(...); // 削除 (useChat のものを使用)
  // const handleRemoveFile = useCallback(...); // 削除 (useChat のものを使用)
  // const handleSend = useCallback(...); // 削除 (useChat のものを使用)
  // --- ▲ ファイル添付関連の状態とハンドラを削除 ▲ ---


  // --- ダークモード関連 (変更なし) ---
  const [isDarkMode, setIsDarkMode] = React.useState(true);
  const toggleDarkMode = () => setIsDarkMode(prev => !prev);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);
  // --- /ダークモード関連 ---

  // --- プロンプト拡張ボタンのハンドラー (変更なし) ---
  const handleExpandPrompt = async () => {
    if (!input.trim() || isLoading || isExpanding) return;
    setIsExpanding(true);
    setError(null);
    try {
      // バックエンドURLを環境変数から取得、なければデフォルト値
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      const apiUrl = `${backendUrl}/api/chat`; // 正しいエンドポイントURLを構築

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: input }],
          purpose: 'expand_prompt',
          // 拡張時は選択中のモデルではなく、設定ファイルで指定されたモデルを使う想定
          // model_name: selectedModel, // 必要であれば追加
        }),
      });
      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            // FastAPI のエラー詳細など、より具体的な情報を取得試行
            if (errorData && errorData.detail) {
                if (Array.isArray(errorData.detail)) {
                  errorDetail = errorData.detail.map(d => `[${d.loc?.join('->') || 'N/A'}]: ${d.msg || 'No message'}`).join('; ');
                } else if (typeof errorData.detail === 'string') {
                  errorDetail = errorData.detail;
                } else {
                  errorDetail = JSON.stringify(errorData.detail);
                }
            } else if (errorData && errorData.message) {
                errorDetail = errorData.message; // 一般的なエラーメッセージ
            }
        } catch (jsonError) {
            // JSON パース失敗時のフォールバック
            console.error("Error parsing expand prompt error response:", jsonError);
            errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        throw new Error(errorDetail);
      }
      const data = await response.json();
      const expandedPrompt = data.content || '';
      if (expandedPrompt) {
        setInput(expandedPrompt);
      } else {
        console.warn("Received empty expanded prompt from backend:", data);
        // ユーザーにフィードバックが必要な場合
        // setError("プロンプトの拡張結果が空でした。");
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

  // --- ▼ チャット履歴クリア確認を修正 ▼ ---
  const handleClearChat = useCallback(() => {
    console.log('handleClearChat called - skipping confirmation'); // デバッグ用ログを更新
    originalHandleClearChat(); // useChat のクリア処理を呼び出す
    // setAttachedFiles([]); // App.jsx の state は削除したので不要
  }, [originalHandleClearChat]); // 依存配列を修正
  // --- ▲ チャット履歴クリア確認を修正 ▲ ---

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-dark-background">
      {/* ヘッダー (変更なし) */}
      <header className="bg-white dark:bg-dark-card p-4 shadow dark:shadow-md sticky top-0 z-10 flex justify-between items-center flex-wrap gap-2">
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

        {/* モデル選択とボタン類 */}
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

          {/* クリアボタン (onClick を修正済みの handleClearChat に) */}
          <button
            onClick={handleClearChat} // 修正済みのハンドラを使用
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
        {/* --- ▼ チャット初期表示の改善 (変更なし) ▼ --- */}
        {messages.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 mt-10">
            <Bot size={48} className="mb-4 text-gray-400 dark:text-gray-500" />
            <h2 className="text-xl font-semibold mb-2">こんにちは！</h2>
            <p className="mb-1">何でも聞いてくださいね。</p>
            <p className="text-sm">下の入力欄にメッセージを入力して送信してください。</p>
            <p className="text-sm mt-4 flex items-center gap-1">
              <Info size={14} />
              ヒント: ファイルも添付できます。
            </p>
          </div>
        )}
        {/* --- ▲ チャット初期表示の改善 ▲ --- */}

        {messages.map((msg, index) => (
          <Message key={index} message={msg} /> // key は本来なら一意なIDを使うべき
        ))}

        {/* メッセージ送受信中のローディング表示 (変更なし) */}
        {isLoading && !isExpanding && (
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

        {/* エラー表示 (変更なし) */}
        {error && (
          <div className="flex justify-center items-center gap-2 p-3 bg-red-100/90 dark:bg-red-900/50 rounded-2xl mb-4 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-600 dark:text-red-400 text-sm font-medium break-words max-w-full">
              エラー: {error}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* フッター (入力欄) - ChatInput に渡す props を修正 */}
      <ChatInput
        input={input}
        setInput={setInput}
        isLoading={isLoading || isModelsLoading}
        isExpanding={isExpanding}
        handleSend={handleSend} // 修正: useChat の handleSend を渡す
        handleExpandPrompt={handleExpandPrompt}
        handleFileSelect={handleFileSelect} // 修正: useChat の handleFileSelect を渡す
        // attachedFiles={attachedFiles} // 削除: App.jsx の state は使わない
        // handleRemoveFile={handleRemoveFile} // 削除: App.jsx のハンドラは使わない
      />
    </div>
  );
}

export default App;
