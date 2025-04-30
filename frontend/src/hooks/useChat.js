// d:\Users\onisi\Documents\web-app-dev\frontend\src\hooks\useChat.js
import { useState, useEffect, useRef, useCallback } from 'react';

// --- Constants ---
//const MAX_FILE_TEXT_LENGTH = 8000; // ファイル内容のプレビュー最大文字数 (現在は未使用)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'; // バックエンドAPIのURL
const SUPPORTED_TEXT_EXTENSIONS = /\.(md|py|js|ts|html|css|json|yaml|yml|csv|txt)$/i; // サポートするテキストファイルの拡張子

// --- Initial State ---
// チャットの初期メッセージ (必要に応じて変更)
const initialMessages = [
  // { role: 'assistant', content: 'こんにちは！どのようなご用件でしょうか？' }
];

// --- Helper Functions (File Processing) ---

/**
 * Fileオブジェクトを読み込み、内容 (テキスト) とエラーを返すPromiseを生成
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<{fileData: {type: string, text?: string, fileName: string}|null, error: string|null, fileName: string}>}
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
        // 画像ファイルの場合 (コメントアウト)
        // if (fileType.startsWith('image/')) {
        //   fileData = { type: "image_url", url: fileContent, fileName: fileName };
        // テキストベースのファイルの場合 (拡張子でも判定)
        /* } else */ if (fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName)) {
          fileData = { type: "text", text: fileContent, fileName: fileName }; // テキストファイルのみ処理
        } else {
          // サポート外のファイル形式
          error = `サポートされていないファイル形式です (${fileType})`;
        }
      } catch (err) {
        console.error(`Error processing file ${fileName}:`, err);
        error = `ファイル処理中にエラー: ${err.message}`;
      }
      resolve({ fileData, error, fileName });
    };

    // ファイル読み込みエラーハンドリング
    reader.onerror = (err) => {
      console.error(`File reading error for ${fileName}:`, err);
      resolve({ fileData: null, error: 'ファイル読み込みエラーが発生しました。', fileName });
    };

    // ファイルの種類に応じて読み込み方法を分岐
    // if (fileType.startsWith('image/')) { // 画像は扱わない (コメントアウト)
    //   reader.readAsDataURL(file); // 画像はDataURLとして読み込む
    /* } else */ if (fileType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.test(fileName)) {
      reader.readAsText(file); // テキストはテキストとして読み込む
    } else {
      // サポート外の場合はエラーとして即時解決
      resolve({ fileData: null, error: `サポートされていないファイル形式です (${fileType})`, fileName });
    }
  });
};

/**
 * ファイル読み込み結果からUI表示用のメッセージオブジェクトを生成
 * @param {{fileData: object|null, error: string|null, fileName: string}} result - readFileAsPromiseの結果
 * @returns {object|null} UI用メッセージオブジェクト or null
 */
const createFileUiMessage = (result) => {
  const { fileData, error, fileName } = result;
  if (error) {
    // エラーメッセージ
    return { role: 'user', content: `[ファイル処理エラー: ${fileName}]`, isFileAttachment: false, error: error, sentToApi: true }; // エラーはAPIには送らないが、UI上は送信済み扱い
  // } else if (fileData?.type === 'image_url') { // 画像は扱わない (コメントアウト)
    // 画像添付メッセージ
    // return { role: 'user', content: `[画像添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false }; // まだAPIには送っていない
  } else if (fileData?.type === 'text') {
    // テキストファイル添付メッセージ
    return { role: 'user', content: `[ファイル添付: ${fileName}]`, isFileAttachment: true, fileData: fileData, sentToApi: false }; // まだAPIには送っていない
  }
  return null; // 有効なメッセージが生成されなかった場合
};


