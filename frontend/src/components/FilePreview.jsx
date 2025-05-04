import React from 'react';
import { FileText, AlertTriangle, X, Loader2 } from 'lucide-react';

/**
 * 個々のアップロードファイルを表示するコンポーネント
 * @param {object} props
 * @param {object} props.fileData - useFileUploadフックからのファイルオブジェクト { id, file, preview, error, type }
 * @param {function} props.onRemove - ファイル削除ボタンクリック時のコールバック (fileIdを引数)
 * @param {boolean} [props.isLoading] - ファイル処理中などのローディング状態を示すフラグ
 */
function FilePreview({ fileData, onRemove, isLoading = false }) {
  const { id, file, preview, error, type } = fileData;
  const fileName = file?.name || '不明なファイル';
  const fileSizeMB = file?.size ? (file.size / 1024 / 1024).toFixed(2) : '?'; // MB単位で表示

  const handleRemoveClick = (e) => {
    e.stopPropagation(); // 親要素へのイベント伝播を停止
    if (onRemove && !isLoading) { // ローディング中でなければ削除
      onRemove(id);
    }
  };

  // ファイルタイプに応じたアイコンとスタイル
  let icon = <FileText className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />;
  let borderColor = 'border-gray-300 dark:border-gray-600';
  let textColor = 'text-gray-700 dark:text-dark-text';
  let backgroundClass = 'bg-white dark:bg-dark-card'; // デフォルト背景クラス

  if (error || type === 'unsupported') {
    icon = <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />;
    borderColor = 'border-red-400 dark:border-red-500';
    textColor = 'text-red-700 dark:text-red-300';
    backgroundClass = 'bg-red-50 dark:bg-red-900/30'; // エラー時の背景クラス
  }

  return (
    <div
      className={`relative flex items-start gap-3 p-3 border ${borderColor} ${backgroundClass} rounded-lg shadow-sm transition-colors duration-150 max-w-md`} // bgColor を backgroundClass に変更
      aria-label={`ファイルプレビュー: ${fileName}`}
    >
      {/* アイコン */}
      <div className="mt-1">{icon}</div>

      {/* ファイル情報 */}
      <div className="flex-1 min-w-0"> {/* これでテキストがはみ出ないように */}
        <p className={`text-sm font-medium truncate ${textColor}`} title={fileName}>
          {fileName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {fileSizeMB} MB
          {type === 'text' && !error && ' (テキスト)'}
          {type === 'unsupported' && !error && ' (非サポート)'}
        </p>

        {/* テキストプレビュー */}
        {type === 'text' && preview && !error && (
          <pre className="mt-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-dark-background p-2 rounded overflow-x-auto max-h-20">
            <code>{preview}</code>
          </pre>
        )}

        {/* エラーメッセージ */}
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium break-words">
            エラー: {error}
          </p>
        )}
      </div>

      {/* 削除ボタン */}
      <button
        onClick={handleRemoveClick}
        disabled={isLoading} // ローディング中は無効化
        className={`absolute top-1 right-1 p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity`}
        aria-label={`ファイル ${fileName} を削除`}
        title="削除"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export default FilePreview;
