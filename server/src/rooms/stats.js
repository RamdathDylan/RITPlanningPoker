import { NUMERIC_CARDS } from "../../../shared/events.js";

const roundToTenth = (number) => Math.round(number * 10) / 10;

function medianOf(sortedNumbers) {
  const middle = Math.floor(sortedNumbers.length / 2);
  return sortedNumbers.length % 2 === 1
    ? sortedNumbers[middle]
    : (sortedNumbers[middle - 1] + sortedNumbers[middle]) / 2;
}

// The smallest card at or above the median, e.g. a median of 4 suggests "5".
function suggestCard(median) {
  return NUMERIC_CARDS.find((card) => Number(card) >= median) ?? NUMERIC_CARDS.at(-1);
}

function countEach(values) {
  const distribution = {};
  for (const value of values) {
    distribution[value] = (distribution[value] ?? 0) + 1;
  }
  return distribution;
}

export function computeStats(values) {
  const numbers = values
    .filter((value) => NUMERIC_CARDS.includes(value))
    .map(Number)
    .sort((a, b) => a - b);
  const hasNumbers = numbers.length > 0;
  const median = hasNumbers ? medianOf(numbers) : null;

  return {
    count: values.length,
    numericCount: numbers.length,
    min: hasNumbers ? numbers[0] : null,
    max: hasNumbers ? numbers.at(-1) : null,
    mean: hasNumbers ? roundToTenth(numbers.reduce((sum, n) => sum + n, 0) / numbers.length) : null,
    median,
    suggestion: hasNumbers ? suggestCard(median) : null,
    consensus: hasNumbers && numbers[0] === numbers.at(-1),
    unsureCount: values.filter((value) => value === "?").length,
    breakCount: values.filter((value) => value === "☕").length,
    distribution: countEach(values),
  };
}
