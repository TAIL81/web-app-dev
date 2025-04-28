# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
import sys
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import uvicorn
import traceback

# --- Global Variables ---
config: Dict[str, Any] = {} # アプリケーション全体の設定を保持
groq_client: Optional[Groq] = None # 初期化されたGroqクライアントを保持
api_key: Optional[str] = None # APIキーを保持 (デバッグ用、通常は不要)

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Groq Chat API Backend",
    description="Backend for the chat application using Groq API.",
    version="0.2.0", # バージョンアップ
)

# --- CORS Configuration ---
frontend_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Constants ---
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese"

# --- Configuration Loading (Modified for Startup) ---
def load_config_on_startup():
    """
    設定ファイルを読み込む関数 (起動時専用)。
    エラー発生時はサーバー起動を中止させるため RuntimeError を送出。
    """
    global config # グローバル変数を更新
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            loaded_config = json.load(f)
            # print(f"設定ファイルを読み込みました: {CONFIG_FILE}") # コメントアウト

            # --- 主要な設定セクションの存在確認 ---
            if "main_chat" not in loaded_config:
                # print(f"警告: 設定ファイルに 'main_chat' セクションが見つかりません。デフォルト値を使用します。") # コメントアウト
                loaded_config["main_chat"] = {} # 空の辞書で初期化
            if "prompt_expansion" not in loaded_config:
                # print(f"警告: 設定ファイルに 'prompt_expansion' セクションが見つかりません。デフォルト値を使用します。") # コメントアウト
                loaded_config["prompt_expansion"] = {} # 空の辞書で初期化

            # --- reasoning_supported_models のデフォルト値設定 (main_chat のみ) ---
            if "reasoning_supported_models" not in loaded_config.get("main_chat", {}):
                 # print("情報: 'main_chat' セクションに 'reasoning_supported_models' が見つかりません。空リストを設定します。") # コメントアウト
                 loaded_config["main_chat"]["reasoning_supported_models"] = []

            config = loaded_config # グローバル変数に格納
            return config # 呼び出し元でも使えるように返す (必須ではない)

    except FileNotFoundError:
        print(f"致命的エラー: 設定ファイル '{CONFIG_FILE}' が見つかりません。") # エラーログは残す
        raise RuntimeError(f"設定ファイル '{CONFIG_FILE}' が見つかりません。")
    except json.JSONDecodeError as e:
        print(f"致命的エラー: 設定ファイル '{CONFIG_FILE}' の形式が正しくありません。詳細: {e}") # エラーログは残す
        raise RuntimeError(f"設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
    except Exception as e:
        print(f"致命的エラー: 設定ファイルの読み込み中に予期せぬエラーが発生しました: {type(e).__name__}") # エラーログは残す
        print(traceback.format_exc()) # エラーログは残す
        raise RuntimeError(f"設定ファイルの読み込み中にエラー: {e}")

# --- Startup Event Handler ---
@app.on_event("startup")
async def startup_event():
    """
    アプリケーション起動時に実行されるイベントハンドラ。
    設定の読み込み、APIキーの取得、Groqクライアントの初期化を行う。
    """
    global config, groq_client, api_key # グローバル変数を参照・更新
    # print("--- Application Startup Sequence ---") # コメントアウト
    try:
        # 1. 設定ファイルの読み込み
        # print("1. 設定ファイルを読み込んでいます...") # コメントアウト
        load_config_on_startup() # グローバル変数 config が更新される
        # print("   設定ファイルの読み込み完了。") # コメントアウト

        # 2. APIキーの取得 (環境変数からのみ)
        # print("2. Groq API キーを環境変数から取得しています (GROQ_API_KEY)...") # コメントアウト
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            print("致命的エラー: 環境変数 'GROQ_API_KEY' が設定されていません。") # エラーログは残す
            raise RuntimeError("Groq API キーが環境変数 'GROQ_API_KEY' に設定されていません。")
        # print("   API キー取得完了。") # コメントアウト

        # 3. Groqクライアントの初期化
        # print("3. Groq クライアントを初期化しています...") # コメントアウト
        groq_client = Groq(api_key=api_key)
        # 簡単な接続テスト (オプション) - 起動時に認証エラーを検知しやすくする
        try:
            groq_client.models.list() # モデルリスト取得を試みる
            # print("   Groq クライアント初期化および接続テスト完了。") # コメントアウト
        except AuthenticationError as auth_err:
            print(f"致命的エラー: Groq API 認証エラー (起動時): {auth_err}") # エラーログは残す
            raise RuntimeError(f"Groq API 認証エラー。提供された API キーが無効です: {auth_err}") from auth_err
        except APIConnectionError as conn_err:
             print(f"警告: Groq API への接続テストに失敗しました (起動時): {conn_err}") # 警告ログは残す
             # print("   ネットワーク接続を確認してください。サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # コメントアウト
        except GroqError as ge:
             print(f"警告: Groq クライアント初期化中に予期せぬ Groq エラーが発生しました: {ge}") # 警告ログは残す
             # print("   サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # コメントアウト
        except Exception as e:
             print(f"警告: Groq クライアント初期化中に予期せぬエラーが発生しました: {type(e).__name__} - {e}") # 警告ログは残す
             print(traceback.format_exc()) # エラーログは残す
             # print("   サーバーは起動を続行しますが、API呼び出しは失敗する可能性があります。") # コメントアウト


        # print("--- Application Startup Complete ---") # コメントアウト

    except RuntimeError as e:
        # 起動シーケンス中の致命的エラー (設定ファイル、APIキー、初期認証)
        print(f"\n!!! アプリケーションの起動に失敗しました: {e} !!!") # エラーログは残す
        raise e
    except Exception as e:
        # その他の予期せぬエラー
        print(f"\n!!! アプリケーションの起動中に予期せぬエラーが発生しました: {type(e).__name__} - {e} !!!") # エラーログは残す
        print(traceback.format_exc()) # エラーログは残す
        raise RuntimeError(f"予期せぬ起動時エラー: {e}") from e


# --- Pydantic Models (変更なし) ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    purpose: Optional[str] = "main_chat"
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_completion_tokens: Optional[int] = None

class ToolCallFunction(BaseModel):
    name: str
    arguments: str

class ToolCall(BaseModel):
    type: str = "function"
    function: ToolCallFunction

class ChatResponse(BaseModel):
    content: str
    reasoning: Optional[Any] = None
    tool_calls: Optional[List[ToolCall]] = None

# --- API Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handles chat requests. Uses pre-initialized config and Groq client.
    Selects configuration based on 'purpose'.
    Allows overriding parameters for 'main_chat'.
    """
    global config, groq_client # グローバル変数を参照

    # --- クライアントが初期化されているか確認 (念のため) ---
    if not groq_client:
        print("エラー: Groq クライアントが利用できません (初期化に失敗したか、まだ完了していません)。") # エラーログは残す
        raise HTTPException(status_code=503, detail="Groq クライアントが利用できません。サーバーが正しく起動していない可能性があります。")

    # print(f"\n--- New Request Received (Purpose: {request.purpose}) ---") # コメントアウト

    # --- purpose に基づいて設定を選択 ---
    if request.purpose == "expand_prompt":
        settings_key = "prompt_expansion"
        # print("Using 'prompt_expansion' settings from config.json") # コメントアウト
    elif request.purpose == "main_chat":
        settings_key = "main_chat"
        # print("Using 'main_chat' settings from config.json") # コメントアウト
    else:
        # print(f"警告: 不明な purpose '{request.purpose}' が指定されました。'main_chat' 設定を使用します。") # コメントアウト
        settings_key = "main_chat"

    # グローバル config から設定を取得
    if settings_key not in config or not isinstance(config[settings_key], dict):
         print(f"エラー: 設定 '{settings_key}' が見つからないか、無効です。") # エラーログは残す
         raise HTTPException(status_code=500, detail=f"サーバー設定エラー: '{settings_key}' の設定が見つかりません。")

    current_settings = config[settings_key]

    # --- パラメータの決定 ---
    model_name = current_settings.get("model_name", "llama-3.1-8b-instant")
    temperature = current_settings.get("temperature", 0.7)
    max_tokens = current_settings.get("max_completion_tokens", 1024)
    system_prompt_content = current_settings.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    top_p = current_settings.get("top_p", 0.95)
    stream = current_settings.get("stream", False)
    reasoning_supported_models = config.get("main_chat", {}).get("reasoning_supported_models", [])

    # メインチャットの場合のみリクエストボディで上書き
    if request.purpose == "main_chat":
        # print("Checking for overrides from request body (main_chat only)...") # コメントアウト
        if request.model_name:
            model_name = request.model_name
            # print(f"  - Overriding model_name: {model_name}") # コメントアウト
        if request.temperature is not None:
            temperature = request.temperature
            # print(f"  - Overriding temperature: {temperature}") # コメントアウト
        if request.max_completion_tokens:
            max_tokens = request.max_completion_tokens
            # print(f"  - Overriding max_completion_tokens: {max_tokens}") # コメントアウト

    # print(f"System Prompt: '{system_prompt_content[:100]}...'") # コメントアウト
    # print(f"Using Model: {model_name}") # コメントアウト

    try:
        messages_for_api = []
        if system_prompt_content:
            messages_for_api.append({"role": "system", "content": system_prompt_content})
            # print("Added system prompt.") # コメントアウト

        # print("Processing messages:") # コメントアウト
        if request.purpose == "expand_prompt":
            last_user_message = next((msg for msg in reversed(request.messages) if msg.role == 'user'), None)
            if last_user_message and isinstance(last_user_message.content, str):
                messages_for_api.append({"role": "user", "content": last_user_message.content})
                # print(f"  - Using last user message for expansion: '{last_user_message.content[:100]}...'") # コメントアウト
            else:
                print("エラー: プロンプト拡張のためのユーザーメッセージが見つかりません。") # エラーログは残す
                raise HTTPException(status_code=400, detail="プロンプト拡張のためのユーザーメッセージが必要です。")
        else: # main_chat
            for msg in request.messages:
                if isinstance(msg.content, str):
                    messages_for_api.append({"role": msg.role, "content": msg.content})
                    # print(f"  - Role: {msg.role}, Content (first 100 chars): '{msg.content[:100]}...'") # コメントアウト
                else:
                    # print(f"  - Warning: Received non-string content (type: {type(msg.content)}). Skipping. Role: {msg.role}") # コメントアウト
                    pass # 警告はコメントアウト

        api_params = {
            "messages": messages_for_api,
            "model": model_name,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": stream,
        }
        # print(f"API Parameters (excluding messages): { {k: v for k, v in api_params.items() if k != 'messages'} }") # コメントアウト

        # Reasoning Format の設定
        if model_name in reasoning_supported_models and settings_key == "main_chat":
            reasoning_format_value = config.get("main_chat", {}).get("reasoning_format", "parsed")
            if reasoning_format_value in ["parsed", "raw", "hidden"]:
                 api_params["reasoning_format"] = reasoning_format_value
                 # print(f"Reasoning Format: {reasoning_format_value}") # コメントアウト
            else:
                 api_params["reasoning_format"] = "parsed"
                 # print(f"Warning: Invalid reasoning_format ('{reasoning_format_value}') in config. Using 'parsed'.") # コメントアウト

        start_time = time.time()
        # print("Calling Groq API...") # コメントアウト
        completion = groq_client.chat.completions.create(**api_params)
        end_time = time.time()
        # print(f"Groq API call finished in {end_time - start_time:.2f} seconds.") # コメントアウト

        response_message = completion.choices[0].message
        reasoning_content = getattr(response_message, 'reasoning', None)
        tool_calls_content = getattr(response_message, 'tool_calls', None)

        response_data = ChatResponse(
            content=response_message.content or "",
            reasoning=reasoning_content if reasoning_content else None,
            tool_calls=[ToolCall.model_validate(tc.model_dump()) for tc in tool_calls_content] if tool_calls_content else None
        )

        # print("--- Response Sent ---") # コメントアウト
        return response_data

    # --- エラーハンドリング (リクエスト処理中のエラー) ---
    except AuthenticationError as e:
        print(f"エラー: Groq API 認証エラー (runtime): {e}") # エラーログは残す
        raise HTTPException(status_code=401, detail="Groq API 認証エラー: API キーを確認してください。")
    except RateLimitError as e:
        print(f"エラー: レート制限に達しました: {e}") # エラーログは残す
        raise HTTPException(status_code=429, detail="Groq API のレート制限に達しました。しばらく待ってから再試行してください。")
    except APIConnectionError as e:
        print(f"エラー: Groq API 接続エラー: {e}") # エラーログは残す
        raise HTTPException(status_code=503, detail="Groq API 接続エラー: ネットワークまたはGroqサービスを確認してください。")
    except BadRequestError as e:
        error_details = str(e)
        error_response = getattr(e, 'response', None)
        if error_response:
            try:
                error_body = error_response.json()
                error_details = error_body.get('error', {}).get('message', str(e))
            except Exception:
                pass
        print(f"エラー: Groq BadRequestError details: {error_details}") # エラーログは残す
        raise HTTPException(status_code=400, detail=f"リクエストエラー: {error_details}")
    except GroqError as e:
        print(f"エラー: Groq API エラー: {str(e)}") # エラーログは残す
        raise HTTPException(status_code=500, detail=f"Groq API エラー: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"エラー: 予期せぬサーバーエラーが発生しました: {type(e).__name__}") # エラーログは残す
        print(traceback.format_exc()) # エラーログは残す
        raise HTTPException(status_code=500, detail=f"予期せぬサーバーエラーが発生しました。")

# --- /api/exit エンドポイント (変更なし) ---
def shutdown_server():
    """サーバーをシャットダウンする関数 (バックグラウンドで実行)"""
    # print("Shutting down server process...") # コメントアウト
    time.sleep(0.5)
    sys.exit(0)

@app.post("/api/exit")
async def request_exit(background_tasks: BackgroundTasks):
    """
    フロントエンドからのリクエストを受けてサーバープロセスを終了するエンドポイント
    応答を返した後にバックグラウンドでシャットダウンを実行する
    """
    # print("Received exit request from frontend. Scheduling shutdown...") # コメントアウト
    background_tasks.add_task(shutdown_server)
    return {"message": "Shutdown initiated"}

# --- Root Endpoint (変更なし) ---
@app.get("/")
async def root():
    """ Health check endpoint """
    status = "running"
    details = "FastAPI backend for Groq Chat is running."
    if not groq_client:
        status = "degraded"
        details = "FastAPI backend is running, but Groq client initialization failed or is pending."
    return {"status": status, "message": details}

# --- Server Execution (変更なし) ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload_flag = os.getenv("RELOAD", "true").lower() == "true"

    # print(f"バックエンドサーバーを http://{host}:{port} で起動します...") # コメントアウト
    # print(f"リロード: {'有効' if reload_flag else '無効'}") # コメントアウト
    # print(f"フロントエンドオリジン許可: {frontend_origins}") # コメントアウト

    # Uvicorn をプログラム的に起動
    # access_log=False は指定しない (アクセスログは残す)
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload_flag,
    )
