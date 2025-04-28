// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const operations = [];

  for (const line of input.cart.lines) {
    // read the aliased attribute you asked for
    const bidValue = line.customBidPrice?.value;
    if (!bidValue) continue;

    const bidPrice = parseFloat(bidValue);
    if (isNaN(bidPrice)) continue;

    // all prices in shop currency—no extra exchange rate
    const finalAmount = bidPrice.toFixed(2);

    operations.push({
      update: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: { amount: finalAmount },
          },
        },
      },
    });
  }

  return { operations };
}