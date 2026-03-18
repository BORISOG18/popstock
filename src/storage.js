const KEYS = { BULK_IDS: 'popstock_bulk_ids', ORDERS: 'popstock_orders' };

export const loadBulkIds = () => { try { const d = localStorage.getItem(KEYS.BULK_IDS); return d ? JSON.parse(d) : []; } catch { return []; } };
export const saveBulkIds = (data) => localStorage.setItem(KEYS.BULK_IDS, JSON.stringify(data));
export const loadOrders = () => { try { const d = localStorage.getItem(KEYS.ORDERS); return d ? JSON.parse(d) : []; } catch { return []; } };
export const saveOrders = (data) => localStorage.setItem(KEYS.ORDERS, JSON.stringify(data));
export const clearAllData = () => { localStorage.removeItem(KEYS.BULK_IDS); localStorage.removeItem(KEYS.ORDERS); };
