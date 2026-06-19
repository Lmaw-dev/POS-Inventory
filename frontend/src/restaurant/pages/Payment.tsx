import { useState } from 'react';
import { Sidebar } from '../../shared/components/Sidebar';
import { Page, type StoreBrand } from '../../shared/App';
import type { AuthenticatedUser, StaffType, StoreType } from '../../auth/types/auth';
import { CreditCard, Wallet, Banknote } from 'lucide-react';
import { getApiBaseUrl } from '../../auth/services/auth';

interface PaymentProps {
  currentUser: AuthenticatedUser | null;
  onNavigate: (page: Page) => void;
  currentOrder: any;
  onLogout: () => void;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: StoreType;
  staffType?: StaffType;
}

export function Payment({ currentUser, onNavigate, currentOrder, onLogout, storeBrand, userName, storeType, staffType }: PaymentProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'ewallet'>('cash');
  const [paymentTiming, setPaymentTiming] = useState<'now' | 'later'>('now');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessPayment = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      if (paymentTiming === 'now' && currentUser?.id && currentOrder?.items?.length) {
        const total = currentOrder.total ?? currentOrder.subtotal ?? 0;
        const orderNumber = currentOrder.orderNumber ?? currentOrder.order_number ?? Date.now();
        const response = await fetch(`${getApiBaseUrl()}/pos/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
            orderNumber: `REST-${orderNumber}`,
            customerName: currentOrder.customerName ?? null,
            orderType: currentOrder.orderType ?? 'DINE_IN',
            tableName: currentOrder.tableNumber ? `Table ${currentOrder.tableNumber}` : null,
            partySize: currentOrder.partySize ?? currentOrder.requiredSeats ?? null,
            subtotal: currentOrder.subtotal ?? 0,
            discount: currentOrder.discount ?? 0,
            discountType: currentOrder.discountType ?? null,
            serviceFee: currentOrder.serviceFee ?? 0,
            tax: currentOrder.tax ?? 0,
            total,
            items: currentOrder.items.map((item: any) => ({ ...item, productId: item.id })),
            payment: {
              paymentNumber: `PAY-${orderNumber}`,
              method: paymentMethod,
              amountPaid: total,
              changeAmount: 0,
            },
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data?.message ?? 'Unable to process payment. Inventory may be insufficient.');
          return;
        }
      }

      onNavigate('receipt');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar currentPage="create-order" onNavigate={onNavigate} onLogout={onLogout} storeBrand={storeBrand} userName={userName} storeType={storeType} staffType={staffType} />

      <div className="flex-1 overflow-auto bg-background">
        <div className="p-8">
          <h1 className="text-primary mb-6">Payment</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
                <h2 className="text-primary mb-4">Order Summary</h2>
                {currentOrder ? (
                  <div className="space-y-2">
                    <p><strong>Customer:</strong> {currentOrder.customerName}</p>
                    <p><strong>Order Type:</strong> {currentOrder.orderType}</p>
                    <div className="border-t border-border pt-4 mt-4">
                      <p className="mb-2"><strong>Items:</strong></p>
                      {currentOrder.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between mb-2">
                          <span>{item.quantity}x {item.name}</span>
                          <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-4 mt-4">
                      <div className="flex justify-between text-xl">
                        <strong>Total Amount:</strong>
                        <strong className="text-primary">₱{currentOrder.subtotal?.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No order data available</p>
                )}
              </div>
            </div>

            <div>
              <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
                <h2 className="text-primary mb-4">Payment Timing</h2>
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => setPaymentTiming('now')}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-lg transition-colors ${
                      paymentTiming === 'now'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Pay Now
                  </button>
                  <button
                    onClick={() => setPaymentTiming('later')}
                    disabled={isProcessing}
                    className={`flex-1 py-3 rounded-lg transition-colors ${
                      paymentTiming === 'later'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    Pay Later
                  </button>
                </div>

                {paymentTiming === 'now' && (
                  <>
                    <h2 className="text-primary mb-4">Payment Method</h2>
                    <div className="space-y-3 mb-6">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        disabled={isProcessing}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                          paymentMethod === 'cash'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Banknote className="w-6 h-6 text-primary" />
                        <span>Cash</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        disabled={isProcessing}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                          paymentMethod === 'card'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <CreditCard className="w-6 h-6 text-primary" />
                        <span>Card</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('ewallet')}
                        disabled={isProcessing}
                        className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                          paymentMethod === 'ewallet'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Wallet className="w-6 h-6 text-primary" />
                        <span>E-Wallet</span>
                      </button>
                    </div>
                  </>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => onNavigate('create-order')}
                    disabled={isProcessing}
                    className="flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                    className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? 'Processing...' : paymentTiming === 'now' ? 'Process Payment' : 'Confirm Order'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
