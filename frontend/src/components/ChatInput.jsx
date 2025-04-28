import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Sparkles } from 'lucide-react';

import React, { useRef } from 'react'; // useRef をインポート
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Sparkles, Paperclip } from 'lucide-react'; // Paperclip アイコンをインポート

const ChatInput = ({
  input,
  setInput,
  isLoading,
  isExpanding,
  handleSend,
  handleKeyPress,
  handleExpandPrompt,
  handleFileSelect // ★ ファイル選択ハンドラを追加
}) => {
  // ★ ファイル入力要素への参照を作成
  const fileInputRef = useRef(null);

  // ★ ファイル選択ダイアログを開く関数
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <footer className="bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10">
      {/* items-end でテキストエリアとボタンの下端を揃える */}
      <div className="flex items-end gap-2">

        {/* ★ ファイル入力要素 (非表示) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect} // ファイル選択時のハンドラ
          className="hidden" // 非表示にする
          multiple // 複数ファイル選択を許可する場合
          // accept="image/*,text/*,.md" // 許可するファイルタイプを指定する場合
        />

        {/* ★ ファイルアップロードボタン */}
        <button
          onClick={triggerFileSelect} // ボタンクリックでファイル選択をトリガー
          disabled={isLoading || isExpanding} // ローディング中や拡張中は無効化
          aria-label="ファイルを添付"
          title="ファイルを添付"
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || isExpanding // 無効化条件
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
          }`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* TextareaAutosize コンポーネントを使用 */}
        <TextareaAutosize
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress} // Enterキーでの送信処理
          placeholder="メッセージを入力... (Shift+Enterで改行)"
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-hidden"
          style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}
          disabled={isLoading || isExpanding} // 拡張中も無効化
          minRows={1} // 最小1行
          maxRows={6} // 最大6行 (超えるとスクロール)
          aria-label="メッセージ入力" // アクセシビリティのためのラベル
        />

        {/* --- ▼▼▼ プロンプト拡張ボタン (isExpanding 状態を反映) ▼▼▼ --- */}
        <button
          id="expand-prompt-button"
          onClick={handleExpandPrompt}
          aria-label="プロンプトを拡張"
          title="入力内容を基にプロンプトを拡張"
          className={`p-2 rounded-lg text-gray-600 dark:text-gray-400 flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || !input.trim() || isExpanding // isExpanding を無効化条件に追加
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
          }`}
          disabled={isLoading || !input.trim() || isExpanding} // isExpanding を無効化条件に追加
        >
          {/* 拡張中はスピナーアイコンを表示するなどの工夫も可能 */}
          {isExpanding ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-gray-100"></div> // 簡単なスピナー例
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </button>
        {/* --- ▲▲▲ プロンプト拡張ボタンここまで ▲▲▲ --- */}


        {/* 送信ボタン: 拡張中も無効化 */}
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim() || isExpanding} // isExpanding を無効化条件に追加
          aria-label="送信"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${
            isLoading || !input.trim() || isExpanding // isExpanding を無効化条件に追加
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
