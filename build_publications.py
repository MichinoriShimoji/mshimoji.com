#!/usr/bin/env python3
"""
業績一覧ビルドスクリプト

CSVファイルから以下を自動生成:
  1. publications.html - ウェブサイト用HTML
  2. publications.pdf  - ダウンロード用PDF

使い方:
    pip install fpdf2
    python build_publications.py

GitHub Actionsで自動実行されます。
"""

import csv
import html as html_module
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# =============================================================================
# 設定
# =============================================================================

CSV_FILE = "data/publications.csv"
OUTPUT_HTML = "publications.html"
OUTPUT_PDF = "publications.pdf"

# 種別の表示名と順序
TYPE_ORDER = ['thesis', 'book', 'translation', 'chapter', 'paper', 'bulletin', 'other', 'presentation', 'workshop', 'lecture']
TYPE_LABELS = {
    'thesis': '🎓 博士論文 Dissertation',
    'book': '📚 著書・編著 Books',
    'translation': '🔄 翻訳 Translations',
    'chapter': '📄 書籍所収論文 Book Chapters',
    'paper': '📝 学術誌論文 Journal Articles',
    'bulletin': '📋 紀要論文 Bulletin Articles',
    'other': '✏️ その他著作 Other Writings',
    'presentation': '🎤 学会発表 Conference Presentations',
    'workshop': '💬 研究会発表 Workshop Presentations', 
    'lecture': '🎙️ 講演 Invited Lectures',
}

# =============================================================================
# HTMLテンプレート
# =============================================================================

