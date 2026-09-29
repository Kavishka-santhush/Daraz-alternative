-- One payment has at most one installment plan. Payment.installments is the
-- inverse side of this one-to-one relation, so the FK column must be unique.
CREATE UNIQUE INDEX "InstallmentPlan_paymentId_key" ON "InstallmentPlan"("paymentId");
