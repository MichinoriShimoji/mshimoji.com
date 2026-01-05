#!/usr/bin/env python3
"""Add エッセイ link to all HTML files that are missing it."""

import os
import re

# エッセイリンク（大学院志望者への後に追加）
essay_link = '<li class="nav-item"><a href="https://note.com/lingfieldwork" class="nav-link" target="_blank" data-i18n="nav-essay">エッセイ</a></li>'

def add_essay_link(filepath):
    """Add essay link after 大学院志望者へ link if not present."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Already has エッセイ link
    if 'エッセイ' in content or 'nav-essay' in content:
        return False
    
    # Pattern to find the 大学院志望者へ nav item
    # Match various patterns of the prospective link
    patterns = [
        # With data-i18n
        r'(<li class="nav-item"><a href="prospective\.html" class="nav-link"[^>]*data-i18n="nav-prospective"[^>]*>大学院志望者へ</a></li>)',
        r'(<li class="nav-item"><a href="prospective\.html" class="nav-link"[^>]*>大学院志望者へ</a></li>)',
        # For writing-guide (relative path)
        r'(<li class="nav-item"><a href="\.\.?/prospective\.html" class="nav-link"[^>]*>大学院志望者へ</a></li>)',
    ]
    
    modified = False
    for pattern in patterns:
        if re.search(pattern, content):
            new_content = re.sub(
                pattern,
                r'\1\n        ' + essay_link,
                content
            )
            if new_content != content:
                content = new_content
                modified = True
                break
    
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    # Process main directory
    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            if add_essay_link(filename):
                print(f'{filename}: エッセイリンク追加')
    
    # Process writing-guide directory
    if os.path.exists('writing-guide'):
        for filename in os.listdir('writing-guide'):
            if filename.endswith('.html'):
                filepath = os.path.join('writing-guide', filename)
                if add_essay_link(filepath):
                    print(f'{filepath}: エッセイリンク追加')
    
    print('\n完了')

if __name__ == '__main__':
    main()