HTML_HEADER = '''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="下地理則の業績一覧 - 論文・著書・編著">
  <title>業績一覧 | 下地理則の研究室</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500&display=swap" rel="stylesheet">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌊</text></svg>">
  <style>
    .pub-section { margin-bottom: 2.5rem; }
    .pub-section h3 {
      font-size: 1.1rem;
      color: #0284c7;
      border-left: 4px solid #0284c7;
      padding-left: 0.8rem;
      margin-bottom: 1rem;
    }
    .pub-item {
      margin-bottom: 1rem;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 8px;
      font-family: 'Zen Kaku Gothic New', sans-serif;
      font-size: 0.9rem;
      line-height: 1.7;
    }
    .pub-item .title {
      font-weight: 500;
      color: #1a1a1a;
    }
    .pub-item .details {
      color: #555;
      margin-top: 0.3rem;
    }
    .pub-links {
      margin-top: 0.5rem;
    }
    .pub-links a {
      display: inline-block;
      margin-right: 0.8rem;
      margin-bottom: 0.3rem;
      padding: 0.25rem 0.6rem;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.8rem;
      transition: background 0.2s;
    }
    .pub-links a:hover {
      background: #bae6fd;
    }
    .year-label {
      display: inline-block;
      background: #0284c7;
      color: #fff;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
    }
    .download-btn {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.6rem 1.2rem;
      background: #0284c7;
      color: #fff;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .download-btn:hover {
      background: #0369a1;
    }
    /* ジャンルフィルター */
    .type-filter-box {
      margin: 1.5rem 0 2rem;
    }
    .type-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .type-filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      background: #fff;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .type-filter-btn:hover {
      border-color: #0284c7;
      color: #0284c7;
    }
    .type-filter-btn.active {
      background: #0284c7;
      border-color: #0284c7;
      color: #fff;
    }
    .result-count {
      margin-top: 0.8rem;
      font-size: 0.85rem;
      color: #64748b;
    }
    .pub-item.hidden {
      display: none;
    }
    .pub-section.hidden {
      display: none;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="header-content">
      <a href="index.html" class="site-title">下地理則の研究室</a>
      <p class="site-subtitle">琉球語と日本語方言の研究 | 九州大学言語学講座</p>
    </div>
  </header>

  <nav class="main-nav">
    <div class="nav-container">
      <button class="mobile-menu-btn" aria-label="メニュー" onclick="toggleMenu()">
        <span class="hamburger"></span>
      </button>
      <ul class="nav-list" id="navList">
        <li class="nav-item"><a href="index.html" class="nav-link">HOME</a></li>
        <li class="nav-item"><a href="members.html" class="nav-link">メンバー</a></li>
        <li class="nav-item"><a href="research.html" class="nav-link">研究</a></li>
        <li class="nav-item"><a href="teaching.html" class="nav-link">授業</a></li>
        <li class="nav-item"><a href="theses.html" class="nav-link">指導した学位論文</a></li>
        <li class="nav-item"><a href="irabu.html" class="nav-link">伊良部島方言を知る</a></li>
        <li class="nav-item"><a href="resources.html" class="nav-link">方言記述のリソース</a></li>
        <li class="nav-item"><a href="prospective.html" class="nav-link">大学院志望者へ</a></li>
      </ul>
    </div>
  </nav>

  <main class="main-content">
    <section class="page-hero">
      <h1 class="page-title">業績一覧</h1>
      <p class="page-description">Publications</p>
    </section>

    <section class="section">
      <div class="text-content">
        <p>
          主要な業績を掲載しています。完全なリストは
          <a href="https://kyushu-u.academia.edu/MichinoriShimoji" target="_blank" rel="noopener">Academia.edu</a>
          または
          <a href="https://researchmap.jp/read0122330" target="_blank" rel="noopener">researchmap</a>
          をご覧ください。
        </p>
        <a href="publications.pdf" class="download-btn" download>📄 PDF版をダウンロード</a>
      </div>

      <!-- ジャンルフィルター -->
      <div class="type-filter-box">
        <div class="type-filters">
          <button class="type-filter-btn active" data-type="all" onclick="toggleType('all')">すべて</button>
          <button class="type-filter-btn" data-type="thesis" onclick="toggleType('thesis')">🎓 博士論文</button>
          <button class="type-filter-btn" data-type="book" onclick="toggleType('book')">📚 著書</button>
          <button class="type-filter-btn" data-type="translation" onclick="toggleType('translation')">🔄 翻訳</button>
          <button class="type-filter-btn" data-type="chapter" onclick="toggleType('chapter')">📄 書籍所収</button>
          <button class="type-filter-btn" data-type="paper" onclick="toggleType('paper')">📝 学術誌論文</button>
          <button class="type-filter-btn" data-type="bulletin" onclick="toggleType('bulletin')">📋 紀要論文</button>
          <button class="type-filter-btn" data-type="other" onclick="toggleType('other')">✏️ その他</button>
          <button class="type-filter-btn" data-type="presentation" onclick="toggleType('presentation')">🎤 学会発表</button>
          <button class="type-filter-btn" data-type="workshop" onclick="toggleType('workshop')">💬 研究会発表</button>
          <button class="type-filter-btn" data-type="lecture" onclick="toggleType('lecture')">🎙️ 講演</button>
        </div>
        <div class="result-count" id="resultCount"></div>
      </div>
'''

HTML_FOOTER = '''
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-content">
      <div class="footer-section">
        <h3>下地理則の研究室</h3>
        <p>九州大学大学院人文科学研究院<br>言語学講座</p>
        <p style="margin-top: 1rem;">smz [at] kyudai.jp</p>
      </div>
      <div class="footer-section">
        <h3>リンク</h3>
        <a href="https://kyushu-u.academia.edu/MichinoriShimoji" target="_blank" rel="noopener">Academia.edu</a>
        <a href="https://researchmap.jp/read0122330" target="_blank" rel="noopener">Researchmap</a>
        <a href="https://note.com/lingfieldwork" target="_blank" rel="noopener">note</a>
      </div>
      <div class="footer-section">
        <h3>サイトマップ</h3>
        <a href="index.html">HOME</a>
        <a href="members.html">メンバー</a>
        <a href="research.html">研究</a>
        <a href="teaching.html">授業</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2025 下地理則研究室. All rights reserved.</p>
    </div>
  </footer>

  <script>
    function toggleMenu() {
      document.getElementById('navList').classList.toggle('show');
    }

    // ジャンルフィルター機能
    let currentType = 'all';
    
    document.addEventListener('DOMContentLoaded', function() {
      updateResultCount();
    });

    function toggleType(type) {
      currentType = type;
      document.querySelectorAll('.type-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
      });
      applyFilter();
    }

    function applyFilter() {
      let visibleCount = 0;
      const sections = {};
      
      document.querySelectorAll('.pub-item').forEach(item => {
        const itemType = item.dataset.type;
        
        let show = (currentType === 'all' || itemType === currentType);
        
        item.classList.toggle('hidden', !show);
        
        if (show) {
          visibleCount++;
          sections[itemType] = (sections[itemType] || 0) + 1;
        }
      });
      
      // セクションの表示/非表示
      document.querySelectorAll('.pub-section').forEach(section => {
        const sectionType = section.dataset.type;
        const hasVisible = sections[sectionType] > 0;
        section.classList.toggle('hidden', !hasVisible);
      });
      
      updateResultCount(visibleCount);
    }

    function updateResultCount(count) {
      const total = document.querySelectorAll('.pub-item').length;
      if (count === undefined) {
        count = total;
      }
      const el = document.getElementById('resultCount');
      if (count === total) {
        el.textContent = `全 ${total} 件`;
      } else {
        el.textContent = `${count} 件 / ${total} 件`;
      }
    }
  </script>
</body>
</html>
'''


