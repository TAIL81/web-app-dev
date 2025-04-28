// d:\Users\onisi\Documents\web-app-dev\frontend\src\hooks\useChat.js
import { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
const MAX_FILE_TEXT_LENGTH = 2000; // 添付テキストファイルの最大文字数 (ハードコーディングを避ける)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'; // バックエンドURL

// --- Initial State ---
// フックの外に定義することで参照が安定し、useCallback の依存配列の問題を回避
const initialMessages = [
  // 必要に応じて初期システムメッセージを追加できます
  // 例: { role: 'system', content: 'あなたは親切なアシスタントです。', hidden: true },
];

// --- Helper Functions (File Processing) ---

/**
 * 単一ファイルを非同期で読み込み、処理結果を返す Promise を生成する
 * @param {File} file 処理対象のファイルオブジェクト
 * @returns {Promise<{fileData: object|null, error: string|null, fileName: string}>} 処理結果
 */
const readFileAsPromise = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const fileType = file.type;
    const fileName = file.name;

    reader.onload = (e) => {
      const fileContent = e.target.result;
      let fileData = null;
      let error = null;
      try {
        if (fileType.startsWith('image/')) {
          fileData = { type: "image_url", url: fileContent, fileName: fileName };
        } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
          fileData = { type: "text", text: fileContent, fileName: fileName };
        } else {
          error = `サポートされていないファイル形式です (${fileType})`;
        }
      } catch (err) {
        console.error(`Error processing file ${fileName}:`, err);
        error = `ファイル処理中にエラー: ${err.message}`;
      }
      resolve({ fileData, error, fileName }); // 結果をオブジェクトで返す
    };

    reader.onerror = (err) => {
      console.error(`File reading error for ${fileName}:`, err);
      resolve({ fileData: null, error: 'ファイル読み込みエラーが発生しました。', fileName });
    };

    // ファイル形式に応じて読み込み方法を選択
    if (fileType.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else if (fileType.startsWith('text/') || /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i.test(fileName)) {
      reader.readAsText(file);
    } else {
      // サポート外の場合は読み込まずにエラーメッセージを resolve
      resolve({ fileData: null, error: `サポートされていないファイル形式です (${fileType})`, fileName });
    }
  });
};

/**
 * ファイル読み込み結果からUI表示用のメッセージオブジェクトを作成する
 * @param {{fileData: object|null, error: string|null, fileName: string}} result readFileAsPromise の結果
 * @returns {object|null} UIメッセージオブジェクト、またはエラーがない場合は null
 */
