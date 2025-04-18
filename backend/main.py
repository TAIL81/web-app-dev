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

CONFIG_FILE = os.path.join(os.getcwd(), "Chatbot-Groq", "config.json")

def load_config():
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' が見つかりません。")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定ファイルの読み込み中にエラー: {e}")

# メッセージのモデル
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

@app.post("/api/chat")
async def chat(request: ChatRequest):
    config = load_config()
    
    # API キー取得
    api_key = os.environ.get("GROQ_API_KEY") or config.get("api_key")
    if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
        raise HTTPException(status_code=401, detail="有効な API キーが設定されていません。")

    client = Groq(api_key=api_key)
    model_name = config.get("model_name", "qwen-qwq-32b")

    try:
        completion = client.chat.completions.create(
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            model=model_name,
            temperature=config.get("temperature", 0.6),
            max_completion_tokens=config.get("max_completion_tokens", 8192),
            top_p=config.get("top_p", 0.95),
            reasoning_format=config.get("reasoning_format", "parsed"),
            stream=config.get("stream", False),
        )

        response_message = completion.choices[0].message
        return {
            "content": response_message.content,
            "reasoning": response_message.reasoning or "（Reasoningなし）"
        }

    except AuthenticationError:
        raise HTTPException(status_code=401, detail="Groq API 認証エラー: API キーを確認してください。")
    except RateLimitError:
        time.sleep(5)  # レート制限回避
        raise HTTPException(status_code=429, detail="レート制限に達しました。少し待って再試行してください。")
    except APIConnectionError:
        raise HTTPException(status_code=503, detail="Groq API 接続エラー: ネットワークを確認してください。")
    except BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"リクエストエラー: {str(e)}")
    except GroqError as e:
        raise HTTPException(status_code=500, detail=f"Groq API エラー: {str(e)}")
    except Exception as e:
        print(f"詳細なエラー: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"予期せぬエラー: {e}")

# 起動確認用
@app.get("/")
async def root():
    return {"message": "FastAPI バックエンド稼働中"}

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8002)
    print("バックエンドサーバーがポート8002で起動しました")
