// frontend/src/components/ChatInput.jsx
import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
// lucide-react から必要なアイコンを一度にインポート
import { Send, Sparkles, Paperclip } from 'lucide-react'; // 未使用の X, FileText アイコンを削除

const ChatInput = ({
  input,
  setInput,
  isLoading,
  isExpanding,
  handleSend,
  handleExpandPrompt,
  handleFileSelect, // App.jsx から受け取る
}) => {
  const fileInputRef = useRef(null);

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 未使用の formatFileSize 関数を削除
  return (
    <footer className="bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10">
      {/* --- ▼ 添付ファイル表示エリアを削除 ▼ --- */}
      {/* ファイル添付の状態は useChat フックの messages state で管理・表示されるため、ここでは不要 */}
      {/* --- ▲ 添付ファイル表示エリアを削除 ▲ --- */}
      {/* items-end でテキストエリアとボタンの下端を揃える */}
      <div className="flex items-end gap-2">

        {/* ファイル入力要素 (非表示) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect} // App.jsx から渡されたハンドラを使用
          className="hidden"
          multiple // 複数ファイル選択を許可
          accept="text/*,.pdf,.doc,.docx" // 画像ファイルを除外し、テキスト、PDF、Word文書のみを許可する場合の例
          disabled={isLoading || isExpanding} // ローディング中などは無効化
        />

        {/* ファイルアップロードボタン */}
        <button
          onClick={triggerFileSelect}
          disabled={isLoading || isExpanding}
          aria-label="ファイルを添付"
          title="ファイルを添付"
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || isExpanding
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
          }`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* TextareaAutosize (変更なし) */}
        <TextareaAutosize
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
              e.preventDefault();
              handleExpandPrompt();
            } else if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="メッセージを入力... (Enterでプロンプト拡張, Ctrl+Enterで送信, Shift+Enterで改行)"
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-y-auto"
          style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}
          disabled={isLoading || isExpanding}
          minRows={1}
          maxRows={6}
          aria-label="メッセージ入力"
        />

        {/* プロンプト拡張ボタン (変更なし) */}
        <button
          id="expand-prompt-button"
          onClick={handleExpandPrompt}
          aria-label="プロンプトを拡張"
          title="入力内容を基にプロンプトを拡張"
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || !input.trim() || isExpanding
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
          }`}
          disabled={isLoading || !input.trim() || isExpanding}
        >
          {isExpanding ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div>
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </button>

        {/* 送信ボタン (変更なし) */}
        <button
          onClick={handleSend}
          // 送信ボタンは入力があれば有効にする (ファイル添付は useChat 側で判断)
          disabled={isLoading || !input.trim() || isExpanding}          aria-label="送信"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || !input.trim() || isExpanding
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </footer>
  );
};

export default ChatInput;
