import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = readFileSync(join(__dirname, '..', 'menu-data.js'), 'utf8');
const transformed = src
  .replace(/^const MENU_DATA = /m, 'globalThis.__MENU_DATA__ = ')
  .replace(/^window\.MENU_DATA = MENU_DATA;\s*$/m, '')
  .replace(/^export \{ MENU_DATA \};\s*$/m, '')
  .replace(/^export default MENU_DATA;\s*$/m, '');

const tmpPath = join(__dirname, '__menu-data-tmp.mjs');
writeFileSync(tmpPath, transformed);
const mod = await import(tmpPath);
const MENU_DATA = globalThis.__MENU_DATA__;

const SITE_URL = 'https://israeltiburcio-ai.github.io/Cocina-la-abundancia---Men-/';
const PHONE = '+52-55-7334-2834';
const FB_URL = 'https://www.facebook.com/groups/605911083537750';
const MAPS_URL = 'https://maps.app.goo.gl/yn5CUeJiMqTZsL9v9';

const restaurant = {
  '@type': 'Restaurant',
  '@id': `${SITE_URL}#restaurant`,
  name: 'Cocina La Abundancia',
  description:
    'Comida mexicana casera en zona de entrega local. Desayunos, menú a la carta, pozole, antojitos, bebidas y postres. Pedidos por WhatsApp con envío a domicilio.',
  url: SITE_URL,
  image: `${SITE_URL}Portada.png`,
  logo: `${SITE_URL}Portada.png`,
  telephone: PHONE,
  priceRange: '$$',
  servesCuisine: ['Mexican', 'Mexicana', 'Comida casera mexicana'],
  currenciesAccepted: 'MXN',
  paymentAccepted: 'Efectivo, Transferencia',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Zona de entrega local',
    addressLocality: 'Toluca',
    addressRegion: 'Estado de México',
    addressCountry: 'MX',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: MENU_DATA.businessLocation.lat,
    longitude: MENU_DATA.businessLocation.lng,
  },
  hasMap: MAPS_URL,
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '17:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Friday', 'Saturday'],
      opens: '10:00',
      closes: '22:30',
    },
  ],
  potentialAction: {
    '@type': 'OrderAction',
    target: `https://wa.me/525573342834?text=${encodeURIComponent('Hola, buen día. Me gustaría hacer un pedido.')}`,
    name: 'Realizar pedido por WhatsApp',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: PHONE,
    contactType: 'customer service',
    availableLanguage: ['Spanish'],
  },
  sameAs: [FB_URL],
  menu: `${SITE_URL}#carta`,
  acceptsReservations: 'False',
};

const categoryOrder = new Map(MENU_DATA.categories.map((c) => [c.id, c.order]));

const sections = MENU_DATA.categories
  .slice()
  .sort((a, b) => (categoryOrder.get(a.id) || 0) - (categoryOrder.get(b.id) || 0))
  .map((category) => {
    const items = MENU_DATA.products
      .filter((p) => p.categoryId === category.id)
      .map((product) => {
        const item = {
          '@type': 'MenuItem',
          name: product.name,
        };
        if (product.description) item.description = product.description;
        item.offers = {
          '@type': 'Offer',
          price: String(product.basePrice),
          priceCurrency: 'MXN',
        };
        return item;
      });

    return {
      '@type': 'MenuSection',
      name: category.name,
      hasMenuItem: items,
    };
  });

const menu = {
  '@type': 'Menu',
  '@id': `${SITE_URL}#menu`,
  name: 'Menú principal',
  inLanguage: 'es-MX',
  hasMenuSection: sections,
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  url: SITE_URL,
  name: 'Cocina La Abundancia',
  inLanguage: 'es-MX',
  publisher: { '@id': `${SITE_URL}#restaurant` },
};

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}#org`,
  name: 'Cocina La Abundancia',
  url: SITE_URL,
  logo: `${SITE_URL}Portada.png`,
  sameAs: [FB_URL],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: PHONE,
    contactType: 'customer service',
    areaServed: 'MX',
    availableLanguage: 'Spanish',
  },
};

const graph = [website, organization, restaurant, menu];

const output = {
  '@context': 'https://schema.org',
  '@graph': graph,
};

console.log(JSON.stringify(output, null, 2));