# =============================================================================
# CSV読み込み
# =============================================================================

def load_publications(csv_path):
    """CSVから業績データを読み込み"""
    publications = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            publications.append(row)
    return publications


def group_by_year(publications):
    """年ごとにグループ化"""
    by_year = defaultdict(list)
    for pub in publications:
        by_year[pub['year']].append(pub)
    return by_year


def group_by_type(publications):
    """種別ごとにグループ化"""
    by_type = defaultdict(list)
    for pub in publications:
        by_type[pub['type']].append(pub)
    return by_type


# =============================================================================
# HTML生成
# =============================================================================

def generate_links_html(pub):
    """リンクボタンのHTMLを生成"""
    links = []
    
    if pub.get('link_academia'):
        links.append(f'<a href="{pub["link_academia"]}" target="_blank">Academia.edu</a>')
    if pub.get('link_amazon'):
        links.append(f'<a href="{pub["link_amazon"]}" target="_blank">Amazon</a>')
    if pub.get('link_publisher'):
        links.append(f'<a href="{pub["link_publisher"]}" target="_blank">出版社</a>')
    if pub.get('link_other') and pub.get('link_other_label'):
        links.append(f'<a href="{pub["link_other"]}" target="_blank">{pub["link_other_label"]}</a>')
    elif pub.get('link_other'):
        links.append(f'<a href="{pub["link_other"]}" target="_blank">リンク</a>')
    
    if links:
        return f'<div class="pub-links">{" ".join(links)}</div>'
    return ''


def generate_html(publications, output_path):
    """HTMLを生成（種別ごとにセクション分け）"""
    by_type = group_by_type(publications)
    
    parts = [HTML_HEADER]
    
    for pub_type in TYPE_ORDER:
        if pub_type not in by_type:
            continue
        
        type_label = TYPE_LABELS.get(pub_type, pub_type)
        parts.append(f'''
      <div class="pub-section" data-type="{pub_type}">
        <h3>{type_label}</h3>
''')
        # 年でソート（降順）
        type_pubs = sorted(by_type[pub_type], key=lambda x: x['year'], reverse=True)
        
        for pub in type_pubs:
            title = html_module.escape(pub['title'])
            details = html_module.escape(pub['details'])
            year = pub['year']
            links_html = generate_links_html(pub)
            
            # data属性用のタイトル（検索用）
            title_for_search = pub['title'].replace('"', '&quot;')
            
            parts.append(f'''        <div class="pub-item" data-year="{year}" data-type="{pub_type}" data-title="{title_for_search}">
          <span class="year-label">{year}</span>
          <span class="title">{title}</span>
          <div class="details">{details}</div>
          {links_html}
        </div>
''')
        parts.append('      </div>\n')
    
    parts.append(HTML_FOOTER)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(''.join(parts))
    
    print(f"✓ HTML generated: {output_path}")



# =============================================================================
# PDF生成
# =============================================================================