// --- Main Hook ---
const useChat = () => {
  // --- State and Refs ---
  const [messages, setMessages] = useState(initialMessages); // チャットメッセージの配列
  const [input, setInput] = useState(''); // テキスト入力欄の内容
  const [isLoading, setIsLoading] = useState(false); // API通信中などのローディング状態
  const [error, setError] = useState(null); // エラーメッセージ
  const messagesEndRef = useRef(null); // チャット末尾へのスクロール用Ref
  const [isExpanding, setIsExpanding] = useState(false); // プロンプト拡張処理中の状態

  // ★ モデル関連の State を変更
  const [availableModels, setAvailableModels] = useState([]); // モデルIDのリスト (動的取得)
  const [selectedModel, setSelectedModel] = useState(''); // 選択中のモデルID (初期値は空)
  const [isModelsLoading, setIsModelsLoading] = useState(true); // モデルリスト取得中のローディング状態

  // --- Effects ---
  // メッセージが追加されたら最下部へスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // messages 配列が変更されるたびに実行

  // ★ モデルリスト取得 Effect を追加
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
        } else {
          console.warn("No available models received from backend or list is empty.");
          setAvailableModels([]); // 利用可能なモデルがない場合は空リスト
          setSelectedModel(''); // 選択も空に
          // 必要であればエラーメッセージを設定
          // setError("利用可能なAIモデルが見つかりませんでした。");
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

  // --- Helper Functions (Message Sending Logic) ---

  /**
   * テキスト入力と保留中のファイル添付からAPI送信用コンテンツを構築
   * @param {string} textInput - テキスト入力
   * @param {Array<object>} pendingFileMessages - API未送信のファイル添付メッセージ
   * @returns {string} API送信用コンテンツ文字列
   */
  const buildCombinedContent = (textInput, pendingFileMessages) => {
    let combinedContent = textInput;
    const filesToSend = pendingFileMessages.map(msg => msg.fileData).filter(Boolean);

    if (filesToSend.length > 0) {
      const fileDescriptions = filesToSend.map(fileData => {
        // if (fileData.type === 'image_url') { // 画像は扱わない (コメントアウト)
          // 画像の場合はファイル名を記述 (Base64データは含めない)
          // return `\n[添付画像: ${fileData.fileName || '名称不明'}]`;
        /* } else */ if (fileData.type === 'text') {
          // テキストファイルの場合は内容を全文結合
          const truncatedText = fileData.text; // ★ 制限を解除
          // const truncatedText = fileData.text.length > MAX_FILE_TEXT_LENGTH // 元のコード (プレビュー)
          //   ? fileData.text.substring(0, MAX_FILE_TEXT_LENGTH) + '... (省略)'
          //   : fileData.text;
          return `\n[添付ファイル: ${fileData.fileName || '名称不明'}]\n\`\`\`\n${truncatedText}\n\`\`\``;
        }
        return ''; // 未知のタイプは無視
      }).join('');
      combinedContent += fileDescriptions; // テキスト入力の後ろにファイル情報を追加
    }
    return combinedContent;
  };

  /**
   * API送信前にUIを更新 (ユーザーメッセージを追加し、送信済みフラグを立てる)
   * @param {string} textInput - テキスト入力
   * @param {Array<object>} pendingFileMessages - API未送信のファイル添付メッセージ
   * @param {Array<object>} currentMessages - 現在のメッセージ配列
   * @param {Function} setMessages - messages state 更新関数
   * @returns {Array<object>} 更新後のメッセージ配列
   */
  const updateUiBeforeSend = (textInput, pendingFileMessages, currentMessages, setMessages) => {
    let updatedMessages = [...currentMessages];
    // テキスト入力があれば、新しいユーザーメッセージとして追加
    if (textInput) {
      const newUserTextMessage = { role: 'user', content: textInput, sentToApi: false };
      updatedMessages.push(newUserTextMessage);
    }
    // 今回送信するテキストメッセージとファイル添付メッセージの sentToApi フラグを true に更新
    const finalMessages = updatedMessages.map(msg =>
      (msg.role === 'user' && !msg.sentToApi && (msg.content === textInput || pendingFileMessages.some(pfm => pfm.fileData === msg.fileData)))
        ? { ...msg, sentToApi: true }
        : msg
    );
    setMessages(finalMessages); // UIを更新
    return finalMessages; // 更新後のメッセージ配列を返す
  };

  /**
   * APIに送信するためのメッセージ履歴を準備 (履歴制限付き)
   * @param {Array<object>} pastMessagesOnly - 過去のメッセージのみを含む配列 (今回のユーザー入力は除外済み)
   * @param {string} combinedContent - buildCombinedContentで生成された今回のユーザー入力コンテンツ
   * @returns {Array<object>} API送信用メッセージ配列
   */
  const prepareApiMessages = (pastMessagesOnly, combinedContent) => {
    const MAX_HISTORY_PAIRS = 5;
    const MAX_API_MESSAGES = MAX_HISTORY_PAIRS * 2;

    // ★ フィルタリング条件を修正:
    // ユーザーメッセージは sentToApi をチェックせず、ファイル添付自体でなければ含める (デバッグ目的)
    const relevantPastMessages = pastMessagesOnly.filter(msg => {
      if (msg.hidden) return false; // 非表示は除外

      if (msg.role === 'user') {
        // ★★★ 修正点: sentToApi のチェックを一時的に削除 ★★★
        // ユーザーメッセージ: ファイル添付自体でないものを含める
        return !msg.isFileAttachment;
      } else if (msg.role === 'assistant') {
        // アシスタントメッセージ: content が文字列であれば含める (sentToApi は問わない)
        return typeof msg.content === 'string';
      }
      return false; // その他のロールは除外
    });

    // --- 以降の処理 (履歴件数制限、マッピング、結合) は変更なし ---
    const limitedPastMessages = relevantPastMessages.slice(-MAX_API_MESSAGES);
    const pastMessagesForApi = limitedPastMessages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    let currentMessageForApi = null;
    if (combinedContent) {
      currentMessageForApi = { role: 'user', content: combinedContent };
    }
    const messagesForApi = [...pastMessagesForApi];
    if (currentMessageForApi) {
      messagesForApi.push(currentMessageForApi);
    }
    // --- デバッグログも変更なし ---
    if (process.env.NODE_ENV === 'development') {
        console.log(`prepareApiMessages: Sending ${messagesForApi.length} messages (Limit: ${MAX_API_MESSAGES} past + 1 current max)`);
        // console.log("Messages for API:", JSON.stringify(messagesForApi, null, 2));
    }

    return messagesForApi;
  };

  /**
   * APIエラー発生時の処理 (エラー表示、UIロールバック)
   * @param {Error} error - 発生したエラーオブジェクト
   * @param {Function} setError - error state 更新関数
   * @param {Function} setMessages - messages state 更新関数
   * @param {string} originalTextInput - 送信試行したテキスト入力
   * @param {Array<object>} originalPendingFiles - 送信試行したファイル添付メッセージ
   */
  const handleApiError = (error, setError, setMessages, originalTextInput, originalPendingFiles) => {
    console.error("API処理エラー:", error);
    let userFriendlyError = `メッセージの送信に失敗しました。`;
    if (error.message) {
        userFriendlyError += ` 詳細: ${error.message}`;
    }
    setError(userFriendlyError); // エラーメッセージをUIに表示

    // 送信に失敗したメッセージの sentToApi フラグを false に戻す (再送信可能にする)
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
   * メッセージを送信するメイン関数
   */
  const handleSend = useCallback(async () => {
    // API未送信のファイル添付メッセージを取得
    const pendingFileMessages = messages.filter(m => m.role === 'user' && m.isFileAttachment && !m.sentToApi);
    // 現在のテキスト入力 (前後の空白を除去)
    const currentInput = input.trim();

    // ★ selectedModel が空 (未選択/取得失敗) の場合も送信不可にする
    if ((!currentInput && pendingFileMessages.length === 0) || isLoading || isModelsLoading || !selectedModel) {
      if (process.env.NODE_ENV === 'development') {
        console.log("送信条件未達:", { currentInput, pendingFileMessages: pendingFileMessages.length, isLoading, isModelsLoading, selectedModel });
      }
      // モデルがまだロードされていない、または選択されていない場合のエラー表示
      if (!isLoading && (isModelsLoading || !selectedModel)) {
          setError("送信前にモデルを選択してください (ロード中または利用不可)。");
      }
      return;
    }

    setIsLoading(true); // ローディング開始
    setError(null); // エラー表示をクリア

    // 1. API送信用コンテンツ作成
    const combinedContent = buildCombinedContent(currentInput, pendingFileMessages);

    // 2. UI更新 (ユーザーメッセージ追加、送信済みフラグ更新)
    const updatedMessages = updateUiBeforeSend(currentInput, pendingFileMessages, messages, setMessages);
    setInput(''); // 入力欄をクリア

    // ★★★ ここから修正 ★★★
    // 3. API送信準備 (API用のメッセージ履歴作成)

    // prepareApiMessages に渡すための「過去の」メッセージ配列を作成
    // updatedMessages から、今回の入力テキストとファイルに対応するメッセージを除外する
    // (sentToApi が true になったばかりのメッセージを除外する)
    const messagesForHistoryPreparation = updatedMessages.filter(msg => {
      const isCurrentTextMessage = msg.role === 'user' && msg.sentToApi === true && !msg.isFileAttachment && msg.content === currentInput;
      const isCurrentFileMessage = msg.role === 'user' && msg.sentToApi === true && msg.isFileAttachment && pendingFileMessages.some(pfm => pfm.fileData === msg.fileData);
      // 今回のテキストメッセージでもファイルメッセージでも「ない」ものを残す
      return !(isCurrentTextMessage || isCurrentFileMessage);
    });

  // prepareApiMessages を呼び出す (過去のメッセージのみをフィルタリングした配列と、今回のコンテンツを渡す)
  const messagesForApi = prepareApiMessages(messagesForHistoryPreparation, combinedContent);
  // ★★★ ここまで修正 ★★★

    // 送信するユーザーコンテンツがない場合は異常系として処理中断
    if (!messagesForApi.some(m => m.role === 'user')) {
       console.warn("送信するユーザーコンテンツがありません。UIをロールバックします。");
       setIsLoading(false);
       setMessages(messages); // メッセージ履歴を元に戻す
       setInput(currentInput); // 入力欄を元に戻す
       return;
    }

    // 4. API呼び出し & 応答処理
    try {
      // APIに送信するリクエストボディ
      const requestBody = {
        messages: messagesForApi,
        purpose: 'main_chat', // メインチャットであることを示す
        model_name: selectedModel, // 選択中のモデル名を送信
      };

      // 開発モード時にリクエスト内容をコンソールに出力
      if (process.env.NODE_ENV === 'development') {
        console.log("Sending to API:", JSON.stringify(requestBody, null, 2));
      }

      // バックエンドAPIにPOSTリクエストを送信
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // 応答がエラーの場合
      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          // エラーレスポンスのJSONを解析試行
          errorData = await response.json();
          if (errorData && errorData.detail) {
            // FastAPIのバリデーションエラーなどの詳細情報を取得
            if (Array.isArray(errorData.detail)) {
              errorDetail = errorData.detail.map(d => `[${d.loc?.join('->') || 'N/A'}]: ${d.msg || 'No message'}`).join('; ');
            } else if (typeof errorData.detail === 'string') {
              errorDetail = errorData.detail;
            } else {
              errorDetail = JSON.stringify(errorData.detail);
            }
          } else if (errorData) {
            // その他のJSONエラー
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          // JSON解析失敗時のフォールバック
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        // エラーオブジェクトを作成してスロー
        const error = new Error(errorDetail);
        error.responseDetails = errorData; // 詳細情報を付与
        throw error;
      }

      // 5. API成功時のUI更新 (アシスタントの応答を追加)
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning, // reasoning情報があれば追加
          tool_calls: data.tool_calls // tool_calls情報があれば追加
        },
      ]);

    } catch (err) {
      // 6. APIエラー時の処理 (エラー表示、UIロールバック)
      handleApiError(err, setError, setMessages, currentInput, pendingFileMessages);
    } finally {
      setIsLoading(false); // ローディング終了
    }
  // ★ 依存配列に isModelsLoading を追加
  }, [messages, input, isLoading, selectedModel, isModelsLoading, setMessages, setError, setInput]);

  /**
   * チャット履歴をクリアする関数 (フロントエンドのみ)
   */
  const handleClearChat = useCallback(() => {
    console.log('useChat: handleClearChat called - skipping confirmation'); // デバッグ用ログ更新
    // 確認ダイアログを削除し、常にクリア処理を実行
    setMessages(initialMessages); // メッセージ履歴を初期状態に戻す
    setError(null); // エラー表示をクリア
    setIsLoading(false); // ローディング状態をリセット
    setIsExpanding(false); // 拡張状態をリセット
    setInput(''); // 入力欄をクリア
  // 依存配列: これらの state setter が変更されることはないが、明示的に記述
  }, [setMessages, setError, setIsLoading, setIsExpanding, setInput]);

  /**
   * ファイル選択イベントを処理する関数
   * @param {Event} event - ファイル選択inputのchangeイベント
   */
  const handleFileSelect = useCallback(async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return; // ファイルが選択されていなければ何もしない

    setIsLoading(true); // ローディング開始
    setError(null); // エラー表示をクリア

    // 選択された全てのファイルを非同期で読み込む
    const fileReadPromises = Array.from(files).map(readFileAsPromise);

    try {
      // 全てのファイル読み込み完了を待つ
      const results = await Promise.all(fileReadPromises);
      // 読み込み結果からUI用メッセージを生成 (エラー含む)
      const newUiMessages = results.map(createFileUiMessage).filter(Boolean);
      // 新しいメッセージを既存のメッセージに追加
      if (newUiMessages.length > 0) {
        setMessages(prev => [...prev, ...newUiMessages]);
      }
    } catch (err) {
      // Promise.all 自体のエラー (通常は発生しにくい)
      console.error("Error processing files with Promise.all:", err);
      setError("ファイル処理中に予期せぬエラーが発生しました。");
    } finally {
      setIsLoading(false); // ローディング終了
      // input[type=file] の値をリセットし、同じファイルを連続で選択できるようにする
      if (event.target) {
        event.target.value = null;
      }
    }
  // 依存配列
  }, [setMessages, setIsLoading, setError]);

  // --- Return Values ---
  // フックが外部に提供する値と関数
  return {
    messages,           // チャットメッセージ配列
    input,              // 入力欄の内容
    setInput,           // input state 更新関数
    isLoading,          // ローディング状態
    error,              // エラーメッセージ
    setError,           // error state 更新関数
    messagesEndRef,     // スクロール用Ref
    handleSend,         // メッセージ送信関数
    handleClearChat,    // チャットクリア関数 (修正版)
    handleFileSelect,   // ファイル選択処理関数
    isExpanding,        // プロンプト拡張中フラグ
    setIsExpanding,     // isExpanding state 更新関数
    selectedModel,      // 選択中のモデルID
    setSelectedModel,   // selectedModel state 更新関数
    availableModels,    // 利用可能なモデルIDのリスト (動的取得)
    isModelsLoading,    // ★ モデルリスト取得中のローディング状態を追加
  };
};

export default useChat; // フックをエクスポート
