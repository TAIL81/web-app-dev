import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Languages, Paperclip, RotateCcw } from 'lucide-react';

const ChatInput = ({
  input,
  handleInputChange, // 入力内容変更ハンドラ
  isLoading,
  isExpanding,
  handleSend,
  handleTranslate, // 翻訳実行/リセットハンドラ
  handleFileSelect, // ファイル選択ハンドラ
  isTranslated, // 翻訳済みかどうかの状態
}) => {
  const fileInputRef = useRef(null);

  // ファイル選択ダイアログを開く関数
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <footer className="bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10">
      <div className="flex items-end gap-2">

        {/* ファイル選択用の非表示input要素 */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple // 複数ファイル選択を許可
          accept="text/*,.pdf,.doc,.docx" // 許可するファイルタイプ (例)
          disabled={isLoading || isExpanding}
        />

        {/* ファイル添付ボタン */}
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

        {/* 自動リサイズするテキストエリア */}
        <TextareaAutosize
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
              e.preventDefault(); // Enterのみでの送信/翻訳を防ぐ
            } else if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault(); // Ctrl+Enter で送信
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

        {/* 翻訳/リセットボタン */}
        <button
          id="translate-button"
          onClick={handleTranslate}
          aria-label={isTranslated ? "元のテキストに戻す" : "英語に翻訳"}
          title={isTranslated ? "元のテキストに戻す" : "入力内容を英語に翻訳"}
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || !input.trim() || isExpanding
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : isTranslated
                ? 'bg-orange-100 dark:bg-orange-800 hover:bg-orange-200 dark:hover:bg-orange-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card' // リセット可能時のスタイル
                : 'bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card' // 翻訳実行時のスタイル
            }`}
          disabled={isLoading || !input.trim() || isExpanding}
        >
          {/* 状態に応じてアイコンを切り替え */}
          {isExpanding ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div>
            : isTranslated ? <RotateCcw className="w-5 h-5" /> : <Languages className="w-5 h-5" />}
        </button>

        {/* 送信ボタン */}
        <button
          onClick={handleSend}
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
