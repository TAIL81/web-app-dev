import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // uuid をインポート

// --- 定数 ---
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'; // バックエンドAPIのURL

// --- 初期状態 ---
const initialMessages = [
  { id: uuidv4(), role: 'assistant', content: '本日はどのようなお手伝いをさせていただけますか？' }
]; // チャットの初期メッセージ

// --- ヘルパー関数 (Base64エンコード) ---
/**
 * FileオブジェクトをBase64エンコードされた文字列として非同期で読み込みます。
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<string>} Base64エンコードされたファイル内容 (data URL形式)
 */
const encodeFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result); // result は data:image/jpeg;base64,... のような形式
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

// --- メインフック ---
const useChat = () => {
  // --- StateとRef ---
  const [messages, setMessages] = useState(initialMessages); // チャットメッセージ配列
  const [input, setInput] = useState(''); // テキスト入力欄
  const [isLoading, setIsLoading] = useState(false); // ローディング状態 (API通信など)
  const [error, setError] = useState(null); // エラーメッセージ表示用
  const messagesEndRef = useRef(null); // チャット末尾への自動スクロール用Ref
  const [availableModels, setAvailableModels] = useState([]); // 利用可能なモデルIDリスト
  const [selectedModel, setSelectedModel] = useState(''); // 選択中のモデルID
  const [isModelsLoading, setIsModelsLoading] = useState(true); // モデルリスト取得中のローディング状態

  // --- Effect ---
  // 自動スクロール無効化
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // };
  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages]);

  // コンポーネントマウント時に利用可能なモデルリストを取得
  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true); // ローディング開始
      setError(null); // 既存のエラーをクリア
      try {
        const response = await fetch(`${BACKEND_URL}/api/models`); // 新しいエンドポイントを叩く
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models); // 取得したモデルIDリストをセット
          setSelectedModel(data.models[0]); // リストの最初のモデルをデフォルト選択
        } else { // モデルリストが空の場合
          console.warn("No available models received from backend or list is empty.");
          setAvailableModels([]); // 利用可能なモデルがない場合は空リスト
          setSelectedModel(''); // 選択も空に
        }
      } catch (err) {
        console.error("Error fetching available models:", err);
        setError("利用可能なAIモデルの取得中にエラーが発生しました。");
        setAvailableModels([]); // エラー時も空リスト
        setSelectedModel(''); // エラー時は選択なし
      } finally {
        setIsModelsLoading(false); // ローディング終了
      }
    };
    fetchModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時に一度だけ実行

  // --- ヘルパー関数 (メッセージ送信ロジック) ---

  /**
   * テキスト入力とアップロードされたファイル情報からユーザー表示用コンテンツ文字列を構築します。
   * API送信用のメッセージは prepareApiMessages で別途構築されます。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<{filename: string, type: 'text' | 'image', saved_path?: string, groq_file_id?: string, base64_content?: string}>} processedFileInfos - 処理されたファイル情報
   * @returns {string} ユーザー表示用コンテンツ文字列
   */
  const buildUserDisplayContent = (textInput, processedFileInfos) => {
    let displayContent = textInput;
    if (processedFileInfos && processedFileInfos.length > 0) {
      const fileDescriptions = processedFileInfos.map(info => {
        if (info.type === 'image') {
          return `\n[添付画像: ${info.filename}]`;
        } else if (info.groq_file_id) {
          return `\n[添付ファイル: ${info.filename} (Groq File ID: ${info.groq_file_id})]`;
        } else if (info.saved_path) {
          return `\n[添付ファイル: ${info.filename} (ローカルパス: ${info.saved_path})]`;
        }
        return `\n[添付ファイル: ${info.filename}]`; // フォールバック
      }).join('');
      displayContent += fileDescriptions;
    }
    return displayContent;
  };

  /**
   * API送信直前にUIを更新します (テキストメッセージのみ追加)。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<object>} currentMessages - 現在のメッセージ配列
   * @param {Function} setMessages - messages state 更新関数
   * @returns {{ updatedMessages: Array<object>, newUserTextMessage: object|null }} UI更新後のメッセージ配列と追加されたユーザーテキストメッセージ
   */
  const updateUiBeforeSend = (textInput, currentMessages, setMessages) => {
    let newUserTextMessage = null;
    let updatedMessages = [...currentMessages];

    if (textInput) {
      newUserTextMessage = { id: uuidv4(), role: 'user', content: textInput, sentToApi: true }; // 送信フラグを立てて追加
      updatedMessages.push(newUserTextMessage);
      setMessages(updatedMessages); // UIを即時更新
    }
    // ファイル添付のUIメッセージはここでは追加しない (ChatInput側でプレビュー表示)
    return { updatedMessages, newUserTextMessage };
  };


  /**
   * APIに送信するためのメッセージ履歴配列を準備します (履歴件数制限あり)。
   * 画像ファイルがある場合は、content を配列形式にします。
   * @param {Array<object>} allMessages - 全てのメッセージ履歴
   * @param {object|null} currentUserTextMessage - 今回のユーザーテキストメッセージオブジェクト
   * @param {string} textInput - ユーザーのテキスト入力
   * @param {Array<{filename: string, type: 'text' | 'image', saved_path?: string, groq_file_id?: string, base64_content?: string}>} processedFileInfos - 処理されたファイル情報
   * @returns {Array<object>} API送信用に整形されたメッセージ配列
   */
  const prepareApiMessages = (allMessages, currentUserTextMessage, textInput, processedFileInfos) => {
    const MAX_HISTORY_PAIRS = 5;
    const MAX_API_MESSAGES = MAX_HISTORY_PAIRS * 2;

    const pastMessagesOnly = currentUserTextMessage
        ? allMessages.filter(msg => msg.id !== currentUserTextMessage.id)
        : allMessages;

    const relevantPastMessages = pastMessagesOnly.filter(msg => {
        if (msg.hidden) return false;
        // 過去のメッセージは content が文字列であることを想定
        return msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string');
    });

    const limitedPastMessages = relevantPastMessages.slice(-MAX_API_MESSAGES);
    const pastMessagesForApi = limitedPastMessages.map(msg => ({
        role: msg.role,
        content: msg.content // 過去メッセージは content が文字列
    }));

    // 今回のユーザー入力メッセージの content を構築
    let currentMessageContent = [];
    if (textInput) {
        currentMessageContent.push({ type: "text", text: textInput });
    }

    processedFileInfos.forEach(info => {
        if (info.type === 'image' && info.base64_content) {
            currentMessageContent.push({
                type: "image_url",
                image_url: { "url": info.base64_content } // base64_content は data URL 形式
            });
        } else if (info.type === 'text' && info.groq_file_id) {
            // テキストファイルの場合、Groq File ID をテキストとして含めるか、
            // バックエンドでファイル内容を取得して結合するかはバックエンドの実装による。
            // ここでは、Groq File ID を示す情報をテキストとして追加する。
            // バックエンドがこれを解釈してファイル内容を差し込む想定。
             currentMessageContent.push({ type: "text", text: `\n[添付ファイル: ${info.filename} (Groq File ID: ${info.groq_file_id})]` });
        } else if (info.type === 'text' && info.saved_path) {
            // ローカルパスの場合も同様
            currentMessageContent.push({ type: "text", text: `\n[添付ファイル: ${info.filename} (ローカルパス: ${info.saved_path})]` });
        }
    });
    
    // content が空配列の場合はテキスト入力のみとする (Groq API仕様に合わせる)
    const finalCurrentContent = currentMessageContent.length > 0 ? currentMessageContent : textInput;

    const currentMessageForApi = { role: 'user', content: finalCurrentContent };
    const messagesForApi = [...pastMessagesForApi, currentMessageForApi];

    if (process.env.NODE_ENV === 'development') {
        console.log(`prepareApiMessages: Sending ${messagesForApi.length} messages (Limit: ${MAX_API_MESSAGES} past + 1 current max)`);
        // console.log("Messages for API:", JSON.stringify(messagesForApi, null, 2));
    }

    return messagesForApi;
  };

  /**
   * API呼び出しでエラーが発生した場合の処理。
   * @param {Error} error - 発生したエラーオブジェクト
   * @param {Function} setError - error state 更新関数
   * @param {Function} setMessages - messages state 更新関数
   * @param {object|null} failedTextMessage - 送信試行したテキストメッセージオブジェクト
   */
  const handleApiError = (error, setError, setMessages, failedTextMessage) => {
    console.error("API処理エラー:", error);
    let userFriendlyError = `メッセージの送信に失敗しました。`;
    if (error.message) {
        userFriendlyError += ` 詳細: ${error.message}`;
    }
    setError(userFriendlyError); // エラーメッセージをUIに表示

    // 送信に失敗したテキストメッセージの sentToApi フラグを false に戻す (再試行可能にするため)
    if (failedTextMessage) {
        setMessages(prev => prev.map(msg =>
            msg.id === failedTextMessage.id ? { ...msg, sentToApi: false } : msg
        ));
    }
    // ファイルのUI状態は ChatInput 側で管理されているため、ここでは何もしない
  };


  // --- コア関数 ---

  /**
   * メッセージ送信処理のメイン関数。
   * @param {Array<object>} [uploadedFilesData=[]] - useFileUploadから渡されるファイル情報配列 [{id, file, preview, error, type}, ...]
   */
  const handleSend = useCallback(async (uploadedFilesData = []) => {
    const currentInput = input.trim();
    // 送信する有効なファイルのみをフィルタリング (エラーがないもの)
    // 画像とテキストファイルの両方を許容
    const validFilesToProcess = uploadedFilesData.filter(f => !f.error && (f.type === 'text' || f.file?.type?.startsWith('image/')));

    // 送信条件チェック
    if ((!currentInput && validFilesToProcess.length === 0) || isLoading || isModelsLoading || !selectedModel) {
      if (process.env.NODE_ENV === 'development') {
        console.log("送信条件未達:", { currentInput, validFiles: validFilesToProcess.length, isLoading, isModelsLoading, selectedModel });
      }
      if (!isLoading && (isModelsLoading || !selectedModel)) {
          setError("送信前にモデルを選択してください (ロード中または利用不可)。");
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    let newUserTextMessage = null; // スコープ内で参照するため

    try {
      const processedFileInfos = [];

      // 1. ファイルの前処理 (テキストはアップロード、画像はBase64エンコード)
      if (validFilesToProcess.length > 0) {
        const fileProcessingPromises = validFilesToProcess.map(async (fileData) => {
          if (fileData.file?.type?.startsWith('image/')) {
            // 画像ファイルの場合
            if (fileData.file.size > 4 * 1024 * 1024) { // 4MB制限
              setError(`画像ファイル '${fileData.file.name}' が大きすぎます (最大4MB)。`);
              return null;
            }
            try {
              const base64_content = await encodeFileToBase64(fileData.file);
              return { filename: fileData.file.name, type: 'image', base64_content };
            } catch (encodeError) {
              console.error(`Error encoding image ${fileData.file.name}:`, encodeError);
              setError(`画像 '${fileData.file.name}' の処理中にエラーが発生しました。`);
              return null;
            }
          } else if (fileData.type === 'text') {
            // テキストファイルの場合 (従来通りバックエンドにアップロード)
            const formData = new FormData();
            formData.append('file', fileData.file);
            try {
              const uploadResponse = await fetch(`${BACKEND_URL}/api/upload`, {
                method: 'POST',
                body: formData,
              });
              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => ({ detail: `ファイルアップロードエラー: ${uploadResponse.status}` }));
                throw new Error(errorData.detail || `ファイル '${fileData.file.name}' のアップロードに失敗しました。`);
              }
              const result = await uploadResponse.json();
              return { filename: result.filename, type: 'text', saved_path: result.saved_path, groq_file_id: result.groq_file_id };
            } catch (uploadError) {
              console.error(`Error uploading ${fileData.file.name}:`, uploadError);
              setError(`ファイル '${fileData.file.name}' のアップロード中にエラー: ${uploadError.message}`);
              return null;
            }
          }
          return null; // サポート外のタイプ
        });

        const results = await Promise.all(fileProcessingPromises);
        results.forEach(result => {
          if (result) {
            processedFileInfos.push(result);
          }
        });

        if (processedFileInfos.length !== validFilesToProcess.length) {
            console.warn("いくつかのファイルの処理に失敗しました。");
             // エラーが発生したファイルがある場合、ここで処理を中断するかどうかを決定
        }
      }
      
      // 2. ユーザー表示用コンテンツ作成
      const userDisplayContent = buildUserDisplayContent(currentInput, processedFileInfos);

      // 3. UI更新 (ユーザーのテキストメッセージのみをまず表示)
      const { updatedMessages, newUserTextMessage: createdMessage } = updateUiBeforeSend(userDisplayContent, messages, setMessages);
      newUserTextMessage = createdMessage;
      setInput('');

      // 4. API送信用メッセージ履歴作成
      // prepareApiMessages はテキスト入力と処理済みファイル情報 (画像はbase64、テキストはID/パス) を受け取る
      const messagesForApi = prepareApiMessages(updatedMessages, newUserTextMessage, currentInput, processedFileInfos);

      // 送信するユーザーコンテンツがない場合は異常系 (通常発生しないはず)
      if (!messagesForApi.some(m => m.role === 'user')) {
         console.warn("送信するユーザーコンテンツがありません。UIをロールバックします。");
         setIsLoading(false);
         // UIロールバック (テキストメッセージ削除、入力復元)
         if (newUserTextMessage) {
             setMessages(prev => prev.filter(msg => msg.id !== newUserTextMessage.id));
         }
         setInput(currentInput);
         // ファイルは ChatInput 側でクリアされているはずなので、ここでは何もしない
         return;
      }

      // 5. API呼び出し & 応答処理
      const requestBody = {
        messages: messagesForApi,
        purpose: 'main_chat',
        model_name: selectedModel,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log("Sending to API:", JSON.stringify(requestBody, null, 2));
      }

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          errorData = await response.json();
          if (errorData && errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorDetail = errorData.detail.map(d => `[${d.loc?.join('->') || 'N/A'}]: ${d.msg || 'No message'}`).join('; ');
            } else if (typeof errorData.detail === 'string') {
              errorDetail = errorData.detail;
            } else {
              errorDetail = JSON.stringify(errorData.detail);
            }
          } else if (errorData) {
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        const error = new Error(errorDetail);
        error.responseDetails = errorData;
        throw error;
      }

      // 6. API成功時のUI更新 (アシスタントの応答を追加)
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning,
          tool_calls: data.tool_calls,
          executed_tools: data.executed_tools // ★ executed_tools をメッセージに追加
        },
      ]);

    } catch (err) {
      // 7. APIエラー時の処理 (エラー表示、UIロールバックの一部)
      handleApiError(err, setError, setMessages, newUserTextMessage);
      // エラー発生時は入力欄の内容を戻さない（ユーザーが再編集できるように）
      // ファイルのプレビューもクリアしない（ユーザーが再試行できるように）
    } finally {
      setIsLoading(false); // ローディング終了
    } // isExpanding の依存を削除
  // 依存配列: messages は直接使わないが、履歴更新のトリガーとして含める場合がある
  }, [input, isLoading, selectedModel, isModelsLoading, messages, setMessages, setError, setInput]);

  /**
   * チャット履歴をクリアする関数 (フロントエンドの状態のみクリア)。
   */
  const handleClearChat = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
        console.log('useChat: handleClearChat called');
    }
    setMessages(initialMessages); // 初期メッセージの状態に戻す
    setError(null);
    setIsLoading(false);
    setInput('');
    // ファイルプレビューのクリアは ChatInput 側で行う必要がある (clearFiles を呼ぶ)
  }, [setMessages, setError, setIsLoading, setInput]);


  // --- フックの戻り値 ---
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    messagesEndRef,
    handleSend,
    handleClearChat,
    selectedModel,
    setSelectedModel,
    availableModels,
    isModelsLoading,
  };
};

export default useChat; // フックをエクスポート
