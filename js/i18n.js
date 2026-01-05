// 言語切り替えシステム
(function() {
  // 現在の言語を取得（デフォルトは日本語）
  let currentLang = localStorage.getItem('lang') || 'ja';
  
  // 翻訳データ
  const translations = {
    // 共通要素
    common: {
      ja: {
        'site-title': '下地理則の研究室',
        'site-subtitle': '日琉諸語の総合的記述研究 | 九州大学言語学講座',
        'nav-home': 'HOME',
        'nav-members': 'メンバー',
        'nav-research': '研究',
        'nav-teaching': '授業',
        'nav-theses': '指導した学位論文',
        'nav-irabu': '伊良部島方言を知る',
        'nav-resources': '記述のリソース',
        'nav-prospective': '大学院志望者へ',
        'nav-essay': 'エッセイ',
        'footer-affiliation': '九州大学大学院人文科学研究院<br>言語学講座',
        'footer-links': 'リンク',
        'footer-sitemap': 'サイトマップ',
        'footer-copyright': '© 2025 下地理則研究室. All rights reserved.'
      },
      en: {
        'site-title': "Michinori Shimoji's Lab",
        'site-subtitle': 'Comprehensive Descriptive Studies of Japonic Languages | Kyushu University Linguistics',
        'nav-home': 'HOME',
        'nav-members': 'Members',
        'nav-research': 'Research',
        'nav-teaching': 'Courses',
        'nav-theses': 'Theses Supervised',
        'nav-irabu': 'Irabu Language',
        'nav-resources': 'Resources',
        'nav-prospective': 'Prospective Students',
        'nav-essay': 'Essays',
        'footer-affiliation': 'Faculty of Humanities<br>Kyushu University',
        'footer-links': 'Links',
        'footer-sitemap': 'Site Map',
        'footer-copyright': '© 2025 Shimoji Laboratory. All rights reserved.'
      }
    },
    
    // トップページ
    index: {
      ja: {
        'hero-p1': '下地理則研究室（九州大学言語学講座）は、消滅の危機に瀕した日琉諸語の総合的記述研究にフォーカスした世界唯一の研究室です。個々の地域言語を「方言」としてみなすのではなく、それぞれ独自の体系を持った消滅危機言語として記述・記録するべきである、というのが私たちに共通する価値観です。',
        'hero-p2': '文法書、辞書、談話資料を残すというオーセンティックな記述言語学的手法が体系的に学べるだけでなく、話者コミュニティとの言語再活性化活動、そして今後はNLP（自然言語処理）との協働も目指します。',
        'hero-p3': '下地研究室の目指す「日琉諸語の総合的記述」のあり方について、読書案内や有用なリソースガイド付きのわかりやすいブックレットを用意しています。<a href="https://www.canva.com/design/DAF6CK2iCHo/7f-u1_Xb1LYXOl-Euc19Jw/view" target="_blank" rel="noopener">こちらからご覧ください</a>。'
      },
      en: {
        'hero-p1': 'Michinori Shimoji\'s Lab (Kyushu University Linguistics) is the world\'s only lab focused on comprehensive descriptive studies of endangered Japonic languages. We share the belief that each regional language should not be viewed merely as a "dialect," but rather documented and described as an endangered language with its own unique system.',
        'hero-p2': 'In addition to systematically learning authentic descriptive linguistic methods for creating grammars, dictionaries, and discourse materials, we also aim to collaborate with speaker communities on language revitalization activities, and in the future, with NLP (Natural Language Processing).',
        'hero-p3': 'We have prepared an easy-to-understand booklet about the "comprehensive description of Japonic languages" that our laboratory aims for, complete with reading guides and useful resource guides. <a href="https://www.canva.com/design/DAF6CK2iCHo/7f-u1_Xb1LYXOl-Euc19Jw/view" target="_blank" rel="noopener">View it here</a>.'
      }
    },

    // メンバーページ
    members: {
      ja: {
        'page-title': 'メンバー',
        'page-description': '新しい方言研究を目指して',
        'member-link': '自己紹介詳細 →'
      },
      en: {
        'page-title': 'Members',
        'page-description': 'Toward new research of Japonic topolects',
        'member-link': 'Profile →',
        // メンバー情報（英語のみ - 日本語はHTMLのまま）
        'shimoji-role': 'Professor, Kyushu University',
        'shimoji-name': 'Michinori SHIMOJI',
        'shimoji-research': 'Comprehensive description of Ryukyuan languages and Kyushu dialects. Linguistic anthropology.',
        'fukaya-role': 'JSPS (PD)',
        'fukaya-name': 'Yasuka FUKAYA',
        'fukaya-research': 'Comprehensive description of Kelabit (Austronesian, Malayo-Polynesian). Lexicography.',
        'guay-role': 'Doctoral Student / Associate Professor, Ryutsu Keizai University',
        'guay-name': 'Matthew GUAY',
        'guay-research': 'Comprehensive description of Southern Ryukyuan Yaeyama Aragusuku dialect. Linguistic anthropology.',
        'hirosawa-role': 'Doctoral Student / JSPS',
        'hirosawa-name': 'Naoyuki HIROSAWA',
        'hirosawa-research': 'Comprehensive description of Omae dialect, Shiiba Village, Miyazaki. Information structure in Japonic languages.',
        'monson-role': 'Doctoral Student',
        'monson-name': 'Max MONSON',
        'monson-research': 'Comprehensive description of Fukaura Town, Tsugaru District, Aomori.',
        'marco-role': 'Doctoral Student',
        'marco-name': 'Marco SCOTTO DI CLEMENTE',
        'marco-research': 'Comprehensive description of Ei Town dialect, Minamikyushu City, Kagoshima.',
        'hamada-role': 'Doctoral Student / JSPS',
        'hamada-name': 'Nanami HAMADA',
        'hamada-research': 'Comprehensive description of Northern Ryukyuan Amami Kikaijima dialect. Language revitalization.',
        'miwa-role': 'Master\'s Student',
        'miwa-name': 'Haruka MIWA',
        'miwa-research': 'Information structure in Korean.',
        'iwakuma-role': 'Master\'s Student',
        'iwakuma-name': 'Watao IWAKUMA',
        'iwakuma-research': 'Description of Miyako language and contact-induced varieties of Ryukyu Islands.'
      }
    },

    // 下地理則プロフィールページ
    'member-shimoji': {
      ja: {},
      en: {
        'page-title': 'Michinori SHIMOJI',
        'page-description': 'SHIMOJI, Michinori, Ph.D.',
        'shimoji-position': 'Professor, Graduate School, Kyushu University',
        'shimoji-research-desc': 'Comprehensive description of Ryukyuan languages and Kyushu dialects. Linguistic anthropology.',
        'shimoji-column-link': 'Research columns and more',
        'shimoji-cv-link': 'CV and publications (as of September 2025)',
        'shimoji-contact': 'Contact',
        'section-employment': 'Employment History',
        'section-education': 'Education',
        'section-dissertation': 'Dissertation',
        'section-awards': 'Awards',
        'section-research': 'Research Areas',
        'section-funding': 'Competitive Research Funding (as PI)',
        'section-kakenhi': 'JSPS Grants-in-Aid',
        'section-other-funding': 'Other Funding',
        'section-hobbies': 'Hobbies',
        'back-to-members': '← Back to Members',
        // 職歴
        'job-2024': 'Professor, Linguistics, Faculty of Humanities, Kyushu University',
        'job-2012': 'Associate Professor, Linguistics, Faculty of Humanities, Kyushu University',
        'job-2011': 'Visiting Associate Professor, National Institute for Japanese Language and Linguistics',
        'job-2009': 'Lecturer, Faculty of International Communication, Gunma Prefectural Women\'s University',
        'job-2008': 'Project Researcher, Research Institute for Languages and Cultures of Asia and Africa, Tokyo University of Foreign Studies',
        // 学歴
        'edu-phd': 'Department of Linguistics, Australian National University (Ph.D.)',
        'edu-ma': 'Tokyo University of Foreign Studies, Graduate School (M.A.)',
        'edu-ba': 'Tokyo Gakugei University, Faculty of Education (B.A.)',
        // 受賞
        'award-2020': 'JSPS Prize (Japan Society for the Promotion of Science)',
        'award-2019': 'Kindaichi Kyosuke Memorial Prize',
        'award-2018': 'Okinawa Research Encouragement Award (Okinawa Association)',
        'award-2010': 'Stephen Wurm Prize for Best PhD Thesis (Australian National University)',
        'award-2009': 'Nakasone Seizen Memorial Research Award (Okinawa Center of Language Study)',
        // 研究領域
        'research-area-1': '1. Comprehensive descriptive studies through fieldwork',
        'research-area-2': '2. Cross-linguistic studies of Japanese and Ryukyuan',
        'research-area-3': '3. General linguistics',
        'research-ryukyuan': 'Ryukyuan languages:',
        'research-japanese': 'Japanese dialects:',
        // 趣味
        'hobby-guitar': 'Guitar (Gibson SG\'61)'
      }
    },

    // 研究ページ
    research: {
      ja: {
        'page-title': '研究'
      },
      en: {
        'page-title': 'Research'
      }
    },

    // 授業ページ
    teaching: {
      ja: {
        'page-title': '授業'
      },
      en: {
        'page-title': 'Courses'
      }
    },

    // 学位論文ページ
    theses: {
      ja: {
        'page-title': '指導した学位論文'
      },
      en: {
        'page-title': 'Theses Supervised'
      }
    },

    // 伊良部島方言ページ
    irabu: {
      ja: {
        'page-title': '伊良部島方言を知る'
      },
      en: {
        'page-title': 'Learn About Irabu Language'
      }
    },

    // リソースページ
    resources: {
      ja: {
        'page-title': '記述のリソース'
      },
      en: {
        'page-title': 'Descriptive Resources'
      }
    },

    // 大学院志望者ページ
    prospective: {
      ja: {
        'page-title': '大学院志望者へ'
      },
      en: {
        'page-title': 'For Prospective Students'
      }
    }
  };

  // ページ名を取得
  function getPageName() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '') || 'index';
    return filename;
  }

  // 翻訳を適用
  function applyTranslations() {
    const pageName = getPageName();
    const commonTrans = translations.common[currentLang] || {};
    const pageTrans = translations[pageName] ? translations[pageName][currentLang] || {} : {};
    const allTrans = { ...commonTrans, ...pageTrans };

    // data-i18n属性を持つ要素を翻訳
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (allTrans[key]) {
        el.innerHTML = allTrans[key];
      }
    });

    // html lang属性を更新
    document.documentElement.lang = currentLang;

    // ボタンテキストを更新
    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
      langBtn.textContent = currentLang === 'ja' ? 'EN' : '日本語';
    }
  }

  // 言語を切り替え
  function toggleLanguage() {
    currentLang = currentLang === 'ja' ? 'en' : 'ja';
    localStorage.setItem('lang', currentLang);
    applyTranslations();
  }

  // 言語切り替えボタンを追加
  function addLanguageButton() {
    // 既にボタンがあればスキップ
    if (document.getElementById('langToggle')) return;
    
    const nav = document.querySelector('.nav-container') || document.querySelector('.main-nav');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.id = 'langToggle';
    btn.className = 'lang-toggle';
    btn.textContent = currentLang === 'ja' ? 'EN' : '日本語';
    btn.onclick = toggleLanguage;
    
    // スタイルを追加
    btn.style.cssText = `
      background: transparent;
      border: 1px solid currentColor;
      color: inherit;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      margin-left: 0.5rem;
      transition: all 0.3s;
    `;
    
    nav.appendChild(btn);
  }

  // 初期化
  function init() {
    addLanguageButton();
    applyTranslations();
  }

  // DOMContentLoaded時に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // グローバルに公開
  window.i18n = {
    toggle: toggleLanguage,
    setLang: function(lang) {
      currentLang = lang;
      localStorage.setItem('lang', currentLang);
      applyTranslations();
    },
    getLang: function() {
      return currentLang;
    }
  };
})();

// グローバル関数として翻訳切り替えを公開
function toggleLang() {
  if (window.i18n && window.i18n.toggle) {
    window.i18n.toggle();
  } else {
    alert('Translation system not loaded');
  }
}