def generate_pdf(publications, output_path, font_path=None):
    """PDFを生成（WeasyPrint使用 - HTMLからPDFへ変換）"""
    try:
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
    except ImportError:
        print("⚠ weasyprint not installed, skipping PDF generation")
        print("  Install with: pip install weasyprint")
        return False
    
    by_type = group_by_type(publications)
    
    # PDF用HTMLを生成
    html_content = f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    @page {{
      size: A4;
      margin: 15mm;
      @bottom-center {{
        content: counter(page);
        font-size: 9pt;
      }}
    }}
    body {{
      font-family: "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #333;
    }}
    .header {{
      text-align: center;
      margin-bottom: 20px;
    }}
    .header h1 {{
      font-size: 18pt;
      margin-bottom: 5px;
    }}
    .header p {{
      font-size: 10pt;
      color: #666;
      margin: 3px 0;
    }}
    .section-title {{
      background: #0284c7;
      color: white;
      padding: 6px 10px;
      font-size: 11pt;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
    }}
    .pub-item {{
      margin-bottom: 12px;
      page-break-inside: avoid;
    }}
    .pub-title {{
      font-weight: bold;
      font-size: 10pt;
    }}
    .pub-details {{
      color: #666;
      font-size: 9pt;
      margin-top: 2px;
    }}
    .pub-links {{
      color: #0284c7;
      font-size: 8pt;
      margin-top: 3px;
    }}
    .pub-links a {{
      color: #0284c7;
      text-decoration: none;
    }}
    .pub-links a:hover {{
      text-decoration: underline;
    }}
  </style>
</head>
<body>
  <div class="header">
    <h1>業績一覧</h1>
    <p>下地理則（九州大学）</p>
    <p>最終更新: {datetime.now().strftime("%Y年%m月%d日")}</p>
  </div>
'''
    
    for pub_type in TYPE_ORDER:
        if pub_type not in by_type:
            continue
        
        type_label = TYPE_LABELS.get(pub_type, pub_type).replace('📚 ', '').replace('📝 ', '').replace('📄 ', '').replace('🎓 ', '')
        html_content += f'  <div class="section-title">{type_label}</div>\n'
        
        # 年でソート（降順）
        type_pubs = sorted(by_type[pub_type], key=lambda x: x['year'], reverse=True)
        
        for pub in type_pubs:
            year = pub['year']
            title = pub['title'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            details = pub['details'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') if pub['details'] else ''
            
            html_content += f'''  <div class="pub-item">
    <div class="pub-title">[{year}] {title}</div>
'''
            if details:
                html_content += f'    <div class="pub-details">{details}</div>\n'
            
            # リンク
            link_parts = []
            if pub.get('link_academia'):
                link_parts.append(f'<a href="{pub["link_academia"]}">Academia.edu</a>')
            if pub.get('link_amazon'):
                link_parts.append(f'<a href="{pub["link_amazon"]}">Amazon</a>')
            if pub.get('link_publisher'):
                link_parts.append(f'<a href="{pub["link_publisher"]}">出版社</a>')
            if pub.get('link_other'):
                label = pub.get('link_other_label', 'リンク')
                link_parts.append(f'<a href="{pub["link_other"]}">{label}</a>')
            
            if link_parts:
                html_content += f'    <div class="pub-links">[ {" , ".join(link_parts)} ]</div>\n'
            
            html_content += '  </div>\n'
    
    html_content += '''</body>
</html>'''
    
    # PDFに変換
    font_config = FontConfiguration()
    html = HTML(string=html_content)
    html.write_pdf(str(output_path), font_config=font_config)
    
    print(f"✓ PDF generated: {output_path}")
    return True


# =============================================================================
# メイン
# =============================================================================

def main():
    script_dir = Path(__file__).parent
    csv_path = script_dir / CSV_FILE
    html_path = script_dir / OUTPUT_HTML
    pdf_path = script_dir / OUTPUT_PDF
    
    if not csv_path.exists():
        print(f"❌ Error: {csv_path} not found")
        return 1
    
    print(f"📄 Reading: {csv_path}")
    publications = load_publications(csv_path)
    print(f"   Found {len(publications)} entries")
    
    # HTML生成
    generate_html(publications, html_path)
    
    # PDF生成
    generate_pdf(publications, pdf_path)
    
    return 0


if __name__ == '__main__':
    exit(main())
