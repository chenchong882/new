const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
const helpers = source.slice(source.indexOf('        const shuffleArray ='), source.indexOf('        const GameButton ='));
const game = source.slice(source.indexOf('        const buildGameQ ='), source.indexOf('        const LS_GAME ='));
const context = {};
vm.runInNewContext(helpers + game + '\nglobalThis.api = { selectVocabOptions, buildGameQ };', context);
const { selectVocabOptions, buildGameQ } = context.api;
const item = (id, word, chinese) => ({ id, word, chinese });
const ifWord = item('if', 'if', '是否');
const whether = item('whether', 'whether', '是否');
const gate = item('gate', 'gate', '大門');
const food = item('food', 'food', '食物');
const key = item('key', 'key', '鑰匙');
const pool = [ifWord, whether, gate, food, key];
const initial = JSON.stringify(pool);

for (let i = 0; i < 100; i++) {
    for (const target of [ifWord, whether]) {
        const choices = selectVocabOptions(target, pool);
        assert.equal(choices.length, 4);
        assert.equal(choices.filter(x => x.chinese === '是否').length, 1);
        assert.equal(choices.filter(x => x.id === target.id).length, 1);
    }
    const choices = selectVocabOptions(gate, pool);
    assert.equal(new Set(choices.map(x => x.chinese)).size, 4, 'distractors must also have different meanings');
    const question = buildGameQ(ifWord, pool);
    assert.equal(question.options.length, 4);
    assert.equal(question.options.filter(x => x.isCorrect).length, 1);
    assert(!question.options.some(x => x.id === whether.id));
}
assert.equal(JSON.stringify(pool), initial, 'selection must not mutate source vocabulary');
assert.equal(selectVocabOptions(ifWord, [ifWord, whether, gate, food]).length, 0, 'skip when fewer than four distinct meanings exist');
assert.equal(buildGameQ(ifWord, [ifWord, whether]), null);
assert.equal(buildGameQ(undefined, []), null);

const love = item('love', 'love', '喜愛；愛');
const like = item('like', 'like', '喜愛（動詞）');
const duplicate = item('gate-duplicate', ' GATE ', '校門');
for (let i = 0; i < 100; i++) {
    const choices = selectVocabOptions(love, [love, like, gate, food, key]);
    assert.equal(choices.length, 4);
    assert(!choices.some(x => x.id === like.id), 'overlapping senses and parenthetical labels must be excluded');
    const wordChoices = selectVocabOptions(gate, [gate, duplicate, food, key, ifWord]);
    assert(!wordChoices.some(x => x.id === duplicate.id), 'same English word with another ID must be excluded');
}

const lesson = JSON.parse(fs.readFileSync(path.join(root, 'data/福山/m3-2-u4.json'), 'utf8')).units['m3-2-u4'];
for (const target of lesson.vocab) {
    for (let i = 0; i < 20; i++) {
        const choices = selectVocabOptions(target, lesson.vocab);
        assert.equal(choices.length, 4, target.word);
        assert.equal(choices.filter(x => x.id === target.id).length, 1);
        assert.equal(new Set(choices.map(x => x.chinese)).size, 4);
        assert.equal(new Set(choices.map(x => x.word)).size, 4);
    }
}
console.log('PASS: synonym exclusion in both directions, distinct distractors, overlap, duplicate words, small pools, immutability, and all 38 U4 entries.');
