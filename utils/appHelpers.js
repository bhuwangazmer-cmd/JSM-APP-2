const chunkArray = (items, size) => {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!Number.isInteger(size) || size < 1) throw new RangeError('size must be a positive integer');
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const isWithinLastTwoLocalMonths = (isoDateStr, now = new Date()) => {
  if (typeof isoDateStr !== 'string') return false;
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(isoDateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsed > today) return false;
  const monthDifference = today.getFullYear() * 12 + today.getMonth() - (year * 12 + month - 1);
  return monthDifference >= 0 && monthDifference <= 1;
};

module.exports = { chunkArray, isWithinLastTwoLocalMonths };
