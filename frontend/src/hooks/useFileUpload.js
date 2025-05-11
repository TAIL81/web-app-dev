import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// サポートするテキストファイルの拡張子 (useChat.js から移動)
const SUPPORTED_TEXT_EXTENSIONS = /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i;
const MAX_FILE_SIZE_MB = 5; // 例: 5MBを上限とする
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Fileオブジェクトを非同期で読み込み、内容またはエラーを返すPromiseを生成します。
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<{id: string, file: File, preview: string|null, error: string|null, type: 'text'|'unsupported'}>}
 */
const readFileForPreview = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const fileId = uuidv4();
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    // ファイルサイズチェック
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      resolve({
        id: fileId,
        file: file,
        preview: null,
        error: `ファイルサイズが大きすぎます (${(fileSize / 1024 / 1024).toFixed(1)}MB)。${MAX_FILE_SIZE_MB}MB以下にしてください。`,
        type: 'unsupported',
      });
      return;
    }

    // テキストファイルかどうかの判定
    const isTextFile = fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName);

    reader.onload = (e) => {
      if (isTextFile) {
        // テキストファイルの場合、最初の数行をプレビューとして取得
        const content = e.target.result;
        const lines = content.split('\n');
        const previewText = lines.slice(0, 5).join('\n') + (lines.length > 5 ? '\n...' : '');
        resolve({
          id: fileId,
          file: file,
          preview: previewText, // テキスト内容のプレビュー
          error: null,
          type: 'text',
        });
      } else {
        // テキストファイル以外はサポート外とする (将来的には画像なども対応可能)
        resolve({
          id: fileId,
          file: file,
          preview: null, // サポート外の場合はプレビューなし
          error: `サポート外のファイル形式です。`, // エラーメッセージを簡略化
          type: 'unsupported',
        });
      }
    };

    reader.onerror = (err) => {
      console.error(`File reading error for ${fileName}:`, err);
      resolve({
        id: fileId,
        file: file,
        preview: null,
        error: 'ファイル読み込みエラー。', // エラーメッセージを簡略化
        type: 'unsupported',
      });
    };

    // テキストファイルのみ読み込み試行
    if (isTextFile) {
      reader.readAsText(file);
    } else {
      // テキスト以外は onload でエラー処理されるのでここでは何もしない
      // (onload が reader.readAsText の後に呼ばれることを保証するため)
      // ダミーの読み込みを開始して onload/onerror をトリガーさせる
      // (readAsDataURL などでも良いが、ここでは不要なので空で)
       try {
         // 何か読み込みを開始しないと onload/onerror が呼ばれない場合がある
         reader.readAsArrayBuffer(new Blob());
       } catch (e) {
         // Blob作成失敗など、予期せぬエラーはonerrorで処理される想定
         console.error("Dummy read trigger failed:", e);
       }
    }
  });
};

const useFileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]); // {id, file, preview, error, type} の配列
  const [isDragging, setIsDragging] = useState(false);

  // ファイルを追加する関数 (input onChange, drop で使用)
  const addFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    // まずプレビュー用の情報を生成
    const newFilesPreviewPromises = Array.from(files).map(readFileForPreview);
    const newFilePreviewResults = await Promise.all(newFilesPreviewPromises);

    // プレビュー情報をUIに即時反映
    setUploadedFiles(prev => [...prev, ...newFilePreviewResults.filter(f => !f.error)]); // エラーのないものだけ一旦追加

    // FormData を作成してファイルを追加
    const formData = new FormData();
    const filesToUpload = newFilePreviewResults.filter(f => !f.error && f.file); // エラーがなく、Fileオブジェクトが存在するもの
    
    if (filesToUpload.length === 0) {
      // アップロードするファイルがない場合は、エラーのあるファイルのみUIに残す
      setUploadedFiles(prev => prev.map(existingFile => {
        const erroredPreview = newFilePreviewResults.find(nf => nf.id === existingFile.id && nf.error);
        return erroredPreview || existingFile;
      }));
      return;
    }

    filesToUpload.forEach(fileData => {
      formData.append('file', fileData.file, fileData.file.name); // FastAPI側は 'file' というキーを期待
    });

    try {
      // バックエンドにアップロード
      const response = await fetch('/api/upload', { // FastAPIのエンドポイント
        method: 'POST',
        body: formData,
        // headers: { 'Content-Type': 'multipart/form-data' } // FormDataの場合、ブラウザが自動で設定するので通常不要
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'アップロードに失敗しました。サーバーからの応答が無効です。' }));
        console.error('File upload failed:', errorData);
        // アップロード失敗したファイルのプレビューにエラー情報を更新
        setUploadedFiles(prev =>
          prev.map(pf => {
            if (filesToUpload.some(f_to_upload => f_to_upload.id === pf.id)) {
              return { ...pf, error: errorData.detail || 'アップロード失敗' };
            }
            return pf;
          })
        );
        return;
      }

      const result = await response.json();
      console.log('File upload successful:', result);
      // アップロード成功時の処理 (必要であればプレビュー情報を更新など)
      // 現状では特にプレビュー情報を更新する必要はないが、サーバーからの情報で何かしたい場合はここで行う
      // 例えば、サーバー側でファイル名が変更された場合などに対応

    } catch (error) {
      console.error('Error during file upload:', error);
      // ネットワークエラーなどでアップロード失敗したファイルのプレビューにエラー情報を更新
      setUploadedFiles(prev =>
        prev.map(pf => {
          if (filesToUpload.some(f_to_upload => f_to_upload.id === pf.id)) {
            return { ...pf, error: 'アップロード中にネットワークエラーが発生しました。' };
          }
          return pf;
        })
      );
    }
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
