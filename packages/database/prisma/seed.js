const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database records...');
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
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.heroBanner.deleteMany();
  await prisma.trustBadge.deleteMany();
  await prisma.featureFlag.deleteMany();

  console.log('Seeding categories...');
  const dairyCategory = await prisma.category.create({
    data: {
      name: 'Dairy',
      slug: 'dairy',
      description: 'Fresh A2 Cow Milk, Vedic Bilona Ghee, Cottage Cheese & Paneer',
      iconName: 'Milk',
      displayOrder: 1,
      isActive: true,
    },
  });

  const oilsCategory = await prisma.category.create({
    data: {
      name: 'Oils',
      slug: 'oils',
      description: 'Cold-pressed organic mustard oil & sesame cooking oils',
      iconName: 'Droplet',
      displayOrder: 2,
      isActive: true,
    },
  });

  const honeyCategory = await prisma.category.create({
    data: {
      name: 'Honey',
      slug: 'honey',
      description: 'Unprocessed wild forest raw honey',
      iconName: 'Sun',
      displayOrder: 3,
      isActive: true,
    },
  });

  console.log('Seeding products & multi-variant packaging...');

  const milk = await prisma.product.create({
    data: {
      title: 'Country Dairy A2 Cow Milk',
      slug: 'country-dairy-a2-cow-milk-1l',
      tagline: 'Farm fresh A2 milk from grass-fed cows',
      storyDescription: 'Pure A2 milk sourced from happy grass-fed Gir & Sahiwal cows. NABL lab-verified with zero adulterants.',
      status: 'LIVE',
      badgeText: '★ BESTSELLER',
      isSubscriptionAllowed: true,
      categoryId: dairyCategory.id,
      specifications: {
        'Net Quantity': '1L Bottle',
        'Packaging Type': 'Glass Bottle',
        'Serving Size': '100g / 100ml',
        'Shelf Life': '2 days',
        'Storage Instructions': 'Store in a cool, dry place away from direct sunlight. Keep container tightly sealed after use.',
      },
      nutritionFacts: {
        fat: '4.2%',
        protein: '3.3g',
        calcium: '120mg',
        energy: '64 kcal',
      },
      variants: {
        create: [
          {
            sku: 'CD-MILK-1L',
            sizeLabel: '1 Litre Bottle',
            sellingPrice: 95.00,
            mrpPrice: 110.00,
            stockQuantity: 200,
            packagingType: 'GLASS_JAR',
            isActive: true,
            displayOrder: 1,
          },
          {
            sku: 'CD-MILK-500ML',
            sizeLabel: '500ml Bottle',
            sellingPrice: 50.00,
            mrpPrice: 60.00,
            stockQuantity: 150,
            packagingType: 'GLASS_JAR',
            isActive: true,
            displayOrder: 2,
          },
        ],
      },
      galleryImages: {
        create: [
          { imageUrl: '/images/products/milk-bottle.png', isPrimary: true, displayOrder: 1 },
        ],
      },
    },
  });

  const ghee = await prisma.product.create({
    data: {
      title: 'Country Dairy A2 Vedic Ghee',
      slug: 'country-dairy-a2-vedic-ghee-1l',
      tagline: 'Traditional Bilona method A2 ghee',
      storyDescription: 'Premium A2 Ghee made using traditional Bilona churning method from A2 curd. Rich aroma and granular texture.',
      status: 'LIVE',
      badgeText: '👑 VEDIC BILONA',
      isSubscriptionAllowed: false,
      categoryId: dairyCategory.id,
      specifications: {
        'Net Quantity': '1L Jar',
        'Packaging Type': 'Glass Jar',
        'Serving Size': '10g',
        'Shelf Life': '12 Months',
        'Storage Instructions': 'Store in a cool dry place. Do not refrigerate.',
      },
      nutritionFacts: {
        fat: '99.8g',
        cholesterol: '256mg',
        energy: '897 kcal',
      },
      variants: {
        create: [
          {
            sku: 'CD-GHEE-1L',
            sizeLabel: '1 Litre Glass Jar',
            sellingPrice: 1450.00,
            mrpPrice: 1650.00,
            stockQuantity: 100,
            packagingType: 'GLASS_JAR',
            isActive: true,
            displayOrder: 1,
          },
          {
            sku: 'CD-GHEE-500ML',
            sizeLabel: '500ml Glass Jar',
            sellingPrice: 780.00,
            mrpPrice: 890.00,
            stockQuantity: 80,
            packagingType: 'GLASS_JAR',
            isActive: true,
            displayOrder: 2,
          },
        ],
      },
      galleryImages: {
        create: [
          { imageUrl: '/images/products/ghee-jar.png', isPrimary: true, displayOrder: 1 },
        ],
      },
    },
  });

  const mustardOil = await prisma.product.create({
    data: {
      title: 'Organic Wood-Pressed Mustard Oil',
      slug: 'organic-wood-pressed-mustard-oil-1l',
      tagline: 'Traditional kachi ghani cold pressed oil',
      storyDescription: 'Cold wood-pressed kachi ghani mustard oil, chemical-free and rich in natural nutrients.',
      status: 'LIVE',
      badgeText: '🌿 ORGANIC',
      isSubscriptionAllowed: false,
      categoryId: oilsCategory.id,
      specifications: {
        'Net Quantity': '1L Bottle',
        'Packaging Type': 'PET Bottle',
        'Serving Size': '15ml',
        'Shelf Life': '9 Months',
        'Storage Instructions': 'Store in a cool dry place away from sunlight.',
      },
      nutritionFacts: {
        fat: '100g',
        omega3: '11.6%',
        energy: '884 kcal',
      },
      variants: {
        create: [
          {
            sku: 'CD-OIL-1L',
            sizeLabel: '1 Litre Bottle',
            sellingPrice: 320.00,
            mrpPrice: 380.00,
            stockQuantity: 120,
            packagingType: 'PET_BOTTLE',
            isActive: true,
            displayOrder: 1,
          },
        ],
      },
      galleryImages: {
        create: [
          { imageUrl: '/images/products/mustard-oil.png', isPrimary: true, displayOrder: 1 },
        ],
      },
    },
  });
