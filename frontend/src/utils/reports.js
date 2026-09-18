export const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED"
});

export const toDateKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toMonthKey = (date) => toDateKey(date).slice(0, 7);

export const getTodayKey = () => toDateKey(new Date());

export const normalizeInvoice = (invoice) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return {
    id: invoice.id || invoice.invoiceNumber,
    invNo: invoice.invoiceNumber || "",
    customer: invoice.customer?.name || "Walk-in",
    items: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    total: Number(invoice.subtotal || 0),
    vat: Number(invoice.vatTotal || 0),
    discount: Number(invoice.discount || 0),
    grand: Number(invoice.grandTotal || 0),
    payment: invoice.paymentMethod || "Cash",
    date: invoice.date || invoice.createdAt
  };
};

export const summarizeInvoices = (invoices) =>
  invoices.reduce(
    (summary, invoice) => ({
      invoices: summary.invoices + 1,
      items: summary.items + Number(invoice.items || 0),
      total: summary.total + Number(invoice.total || 0),
      vat: summary.vat + Number(invoice.vat || 0),
      discount: summary.discount + Number(invoice.discount || 0),
      grand: summary.grand + Number(invoice.grand || 0)
    }),
    { invoices: 0, items: 0, total: 0, vat: 0, discount: 0, grand: 0 }
  );

export const groupInvoicesByWeek = (invoices) => {
  const weeks = new Map();

  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.date);
    if (Number.isNaN(invoiceDate.getTime())) return;

    const week = `Week ${Math.ceil(invoiceDate.getDate() / 7)}`;
    weeks.set(week, [...(weeks.get(week) || []), invoice]);
  });

  return Array.from(weeks.entries())
    .sort(([left], [right]) => Number(left.replace("Week ", "")) - Number(right.replace("Week ", "")))
    .map(([week, entries]) => ({ week, ...summarizeInvoices(entries) }));
};
