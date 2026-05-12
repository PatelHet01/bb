export function getLedgerEntryStyle(type, context) {
  // Convention:
  // RED (Credit) = Money going OUT from entity's perspective (they owe, or we gave them)
  // GREEN (Debit) = Money coming IN to entity's perspective (they paid, or we received)

  let color = 'text-ink-600';
  let bgColor = 'bg-ink-100';
  let prefix = '';
  let label = type;
  let isDebit = false;

  switch (context) {
    case 'customer_khata':
      if (type === 'CREDIT') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '+';
        label = 'Credit Given';
        isDebit = false;
      } else if (type === 'PAYMENT') {
        color = 'text-emerald-600 dark:text-emerald-400';
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30';
        prefix = '-';
        label = 'Payment Recvd';
        isDebit = true;
      } else if (type === 'ADJUSTMENT') {
        color = 'text-amber-600 dark:text-amber-400';
        bgColor = 'bg-amber-100 dark:bg-amber-900/30';
      }
      break;

    case 'customer_advance':
      if (type === 'TOPUP') {
        color = 'text-emerald-600 dark:text-emerald-400';
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30';
        prefix = '+';
        label = 'Advance Added';
        isDebit = true;
      } else if (type === 'DEDUCTION') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '-';
        label = 'Advance Used';
        isDebit = false;
      } else if (type === 'REFUND') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '-';
        label = 'Refunded';
        isDebit = false;
      }
      break;

    case 'vendor':
      if (type === 'PURCHASE') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '+';
        label = 'Purchase (Owe)';
        isDebit = false;
      } else if (type === 'PAYMENT') {
        color = 'text-emerald-600 dark:text-emerald-400';
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30';
        prefix = '-';
        label = 'Payment Made';
        isDebit = true;
      } else if (type === 'RETURN') {
        color = 'text-emerald-600 dark:text-emerald-400';
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30';
        prefix = '-';
        label = 'Return';
        isDebit = true;
      } else if (type === 'ADJUSTMENT') {
        color = 'text-amber-600 dark:text-amber-400';
        bgColor = 'bg-amber-100 dark:bg-amber-900/30';
      }
      break;

    case 'staff':
      if (type === 'ADVANCE') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '+';
        label = 'Advance Given';
        isDebit = false;
      } else if (type === 'SALARY') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '+';
        label = 'Salary Paid';
        isDebit = false;
      } else if (type === 'BONUS') {
        color = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/30';
        prefix = '+';
        label = 'Bonus';
        isDebit = false;
      } else if (type === 'DEDUCTION') {
        color = 'text-emerald-600 dark:text-emerald-400';
        bgColor = 'bg-emerald-100 dark:bg-emerald-900/30';
        prefix = '-';
        label = 'Deduction';
        isDebit = true;
      }
      break;
      
    default:
      break;
  }

  return { color, bgColor, prefix, label, isDebit };
}
