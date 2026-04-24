// Maps category → transaction type.
// Anything not listed here is 'expense' (real spending).
const CATEGORY_TYPE = {
  'Transferencias': 'transfer',
  'Pago TC':        'credit_payment',
  'Ingresos':       'income',
}

// Exported so callers can reclassify after applying learned rules
function typeForCategory(category, amount) {
  if (amount !== undefined && amount < 0) return 'income'
  return CATEGORY_TYPE[category] || 'expense'
}

const RULES = [
  { category: 'Comida', keywords: [
    // Delivery apps
    'UBER EATS', 'UBEREATS', 'RAPPI', 'DIDI FOOD', 'DIDIFOOD', 'DLO*DIDI FOOD', 'D LOCAL*DIDI FOOD', 'D LOCAL*REST', 'DLO*DIDI FOODS', 'D LOCAL*DIDI FOODS',
    // Fast food / chains
    'TACO', 'TACOS', 'STARBUCKS', 'DOMINOS', 'DOMINO', 'SUBWAY', 'MCDONALDS', 'KFC', 'BURGER', 'PIZZA', 'SUSHI', 'BAGUETTE', 'SANDWICH',
    // Generic food words
    'RESTAURANTE', 'CAFETERIA', 'COMIDA', 'COCINA', 'ANTOJITOS', 'MARISCOS', 'CARNITAS', 'BARBACOA', 'BIRRIA', 'BUFFET', 'CAFE', 'PANADERIA', 'PASTELERIA', 'HELADERIA',
    'REST ', 'FONDA', 'FONDITA', 'TAQUERIA', 'POZOLERIA', 'LONCHERIA', 'GORDITAS', 'ENCHILADAS', 'TAMALES', 'RAMEN', 'DELI ',
    // Specific merchants (Monterrey / CDMX)
    'PROTEIN FOOD', 'COM RAP', 'CASA DAZA', 'LA ESTANZUELA', 'EL URO', 'FERR PAYUL',
    // Convenience food
    'TORTA', 'TOSTADA', 'QUESADILLA', 'SOPE',
  ]},
  { category: 'Transporte', keywords: [
    // Ride-hailing (Didi variations)
    'UBER', 'DLO*DIDI RIDES', 'D LOCAL*DIDI RIDES', 'DIDI RIDES', 'DIDI', 'CABIFY', 'BEAT ',
    // Fuel
    'GASOLINERA', 'PEMEX', 'SHELL', 'MOBIL', 'BP ', 'COMBUSTIBLE', 'G500', 'GAS EXPRESS', 'GAS LAS TORRES', 'GASOLINERAS', 'MULTISERVICIO',
    // Parking / tolls
    'ESTACIONAMIENTO', 'PARKING', 'CASETA', 'TOLL', 'VALET',
    // Transit
    'METRO CDMX', 'AUTOBUS', 'ADO', 'ETN', 'PRIMERA PLUS',
  ]},
  { category: 'Supermercado', keywords: [
    // Supermarkets
    'WALMART', 'WAL-MART', 'SORIANA', 'CHEDRAUI', 'HEB ', 'H-E-B', 'COSTCO', 'LA COMER', 'SUPERAMA', 'BODEGA AURRERA', 'SAMS CLUB', "SAM'S", 'MEGA', 'COMERCIAL MEXICANA', 'CITY MARKET', 'FRESKO',
    // Convenience
    'OXXO', 'SEVEN ELEVEN', '7 ELEVEN', '7ELEVEN', 'CIRCLE K', 'EXTRA ', 'KIOSKO',
    // Markets / misc grocery
    'MERCED', 'ABARROTES', 'TIENDA ', 'MINISUPER',
    // Pharmacy chains (convenience-style)
    'FARMACIA DEL AHORRO', 'FARMACIAS DEL AHORRO', 'F AHORRO',
  ]},
  { category: 'Hogar', keywords: [
    'FERRETERIA', 'FERR ', 'HOME DEPOT', 'HOMEDEPOT', 'TRUPER', 'ACE HARDWARE', 'SODIMAC', 'BAUHAUS',
    'MUEBLES', 'MUEBLERIA', 'IKEA', 'FAMSA', 'ELEKTRA', 'COPPEL',
    'TLAPALERIA', 'PLOMERO', 'ELECTRICISTA',
    'RENTA ', 'RENTA:', 'DEPARTAMENTO', 'MANTENIMIENTO', 'CONDOMINIO',
  ]},
  { category: 'Salud', keywords: [
    'FARMACIA', 'FARM FA', 'HOSPITAL', 'DOCTOR', 'LABORATORIO', 'LABORATORIOS',
    'SIMILARES', 'BENAVIDES', 'CRUZ VERDE', 'CLINICA', 'MEDICO', 'OPTICA', 'DENTAL', 'DENTISTA', 'VETERINARIA',
    'GIMNASIO', 'GYM', 'SMART FIT', 'SPORT CITY', 'GYMPASS', 'YZA', 'CRUNCH', 'ANYTIME FITNESS',
    'PSICOLOG', 'NUTRICION', 'FISIOTERAPIA',
  ]},
  { category: 'Entretenimiento', keywords: [
    'NETFLIX', 'SPOTIFY', 'DISNEY', 'HBO', 'CINEPOLIS', 'CINEMEX',
    'STEAM', 'XBOX', 'PLAYSTATION', 'NINTENDO', 'APPLE MUSIC', 'YOUTUBE', 'AMAZON PRIME', 'PARAMOUNT',
    'CRUNCHYROLL', 'TICKETMASTER', 'BOLETIA', 'TEATRO', 'MUSEO',
    'GOOGLE ONE', 'GOOGLE PLAY', 'APPLE TV', 'APPLE ONE', 'MUBI', 'BLIM', 'CLARO VIDEO',
    'ESPN ', 'DAZN', 'TWITCH', 'PRIME VIDEO',
    'VIDEOJUEGO', 'ARCADE', 'BOLICHE', 'CINE ',
  ]},
  { category: 'Servicios', keywords: [
    // Utilities
    'CFE', 'TELMEX', 'IZZI', 'TOTALPLAY', 'TELCEL', 'AT&T', 'ATT', 'MOVISTAR',
    'AGUA ', 'GAS NATURAL', 'FENOSA', 'CALIDRA', 'INTERNET', 'AXTEL', 'MEGACABLE', 'DISH', 'SKY ',
    // Insurance / subscriptions
    'SEGURO ', 'SEGUROS', 'SUSCRIPCION', 'MENSUALIDAD',
    // Tech subscriptions
    'MICROSOFT', 'OFFICE 365', 'ICLOUD', 'DROPBOX', 'ADOBE', 'CHATGPT', 'OPENAI',
    // Bank fees (when not transfers)
    'COMISION BANCARIA', 'ANUALIDAD',
  ]},
  { category: 'Ropa', keywords: [
    'ZARA', 'H&M', 'SHEIN', 'LIVERPOOL', 'PALACIO DE HIERRO', 'SUBURBIA', 'C&A', 'FOREVER 21',
    'PULL AND BEAR', 'BERSHKA', 'STRADIVARIUS', 'MASSIMO DUTTI',
    'NIKE', 'ADIDAS', 'PUMA', 'ALDO', 'BATA', 'FLEXI', 'ANDREA',
    'ROPA ', 'MODA ', 'BOUTIQUE',
  ]},
  { category: 'Viajes', keywords: [
    'AIRBNB', 'BOOKING', 'HOTEL', 'HOSTAL',
    'AEROMEXICO', 'AEROMÉXICO', 'VOLARIS', 'VIVAAEROBUS', 'VIVA AEROBUS', 'INTERJET', 'AEROMAR',
    'EXPEDIA', 'TRIVAGO', 'DESPEGAR', 'TRIP.COM', 'HILTON', 'MARRIOTT', 'HYATT', 'CAMINO REAL',
    'RENTA DE AUTO', 'HERTZ', 'AVIS ', 'EUROPCAR', 'NATIONAL CAR',
  ]},
  { category: 'Educacion', keywords: [
    'UDEMY', 'COURSERA', 'COLEGIO', 'UNIVERSIDAD', 'INSCRIPCION', 'INSCRIPCIÓN', 'COLEGIATURA',
    'ESCUELA', 'UNAM', 'TALLER', 'CURSO ', 'CAPACITACION', 'LINKEDIN LEARNING', 'PLURALSIGHT', 'CODECADEMY',
    'LIBROS', 'LIBRERIA', 'PAPELERIA',
  ]},
  // SPEI / bank transfers / ATM withdrawals
  {
    category: 'Transferencias',
    keywords: ['SPEI', 'TRANSFERENCIA', 'ENVIO DE DINERO', 'ENVÍO DE DINERO', 'PAGO CUENTA DE TERCERO', 'RETIRO SIN TARJETA', 'RETIRO ATM', 'DISPOSICION'],
  },
  // Credit card payments — excluded from expense totals (internal transfer, not real spending)
  {
    category: 'Pago TC',
    keywords: [
      'AMERICAN EXPRESS', 'PAGO TDC', 'PAGO TARJETA', 'PAGO TC ',
      'PAGO BANAMEX', 'PAGO BANCOMER', 'PAGO CITIBANAMEX',
      'PAGO SANTANDER', 'PAGO HSBC', 'PAGO BANORTE', 'PAGO INBURSA',
      'AMEX',
    ],
  },
  {
    category: 'Alcohol',
    keywords: [
      // Beverages
      'CERVEZA', 'CAGUAMA', 'CHELA', 'VINO', 'TEQUILA', 'MEZCAL', 'WHISKY', 'WHISKEY',
      'LICOR', 'LICORES', 'RON ', 'VODKA', 'GINEBRA', 'CHAMPAÑA', 'CHAMPAGNE',
      'MICHELADA', 'CATA DE VINO', 'VINOS Y LICORES',
      // Beer brands
      'HEINEKEN', 'CORONA ', 'MODELO', 'TECATE', 'PACIFICO', 'PACÍFICO',
      'INDIO ', 'XX LAGER', 'VICTORIA ', 'COORS', 'BUDWEISER',
      // Stores
      'LA EUROPEA', 'TOTAL WINE',
      // Bar/nightlife venues
      // "BAR " catches "BAR 27", "BAR CANTINA" | " BAR" catches "SPORTS BAR" (ends with BAR)
      'BAR ', ' BAR', 'CANTINA', 'PULQUERIA', 'PULQUERÍA', 'BOTANERO',
      'PUB ', ' PUB', 'LOUNGE', 'ANTRO', 'DISCOTECA', 'NIGHT CLUB', 'NIGHTCLUB',
      'BEER', 'CERVECERIA', 'TABERNA', 'ROCKBAR', 'SPORTS BAR',
      'TEQUILERIA', 'MEZCALERIA', 'VINATERIA', 'LICORERA',
      // Specific venues (Monterrey, CDMX and common)
      'SALA DE DESPACHO', 'SALA DE DESPECHO', 'HOUSE OF WOLF', 'FLOCK', 'HANKY PANKY', 'FIFTY MALONE',
      'ROOFCHAPULTEPEC', 'ROOF CHAPULTEPEC', 'PAULY', 'HOOKAH', 'CENOTE',
    ],
  },
]

function categorize(description, amount) {
  if (amount !== undefined && amount < 0) {
    return { category: 'Ingresos', type: 'income' }
  }
  if (!description) {
    return { category: 'Otros', type: 'expense' }
  }
  const upper = description.toUpperCase()
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (upper.includes(kw)) {
        return { category: rule.category, type: CATEGORY_TYPE[rule.category] || 'expense' }
      }
    }
  }
  return { category: 'Otros', type: 'expense' }
}

module.exports = { categorize, typeForCategory }
