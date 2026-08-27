"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '/Users/deepakchand/workspaces/country_dairy/.env' });
const cashfree_service_1 = require("./src/orders/cashfree.service");
(async () => {
    const cf = new cashfree_service_1.CashfreeService();
    console.log('configured:', cf.isConfigured);
    const orderId = `svc-probe-${Date.now()}`;
    const order = await cf.createOrder({
        orderId,
        amount: 1450,
        customerId: 'probe001',
        customerPhone: '9999999999',
        returnUrl: 'https://example.com/return?order_id={order_id}',
        cartItems: [{
                item_id: 'cd-ghee-1l',
                item_name: 'A2 Desi Ghee, 1 Litre',
                item_original_unit_price: 1650,
                item_discounted_unit_price: 1450,
                item_quantity: 1,
                item_currency: 'INR',
            }],
        collectAddress: true,
    });
    console.log('createOrder  ->', order.order_status, '| cf id', order.cf_order_id, '| session', order.payment_session_id.slice(0, 14) + '…');
    const fetched = await cf.getOrder(orderId);
    console.log('getOrder     ->', fetched.order_status, '| amount', fetched.order_amount);
    const ext = await cf.getOrderExtended(orderId);
    console.log('getExtended  -> keys:', Object.keys(ext).sort().join(', '));
    console.log('               shipping_address:', JSON.stringify(ext.shipping_address));
    const secret = process.env.CASHFREE_CLIENT_SECRET;
    const ts = '1700000000';
    const body = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
    const crypto = require('crypto');
    const good = crypto.createHmac('sha256', secret).update(ts + body).digest('base64');
    console.log('verify good  ->', cf.verifyWebhookSignature(body, good, ts));
    console.log('verify bad   ->', cf.verifyWebhookSignature(body + ' ', good, ts));
    console.log('verify empty ->', cf.verifyWebhookSignature(body, '', ts));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
//# sourceMappingURL=cf-probe.js.map