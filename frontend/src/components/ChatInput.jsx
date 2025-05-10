import React, { useRef, useCallback, useState, useEffect } from 'react'; // useEffect を追加
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, UploadCloud, Sparkles, ChevronDown } from 'lucide-react'; // ChevronDown を追加
import useFileUpload from '../hooks/useFileUpload';
import FilePreview from './FilePreview';

const ChatInput = ({
  input,
  handleInputChange,
  isLoading, // isExpanding を削除
  handleSend,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const templateButtonRef = useRef(null); // ボタンの参照用
  const templateDropdownRef = useRef(null); // ドロップダウンの参照用

  // --- プロンプトテンプレート機能 State ---
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const promptTemplates = [
    // label: メニュー表示名, value: ペルソナ指示文
    { id: 'summary', label: '要約させる', value: 'あなたは要約の専門家です。' },
    { id: 'review', label: 'レビューさせる', value: 'あなたは優秀なレビュアーです。' },
    { id: 'ideas', label: 'アイデアを出させる', value: 'あなたは発想力豊かなプランナーです。' },
    { id: 'translate_jp', label: '日本語に翻訳させる', value: 'あなたはプロの翻訳家です。日本語に翻訳してください。' },
    { id: 'explain', label: '説明させる', value: 'あなたはその分野の専門家です。分かりやすく説明してください。' },
  ];
  // --- /プロンプトテンプレート機能 State ---

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
    if (event.key === 'Enter' && event.ctrlKey && !isLoading) { // Ctrlキーが押されているかを確認
      event.preventDefault();
      handleSend(uploadedFiles.filter(f => !f.error));
      clearFiles();
    }
    // Enterキー単独の場合や、Shift+Enterの場合は、TextareaAutosizeのデフォルトの挙動（改行）になります。
  }, [handleSend, clearFiles, isLoading, uploadedFiles]);

  // ファイル削除ハンドラ
  const handleRemoveFile = useCallback((fileId) => {
    removeFile(fileId);
  }, [removeFile]);

  // --- プロンプトテンプレート関連ハンドラ ---
  const toggleTemplateDropdown = () => {
    setIsTemplateDropdownOpen(prev => !prev);
  };

  const handleInsertTemplate = (instruction) => {
    const currentInput = input.trim(); // 現在の入力内容を取得
    let newContent = instruction; // デフォルトは指示文のみ

    if (currentInput) { // 入力があれば内容を結合
      newContent = `${instruction}\n\n以下の内容についてお願いします:\n\`\`\`\n${currentInput}\n\`\`\``;
    } else { // 入力がなければ指示文の後に改行を追加
      newContent += '\n';
    }
    handleInputChange(newContent); // 生成した内容で入力欄全体を更新
    setIsTemplateDropdownOpen(false); // ドロップダウンを閉じる
    textareaRef.current?.focus(); // テキストエリアにフォーカスを戻す
  };

  // ドロップダウン外クリックで閉じる処理
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isTemplateDropdownOpen &&
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target) &&
        templateButtonRef.current && // ボタン自体をクリックした場合も閉じないように
        !templateButtonRef.current.contains(event.target)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTemplateDropdownOpen]);
  // --- /プロンプトテンプレート関連ハンドラ ---
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
          disabled={isLoading}
        />

        {/* ファイル添付ボタン (アイコンのみに変更) */}
        <button
          onClick={() => {
            console.log("File input clicked");
            fileInputRef.current?.click();
          }}
          disabled={isLoading}
          aria-label="ファイルを選択して添付"
          title="ファイルを選択 (クリックまたはドラッグ＆ドロップ)"
          className={`p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors disabled:opacity-50 flex-shrink-0`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* プロンプトテンプレートボタンとドロップダウン (位置移動) */}
        <div className="relative flex-shrink-0">
          <button
            ref={templateButtonRef}
            onClick={toggleTemplateDropdown}
            disabled={isLoading}
            aria-label="プロンプトテンプレートを選択"
            title="プロンプトテンプレート"
            className={`p-2 rounded-lg flex items-center gap-1 transition duration-200 ease-in-out transform ${isLoading
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <ChevronDown className={`w-4 h-4 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* ドロップダウンメニュー (表示位置変更) */}
          {isTemplateDropdownOpen && (
            <div
              ref={templateDropdownRef}
              className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-30 overflow-hidden" // right-0 を left-0 に変更
            >
              <ul className="py-1 max-h-60 overflow-y-auto">
                {promptTemplates.map((template) => (
                  <li key={template.id}>
                    <button onClick={() => handleInsertTemplate(template.value)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700">
                      {template.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 自動リサイズするテキストエリア */}
        <TextareaAutosize
          ref={textareaRef}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Ctrl+Enterで送信, EnterまたはShift+Enterで改行)"
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-y-auto"
          style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}
          disabled={isLoading}
          minRows={1}
          maxRows={6}
          aria-label="メッセージ入力"
        />

        {/* 送信ボタン */}
        <button
          onClick={() => handleSend(uploadedFiles.filter(f => !f.error))} // handleSend に引数を渡す
          disabled={isLoading || !input.trim()} // isExpanding を削除
          aria-label="送信 (Ctrl+Enter)"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || !input.trim()
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
