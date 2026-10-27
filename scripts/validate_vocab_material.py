"""Validate a student folder containing vocabulary-only lesson JSON files.

Usage: python3 scripts/validate_vocab_material.py data/前鎮
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path


def validate(folder):
    manifest = json.loads((folder / 'lessons.json').read_text(encoding='utf-8'))
    codes = manifest['units']
    assert codes and len(codes) == len(set(codes)), '課程清單為空或重複'
    assert codes == manifest['all'], '單字教材的 units 與 all 必須一致'
    assert {p.stem for p in folder.glob('*.json') if p.name != 'lessons.json'} == set(codes), '課程清單與檔案不一致'
    total = 0
    all_ids = set()
    for level, code in enumerate(codes, 1):
        data = json.loads((folder / f'{code}.json').read_text(encoding='utf-8'))
        assert list(data['units']) == [code], f'{code}: 課程代號不一致'
        unit = data['units'][code]
        assert unit['title'] == 'U' + re.search(r'-u(\d+)$', code).group(1), f'{code}: 標題格式不符'
        assert not unit.get('grammar') and not unit.get('phrases'), f'{code}: 含未要求的文法或片語'
        assert not unit.get('cloze_quiz'), f'{code}: 含未要求的填空題'
        vocab = unit['vocab']
        assert vocab, f'{code}: 沒有單字'
        assert len({v['word'].casefold() for v in vocab}) == len(vocab), f'{code}: 單字重複'
        assert len({v['sentence'] for v in vocab}) == len(vocab), f'{code}: 例句重複'
        for index, item in enumerate(vocab, 1):
            assert item['id'] == f'{code}-v{index:03d}', f'{code}: 單字 ID 不連號'
            for key in ('word', 'part_of_speech', 'chinese', 'sentence', 'sentence_chinese'):
                assert isinstance(item.get(key), str) and item[key].strip(), f'{item["id"]}: {key} 空白'
            assert re.fullmatch(r'[動名形副助片連介代／]+', item['part_of_speech']), f'{item["id"]}: 詞性不是中文'
            assert re.fullmatch(r'[A-Za-z][A-Za-z -]*', item['word']), f'{item["id"]}: 主單字含拼字用不到的符號'
            forms = item.get('accepted_forms', [item['word']])
            assert item['word'] in forms and len(forms) == len(set(forms)), f'{item["id"]}: 多寫法設定錯誤'
            assert all(re.fullmatch(r'[A-Za-z][A-Za-z -]*', form) for form in forms), f'{item["id"]}: 寫法含無效字元'
        scrambles = unit['scrambles']
        assert not scrambles.get('grammar') and not scrambles.get('phrases'), f'{code}: 含未要求的重組題型'
        rows = scrambles['vocab']
        assert len(rows) == len(vocab), f'{code}: 單字與重組句數量不符'
        assert Counter(s['vocab_id'] for s in rows) == Counter(v['id'] for v in vocab), f'{code}: 重組句未一對一對應'
        by_id = {v['id']: v for v in vocab}
        for index, row in enumerate(rows, 1):
            assert row['id'] == f'{code}-sv{index:03d}', f'{code}: 重組句 ID 不連號'
            source = by_id[row['vocab_id']]
            for key in ('sentence', 'sentence_chinese'):
                assert row[key] == source[key], f'{row["id"]}: 重組句與單字例句不同'
        ids = [item['id'] for item in vocab + rows]
        assert len(set(ids)) == len(ids) and not all_ids.intersection(ids), f'{code}: ID 重複'
        all_ids.update(ids)
        total += len(vocab)
        print(f'PASS Level {level}: {code}，單字 {len(vocab)}、單字重組 {len(rows)}')
    students_path = folder.parent.parent / 'students.json'
    if students_path.exists():
        students = json.loads(students_path.read_text(encoding='utf-8'))
        assert sum(s['id'] == folder.name for s in students) == 1, '學生清單未正確登錄'
    print(f'PASS: {len(codes)} 個 Level、{total} 個單字、{total} 題單字重組；欄位、連號、詞性、去重、參照與課程清單皆通過。')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    validate(Path(sys.argv[1]).resolve())
