#!/bin/bash
# 学位論文PDFダウンロードスクリプト
# 使い方: このスクリプトをサイトのルートフォルダで実行
# chmod +x download_theses.sh && ./download_theses.sh

mkdir -p files/theses
cd files/theses

echo "=== 学位論文PDFをダウンロード中... ==="

# 2024年度卒論
echo "2024年度卒論..."
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_70b841b9e85c4ebd8372b9a07c0875d7.pdf" -o "2024_BA_shuto.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_e48fd5fe4a2e41bbaa8adb7d5e8ae14d.pdf" -o "2024_BA_haraguchi.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_07385a6d1c094516be7711f182b7e932.pdf" -o "2024_BA_fujimoto_wakana.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_7774063b407145f2b1cd879c19d7b382.pdf" -o "2024_BA_horinouchi.pdf"

# 2022年度卒論
echo "2022年度卒論..."
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_b82ceab2df5c4981a1b0062e2b8b4576.pdf" -o "2022_BA_aratsu.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_f1455f8ee20c4c228f2f6f2027b4016a.pdf" -o "2022_BA_kobayashi_kanon.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_b39c13483fad4833865ecd04922a1ede.pdf" -o "2022_BA_fukui.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_abb465a294cf469ea92efd8c65b91aef.pdf" -o "2022_BA_fukuda.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_7946ca2e51974da9bcf9ec4bda3acd40.pdf" -o "2022_BA_fujimoto_yuka.pdf"

# 2021年度卒論
echo "2021年度卒論..."
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_7ecfc35bbc214b3dbea613bd91323c97.pdf" -o "2021_BA_kobayashi_hiromu.pdf"
curl -L "https://www.mshimoji.com/_files/ugd/88f9b7_0b