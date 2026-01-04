# 下地理則の研究室 - GitHub Pages版

九州大学言語学講座 下地理則研究室のウェブサイトです。

## サイト構成

```
mshimoji-site/
├── index.html            # HOME
├── members.html          # メンバー
├── research.html         # 研究
├── teaching.html         # 授業
├── theses.html           # 指導した学位論文
├── publications.html     # 業績一覧（自動生成）
├── publications.pdf      # 業績PDF（自動生成）
├── irabu.html            # 伊良部島方言を知る
├── discourse.html        # 談話データ
├── resources.html        # 方言記述のリソース
├── prospective.html      # 大学院志望者へ
├── css/style.css         # スタイルシート
├── images/               # 画像ファイル
├── data/
│   └── publications.csv  # 業績データ（これを編集）
├── build_publications.py # ビルドスクリプト
└── .github/workflows/    # GitHub Actions設定
```

## 業績一覧の更新方法

### 1. CSVファイルを編集

`data/publications.csv` を編集します。GitHubのWeb UIから直接編集可能です。

### CSVの形式

```csv
year,type,title,details,link_academia,link_amazon,link_publisher,link_other,link_other_label
2024,book,書籍タイトル,出版社情報,https://academia.edu/...,https://amazon.co.jp/...,https://publisher.com/...,,
2024,paper,論文タイトル,掲載誌の情報,https://academia.edu/...,,,,
```

### 列の説明

| 列名 | 必須 | 説明 |
|------|:----:|------|
| year | ✓ | 出版年 |
| type | ✓ | 種類（book, paper, thesis） |
| title | ✓ | タイトル |
| details | ✓ | 掲載誌・出版社などの詳細 |
| link_academia | | Academia.edu のURL |
| link_amazon | | Amazon のURL |
| link_publisher | | 出版社サイトのURL |
| link_other | | その他のURL |
| link_other_label | | その他リンクのラベル |

### 2. 自動生成

CSVをコミット＆プッシュすると、GitHub Actionsが自動的に以下を生成します：

- **publications.html** - ウェブサイト用ページ
- **publications.pdf** - ダウンロード用PDF

### ローカルで手動生成する場合

```bash
pip install fpdf2
python build_publications.py
```

## GitHub Pagesへのデプロイ

1. GitHubで新しいリポジトリを作成
2. このフォルダの内容をリポジトリにプッシュ
3. Settings → Pages で Source を `main` ブランチに設定
4. 数分後に公開

## カスタムドメイン

`mshimoji.com` を使用する場合：

1. Settings → Pages → Custom domain に設定
2. DNSでCNAMEまたはAレコードを設定
3. `CNAME` ファイルをリポジトリに追加：
   ```
   www.mshimoji.com
   ```

## ローカルプレビュー

```bash
cd mshimoji-site
python3 -m http.server 8000
# http://localhost:8000 でアクセス
```

## 連絡先

下地理則（九州大学）
- Email: smz [at] kyudai.jp
- Academia.edu: https://kyushu-u.academia.edu/MichinoriShimoji
- Researchmap: https://researchmap.jp/read0122330
