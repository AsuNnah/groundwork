// Todo list helpers. Lists are arrays of { text, done }; functions never mutate their input.
function add(list, text) {
  if (!text || !text.trim()) throw new Error('empty todo');
  return [...list, { text: text.trim(), done: false }];
}
function complete(list, index) {
  return list.map((t, i) => (i === index ? { ...t, done: true } : t));
}
function render(list) {
  return list.map(t => (t.done ? '[x] ' : '[ ] ') + t.text);
}
module.exports = { add, complete, render };
