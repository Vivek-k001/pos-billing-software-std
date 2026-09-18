const VAT_RATE = 0.05;

exports.calculateInvoice = (items, discount = 0, discountType = "flat") => {
  let subtotal = 0;
  let vatTotal = 0;
  const normalizedDiscount = Math.max(Number(discount) || 0, 0);

  const updatedItems = items.map(item => {
    const rate = Number(item.rate) || 0;
    const qty = Number(item.qty) || 0;
    const base = rate * qty;
    const customVatRate = typeof item.vatRate === "number" ? (item.vatRate / 100) : VAT_RATE;
    const vat = item.vatApplicable !== false ? base * customVatRate : 0;
    const total = base + vat;

    subtotal += base;
    vatTotal += vat;

    return { ...item, vat, total };
  });

  let discountAmount = normalizedDiscount;
  if (discountType === "percentage") {
    discountAmount = subtotal * (normalizedDiscount / 100);
  }

  return {
    items: updatedItems,
    subtotal,
    vatTotal,
    discount: normalizedDiscount,
    discountType,
    grandTotal: Math.max(subtotal + vatTotal - discountAmount, 0)
  };
};
