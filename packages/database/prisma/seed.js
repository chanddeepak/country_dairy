const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.productReview.deleteMany();
  await prisma.labReport.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscriptionDelivery.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  console.log('Seeding categories...');
  
  const dairyCategory = await prisma.category.create({
    data: {
      name: 'Dairy Products',
      slug: 'dairy-products',
      description: 'Fresh A2 cow milk, ghee, paneer, and curd.',
    },
  });

  const oilsCategory = await prisma.category.create({
    data: {
      name: 'Cold-Pressed Oils',
      slug: 'cold-pressed-oils',
      description: 'Wood-pressed pure organic oils.',
    },
  });

  const honeyCategory = await prisma.category.create({
    data: {
      name: 'Organic Honey',
      slug: 'organic-honey',
      description: 'Raw forest honey collected sustainably.',
    },
  });

  console.log('Seeding products...');

  const milk = await prisma.product.create({
    data: {
      name: 'Country Dairy A2 Cow Milk',
      slug: 'country-dairy-a2-cow-milk-1l',
      description: 'Pure A2 milk sourced from happy grass-fed cows. High fat, rich in A2 beta-casein.',
      price: 95.00,
      stock: 500,
      imageUrls: ['https://country-dairy-assets.s3.ap-south-1.amazonaws.com/products/milk-bottle.jpg'],
      videoUrls: [],
      isSubscriptionAllowed: true,
      categoryId: dairyCategory.id,
      nutritionFacts: {
        fat: '4.2%',
        protein: '3.3g',
        calcium: '120mg',
        energy: '64 kcal'
      },
      metadata: {
        shelfLife: '2 days',
        packaging: 'Glass Bottle',
        volume: '1 Litre'
      }
    },
  });

  const ghee = await prisma.product.create({
    data: {
      name: 'Country Dairy A2 Vedic Ghee',
      slug: 'country-dairy-a2-vedic-ghee-1l',
      description: 'Every Spoon Carries the Soul of Devbhoomi.',
      price: 1450.00,
      stock: 150,
      imageUrls: ['https://country-dairy-assets.s3.ap-south-1.amazonaws.com/products/ghee-jar.jpg'],
      videoUrls: ['https://country-dairy-assets.s3.ap-south-1.amazonaws.com/products/bilona-ghee-churn.mp4'],
      isSubscriptionAllowed: false,
      categoryId: dairyCategory.id,
      nutritionFacts: {
        fat: '99.8g',
        cholesterol: '256mg',
        energy: '897 kcal'
      },
      metadata: {
        shelfLife: '12 months',
        packaging: 'Glass Jar',
        volume: '1 Litre'
      }
    },
  });



  const honey = await prisma.product.create({
    data: {
      name: 'Raw Wild Forest Honey',
      slug: 'raw-wild-forest-honey-500g',
      description: 'Unprocessed, unpasteurized honey collected by native tribes from deep forest hives.',
      price: 450.00,
      stock: 100,
      imageUrls: ['https://country-dairy-assets.s3.ap-south-1.amazonaws.com/products/wild-honey.jpg'],
      videoUrls: [],
      isSubscriptionAllowed: false,
      categoryId: honeyCategory.id,
      nutritionFacts: {
        carbohydrates: '82.4g',
        sugar: '82.1g',
        energy: '304 kcal'
      },
      metadata: {
        shelfLife: '18 months',
        packaging: 'Glass Jar',
        weight: '500g'
      }
    },
  });

  console.log('Seeding lab reports...');
  
  await prisma.labReport.create({
    data: {
      productId: milk.id,
      batchNumber: 'CD-MILK-B0912',
      testDate: new Date('2026-07-04'),
      fileUrl: 'https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reports/milk-report-B0912.pdf',
      parameters: {
        fat: '4.35%',
        snf: '8.65%',
        purity: '100% Certified',
        adulteration: 'Not Detected',
        antibiotics: 'Not Detected'
      }
    }
  });

  await prisma.labReport.create({
    data: {
      productId: ghee.id,
      batchNumber: 'CD-GHEE-B0442',
      testDate: new Date('2026-06-25'),
      fileUrl: 'https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reports/ghee-report-B0442.pdf',
      parameters: {
        moisture: '0.12%',
        freeFattyAcid: '0.24%',
        adulteration: 'Negative',
        bilonaVerified: 'Yes'
      }
    }
  });

  console.log('Seeding initial customers...');
  
  const customer = await prisma.user.create({
    data: {
      name: 'Amit Sharma',
      phone: '+919876543210',
      email: 'amit.sharma@example.com',
      role: 'CUSTOMER',
      walletBalance: 1500.00
    }
  });

  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      street: 'Flat 402, Oakwood Apartments, Sector 56',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122011',
      country: 'India',
      isDefault: true,
      latitude: 28.4595,
      longitude: 77.0266
    }
  });

  console.log('Seeding initial reviews...');
  
  await prisma.productReview.create({
    data: {
      userId: customer.id,
      productId: milk.id,
      rating: 5,
      title: 'Amazing Freshness',
      comment: 'The milk is super rich and thick. Delivery runner comes on time before 7 AM every day.',
      mediaUrls: ['https://country-dairy-assets.s3.ap-south-1.amazonaws.com/reviews/user-milk-review.jpg']
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