const createFileUiMessage = (result) => {
  const { fileData, error, fileName } = result;
  if (error) {
    // エラーメッセージは送信済み扱い (sentToApi: true)
    return { role: 'user', content: `[ファイル処理エラー: ${fileName}]`, isFileAttachment: false, error: error, sentToApi: true };
  } else if (fileData?.type === 'image_url') {
    return { role: 'user', content: `[画像添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
  } else if (fileData?.type === 'text') {
    return { role: 'user', content: `[ファイル添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false };
  }
  // ここには到達しないはずだが念のため
  return null;
};


// --- Main Hook ---
const useChat = () => {
  // --- State and Refs ---
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [isExpanding, setIsExpanding] = useState(false);

  // --- Effects ---
  // メッセージが更新されたときに一番下にスクロールする
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Helper Functions (Message Sending Logic) ---

  /**
   * テキスト入力とファイル情報から API 送信用の結合コンテンツを作成する
   * @param {string} textInput ユーザーのテキスト入力
   * @param {Array<object>} pendingFileMessages 未送信のファイルメッセージオブジェクト配列
   * @returns {string} 結合されたコンテンツ文字列
   */
  const buildCombinedContent = (textInput, pendingFileMessages) => {
    // --- API送信用コンテンツ作成 ---
    // 現在のバックエンドはテキスト入力のみを受け付けるため、
    // ファイルの内容を説明文としてテキストに埋め込みます。
    // 画像はファイル名のみ、テキストは内容を一部含めます。
    // 将来的にバックエンドがファイル自体を受け付けるようになった場合、
    // この部分とAPI呼び出し方法 (例: FormData使用) を変更する必要があります。
    let combinedContent = textInput;
    const filesToSend = pendingFileMessages.map(msg => msg.fileData).filter(Boolean);

    if (filesToSend.length > 0) {
      const fileDescriptions = filesToSend.map(fileData => {
        if (fileData.type === 'image_url') {
          return `\n[添付画像: ${fileData.fileName || '名称不明'}]`;
        } else if (fileData.type === 'text') {
          const truncatedText = fileData.text.length > MAX_FILE_TEXT_LENGTH
            ? fileData.text.substring(0, MAX_FILE_TEXT_LENGTH) + '... (省略)'
            : fileData.text;
          return `\n[添付ファイル: ${fileData.fileName || '名称不明'}]\n\`\`\`\n${truncatedText}\n\`\`\``;
        }
        return '';
      }).join('');
      combinedContent += fileDescriptions;
    }
    return combinedContent;
  };

  /**
   * メッセージ送信前のUI更新を行う (ユーザーメッセージ追加、sentToApiフラグ更新)
   * @param {string} textInput ユーザーのテキスト入力
   * @param {Array<object>} pendingFileMessages 未送信のファイルメッセージオブジェクト配列
   * @param {Array<object>} currentMessages 現在のメッセージリスト
   * @param {Function} setMessages メッセージリスト更新関数
   * @returns {Array<object>} 更新後のメッセージリスト
   */
  const updateUiBeforeSend = (textInput, pendingFileMessages, currentMessages, setMessages) => {
    let updatedMessages = [...currentMessages];
    if (textInput) {
      const newUserTextMessage = { role: 'user', content: textInput, sentToApi: false };
      updatedMessages.push(newUserTextMessage);
    }
    // 今回送信対象となるユーザーメッセージ (テキストとファイル両方) に送信済みマークを付ける
    const finalMessages = updatedMessages.map(msg =>
      (msg.role === 'user' && !msg.sentToApi && (msg.content === textInput || pendingFileMessages.some(pfm => pfm.fileData === msg.fileData)))
        ? { ...msg, sentToApi: true }
        : msg
    );
    setMessages(finalMessages);
    return finalMessages; // 更新後のリストを返す
  };

  /**
   * APIに送信するメッセージ配列を準備する
   * @param {Array<object>} updatedMessages UI更新後のメッセージリスト
   * @param {string} combinedContent 結合された現在のユーザー入力コンテンツ
   * @returns {Array<object>} API送信用メッセージ配列
   */
  const prepareApiMessages = (updatedMessages, combinedContent) => {
    // APIに送信する過去のメッセージ履歴を作成 (非表示、ファイル添付プレースホルダーを除く)
    // 注意: updateUiBeforeSend で sentToApi=true になったものも含める
    const pastMessagesForApi = updatedMessages
      .filter(msg => !msg.hidden && msg.sentToApi === true && !msg.isFileAttachment)
      .map(msg => ({ role: msg.role, content: msg.content }));

    // 今回送信するユーザーメッセージを作成 (テキストとファイル説明を結合したもの)
    let currentMessageForApi = null;
    if (combinedContent) {
      currentMessageForApi = { role: 'user', content: combinedContent };
    }

    // 過去のメッセージと今回のメッセージを結合
    const messagesForApi = [...pastMessagesForApi];
    // 結合コンテンツがある場合のみ現在のメッセージを追加
    // (ファイルのみ送信の場合も combinedContent にファイル説明が入る)
    if (currentMessageForApi) {
      messagesForApi.push(currentMessageForApi);
    }

    return messagesForApi;
  };

  /**
   * APIエラー発生時の処理 (エラー表示、sentToApiフラグのロールバック)
   * @param {Error} error 発生したエラーオブジェクト
   * @param {Function} setError エラー状態更新関数
   * @param {Function} setMessages メッセージリスト更新関数
   * @param {string} originalTextInput 送信試行したテキスト入力
   * @param {Array<object>} originalPendingFiles 送信試行したファイルメッセージ
   */
  const handleApiError = (error, setError, setMessages, originalTextInput, originalPendingFiles) => {
    console.error("API処理エラー:", error);

    // より詳細なエラーメッセージを生成
    let userFriendlyError = `メッセージの送信に失敗しました。`;
    if (error.message) {
        userFriendlyError += ` 詳細: ${error.message}`;
    }
    // TODO: 必要に応じて error オブジェクトの他のプロパティ (例: error.responseDetails) を確認し、
    // さらに具体的な情報 (例: どのファイルが原因か) をメッセージに追加する

    setError(userFriendlyError);

    // 送信失敗したユーザーメッセージを未送信状態に戻す (再試行可能にするため)
    setMessages(prev => prev.map(msg => {
      const isFailedText = msg.role === 'user' && msg.sentToApi === true && msg.content === originalTextInput && !msg.isFileAttachment;
      const isFailedFile = msg.role === 'user' && msg.sentToApi === true && msg.isFileAttachment && originalPendingFiles.some(pfm => pfm.fileData === msg.fileData);
      if (isFailedText || isFailedFile) {
        return { ...msg, sentToApi: false };
      }
      return msg;
    }));
  };


  // --- Core Functions ---

  /**
   * メッセージを送信する関数 (リファクタリング版)
   */
  const handleSend = useCallback(async () => {
    const pendingFileMessages = messages.filter(m => m.role === 'user' && m.isFileAttachment && !m.sentToApi);
    const currentInput = input.trim();

    if ((!currentInput && pendingFileMessages.length === 0) || isLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log("送信条件未達:", { currentInput, pendingFileMessages: pendingFileMessages.length, isLoading });
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. API送信用コンテンツ作成
    const combinedContent = buildCombinedContent(currentInput, pendingFileMessages);

    // 2. UI更新 (送信前にユーザーメッセージを表示 & sentToApiフラグ更新)
    const updatedMessages = updateUiBeforeSend(currentInput, pendingFileMessages, messages, setMessages);
    setInput(''); // 入力クリアはUI更新後

    // 3. API送信準備
    const messagesForApi = prepareApiMessages(updatedMessages, combinedContent);

    // 送信するユーザーコンテンツがあるか最終確認
    if (!messagesForApi.some(m => m.role === 'user')) {
       console.warn("送信するユーザーコンテンツがありません。UIをロールバックします。");
       setIsLoading(false);
       setMessages(messages); // 元のメッセージ状態に戻す
       setInput(currentInput); // 入力も戻す
       return;
    }

    // 4. API呼び出し & 応答処理
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("Sending to API:", JSON.stringify({ messages: messagesForApi, purpose: 'main_chat' }, null, 2));
      }

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          purpose: 'main_chat'
        }),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          errorData = await response.json();
          if (errorData && errorData.detail) {
            if (Array.isArray(errorData.detail)) { // FastAPI validation error
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
        // Error オブジェクトに詳細情報を持たせる (handleApiError で利用可能)
        const error = new Error(errorDetail);
        error.responseDetails = errorData; // 元のJSONデータも保持
        throw error;
      }

      // 5. API成功時のUI更新
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning,
          tool_calls: data.tool_calls
        },
      ]);

    } catch (err) {
      // 6. APIエラー時の処理
      handleApiError(err, setError, setMessages, currentInput, pendingFileMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, input, isLoading, setMessages, setError, setInput]); // 依存関係を明記

  /**
   * チャット履歴をクリアし、バックエンドに終了リクエストを送る関数
   */
  const handleClearChat = useCallback(async () => {
    if (window.confirm("チャット履歴をクリアし、サーバーを終了してもよろしいですか？")) {
      setMessages(initialMessages);
      setError(null);
      setIsLoading(false);
      setIsExpanding(false);
      setInput('');
      console.log('Chat history cleared locally.');

      try {
        const response = await fetch(`${BACKEND_URL}/api/exit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          console.log('Exit request sent successfully to backend.');
        } else {
          console.error('Failed to send exit request:', response.statusText);
          setError(`サーバー終了リクエストに失敗しました (${response.status})。サーバーは応答しない可能性があります。`);
        }
      } catch (error) {
        console.error('Error sending exit request:', error);
        console.log('Backend might have shut down as requested.');
      }
    }
  }, [setMessages, setError, setIsLoading, setIsExpanding, setInput]); // 依存する state setter を追加

  /**
   * ファイル選択イベントを処理する関数 (リファクタリング版)
   */
  const handleFileSelect = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null);

    // ヘルパー関数を使ってファイル読み込み Promise を作成
    const fileReadPromises = Array.from(files).map(readFileAsPromise);

    try {
      const results = await Promise.all(fileReadPromises);
      // ヘルパー関数を使って UI メッセージを作成
      const newUiMessages = results.map(createFileUiMessage).filter(Boolean);
      if (newUiMessages.length > 0) {
        setMessages(prev => [...prev, ...newUiMessages]);
      }
    } catch (err) {
      console.error("Error processing files with Promise.all:", err);
      setError("ファイル処理中に予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false);
      if (event.target) {
        event.target.value = null; // 同じファイルを再度選択可能にする
      }
    }
  }, [setMessages, setIsLoading, setError]); // 依存関係を明記

  // --- Return Values ---
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
    handleFileSelect,
    isExpanding,
    setIsExpanding,
  };
};

export default useChat;
