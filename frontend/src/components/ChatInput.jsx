import React, { useRef, useCallback, useState, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, UploadCloud, Sparkles, ChevronDown, X, FileText, Link } from 'lucide-react';
import FilePreview from './FilePreview';
import { toast } from 'react-toastify'; // toast をインポート

const ChatInput = ({
  input,
  handleInputChange,
  isLoading,
  handleSend,
  uploadedFiles,
  isDragging,
  removeFile,
  clearAllFiles,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleFileChange: onFileChange,
  setSelectedFile,
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  // const templateButtonRef = useRef(null); // 不要になったため削除
  // const templateDropdownRef = useRef(null); // 不要になったため削除

  // const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false); // 不要になったため削除
  // promptTemplates はバックエンドから動的に生成するため削除
  // const promptTemplates = [
  //   { id: 'summary', label: '要約させる', value: 'あなたは要約の専門家です。' },
  //   { id: 'review', label: 'レビューさせる', value: 'あなたは優秀なレビュアーです。' },
  //   { id: 'ideas', label: 'アイデアを出させる', value: 'あなたは発想力豊かなプランナーです。' },
  //   { id: 'translate_jp', label: '日本語に翻訳させる', value: 'あなたはプロの翻訳家です。日本語に翻訳してください。' },
  //   { id: 'explain', label: '説明させる', value: 'あなたはその分野の専門家です。分かりやすく説明してください。' },
  // ];

  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentTypeInModal, setAttachmentTypeInModal] = useState('file');
  const [urlInputValue, setUrlInputValue] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false); // プロンプト生成中の状態

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && event.ctrlKey && !isLoading && !isGeneratingPrompt) {
      event.preventDefault();
      handleSend(uploadedFiles.filter(f => !f.error));
    }
  }, [handleSend, isLoading, uploadedFiles, isGeneratingPrompt]);

  const handleRemoveFile = useCallback((fileId) => {
    removeFile(fileId);
  }, [removeFile]);

  // const toggleTemplateDropdown = () => { // 不要になったため削除
  //   setIsTemplateDropdownOpen(prev => !prev);
  // };

  // const handleInsertTemplate = (instruction) => { // 不要になったため削除
  //   const currentInput = input.trim();
  //   let newContent = instruction;
  //   if (currentInput) {
  //     newContent = `${instruction}\n\n以下の内容についてお願いします:\n\`\`\`\n${currentInput}\n\`\`\``;
  //   } else {
  //     newContent += '\n';
  //   }
  //   handleInputChange(newContent);
  //   setIsTemplateDropdownOpen(false);
  //   textareaRef.current?.focus();
  // };

  // メタプロンプト生成ハンドラ
  const handleGenerateMetaprompt = useCallback(async () => {
    setIsGeneratingPrompt(true);
    const defaultTask = "Draft an email responding to a customer complaint"; // デフォルトタスク
    const task = input.trim() || defaultTask; // 現在の入力があればそれを使用、なければデフォルト

    try {
      const response = await fetch('/api/generate-metaprompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'プロンプト生成に失敗しました。');
      }

      const data = await response.json();
      handleInputChange(data.prompt); // 生成されたプロンプトを入力欄に自動挿入
      toast.success('プロンプトテンプレートを生成しました！');
      textareaRef.current?.focus();
    } catch (error) {
      console.error('メタプロンプト生成エラー:', error);
      toast.error(`プロンプト生成エラー: ${error.message}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [input, handleInputChange]);

  useEffect(() => {
    // ドロップダウン関連の useEffect は不要になったため削除
    // const handleClickOutside = (event) => {
    //   if (
    //     isTemplateDropdownOpen &&
    //     templateDropdownRef.current &&
    //     !templateDropdownRef.current.contains(event.target) &&
    //     templateButtonRef.current &&
    //     !templateButtonRef.current.contains(event.target)
    //   ) {
    //     setIsTemplateDropdownOpen(false);
    //   }
    // };
    // document.addEventListener('mousedown', handleClickOutside);
    // return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // 依存配列を空に

  const openAttachmentModal = () => {
    setAttachmentTypeInModal('file');
    setUrlInputValue('');
    setIsAttachmentModalOpen(true);
  };

  const closeAttachmentModal = () => {
    setIsAttachmentModalOpen(false);
  };

  const handleSelectFileFromModal = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelectedAndCloseModal = (event) => {
    onFileChange(event);
    closeAttachmentModal();
  };

  const handleAddUrlFromModal = () => {
    if (urlInputValue.trim()) {
      console.log("URL submitted:", urlInputValue);
      setUrlInputValue('');
      closeAttachmentModal();
    }
  };

  return (
    <footer
      className={`bg-white dark:bg-dark-card p-4 shadow-inner sticky bottom-0 z-10 transition-all duration-200 ease-out ${isDragging ? 'border-t-4 border-blue-500' : 'border-t border-gray-200 dark:border-gray-700'
        }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      aria-label="チャット入力エリア"
    >
      {isDragging && (
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 flex flex-col items-center justify-center pointer-events-none z-20 border-4 border-dashed border-blue-500 dark:border-blue-400 rounded-lg m-2">
          <UploadCloud className="w-12 h-12 text-blue-600 dark:text-blue-300 mb-2 animate-bounce" />
          <p className="text-lg font-semibold text-blue-700 dark:text-blue-200">ファイルをここにドロップ</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">テキストファイルを添付できます</p>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mb-3 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-dark-card rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">添付ファイル ({uploadedFiles.length}件)</span>
            <button
              onClick={clearAllFiles}
              disabled={isLoading || isGeneratingPrompt}
              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              title="すべての添付ファイルをクリア"
            >
              すべてクリア
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((fileData) => (
              <FilePreview key={fileData.id} fileData={fileData} onRemove={handleRemoveFile} isLoading={isLoading || isGeneratingPrompt} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelectedAndCloseModal}
          className="hidden"
          multiple
          accept=".md,.py,.js,.ts,.html,.css,.json,.yaml,.yml,.csv,.txt,text/*"
          disabled={isLoading || isGeneratingPrompt}
        />

        <button
          onClick={openAttachmentModal}
          disabled={isLoading || isGeneratingPrompt}
          aria-label="ファイルまたはURLを添付"
          title="ファイルまたはURLを添付 (クリックまたはドラッグ＆ドロップ)"
          className={`p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors disabled:opacity-50 flex-shrink-0`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="relative flex-shrink-0">
          <button
            // ref={templateButtonRef} // 不要になったため削除
            onClick={handleGenerateMetaprompt} // メタプロンプト生成関数を呼び出す
            disabled={isLoading || isGeneratingPrompt}
            aria-label="プロンプトテンプレートを生成"
            title="プロンプトテンプレートを生成"
            className={`p-2 rounded-lg flex items-center gap-1 transition duration-200 ease-in-out transform ${isLoading || isGeneratingPrompt
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
              }`}
          >
            <Sparkles className="w-5 h-5" />
            {/* ChevronDown は不要になったため削除 */}
            {/* <ChevronDown className={`w-4 h-4 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} /> */}
          </button>
          {/* テンプレートドロップダウンは不要になったため削除 */}
          {/* {isTemplateDropdownOpen && (
            <div
              ref={templateDropdownRef}
              className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-30 overflow-hidden"
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
          )} */}
        </div>

        <TextareaAutosize
          ref={textareaRef}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力... (Ctrl+Enterで送信, EnterまたはShift+Enterで改行)"
          className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-y-auto"
          style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}
          disabled={isLoading || isGeneratingPrompt}
          minRows={1}
          maxRows={6}
          aria-label="メッセージ入力"
        />

        <button
          onClick={() => handleSend(uploadedFiles.filter(f => !f.error))}
          disabled={isLoading || isGeneratingPrompt || !input.trim()}
          aria-label="送信 (Ctrl+Enter)"
          className={`p-2 rounded-lg text-white flex-shrink-0 transition duration-200 ease-in-out transform ${isLoading || isGeneratingPrompt || !input.trim()
            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
            : 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-dark-card'
            }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Attachment Modal */}
      {isAttachmentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">添付方法を選択</h3>
              <button onClick={closeAttachmentModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-1" aria-label="Tabs">
                <button
                  onClick={() => setAttachmentTypeInModal('file')}
                  className={`px-3 py-2 font-medium text-sm rounded-t-md ${attachmentTypeInModal === 'file'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 border-b-2'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <FileText size={18} className="inline mr-1" /> ファイルを選択
                </button>
                <button
                  onClick={() => setAttachmentTypeInModal('url')}
                  className={`px-3 py-2 font-medium text-sm rounded-t-md ${attachmentTypeInModal === 'url'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 border-b-2'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                >
                  <Link size={18} className="inline mr-1" /> URLを入力
                </button>
              </nav>
            </div>

            {attachmentTypeInModal === 'file' && (
              <div className="text-center">
                <button
                  onClick={handleSelectFileFromModal}
                  disabled={isLoading || isGeneratingPrompt}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  ファイルを選択...
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  クリックしてファイルダイアログを開きます。
                </p>
              </div>
            )}

            {attachmentTypeInModal === 'url' && (
              <div>
                <input
                  type="text"
                  value={urlInputValue}
                  onChange={(e) => setUrlInputValue(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-dark-text mb-3"
                  disabled={isLoading || isGeneratingPrompt}
                />
                <button
                  onClick={handleAddUrlFromModal}
                  disabled={isLoading || isGeneratingPrompt || !urlInputValue.trim()}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  URLを追加
                </button>
              </div>
            )}
            <button
              onClick={closeAttachmentModal}
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default ChatInput;