>>>>>>> 7d44958 (fix(web): add safe volumeOrWeight property access and variant normalization in ProductDetailPage)

  const honey = await prisma.product.create({
    data: {
      title: 'Raw Wild Forest Honey',
      slug: 'raw-wild-forest-honey-500g',
      tagline: 'Unpasteurized 100% natural forest honey',
      storyDescription: 'Unprocessed, unpasteurized honey collected by native tribes from deep forest hives.',
      status: 'LIVE',
      badgeText: '🍯 100% RAW',
      isSubscriptionAllowed: false,
      categoryId: honeyCategory.id,
      specifications: {
        'Net Quantity': '500g Jar',
        'Packaging Type': 'Glass Jar',
        'Serving Size': '20g',
        'Shelf Life': '18 Months',
        'Storage Instructions': 'Store at room temperature. Natural crystallization may occur.',
      },
      nutritionFacts: {
        carbohydrates: '82.4g',
        sugar: '82.1g',
        energy: '304 kcal',
      },
      variants: {
        create: [
          {
            sku: 'CD-HONEY-500G',
            sizeLabel: '500g Jar',
            sellingPrice: 450.00,
            mrpPrice: 520.00,
            stockQuantity: 90,
            packagingType: 'GLASS_JAR',
            isActive: true,
            displayOrder: 1,
          },
        ],
      },
      galleryImages: {
        create: [
          { imageUrl: '/images/products/wild-honey.png', isPrimary: true, displayOrder: 1 },
        ],
      },
    },
  });

  console.log('Seeding Hero Banners...');
  await prisma.heroBanner.createMany({
    data: [
      {
        title: 'Farm Fresh. Organic. Pure Happiness.',
        subtitle: 'Experience the finest A2 Milk & Organic Ghee, sourced directly from our happy cows.',
        imageUrl: '/images/hero-banner.png',
        ctaText: 'Shop All Products',
        ctaLink: '/products',
        badgeText: 'FARM FRESH',
        displayOrder: 1,
        isActive: true,
      },
      {
        title: 'Pure A2 Milk. From Happy Cows.',
        subtitle: 'Grass-fed, free-range Gir & Sahiwal cows. NABL lab-verified. Zero adulterants.',
        imageUrl: '/images/hero-banner-2-wide.png',
        ctaText: 'Shop All Products',
        ctaLink: '/products',
        badgeText: 'A2 MILK',
        displayOrder: 2,
        isActive: true,
      },
    ],
  });

  console.log('Seeding Trust Badges...');
  await prisma.trustBadge.createMany({
    data: [
      {
        title: 'Guaranteed 100% Pure',
        subtitle: 'Every batch tested & certified',
        iconName: 'ShieldCheck',
        displayOrder: 1,
        isActive: true,
      },
      {
        title: 'Express Morning Delivery',
        subtitle: 'Fresh at your doorstep by 7 AM',
        iconName: 'Truck',
        displayOrder: 2,
        isActive: true,
      },
      {
        title: 'No Added Preservatives',
        subtitle: 'Zero chemicals, zero processing',
        iconName: 'Sparkles',
        displayOrder: 3,
        isActive: true,
      },
    ],
  });

  console.log('Seeding Feature Flags...');
  await prisma.featureFlag.createMany({
    data: [
      { key: 'ENABLE_WEBSITE_PAYMENT', description: 'Direct online payment checkout', isEnabled: false },
      { key: 'ENABLE_PRODUCT_RATINGS', description: 'Product customer ratings & reviews', isEnabled: true },
      { key: 'ENABLE_SUBSCRIPTIONS', description: 'Daily subscription deliveries', isEnabled: true },
      { key: 'ENABLE_CART', description: 'Multi-item shopping cart', isEnabled: true },
      { key: 'ENABLE_USER_ACCOUNTS', description: 'User accounts and sign in', isEnabled: true },
    ],
  });

  console.log('Seeding initial customers...');
  const customer = await prisma.user.create({
    data: {
      name: 'Amit Sharma',
      phone: '+919876543210',
      email: 'amit.sharma@example.com',
      role: 'CUSTOMER',
      walletBalance: 1500.00,
    },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      street: 'Flat 402, Oakwood Apartments, Sector 56',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122011',
      country: 'India',
      isDefault: true,
    },
  });

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
