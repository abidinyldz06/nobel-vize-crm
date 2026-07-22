type ApplicationMetricRow = { status: string; created_at: string };
type PaymentMetricRow = { amount: number; status: string | null; created_at: string };

export function summarizeMonthlyDashboard(
  applications: ApplicationMetricRow[],
  payments: PaymentMetricRow[],
  startOfMonth: Date,
) {
  const start = startOfMonth.getTime();
  const monthlyApplications = applications.filter(application => new Date(application.created_at).getTime() >= start);
  const monthlyPayments = payments.filter(payment =>
    payment.status === 'alindi' && new Date(payment.created_at).getTime() >= start
  );

  return {
    applications: monthlyApplications.length,
    approved: monthlyApplications.filter(application => application.status === 'onaylandi').length,
    rejected: monthlyApplications.filter(application => application.status === 'reddedildi').length,
    revenue: monthlyPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
  };
}

export function passportExpiryState(expiry: string, now = new Date()) {
  const expiryDate = new Date(`${expiry}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000);
  return { expired: days < 0, days };
}
