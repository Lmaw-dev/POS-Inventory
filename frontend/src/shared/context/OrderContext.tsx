import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { getApiBaseUrl } from '../../auth/services/auth';
import type { AuthenticatedUser } from '../../auth/types/auth';
import { getLocalDateKey } from '../utils/date';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  lineTotal?: number;
  image?: string;
  itemType?: 'dine-in' | 'takeout';
  notes?: string;
  ingredients?: any[];
}

export interface Order {
  id: string;
  orderNumber?: string;
  customer: string;
  type: 'Dine-In' | 'Takeout' | 'Mixed';
  table: string;
  amountNumber: number;
  subtotal: number;
  serviceFee: number;
  tax: number;
  discount: number;
  discountType?: string;
  paymentStatus: 'Paid' | 'Not Paid' | 'Void';
  orderStatus: 'Pending' | 'Preparing' | 'Ready' | 'Served' | 'Completed';
  date: string;
  time: string;
  items: OrderItem[];
  paymentId?: string;
  receiptId?: string;
  cashReceived?: number;
  changeGiven?: number;
  cashier?: string;
  queuePosition?: number;
  isQueued?: boolean;
  partySize?: number;
  tableNumbers?: number[];
  requiredSeats?: number;
}

export interface QueuedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  total: number;
  timestamp: Date;
  queuePosition: number;
  partySize?: number;
  requiredSeats?: number;
}

export interface TableStatus {
  number: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  orderId?: string;
}

