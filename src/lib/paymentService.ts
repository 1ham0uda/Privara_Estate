/**
 * Mock payment service to simulate payment flow.
 * Can be replaced with Stripe or another gateway later.
 */
export const paymentService = {
  async processPayment(amount: number, currency: string = 'EGP'): Promise<{ success: boolean; transactionId: string }> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Simulate successful payment
    return {
      success: true,
      transactionId: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    };
  }
};
