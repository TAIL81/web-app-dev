// frontend/src/components/ChatInput.jsx
import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
// lucide-react から必要なアイコンを一度にインポート
import { Send, Languages, Paperclip } from 'lucide-react'; // Sparkles を Languages に変更

const ChatInput = ({
  input,
  setInput,
  isLoading,
  isExpanding,
  handleSend,
  handleTranslate, // App.jsx から受け取るハンドラ名を変更
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
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || isExpanding
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
              e.preventDefault(); // Enterキーのみで翻訳を実行しないように変更 (必要なら handleTranslate() を呼ぶ)
              // handleTranslate(); // Enterキーで翻訳を実行したい場合はコメント解除
            } else if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault(); // Ctrl+Enter で送信は維持
              handleSend();
            }
          }}
          placeholder="メッセージを入力... (Ctrl+Enterで送信, Shift+Enterで改行)"
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-y-auto"
          style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}
          disabled={isLoading || isExpanding}
          minRows={1}
          maxRows={6}
          aria-label="メッセージ入力"
        />

        {/* 翻訳ボタン (旧プロンプト拡張ボタン) */}
        <button
          id="translate-button" // id を変更
          onClick={handleTranslate} // onClick ハンドラ名を変更
          aria-label="英語に翻訳" // aria-label を変更
          title="入力内容を英語に翻訳" // title を変更
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || !input.trim() || isExpanding
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card' // スタイル (色) を変更
            }`}
          disabled={isLoading || !input.trim() || isExpanding}
        >
          {isExpanding ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div>
          ) : (
            <Languages className="w-5 h-5" /> // アイコンを Languages に変更
          )}
        </button>

        {/* 送信ボタン (変更なし) */}
        <button
          onClick={handleSend}
          // 送信ボタンは入力があれば有効にする (ファイル添付は useChat 側で判断)
          // ★ 翻訳ボタンと同様に、入力がない場合は無効にする
          disabled={isLoading || !input.trim() || isExpanding} aria-label="送信 (Ctrl+Enter)"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || !input.trim() || isExpanding
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
