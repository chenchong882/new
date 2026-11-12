// Semantic decisions live in the reviewed fixture; these checks verify the actual
// quiz generator, including the merged vocabulary/phrase pool and both directions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
const helpers = source.slice(source.indexOf('        const shuffleArray ='), source.indexOf('        const GameButton =')).replace('const shuffleArray =', 'let shuffleArray =');
const quiz = source.slice(source.indexOf('            const startChoiceQuiz ='), source.indexOf('            const startClozeQuiz ='));
let seed = 2027;
const math = Object.create(Math);
math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const context = { Math: math };
vm.runInNewContext(helpers + `
    globalThis.selectOrdered = (target, pool) => {
        const original = shuffleArray;
        shuffleArray = array => [...array];
        try { return selectVocabOptions(target, pool); }
        finally { shuffleArray = original; }
    };
    globalThis.generate = data => {
        let generated = [], selected = [];
        const original = shuffleArray;
        shuffleArray = array => {
            if (array.length && 'questionText' in array[0]) generated = [...array];
            return original(array);
        };
        const unlockAnswerAudio = () => {};
        const setQuizData = value => { selected = value; };
        const setCurrentQIndex = () => {}, setScore = () => {}, setHistory = () => {};
        const setSelectedOption = () => {}, setQuizType = () => {}, setStatus = () => {};
        const setTimeLimit = () => {}, setTimeLeft = () => {};
        const questionStartRef = {};
        ${quiz}
        try { startChoiceQuiz(); return { generated, selected }; }
        finally { shuffleArray = original; }
    };
`, context);

const review = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/vocab_option_groups.json'), 'utf8'));
const reviewed = new Set();
let entries = 0, groups = 0, pairs = 0, questions = 0;
const safe = ['甲', '乙', '丙', '丁'].map((zh, i) => ({ id: `__safe_${i}`, word: `__safe_${i}`, chinese: `測試專用${zh}` }));
for (const lesson of review.lessons) {
    const unit = JSON.parse(fs.readFileSync(path.join(root, lesson.file), 'utf8')).units[lesson.unit];
    assert(unit, lesson.file);
    assert.equal(unit.vocab.length, lesson.vocab_count);
    assert.equal((unit.phrases || []).length, lesson.phrase_count);
    const pool = [...unit.vocab, ...(unit.phrases || []).map(p => ({ ...p, word: p.phrase, part_of_speech: 'phr.' }))];
    const initial = JSON.stringify(pool);
    const byId = new Map(pool.map(v => [v.id, v]));
    assert.equal(byId.size, pool.length, `${lesson.file}: duplicate IDs`);
    entries += pool.length;
    reviewed.add(`${lesson.file}:${lesson.unit}`);
    const expectedGroups = new Map();
    for (const group of lesson.groups) {
        groups++;
        assert.equal(typeof group.option_group, 'string');
        assert(group.option_group.trim());
        assert(group.members.length >= 2);
        for (const expected of group.members) {
            const actual = byId.get(expected.id);
            assert(actual, expected.id);
            assert.equal(actual.word, expected.word, `${expected.id}: review outdated`);
            assert.equal(actual.chinese, expected.chinese, `${expected.id}: review outdated`);
            assert.equal(actual.option_group, group.option_group, expected.id);
            expectedGroups.set(actual.id, group.option_group);
        }
        for (let i = 0; i < group.members.length; i++) {
            for (let j = i + 1; j < group.members.length; j++) {
                pairs++;
                const a = byId.get(group.members[i].id), b = byId.get(group.members[j].id);
                for (const [target, forbidden] of [[a, b], [b, a]]) {
                    // Put the ambiguous choice first so a random shuffle cannot hide a failure.
                    const result = context.selectOrdered(target, [forbidden, ...safe]);
                    assert.equal(result.length, 4, target.id);
                    assert(result.some(v => v.id === target.id));
                    assert(!result.some(v => v.id === forbidden.id), `${target.id} vs ${forbidden.id}`);
                }
                const distractors = context.selectOrdered(safe[0], [a, b, ...safe.slice(1)]);
                assert.equal(distractors.filter(v => v.id === a.id || v.id === b.id).length, 1);
            }
        }
    }
    for (const item of pool) {
        if ('option_group' in item) {
            assert.equal(typeof item.option_group, 'string', item.id);
            assert(item.option_group.trim(), item.id);
            assert.equal(item.option_group, expectedGroups.get(item.id), `${item.id}: unreviewed group`);
        }
    }
    for (let iteration = 0; iteration < 20; iteration++) {
        const result = context.generate(pool);
        assert.equal(result.generated.length, pool.length * 2, `${lesson.file}: a word/direction became unquizzable`);
        assert.equal(result.selected.length, Math.min(10, pool.length * 2));
        for (const target of pool) {
            const both = result.generated.filter(q => q.correctId === target.id);
            assert.equal(both.length, 2);
            assert.equal(both[0].questionText, target.word);
            assert.equal(both[0].correctAnswer, target.chinese);
            assert.equal(both[1].questionText, target.chinese);
            assert.equal(both[1].correctAnswer, target.word);
            for (let direction = 0; direction < 2; direction++) {
                const q = both[direction];
                questions++;
                assert.equal(q.options.length, 4);
                assert.equal(q.options.filter(o => o.isCorrect).length, 1);
                assert.equal(q.options.find(o => o.isCorrect).id, target.id);
                assert.equal(new Set(q.options.map(o => o.text.trim().toLowerCase())).size, 4);
                const groupNames = q.options.map(o => byId.get(o.id).option_group).filter(Boolean);
                assert.equal(new Set(groupNames).size, groupNames.length, `${lesson.file}: conflicting choices`);
                for (const option of q.options) {
                    assert.equal(option.text, byId.get(option.id)[direction === 0 ? 'chinese' : 'word']);
                }
            }
        }
    }
    assert.equal(JSON.stringify(pool), initial, `${lesson.file}: generator mutated the material`);
}
// All existing lesson files, including inactive/archived lessons, must be covered.
for (const student of fs.readdirSync(path.join(root, 'data'), { withFileTypes: true })) {
    if (!student.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(root, 'data', student.name))) {
        if (!file.endsWith('.json')) continue;
        const rel = `data/${student.name}/${file}`;
        const data = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
        if (!data.units || Array.isArray(data.units)) continue;
        for (const unit of Object.keys(data.units)) assert(reviewed.has(`${rel}:${unit}`), `Not reviewed: ${rel}:${unit}`);
    }
}
console.log(`PASS: ${reviewed.size} lessons, ${entries} vocabulary/phrase entries, ${groups} reviewed groups, ${pairs} exhaustive conflict pairs, ${questions} generated questions in both directions; no skipped entries or mutations.`);
