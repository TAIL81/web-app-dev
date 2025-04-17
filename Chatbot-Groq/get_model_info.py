from groq import Groq
import json
from datetime import datetime

def get_model_info():
    client = Groq()
    
    # モデル一覧の取得
    models = client.models.list()
    # print("DEBUG: Raw models list:", models) # デバッグ出力削除
    
    # マークダウンコンテンツの作成
    md_content = "# Groq利用可能モデル一覧\n\n"
    md_content += f"*更新日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S JST')}*\n\n"
    
    # モデル一覧セクション
    md_content += "## モデル一覧\n\n"
    for model in models.data: # models.data を反復処理するように修正
        md_content += f"- **{model.id}**\n"
        if hasattr(model, 'owned_by'):
            md_content += f"  - 所有者: {model.owned_by}\n"
        if hasattr(model, 'created'):
            created_time = datetime.fromtimestamp(model.created)
            md_content += f"  - 作成日時: {created_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        md_content += "\n"
    
    # モデル詳細セクション
    md_content += "## モデル詳細\n\n"
    for model in models.data: # models.data を反復処理するように修正
        try:
            # 個別モデルの詳細情報を取得
            model_detail = client.models.retrieve(model.id)
            md_content += f"### {model.id}\n\n"
            
            if hasattr(model_detail, 'description'):
                md_content += f"**説明**:\n{model_detail.description}\n\n"
            
            # 技術的詳細
            md_content += "**技術詳細**:\n"
            if hasattr(model_detail, 'context_window'):
                md_content += f"- コンテキストウィンドウ: {model_detail.context_window}\n"
            if hasattr(model_detail, 'training_data_cutoff'):
                md_content += f"- トレーニングデータカットオフ: {model_detail.training_data_cutoff}\n"
            md_content += "\n"
            
        except Exception as e:
            md_content += f"*詳細情報の取得に失敗しました: {str(e)}*\n\n"
    
    return md_content

# モデル情報の取得と保存
model_info = get_model_info()
with open('groq_models.md', 'w', encoding='utf-8') as f:
    f.write(model_info)

print("モデル情報を groq_models.md に保存しました。")
