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
    handleKeyPress,
    handleClearChat,
    isExpanding,
    setIsExpanding
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
  const handleExpandPrompt = async () => {
    const currentInput = input.trim();
    if (!currentInput || isLoading || isExpanding) return;

    setIsExpanding(true);
    setError(null); // エラー状態をリセット

    try {
      // --- メタプロンプトの指示内容を修正 ---
      const metaPrompt = `
以下のユーザー入力を、より明確で詳細な一つの質問文または指示文に書き換えてください。
元の質問や指示の意図は変えずに、より多くの情報が得られるような形にしてください。
応答は書き換えた文のみとし、追加の説明や質問は含めないでください。

ユーザー入力: ${currentInput}

書き換え後の文:
      `.trim();
      // --- メタプロンプトここまで ---

      // --- デバッグ用にコンソールに出力 (任意) ---
      // console.log("送信するメタプロンプト:", metaPrompt);
      // ---

      const response = await fetch(process.env.REACT_APP_LM_STUDIO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: metaPrompt }],
          temperature: 0.5, // 少し創造性を抑える
          max_tokens: 150,  // 拡張後の長さを調整
          stream: false
        })
      });

      if (!response.ok) {
        // エラーレスポンスの形式に合わせて調整
        let errorDetail = `APIエラー (${response.status})`;
        let errorBody = null;
        try {
          // 生のエラーボディを取得
          errorBody = await response.text();
          try {
            // JSONとしてパースを試みる
            const errorData = JSON.parse(errorBody);
            // LM Studioのエラー形式に合わせてキーを調整する必要があるかもしれません
            errorDetail = errorData.error?.message || errorData.detail || JSON.stringify(errorData) || errorDetail;
          } catch (jsonError) {
            console.error("Error parsing error response as JSON:", jsonError);
            // JSONパースに失敗した場合、生のエラーボディをログに出力
            console.error("Raw error response body:", errorBody);
          }
        } catch (textError) {
           console.error("Error reading error response as text:", textError);
        }
        throw new Error(`API エラー (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();

      // --- レスポンス処理の修正 (ラベル変更に対応) ---
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const expandedPrompt = data.choices[0].message.content
          .replace(/^書き換え後の文:\s*/i, '') // ラベルを '書き換え後の文:' に変更
          .trim();

        if (expandedPrompt) {
          setInput(expandedPrompt);
        } else {
          console.warn("拡張後のプロンプトが空です。");
          // 必要であればユーザーに通知
          setError("プロンプトの拡張に失敗しました（結果が空）。");
        }
      } else {
        console.error("API応答の形式が不正です:", data);
        throw new Error("プロンプト拡張に失敗しました (不正な応答形式)。");
      }
      // --- レスポンス処理ここまで ---

    } catch (err) {
      console.error("プロンプト拡張エラー:", err);
      setError(err.message || "不明なエラーが発生しました。"); // エラーメッセージが空の場合のフォールバック
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
        handleKeyPress={handleKeyPress}
        handleExpandPrompt={handleExpandPrompt}
      />
    </div>
  );
}

export default App;
