// Format byte counts for the status page.
function formatBytes(n) {
  if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}
module.exports = { formatBytes };
