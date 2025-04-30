// frontend/src/components/ChatInput.jsx
import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
// lucide-react から必要なアイコンを一度にインポート
import { Send, Sparkles, Paperclip, X, FileText } from 'lucide-react'; // X, FileText アイコンを追加

const ChatInput = ({
  input,
  setInput,
  isLoading,
  isExpanding,
  handleSend,
  handleExpandPrompt,
  handleFileSelect, // App.jsx から受け取る
  attachedFiles,    // App.jsx から受け取る
  handleRemoveFile  // App.jsx から受け取る
}) => {
  const fileInputRef = useRef(null);

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ファイルサイズのフォーマット関数 (例)
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  return (
    <footer className="bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10">
      {/* --- ▼ 添付ファイル表示エリアを追加 ▼ --- */}
      {attachedFiles && attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-md p-1.5 text-xs"
              title={`${file.name} (${formatFileSize(file.size)})`}
            >
              <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
              <span className="text-gray-800 dark:text-gray-200 truncate max-w-[100px] sm:max-w-[150px]">
                {file.name}
              </span>
              <button
                onClick={() => handleRemoveFile(file)}
                aria-label={`添付ファイル ${file.name} を削除`}
                className="p-0.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                disabled={isLoading || isExpanding}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* --- ▲ 添付ファイル表示エリアを追加 ▲ --- */}

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
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-hidden"
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
          // 送信ボタンは入力があるか、ファイルが添付されていれば有効にする
          disabled={isLoading || (!input.trim() && attachedFiles.length === 0) || isExpanding}
          aria-label="送信"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || (!input.trim() && attachedFiles.length === 0) || isExpanding
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
