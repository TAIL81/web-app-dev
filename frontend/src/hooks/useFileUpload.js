import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// サポートするテキストファイルの拡張子
const SUPPORTED_TEXT_EXTENSIONS = /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i;
// サポートする画像MIMEタイプ
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_TEXT_FILE_SIZE_MB = 5; // テキストファイルの最大サイズ
const MAX_IMAGE_FILE_SIZE_MB = 4; // 画像ファイルの最大サイズ (Groq APIのBase64制限に合わせる)
const MAX_TEXT_FILE_SIZE_BYTES = MAX_TEXT_FILE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;


/**
 * Fileオブジェクトを非同期で読み込み、プレビュー情報またはエラーを返すPromiseを生成します。
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<{id: string, file: File, preview: string|null, error: string|null, type: 'text'|'image'|'unsupported'}>}
 */
const readFileForPreview = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const fileId = uuidv4();
    const fileName = file.name;
    const fileType = file.type; // MIMEタイプ
    const fileSize = file.size;

    const isTextFile = fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName);
    const isImageFile = SUPPORTED_IMAGE_TYPES.includes(fileType);

    // ファイルサイズチェック
    if (isImageFile && fileSize > MAX_IMAGE_FILE_SIZE_BYTES) {
      resolve({
        id: fileId, file, preview: null,
        error: `画像ファイルサイズが大きすぎます (${(fileSize / 1024 / 1024).toFixed(1)}MB)。${MAX_IMAGE_FILE_SIZE_MB}MB以下にしてください。`,
        type: 'unsupported',
      });
      return;
    }
    if (isTextFile && fileSize > MAX_TEXT_FILE_SIZE_BYTES) {
      resolve({
        id: fileId, file, preview: null,
        error: `テキストファイルサイズが大きすぎます (${(fileSize / 1024 / 1024).toFixed(1)}MB)。${MAX_TEXT_FILE_SIZE_MB}MB以下にしてください。`,
        type: 'unsupported',
      });
      return;
    }
    if (!isTextFile && !isImageFile) {
        resolve({ id: fileId, file, preview: null, error: 'サポート外のファイル形式です。テキストまたは画像ファイルを選択してください。', type: 'unsupported' });
        return;
    }


    reader.onload = (e) => {
      if (isTextFile) {
        const content = e.target.result;
        const lines = content.split('\n');
        const previewText = lines.slice(0, 5).join('\n') + (lines.length > 5 ? '\n...' : '');
        resolve({ id: fileId, file, preview: previewText, error: null, type: 'text' });
      } else if (isImageFile) {
        resolve({ id: fileId, file, preview: e.target.result, error: null, type: 'image' }); // e.target.result は dataURL
      }
      // このelseは通常到達しないはず (上で判定済みのため)
    };

    reader.onerror = (err) => {
      console.error(`File reading error for ${fileName}:`, err);
      resolve({ id: fileId, file, preview: null, error: 'ファイル読み込みエラー。', type: 'unsupported' });
    };

    if (isTextFile) {
      reader.readAsText(file);
    } else if (isImageFile) {
      reader.readAsDataURL(file); // 画像はDataURLとして読み込む
    }
    // サポート外の場合は既に上でresolveされている
  });
};

const useFileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]); // {id, file, preview, error, type} の配列
  const [isDragging, setIsDragging] = useState(false);

  // ファイルを追加する関数 (input onChange, drop で使用)
  // このフックはファイルの選択とプレビュー生成のみを担当。実際のアップロードはuseChatで行う。
  const addFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const newFilesPromises = Array.from(files).map(readFileForPreview);
    const newFileResults = await Promise.all(newFilesPromises);

    setUploadedFiles(prev => {
      const updatedFiles = [...prev];
      newFileResults.forEach(newFile => {
        // 重複チェック (オプション、ファイル名とサイズで簡易的に)
        // const isDuplicate = prev.some(existingFile => existingFile.file.name === newFile.file.name && existingFile.file.size === newFile.file.size);
        // if (!isDuplicate) {
        updatedFiles.push(newFile);
        // }
      });
      return updatedFiles;
    });
  }, []);

  // 特定のファイルをリストから削除する関数
  const removeFile = useCallback((fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // 全てのファイルをクリアする関数
  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  // ドラッグイベントハンドラ
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // 要素から離れた場合のみ isDragging を false にする
    // (子要素への移動では false にしないための工夫が必要な場合がある)
    // 簡単な実装として、関連ターゲットがなければ離れたとみなす
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
        setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); // これがないと drop イベントが発生しない
    e.stopPropagation();
    setIsDragging(true); // ドラッグオーバー中は true を維持
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
      // クリーンアップ (ブラウザによっては必要)
      if (e.dataTransfer.items) {
        e.dataTransfer.items.clear();
      } else {
        e.dataTransfer.clearData();
      }
    }
  }, [addFiles]);

  // input[type=file] の変更ハンドラ
  const handleFileChange = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
    // 同じファイルを連続で選択できるように値をリセット
    e.target.value = null;
  }, [addFiles]);

  return {
    uploadedFiles,
    isDragging,
    addFiles,
    removeFile,
    clearFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
  };
};

export default useFileUpload;
