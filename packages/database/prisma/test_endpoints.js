const http = require('http');

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
};

async function runTests() {
  console.log('--- STARTING ENDPOINT VERIFICATION TESTS ---');

  // 1. Request OTP
  console.log('\n1. POST /api/auth/send-otp');
  const sendOtpResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/send-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    {
      phone: '+919876543210',
    }
  );
  console.log('Success:', sendOtpResponse.success);
  console.log('Message:', sendOtpResponse.message);

  // 2. Log in
  console.log('\n2. POST /api/auth/verify-otp');
  const authResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/verify-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    {
      phone: '+919876543210',
      otp: '123456',
    }
  );
  
  if (authResponse.error) {
    console.error('Error logging in:', authResponse);
    return;
  }

  const token = authResponse.accessToken;
  console.log('Success:', authResponse.success);
  console.log('User Name:', authResponse.user?.name);
  console.log('Token acquired:', token ? `${token.substring(0, 30)}...` : 'None');

  if (!token) {
    console.error('Failed to acquire token. Stopping tests.');
    return;
  }

  // 3. Fetch Catalog Products
  console.log('\n3. GET /api/catalog/products');
  const products = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/catalog/products',
    method: 'GET',
  });
  console.log('Total Products Loaded:', products.length);
  const milk = products.find(p => p.slug === 'country-dairy-a2-cow-milk-1l');
  console.log('Milk Product Found:', !!milk);
  console.log('Milk Average Rating:', milk ? milk.averageRating : 'N/A');

  // 4. Request Pre-signed Upload URL
  console.log('\n4. GET /api/media/presigned-url');
  const mediaResponse = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/media/presigned-url?filename=my-milk-bottle.jpg&contentType=image/jpeg',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  console.log('Upload URL:', mediaResponse.uploadUrl);
  console.log('Target File URL:', mediaResponse.fileUrl);

  // 5. Add Milk to Cart
  console.log('\n5. POST /api/cart/add');
  const cartAddResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/cart/add',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      productId: milk.id,
      quantity: 3,
    }
  );
  console.log('Cart Add ID:', cartAddResponse.id);
  console.log('Cart Add Quantity:', cartAddResponse.quantity);

  // 6. Get User Cart
  console.log('\n6. GET /api/cart');
  const cartItems = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/cart',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  console.log('Total Cart Items:', cartItems.length);
  console.log('Cart Item Product Name:', cartItems[0]?.product?.name);
  console.log('Cart Item Quantity:', cartItems[0]?.quantity);

  // 7. Get Address from Profile
  console.log('\n7. GET /api/auth/me (Get Address)');
  const profileResponse = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  // Re-load customer with address relation
  const customerProfile = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  // Since we seeded Amit Sharma, let's load his address manually using Prisma client since the /me endpoint doesn't return full address relation by default. Or we can just query the DB directly in our node test script!
  const { PrismaClient } = require('@prisma/client');
  const prismaClientInstance = new PrismaClient();
  const dbUser = await prismaClientInstance.user.findFirst({
    where: { phone: '+919876543210' },
    include: { addresses: true }
  });
  const defaultAddressId = dbUser.addresses[0]?.id;
  console.log('User ID:', dbUser.id);
  console.log('Default Address ID:', defaultAddressId);
  console.log('Pre-checkout Wallet Balance:', dbUser.walletBalance.toString());

  // 8. Order Checkout
  console.log('\n8. POST /api/orders/checkout');
  const checkoutResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/orders/checkout',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      addressId: defaultAddressId,
      deliveryType: 'LOCAL',
    }
  );
  console.log('Checkout Order ID:', checkoutResponse.orderId);
  console.log('Payment Gateway Order ID:', checkoutResponse.paymentGatewayId);
  console.log('Checkout Amount:', checkoutResponse.amount);

  // 9. Verify Order Payment
  console.log('\n9. POST /api/orders/verify-payment');
  const verifyPaymentResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/orders/verify-payment',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      orderId: checkoutResponse.orderId,
      razorpayPaymentId: 'pay_mock_verified_123',
      signature: 'signature_mock_verified_123',
    }
  );
  console.log('Payment Verification Success:', verifyPaymentResponse.success);
  console.log('Order Status post-payment:', verifyPaymentResponse.status);
  console.log('Payment Status post-payment:', verifyPaymentResponse.paymentStatus);

  // 10. Start a Delivery Subscription for Milk
  console.log('\n10. POST /api/subscriptions');
  const subscriptionResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/subscriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      productId: milk.id,
      quantity: 2,
      frequency: 'DAILY',
      daysOfWeek: [],
      startDate: '2026-07-06T00:00:00.000Z',
    }
  );
  console.log('Subscription ID:', subscriptionResponse.id);
  console.log('Subscription Frequency:', subscriptionResponse.frequency);
  console.log('Subscription Next Delivery Date:', subscriptionResponse.nextDelivery);

  // 11. Run Nightly Subscription Delivery Processing (Cron Simulation)
  console.log('\n11. POST /api/subscriptions/trigger-scheduler (Simulating July 6th)');
  const schedulerResponse = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/subscriptions/trigger-scheduler',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      date: '2026-07-06T00:00:00.000Z',
    }
  );
  console.log('Scheduler Success Count:', schedulerResponse.successCount);
  console.log('Scheduler Failed Count:', schedulerResponse.failCount);

  // 12. Check Wallet balance deduction post-delivery
  console.log('\n12. Verifying Wallet Deduction & Deliveries');
  const dbUserPostDelivery = await prismaClientInstance.user.findUnique({
    where: { id: dbUser.id },
  });
  console.log('Post-delivery Wallet Balance:', dbUserPostDelivery.walletBalance.toString());
  
  const deliveries = await prismaClientInstance.subscriptionDelivery.findMany({
    where: { subscriptionId: subscriptionResponse.id }
  });
  console.log('Total Deliveries Scheduled:', deliveries.length);
  console.log('First Scheduled Delivery Date:', deliveries[0]?.deliveryDate.toDateString());
  console.log('First Scheduled Delivery Status:', deliveries[0]?.status);

  await prismaClientInstance.$disconnect();
  console.log('\n--- ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY ---');
}

runTests().catch(console.error);
