const RULES = [
  { category: 'Comida', keywords: ['UBER EATS', 'UBEREATS', 'RAPPI', 'DIDI FOOD', 'DIDIFOOD', 'TACO', 'TACOS', 'RESTAURANTE', 'CAFETERIA', 'STARBUCKS', 'DOMINOS', 'DOMINO', 'SUBWAY', 'MCDONALDS', 'KFC', 'BURGER', 'PIZZA', 'SUSHI', 'TORTA', 'COMIDA', 'COCINA', 'ANTOJITOS', 'MARISCOS', 'CARNITAS', 'BARBACOA', 'BIRRIA', 'BUFFET', 'CAFE', 'PANADERIA', 'PASTELERIA', 'HELADERIA', 'REST ', 'FONDA', 'FONDITA', 'TAQUERIA', 'POZOLERIA', 'LONCHERIA', 'GORDITAS', 'ENCHILADAS', 'TAMALES', 'RAMEN', 'BAGUETTE', 'SANDWICH', 'DELI ', 'LA ESTANZUELA', 'EL URO'] },
  { category: 'Transporte', keywords: ['UBER', 'DIDI', 'CABIFY', 'GASOLINERA', 'PEMEX', 'SHELL', 'MOBIL', 'BP ', 'ESTACIONAMIENTO', 'PARKING', 'METRO CDMX', 'AUTOBUS', 'ADO', 'ETN', 'PRIMERA PLUS', 'CASETA', 'TOLL', 'VALET', 'GAS LAS TORRES', 'COMBUSTIBLE', 'G500', 'GAS EXPRESS', 'GASOLINERAS', 'MULTISERVICIO'] },
  { category: 'Supermercado', keywords: ['WALMART', 'WAL-MART', 'SORIANA', 'CHEDRAUI', 'HEB ', 'H-E-B', 'COSTCO', 'LA COMER', 'SUPERAMA', 'BODEGA AURRERA', 'SAMS CLUB', 'SAM\'S', 'MEGA', 'COMERCIAL MEXICANA', 'CITY MARKET', 'FRESKO', 'MERCED', 'ABARROTES', 'OXXO', 'SEVEN ELEVEN', '7 ELEVEN', '7ELEVEN', 'CIRCLE K', 'EXTRA ', 'KIOSKO', 'FARMACIA DEL AHORRO', 'FARMACIAS DEL AHORRO', 'F AHORRO'] },
  { category: 'Salud', keywords: ['FARMACIA', 'FARM FA', 'HOSPITAL', 'DOCTOR', 'LABORATORIO', 'LABORATORIOS', 'SIMILARES', 'BENAVIDES', 'CRUZ VERDE', 'CLINICA', 'MEDICO', 'OPTICA', 'DENTAL', 'DENTISTA', 'VETERINARIA', 'GIMNASIO', 'GYM', 'SMART FIT', 'SPORT CITY', 'GYMPASS', 'YZA', 'CRUNCH'] },
  { category: 'Entretenimiento', keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'HBO', 'CINEPOLIS', 'CINEMEX', 'STEAM', 'XBOX', 'PLAYSTATION', 'APPLE MUSIC', 'YOUTUBE', 'AMAZON PRIME', 'PARAMOUNT', 'CRUNCHYROLL', 'TICKETMASTER', 'BOLETIA', 'TEATRO', 'MUSEO', 'GOOGLE ONE', 'GOOGLE PLAY', 'APPLE TV', 'APPLE ONE', 'MUBI', 'BLIM', 'CLARO VIDEO', 'ESPN ', 'DAZN', 'TWITCH'] },
  { category: 'Servicios', keywords: ['CFE', 'TELMEX', 'IZZI', 'TOTALPLAY', 'TELCEL', 'AT&T', 'ATT', 'MOVISTAR', 'AGUA', 'GAS NATURAL', 'FENOSA', 'CALIDRA', 'INTERNET', 'AXTEL', 'MEGACABLE', 'DISH', 'SKY ', 'SEGURO', 'SEGUROS', 'BANAMEX', 'HSBC', 'SANTANDER'] },
  { category: 'Ropa', keywords: ['ZARA', 'H&M', 'SHEIN', 'LIVERPOOL', 'PALACIO DE HIERRO', 'SUBURBIA', 'C&A', 'FOREVER 21', 'PULL AND BEAR', 'BERSHKA', 'STRADIVARIUS', 'MASSIMO DUTTI', 'NIKE', 'ADIDAS', 'PUMA', 'ALDO', 'BATA', 'FLEXI', 'ANDREA'] },
  { category: 'Viajes', keywords: ['AIRBNB', 'BOOKING', 'HOTEL', 'AEROMEXICO', 'AEROMÉXICO', 'VOLARIS', 'VIVAAEROBUS', 'VIVA AEROBUS', 'INTERJET', 'AEROMAR', 'EXPEDIA', 'TRIVAGO', 'DESPEGAR', 'TRIP.COM', 'HILTON', 'MARRIOTT', 'HYATT', 'CAMINO REAL'] },
  { category: 'Educacion', keywords: ['UDEMY', 'COURSERA', 'COLEGIO', 'UNIVERSIDAD', 'INSCRIPCION', 'INSCRIPCIÓN', 'COLEGIATURA', 'ESCUELA', 'UNAM', 'TALLER', 'CURSO', 'CAPACITACION', 'LINKEDIN LEARNING', 'PLURALSIGHT', 'CODECADEMY'] },
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
  if (amount !== undefined && amount < 0) return 'Ingresos'
  if (!description) return 'Otros'
  const upper = description.toUpperCase()
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (upper.includes(kw)) return rule.category
    }
  }
  return 'Otros'
}

module.exports = { categorize }
