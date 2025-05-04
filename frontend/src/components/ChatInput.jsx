import React, { useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Languages, Paperclip, RotateCcw, UploadCloud, Loader2 } from 'lucide-react';
import useFileUpload from '../hooks/useFileUpload';
import FilePreview from './FilePreview';

const ChatInput = ({
  input,
  handleInputChange,
  isLoading,
  isExpanding,
  handleSend,
  handleTranslate,
  isTranslated,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    uploadedFiles,
    isDragging,
    removeFile,
    clearFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
  } = useFileUpload();

  // Enterキーでの送信ハンドラ
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading && !isExpanding) {
      event.preventDefault();
      handleSend(uploadedFiles.filter(f => !f.error));
      clearFiles();
    }
  }, [handleSend, clearFiles, isLoading, isExpanding, uploadedFiles]);

  // ファイル削除ハンドラ
  const handleRemoveFile = useCallback((fileId) => {
    removeFile(fileId);
  }, [removeFile]);

  return (
    <footer
      className={`bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10 transition-all duration-200 ease-out ${
        isDragging ? 'border-t-4 border-blue-500' : 'border-t border-gray-200 dark:border-gray-700'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="チャット入力エリア"
    >
      {/* ドラッグ中のオーバーレイ */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 flex flex-col items-center justify-center pointer-events-none z-20 border-4 border-dashed border-blue-500 dark:border-blue-400 rounded-lg m-2">
          <UploadCloud className="w-12 h-12 text-blue-600 dark:text-blue-300 mb-2 animate-bounce" />
          <p className="text-lg font-semibold text-blue-700 dark:text-blue-200">
            ファイルをここにドロップ
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            テキストファイルを添付できます
          </p>
        </div>
      )}

      {/* ファイルプレビューエリア */}
      {uploadedFiles.length > 0 && (
        <div className="mb-3 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-dark-card rounded-lg border border-gray-200 dark:border-gray-600"> {/* dark:bg-dark-input を dark:bg-dark-card に変更 */}
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              添付ファイル ({uploadedFiles.length}件)
            </span>
            <button
              onClick={clearFiles}
              disabled={isLoading}
              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              title="すべての添付ファイルをクリア"
            >
              すべてクリア
            </button>
          </div>
          <div className="flex flex-wrap gap-2"> {/* flex, flex-wrap, gap-2 を追加 */}
            {uploadedFiles.map((fileData) => (
              <FilePreview
                key={fileData.id}
                fileData={fileData}
                onRemove={handleRemoveFile}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* --- 上部: 翻訳ボタン (削除済み) --- */}

      {/* --- 下部: 入力エリアと送信ボタン --- */}
      <div className="flex items-end gap-2">
        {/* ファイル選択用の非表示input要素 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          multiple
          accept=".md,.py,.js,.ts,.html,.css,.json,.yaml,.yml,.csv,.txt,text/*"
          disabled={isLoading || isExpanding}
        />

        {/* ファイル添付ボタン (アイコンのみに変更) */}
        <button
          onClick={() => {
            console.log("File input clicked");
            fileInputRef.current?.click();
          }}
          disabled={isLoading || isExpanding}
          aria-label="ファイルを選択して添付"
          title="ファイルを選択 (クリックまたはドラッグ＆ドロップ)"
          className={`p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors disabled:opacity-50 flex-shrink-0`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* 自動リサイズするテキストエリア */}
        <TextareaAutosize
          ref={textareaRef}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
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
              ? 'bg-orange-100 dark:bg-orange-800 hover:bg-orange-200 dark:hover:bg-orange-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
              : 'bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
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
