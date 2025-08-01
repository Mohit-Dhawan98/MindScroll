import fs from 'fs';

const data = JSON.parse(fs.readFileSync('/Users/mohitdhawan/Microlearn/backend/storage/cache/bd3213d7f8c1defc9b40717d351914b6-cards.json', 'utf8'));

console.log('Total cards:', data.cards.length);
console.log('\nFirst 10 card titles:');
data.cards.slice(0, 10).forEach((card, i) => {
  console.log(`${i+1}. [${card.type}] ${card.title.substring(0, 80)}...`);
});

console.log('\nChecking for duplicate titles:');
const titles = data.cards.map(c => c.title);
const uniqueTitles = new Set(titles);
console.log('Unique titles:', uniqueTitles.size, 'of', titles.length);

if (uniqueTitles.size !== titles.length) {
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  console.log('Duplicate titles found:', [...new Set(duplicates)]);
}

console.log('\nCard types breakdown:');
const typeCount = {};
data.cards.forEach(card => {
  typeCount[card.type] = (typeCount[card.type] || 0) + 1;
});
console.log(typeCount);

console.log('\nSample content similarity check (first 5 FLASHCARD titles):');
const flashcards = data.cards.filter(c => c.type === 'FLASHCARD').slice(0, 5);
flashcards.forEach((card, i) => {
  console.log(`${i+1}. ${card.title}`);
});