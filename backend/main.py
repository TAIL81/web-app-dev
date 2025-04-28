import os
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List

import uvicorn

app = FastAPI()

# CORS 設定（React フロントエンド用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002", "http://localhost:3003"],  # React のポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定ファイルのパスを backend ディレクトリ内の config.json に変更
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

# ★ デフォルトのシステム指示 (config.json に system_prompt がない場合に使用)
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese"

def load_config():
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' が見つかりません。")
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' が見つかりません。")
    except json.JSONDecodeError as e:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' の形式が正しくありません。詳細: {e}")
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
    except Exception as e:
        import traceback
        print(f"エラー: 設定ファイルの読み込み中に予期せぬエラーが発生しました: {type(e).__name__}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"設定ファイルの読み込み中にエラー: {e}")

# メッセージのモデル
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

# ★ Reasoning 対応モデルのリストを定義
REASONING_SUPPORTED_MODELS = [
    "qwen-qwq-32b",
    "deepseek-r1-distill-llama-70b",
]

@app.post("/api/chat")
async def chat(request: ChatRequest):
    config = load_config()

    # ★ システム指示の内容を取得
    # config.json に "system_prompt" があればそれを使い、なければ DEFAULT_SYSTEM_PROMPT を使う
    system_prompt_content = config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

    # API キー取得
    api_key = os.environ.get("GROQ_API_KEY") or config.get("api_key")
    if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
        raise HTTPException(status_code=401, detail="有効な API キーが設定されていません。")

    client = Groq(api_key=api_key)
    model_name = config.get("model_name", "qwen-qwq-32b") # ★ モデル名を取得

    try:
        # ★ API に送信するメッセージリストを構築
        messages_for_api = []

        # システム指示を追加
        messages_for_api.append({"role": "system", "content": system_prompt_content})

        # フロントエンドからのメッセージを処理
        for msg in request.messages:
            if isinstance(msg.content, list):
                # content がリストの場合 (マルチモーダル形式を想定)
                # 各要素を Groq API が期待する形式に変換して追加
                processed_content = []
                for item in msg.content:
                    if isinstance(item, dict) and "type" in item:
                        if item["type"] == "text" and "text" in item:
                            processed_content.append({"type": "text", "text": item["text"]})
                        elif item["type"] == "image_url" and "image_url" in item and "url" in item["image_url"]:
                             # Vision モデルが認識できる形式
                            processed_content.append({"type": "image_url", "image_url": {"url": item["image_url"]["url"]}})
                        # 他のタイプ（例: tool_code, tool_results など）も必要に応じてここに追加
                    elif isinstance(item, str):
                         # リスト内に文字列がある場合もテキストとして扱う
                         processed_content.append({"type": "text", "text": item})

                if processed_content:
                    messages_for_api.append({"role": msg.role, "content": processed_content})

            elif isinstance(msg.content, str):
                # content が文字列の場合 (通常のテキストメッセージ)
                messages_for_api.append({"role": msg.role, "content": msg.content})
            # その他の形式は無視するか、エラーハンドリングを追加

        # ★ API 呼び出し用のパラメータを準備
        api_params = {
            "messages": messages_for_api, # ★ 構築した messages_for_api を使用
            "model": model_name,
            "temperature": config.get("temperature", 0.6),
            "max_completion_tokens": config.get("max_completion_tokens", 8192),
            "top_p": config.get("top_p", 0.95),
            "stream": config.get("stream", False),
            # 注意: reasoning_format はここではまだ追加しない
        }

        # ★ モデルが Reasoning 対応リストに含まれていれば、reasoning_format を追加
        if model_name in REASONING_SUPPORTED_MODELS:
            # config.json に reasoning_format があればそれを使い、なければ 'parsed' を使う
            reasoning_format_value = config.get("reasoning_format", "parsed")
            # 'hidden' や 'raw' も設定できるように、値を取得して設定
            if reasoning_format_value in ["parsed", "raw", "hidden"]:
                 api_params["reasoning_format"] = reasoning_format_value
            else:
                 # 不正な値が設定されていた場合はデフォルトの 'parsed' を使うか、エラーにするか選べる
                 # ここではデフォルトの 'parsed' を使うことにする
                 api_params["reasoning_format"] = "parsed"
                 print(f"警告: config.json の reasoning_format ('{reasoning_format_value}') は無効な値です。'parsed' を使用します。")


        # ★ 準備したパラメータを使って API を呼び出す
        completion = client.chat.completions.create(**api_params)

        response_message = completion.choices[0].message

        # ★ reasoning 属性が存在するかチェックして取得 (より安全な方法)
        # getattr は属性が存在しない場合に None を返す
        reasoning_content = getattr(response_message, 'reasoning', None)

        # reasoning_content が None や空文字列でない場合のみそれを使い、そうでなければ固定文字列を返す
        final_reasoning = reasoning_content if reasoning_content else "（Reasoningなし）"

        response_data = {
            "content": response_message.content,
            "reasoning": final_reasoning # ★ 取得した reasoning を返す
        }

        # ★ tool_calls が存在する場合、レスポンスに含める
        if response_message.tool_calls:
            # tool_calls はリストなので、そのまま含める
            # Pydanticモデルを辞書に変換するために model_dump() を使用
            response_data["tool_calls"] = [tc.model_dump() for tc in response_message.tool_calls]

        return response_data

    except AuthenticationError as e:
        print(f"エラー: Groq API 認証エラー: {e}")
        raise HTTPException(status_code=401, detail="Groq API 認証エラー: API キーを確認してください。")
    except RateLimitError as e:
        print(f"エラー: レート制限に達しました: {e}")
        # レート制限エラーの場合、具体的なメッセージを返す
        raise HTTPException(status_code=429, detail="Groq API のレート制限に達しました。しばらく待ってから再試行してください。")
    except APIConnectionError as e:
        print(f"エラー: Groq API 接続エラー: {e}")
        raise HTTPException(status_code=503, detail="Groq API 接続エラー: ネットワークを確認してください。")
    except BadRequestError as e:
        # エラーレスポンスの本文を安全に取得しようと試みる
        error_details = str(e)
        error_response = getattr(e, 'response', None)
        if error_response:
            try:
                error_body = error_response.json()
                error_details = error_body.get('error', {}).get('message', str(e))
            except Exception:
                pass # JSONデコード失敗などは無視
        print(f"エラー: Groq BadRequestError details: {error_details}") # 詳細を出力
        raise HTTPException(status_code=400, detail=f"リクエストエラー: {error_details}")
    except GroqError as e:
        print(f"エラー: Groq API エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API エラー: {str(e)}")
    except Exception as e:
        # 予期せぬエラーの詳細もログに出力するとデバッグしやすい
        import traceback
        print(f"エラー: 予期せぬエラーが発生しました: {type(e).__name__}")
        print(traceback.format_exc()) # スタックトレースを出力
        raise HTTPException(status_code=500, detail=f"予期せぬサーバーエラーが発生しました。")

# 起動確認用
@app.get("/")
async def root():
    return {"message": "FastAPI バックエンド稼働中"}

if __name__ == "__main__":
    print("バックエンドサーバーを http://localhost:8002 で起動します...")
    # リロード有効で起動すると開発中に便利 (uvicorn main:app --reload --port 8002)
    # ここでは通常の起動
    uvicorn.run(app, host="localhost", port=8002)
    # uvicorn.run が終了するまで下の行は実行されない
    # print("バックエンドサーバーがポート8002で起動しました") # この行は通常表示されない