const initialOrders: Order[] = [
  {
    id: '000001',
    customer: 'Juan Dela Cruz',
    type: 'Dine-In',
    table: 'Table 5',
    amountNumber: 1430.00,
    subtotal: 1250.00,
    serviceFee: 12.50,
    tax: 150.00,
    discount: 0,
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    date: '2026-05-28',
    time: '10:30 AM',
    items: [
      { name: 'Truffle Pasta', quantity: 2, price: 380, itemType: 'dine-in' },
      { name: 'Grilled Salmon', quantity: 1, price: 490, itemType: 'dine-in' },
    ],
    partySize: 3,
    paymentId: 'PAY-001234',
    receiptId: 'REC-001234',
    cashReceived: 1500,
    changeGiven: 70,
    cashier: 'Maria Santos',
  },
  {
    id: '000002',
    customer: 'Maria Santos',
    type: 'Dine-In',
    table: 'Table 3',
    amountNumber: 2850.00,
    subtotal: 2700.00,
    serviceFee: 27.00,
    tax: 324.00,
    discount: 540.00,
    discountType: 'Senior Citizen',
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    date: '2026-05-28',
    time: '11:15 AM',
    items: [
      { name: 'Wagyu Steak', quantity: 2, price: 890, itemType: 'dine-in' },
      { name: 'Lobster Thermidor', quantity: 1, price: 650, itemType: 'dine-in' },
      { name: 'Tiramisu', quantity: 2, price: 135, itemType: 'dine-in' },
    ],
    partySize: 5,
    paymentId: 'PAY-001235',
    receiptId: 'REC-001235',
    cashReceived: 3000,
    changeGiven: 150,
    cashier: 'Joseph Dalton',
  },
  {
    id: '000003',
    customer: 'Mark Reyes',
    type: 'Takeout',
    table: '—',
    amountNumber: 320.00,
    subtotal: 285.00,
    serviceFee: 2.85,
    tax: 34.20,
    discount: 0,
    paymentStatus: 'Paid',
    orderStatus: 'Completed',
    date: '2026-05-28',
    time: '12:00 PM',
    items: [
      { name: 'Caesar Salad', quantity: 1, price: 180, itemType: 'takeout' },
      { name: 'Lemonade', quantity: 1, price: 105, itemType: 'takeout' },
    ],
    paymentId: 'PAY-001236',
    receiptId: 'REC-001236',
    cashReceived: 350,
    changeGiven: 30,
    cashier: 'Maria Santos',
  },
  {
    id: '000004',
    customer: 'Anna Lim',
    type: 'Takeout',
    table: '—',
    amountNumber: 215.00,
    subtotal: 190.00,
    serviceFee: 1.90,
    tax: 22.80,
    discount: 0,
    paymentStatus: 'Not Paid',
    orderStatus: 'Ready',
    date: '2026-05-28',
    time: '01:20 PM',
    items: [
      { name: 'Mushroom Soup', quantity: 1, price: 120, itemType: 'takeout' },
      { name: 'Iced Tea', quantity: 1, price: 70, itemType: 'takeout' },
    ],
  },
  {
    id: '000005',
    customer: 'Angel Cruize',
    type: 'Dine-In',
    table: 'Table 7',
    amountNumber: 1850.00,
    subtotal: 1640.00,
    serviceFee: 16.40,
    tax: 196.80,
    discount: 0,
    partySize: 4,
    paymentStatus: 'Not Paid',
    orderStatus: 'Served',
    date: '2026-05-28',
    time: '02:45 PM',
    items: [
      { name: 'Chicken Burger', quantity: 3, price: 320, itemType: 'dine-in' },
      { name: 'Spring Rolls', quantity: 2, price: 130, itemType: 'dine-in' },
      { name: 'Sparkling Water', quantity: 2, price: 85, itemType: 'dine-in' },
    ],
  },
  {
    id: '000006',
    customer: 'Jely Gomez',
    type: 'Mixed',
    table: 'Table 2',
    amountNumber: 1280.00,
    subtotal: 1130.00,
    serviceFee: 11.30,
    tax: 135.60,
    discount: 0,
    partySize: 2,
    paymentStatus: 'Not Paid',
    orderStatus: 'Preparing',
    date: '2026-05-28',
    time: '03:10 PM',
    items: [
      { name: 'Wagyu Steak', quantity: 1, price: 890, itemType: 'dine-in' },
      { name: 'Caesar Salad', quantity: 1, price: 180, itemType: 'takeout' },
      { name: 'Lemonade', quantity: 1, price: 105, itemType: 'takeout' },
    ],
  },
  {
    id: '000007',
    customer: 'Sophie Alvarez',
    type: 'Dine-In',
    table: 'Table 9',
    amountNumber: 980.00,
    subtotal: 870.00,
    serviceFee: 8.70,
    tax: 104.40,
    discount: 0,
    partySize: 2,
    paymentStatus: 'Not Paid',
    orderStatus: 'Pending',
    date: '2026-05-28',
    time: '04:30 PM',
    items: [
      { name: 'Red Wine', quantity: 2, price: 350, itemType: 'dine-in' },
      { name: 'Cheese Platter', quantity: 1, price: 170, itemType: 'dine-in' },
    ],
  },
];

