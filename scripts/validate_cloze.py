"""Validate the independently authored cloze_quiz in each active lesson.

Schema: id, vocab_id, question (one ___ blank), four unlabelled options,
answer (A-D), answer_index (0-3), and a Chinese explanation in hint.
Run from any directory: python3 scripts/validate_cloze.py
"""
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []
lessons = questions = 0

def check(ok, location, message):
    if not ok:
        errors.append(f'{location}: {message}')

for manifest in sorted((ROOT / 'data').glob('*/lessons.json')):
    for code in json.loads(manifest.read_text())['units']:
        path = manifest.parent / f'{code}.json'
        unit = json.loads(path.read_text())['units'][code]
        rows = unit.get('cloze_quiz', [])
        location = f'{manifest.parent.name}/{code}'
        check(len(rows) == 20, location, f'expected 20 questions, got {len(rows)}')
        lessons += 1
        questions += len(rows)
        vocab_ids = {v['id'] for v in unit.get('vocab', [])}
        seen = set()
        answers = []
        normalize = lambda value: re.sub(r'\s+', ' ', value).strip().lower()
        examples = {normalize(v.get('sentence', '')) for v in unit.get('vocab', [])}
        for index, item in enumerate(rows):
            where = f'{location}/{index + 1}'
            check(item.get('id') == f'{code}-cq{index + 1:03}', where, 'non-sequential id')
            check(item.get('vocab_id') in vocab_ids, where, 'unknown vocab_id')
            question = item.get('question', '')
            check(isinstance(question, str) and len(re.findall(r'_{3,}|＿{2,}', question)) == 1, where, 'must contain exactly one blank')
            check(normalize(question) not in seen, where, 'duplicate question')
            seen.add(normalize(question))
            options = item.get('options', [])
            valid = len(options) == 4 and all(isinstance(x, str) and x.strip() for x in options)
            check(valid, where, 'must have four nonempty options')
            if not valid:
                continue
            check(len({normalize(x) for x in options}) == 4, where, 'duplicate option')
            check(all(not re.match(r'^[A-D]\.\s', x) for x in options), where, 'options must not have baked-in letters')
            answer_index = item.get('answer_index')
            valid = type(answer_index) is int and 0 <= answer_index < 4
            check(valid, where, 'invalid answer_index')
            if not valid:
                continue
            check(item.get('answer') == 'ABCD'[answer_index], where, 'answer and index disagree')
            answers.append(item['answer'])
            hint = item.get('hint', '')
            check(isinstance(hint, str) and bool(re.search(r'[\u4e00-\u9fff]', hint)), where, 'missing Chinese explanation')
            full = re.sub(r'_{3,}|＿{2,}', lambda _: options[answer_index], question)
            check(normalize(full) not in examples, where, 'question copies an existing vocabulary example')
        check(collections.Counter(answers) == dict.fromkeys('ABCD', 5), location, 'answers must be balanced: five each')
        check(not any(len(set(answers[i:i+4])) == 1 for i in range(len(answers)-3)), location, 'four identical answers in a row')
if errors:
    print('\n'.join(errors))
    raise SystemExit(f'FAIL: {len(errors)} issue(s)')
print(f'PASS: {lessons} active lessons, {questions} questions; counts, references, unique blanks/options, answers, explanations, and independent sentences checked.')