interface OrderContextType {
  orders: Order[];
  queuedOrders: QueuedOrder[];
  addOrder: (order: Omit<Order, 'id'>) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  removeFromQueue: (id: string) => void;
  assignQueuedOrderToTable: (id: string, table: string, orderStatus: Order['orderStatus']) => Promise<void>;
  completePayment: (orderId: string, paymentData: { cashReceived: number; changeGiven: number; cashier?: string; paymentId?: string; receiptId?: string }) => Promise<void>;
  completeTableOrder: (orderId: string) => Promise<void>;
  voidOrder: (orderId: string) => Promise<void>;
  paymentCompletedSignal: number; // Signal for when payment is completed
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children, currentUser }: { children: ReactNode; currentUser: AuthenticatedUser | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const nextId = useRef(1);
  const [paymentCompletedSignal, setPaymentCompletedSignal] = useState(0);

  useEffect(() => {
    const loadOrders = async () => {
      if (!currentUser?.id || currentUser.store_type !== 'RESTAURANT') {
        setOrders([]);
        return;
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/admin/pos/orders?user_id=${currentUser.id}`);
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          setOrders([]);
          return;
        }

        const mapped = data.map(mapDatabaseRestaurantOrder);
        setOrders(mapped);
        nextId.current = mapped.length + 1;
      } catch {
        setOrders([]);
      }
    };

    void loadOrders();
  }, [currentUser?.id, currentUser?.store_type]);

  // Derive queued orders from orders with isQueued = true
  const queuedOrders: QueuedOrder[] = orders
    .filter(o => o.isQueued && o.table === 'Queue' && o.orderStatus !== 'Completed')
    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
    .map(o => ({
      id: o.id,
      orderNumber: o.orderNumber || o.id,
      customerName: o.customer,
      items: o.items.length,
      total: o.amountNumber,
      timestamp: new Date(`${o.date} ${o.time}`),
      queuePosition: o.queuePosition || 0,
      partySize: o.partySize,
      requiredSeats: o.requiredSeats || o.partySize,
    }));

  const addOrder = (order: Omit<Order, 'id'>) => {
    const id = String(nextId.current).padStart(6, '0');
    nextId.current += 1;
    setOrders(prev => [{ ...order, id }, ...prev]);
  };

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const voidOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, paymentStatus: 'Void' as const, orderStatus: 'Completed' as const }
        : o
    ));

    if (!currentUser?.id || !order.orderNumber) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/pos/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          paymentStatus: 'VOIDED',
          orderStatus: 'COMPLETED',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to void order.');
      }
    } catch (error) {
      setOrders(prev => prev.map(o => o.id === orderId ? order : o));
      throw error;
    }
  };

  const removeFromQueue = (id: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, isQueued: false, queuePosition: undefined } : o
    ));
  };

  const toDatabaseOrderStatus = (status: Order['orderStatus']) =>
    status === 'Preparing' ? 'PREPARING' :
    status === 'Ready' ? 'READY' :
    status === 'Served' ? 'SERVED' :
    status === 'Completed' ? 'COMPLETED' :
    'PENDING';

  const assignQueuedOrderToTable = async (id: string, table: string, orderStatus: Order['orderStatus']) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    setOrders(prev => prev.map(o =>
      o.id === id
        ? { ...o, table, isQueued: false, queuePosition: undefined, orderStatus }
        : o
    ));

    if (!currentUser?.id || !order.orderNumber) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/pos/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          tableName: table,
          orderStatus: toDatabaseOrderStatus(orderStatus),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to update table assignment.');
      }
    } catch (error) {
      setOrders(prev => prev.map(o => o.id === id ? order : o));
      throw error;
    }
  };

  const completePayment = async (orderId: string, paymentData: { cashReceived: number; changeGiven: number; cashier?: string; paymentId?: string; receiptId?: string }) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const paymentId = paymentData.paymentId ?? `PAY-${Date.now()}`;
    const receiptId = paymentData.receiptId ?? `REC-${Date.now()}`;

    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? {
            ...o,
            paymentStatus: 'Paid' as const,
            orderStatus: 'Completed' as const,
            cashReceived: paymentData.cashReceived,
            changeGiven: paymentData.changeGiven,
            cashier: paymentData.cashier,
            paymentId,
            receiptId,
          }
        : o
    ));

    if (currentUser?.id && order.orderNumber) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/admin/pos/orders/${encodeURIComponent(order.orderNumber)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
            orderStatus: 'COMPLETED',
            paymentStatus: 'PAID',
            payment: {
              paymentNumber: paymentId,
              method: 'Cash',
              amountPaid: paymentData.cashReceived,
              changeAmount: paymentData.changeGiven,
            },
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? 'Unable to complete payment.');
        }
      } catch (error) {
        setOrders(prev => prev.map(o => o.id === orderId ? order : o));
        throw error;
      }
    }

    setPaymentCompletedSignal(prev => prev + 1);
  };

  const completeTableOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, orderStatus: 'Completed' as const } : o
    ));

    if (!currentUser?.id || !order.orderNumber) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/admin/pos/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          orderStatus: 'COMPLETED',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Unable to release table.');
      }
    } catch (error) {
      setOrders(prev => prev.map(o => o.id === orderId ? order : o));
      throw error;
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      queuedOrders,
      addOrder,
      updateOrder,
      removeOrder,
      removeFromQueue,
      assignQueuedOrderToTable,
      completePayment,
      completeTableOrder,
      voidOrder,
      paymentCompletedSignal,
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used within OrderProvider');
  return ctx;
}

function mapDatabaseRestaurantOrder(row: any): Order {
  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const items = Array.isArray(row.items) ? row.items : [];
  const tableName = row.table_name ? String(row.table_name) : '-';
  const queueMatch = tableName.match(/^Queue(?:\s*#?(\d+))?/i);
  const tableNumbers = tableName
    .match(/Table\s+\d+/gi)
    ?.map((label) => Number(label.match(/\d+/)?.[0]))
    .filter((value) => Number.isFinite(value));
  const partySize = Number(row.party_size ?? row.partySize ?? row.required_seats ?? 0);
  const paymentStatus: Order['paymentStatus'] =
    row.payment_status === 'VOIDED' || row.payment_status === 'VOID' ? 'Void' :
    row.payment_status === 'PAID' ? 'Paid' :
    'Not Paid';
  const orderStatus: Order['orderStatus'] =
    row.order_status === 'PREPARING' ? 'Preparing' :
    row.order_status === 'READY' ? 'Ready' :
    row.order_status === 'SERVED' ? 'Served' :
    row.order_status === 'COMPLETED' ? 'Completed' :
    'Pending';
  const isQueued = Boolean(queueMatch) && orderStatus !== 'Completed';
  const type: Order['type'] =
    row.order_type === 'DINE_IN' ? 'Dine-In' :
    row.order_type === 'MIXED' ? 'Mixed' :
    'Takeout';

  return {
    id: String(row.id).padStart(6, '0'),
    orderNumber: row.order_number ?? String(row.id).padStart(6, '0'),
    customer: row.customer_name || 'Walk-in Customer',
    type,
    table: isQueued ? 'Queue' : tableName,
    amountNumber: Number(row.total_amount ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    serviceFee: Number(row.service_charge ?? 0),
    tax: Number(row.tax_amount ?? 0),
    discount: Number(row.discount_amount ?? 0),
    discountType: row.discount_type ?? undefined,
    paymentStatus,
    orderStatus,
    date: getLocalDateKey(createdAt),
    time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    items: items.map((item: any) => ({
      name: item.product_name,
      quantity: Number(item.quantity ?? 0),
      price: Number(item.unit_price ?? 0),
      lineTotal: Number(item.line_total ?? (Number(item.unit_price ?? 0) * Number(item.quantity ?? 0))),
      image: item.image_url ?? item.image ?? undefined,
      itemType: item.item_type === 'dine-in' || item.item_type === 'DINE_IN' ? 'dine-in' : 'takeout',
      notes: item.notes ?? undefined,
      ingredients: item.ingredients ?? undefined,
    })),
    paymentId: row.payment_number ?? undefined,
    receiptId: row.receipt_id ?? row.payment_number ?? (row.order_number ? `REC-${row.order_number}` : undefined),
    cashReceived: row.amount_paid !== null && row.amount_paid !== undefined ? Number(row.amount_paid) : undefined,
    changeGiven: row.change_amount !== null && row.change_amount !== undefined ? Number(row.change_amount) : undefined,
    cashier: row.cashier_name ?? undefined,
    isQueued,
    queuePosition: isQueued && queueMatch?.[1] ? Number(queueMatch[1]) : undefined,
    partySize: partySize > 0 ? partySize : undefined,
    requiredSeats: partySize > 0 ? partySize : undefined,
    tableNumbers,
  };
}
