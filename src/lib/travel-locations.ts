export type AirportOption = { code: string; name: string; city: string; country: string }

export const AIRPORTS: AirportOption[] = [
  // ─── United States ───────────────────────────────────────────────────────────
  { code: 'JFK', name: 'John F. Kennedy Intl',          city: 'New York',        country: 'USA' },
  { code: 'LGA', name: 'LaGuardia Airport',             city: 'New York',        country: 'USA' },
  { code: 'EWR', name: 'Newark Liberty Intl',           city: 'Newark',          country: 'USA' },
  { code: 'LAX', name: 'Los Angeles Intl',              city: 'Los Angeles',     country: 'USA' },
  { code: 'ORD', name: "O'Hare International",          city: 'Chicago',         country: 'USA' },
  { code: 'MDW', name: 'Chicago Midway',                city: 'Chicago',         country: 'USA' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta',    city: 'Atlanta',         country: 'USA' },
  { code: 'DFW', name: 'Dallas/Fort Worth Intl',        city: 'Dallas',          country: 'USA' },
  { code: 'DAL', name: 'Dallas Love Field',             city: 'Dallas',          country: 'USA' },
  { code: 'MIA', name: 'Miami International',           city: 'Miami',           country: 'USA' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood',     city: 'Fort Lauderdale', country: 'USA' },
  { code: 'SFO', name: 'San Francisco Intl',            city: 'San Francisco',   country: 'USA' },
  { code: 'SJC', name: 'San Jose International',        city: 'San Jose',        country: 'USA' },
  { code: 'OAK', name: 'Oakland International',         city: 'Oakland',         country: 'USA' },
  { code: 'SEA', name: 'Seattle-Tacoma Intl',           city: 'Seattle',         country: 'USA' },
  { code: 'BOS', name: 'Boston Logan Intl',             city: 'Boston',          country: 'USA' },
  { code: 'DEN', name: 'Denver International',          city: 'Denver',          country: 'USA' },
  { code: 'LAS', name: 'Las Vegas Harry Reid Intl',     city: 'Las Vegas',       country: 'USA' },
  { code: 'IAD', name: 'Washington Dulles Intl',        city: 'Washington DC',   country: 'USA' },
  { code: 'DCA', name: 'Reagan National',               city: 'Washington DC',   country: 'USA' },
  { code: 'IAH', name: 'Houston George Bush Intl',      city: 'Houston',         country: 'USA' },
  { code: 'HOU', name: 'Houston Hobby',                 city: 'Houston',         country: 'USA' },
  { code: 'PHX', name: 'Phoenix Sky Harbor',            city: 'Phoenix',         country: 'USA' },
  { code: 'MSP', name: 'Minneapolis–St. Paul Intl',     city: 'Minneapolis',     country: 'USA' },
  { code: 'DTW', name: 'Detroit Metropolitan',          city: 'Detroit',         country: 'USA' },
  { code: 'PHL', name: 'Philadelphia International',    city: 'Philadelphia',    country: 'USA' },
  { code: 'CLT', name: 'Charlotte Douglas Intl',        city: 'Charlotte',       country: 'USA' },
  { code: 'PDX', name: 'Portland International',        city: 'Portland',        country: 'USA' },
  { code: 'SLC', name: 'Salt Lake City Intl',           city: 'Salt Lake City',  country: 'USA' },
  { code: 'AUS', name: 'Austin-Bergstrom Intl',         city: 'Austin',          country: 'USA' },
  { code: 'BNA', name: 'Nashville International',       city: 'Nashville',       country: 'USA' },
  { code: 'MCI', name: 'Kansas City International',     city: 'Kansas City',     country: 'USA' },
  { code: 'STL', name: 'St. Louis Lambert',             city: 'St. Louis',       country: 'USA' },
  { code: 'RDU', name: 'Raleigh-Durham Intl',           city: 'Raleigh',         country: 'USA' },
  { code: 'TPA', name: 'Tampa International',           city: 'Tampa',           country: 'USA' },
  { code: 'MCO', name: 'Orlando International',         city: 'Orlando',         country: 'USA' },
  { code: 'SAN', name: 'San Diego International',       city: 'San Diego',       country: 'USA' },
  { code: 'MSY', name: 'Louis Armstrong New Orleans',   city: 'New Orleans',     country: 'USA' },
  { code: 'BDL', name: 'Bradley International',         city: 'Hartford',        country: 'USA' },
  // ─── Canada ──────────────────────────────────────────────────────────────────
  { code: 'YYZ', name: 'Toronto Pearson Intl',          city: 'Toronto',         country: 'Canada' },
  { code: 'YVR', name: 'Vancouver International',       city: 'Vancouver',       country: 'Canada' },
  { code: 'YUL', name: 'Montreal-Trudeau',              city: 'Montreal',        country: 'Canada' },
  // ─── Mexico & Latin America ───────────────────────────────────────────────────
  { code: 'MEX', name: 'Mexico City International',     city: 'Mexico City',     country: 'Mexico' },
  { code: 'CUN', name: 'Cancún International',          city: 'Cancún',          country: 'Mexico' },
  { code: 'GRU', name: 'São Paulo Guarulhos',           city: 'São Paulo',       country: 'Brazil' },
  // ─── Europe ──────────────────────────────────────────────────────────────────
  { code: 'LHR', name: 'London Heathrow',               city: 'London',          country: 'UK' },
  { code: 'LGW', name: 'London Gatwick',                city: 'London',          country: 'UK' },
  { code: 'CDG', name: 'Paris Charles de Gaulle',       city: 'Paris',           country: 'France' },
  { code: 'AMS', name: 'Amsterdam Schiphol',            city: 'Amsterdam',       country: 'Netherlands' },
  { code: 'FRA', name: 'Frankfurt Airport',             city: 'Frankfurt',       country: 'Germany' },
  { code: 'MUC', name: 'Munich Airport',                city: 'Munich',          country: 'Germany' },
  { code: 'BER', name: 'Berlin Brandenburg',            city: 'Berlin',          country: 'Germany' },
  { code: 'ZRH', name: 'Zurich Airport',                city: 'Zurich',          country: 'Switzerland' },
  { code: 'FCO', name: 'Rome Fiumicino',                city: 'Rome',            country: 'Italy' },
  { code: 'BCN', name: 'Barcelona El Prat',             city: 'Barcelona',       country: 'Spain' },
  { code: 'MAD', name: 'Madrid Barajas',                city: 'Madrid',          country: 'Spain' },
  { code: 'ARN', name: 'Stockholm Arlanda',             city: 'Stockholm',       country: 'Sweden' },
  { code: 'CPH', name: 'Copenhagen Airport',            city: 'Copenhagen',      country: 'Denmark' },
  { code: 'OSL', name: 'Oslo Gardermoen',               city: 'Oslo',            country: 'Norway' },
  { code: 'HEL', name: 'Helsinki-Vantaa',               city: 'Helsinki',        country: 'Finland' },
  { code: 'VIE', name: 'Vienna International',          city: 'Vienna',          country: 'Austria' },
  { code: 'PRG', name: 'Prague Václav Havel',           city: 'Prague',          country: 'Czech Republic' },
  { code: 'WAW', name: 'Warsaw Chopin',                 city: 'Warsaw',          country: 'Poland' },
  { code: 'IST', name: 'Istanbul Airport',              city: 'Istanbul',        country: 'Turkey' },
  // ─── Middle East ─────────────────────────────────────────────────────────────
  { code: 'DXB', name: 'Dubai International',           city: 'Dubai',           country: 'UAE' },
  { code: 'DOH', name: 'Hamad International',           city: 'Doha',            country: 'Qatar' },
  { code: 'AUH', name: 'Abu Dhabi International',       city: 'Abu Dhabi',       country: 'UAE' },
  { code: 'RUH', name: 'King Khalid International',     city: 'Riyadh',          country: 'Saudi Arabia' },
  // ─── Asia Pacific ────────────────────────────────────────────────────────────
  { code: 'SIN', name: 'Singapore Changi',              city: 'Singapore',       country: 'Singapore' },
  { code: 'HND', name: 'Tokyo Haneda',                  city: 'Tokyo',           country: 'Japan' },
  { code: 'NRT', name: 'Tokyo Narita',                  city: 'Tokyo',           country: 'Japan' },
  { code: 'HKG', name: 'Hong Kong International',       city: 'Hong Kong',       country: 'Hong Kong' },
  { code: 'ICN', name: 'Incheon International',         city: 'Seoul',           country: 'South Korea' },
  { code: 'PEK', name: 'Beijing Capital Intl',          city: 'Beijing',         country: 'China' },
  { code: 'PVG', name: 'Shanghai Pudong Intl',          city: 'Shanghai',        country: 'China' },
  { code: 'BKK', name: 'Bangkok Suvarnabhumi',          city: 'Bangkok',         country: 'Thailand' },
  { code: 'SYD', name: 'Sydney Kingsford Smith',        city: 'Sydney',          country: 'Australia' },
  { code: 'MEL', name: 'Melbourne Airport',             city: 'Melbourne',       country: 'Australia' },
  { code: 'JNB', name: 'O.R. Tambo International',      city: 'Johannesburg',    country: 'South Africa' },
  { code: 'CAI', name: 'Cairo International',           city: 'Cairo',           country: 'Egypt' },
]

export const HOTEL_CITIES: string[] = [
  // ─── United States ───────────────────────────────────────────────────────────
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Francisco, CA',
  'Seattle, WA', 'Boston, MA', 'Atlanta, GA', 'Miami, FL', 'Washington, DC',
  'Las Vegas, NV', 'Denver, CO', 'Austin, TX', 'Nashville, TN', 'Portland, OR',
  'Minneapolis, MN', 'Detroit, MI', 'Charlotte, NC', 'Orlando, FL', 'Tampa, FL',
  'Salt Lake City, UT', 'Raleigh, NC', 'Kansas City, MO', 'St. Louis, MO', 'Indianapolis, IN',
  'New Orleans, LA', 'Pittsburgh, PA', 'Richmond, VA', 'Cincinnati, OH', 'Cleveland, OH',
  // ─── Canada & Mexico ─────────────────────────────────────────────────────────
  'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'Mexico City, Mexico', 'Cancún, Mexico',
  // ─── Europe ──────────────────────────────────────────────────────────────────
  'London, UK', 'Paris, France', 'Amsterdam, Netherlands',
  'Frankfurt, Germany', 'Munich, Germany', 'Berlin, Germany',
  'Zurich, Switzerland', 'Vienna, Austria', 'Rome, Italy', 'Barcelona, Spain',
  'Madrid, Spain', 'Stockholm, Sweden', 'Copenhagen, Denmark',
  // ─── Asia Pacific & Other ─────────────────────────────────────────────────────
  'Dubai, UAE', 'Singapore', 'Tokyo, Japan', 'Hong Kong',
  'Sydney, Australia', 'São Paulo, Brazil',
  'Johannesburg, South Africa', 'Cairo, Egypt',
]

export const TRAVEL_LOCATIONS: string[] = [
  // ─── New York ────────────────────────────────────────────────────────────────
  'JFK International Airport (JFK)', 'LaGuardia Airport (LGA)', 'Newark Liberty Airport (EWR)',
  'New York Penn Station', 'Grand Central Terminal', 'Manhattan Midtown', 'Manhattan Downtown',
  'Brooklyn', 'Queens', 'Hoboken, NJ',
  // ─── Los Angeles ─────────────────────────────────────────────────────────────
  'Los Angeles International Airport (LAX)', 'Los Angeles Union Station',
  'Hollywood', 'Beverly Hills', 'Downtown LA', 'Santa Monica', 'Burbank',
  // ─── Chicago ─────────────────────────────────────────────────────────────────
  "Chicago O'Hare Airport (ORD)", 'Chicago Midway Airport (MDW)',
  'Chicago Union Station', 'The Loop', 'Navy Pier',
  // ─── Dallas ──────────────────────────────────────────────────────────────────
  'Dallas/Fort Worth Airport (DFW)', 'Dallas Love Field (DAL)',
  'Downtown Dallas', 'Irving', 'Plano', 'Frisco',
  // ─── Houston ─────────────────────────────────────────────────────────────────
  'Houston George Bush Airport (IAH)', 'Houston Hobby Airport (HOU)',
  'Downtown Houston', 'Galleria', 'The Woodlands',
  // ─── Miami ───────────────────────────────────────────────────────────────────
  'Miami International Airport (MIA)', 'Fort Lauderdale-Hollywood Airport (FLL)',
  'Miami Beach', 'Downtown Miami', 'Brickell', 'Coral Gables', 'Doral',
  // ─── San Francisco / Bay Area ─────────────────────────────────────────────────
  'San Francisco Airport (SFO)', 'San Jose Airport (SJC)', 'Oakland Airport (OAK)',
  'Downtown San Francisco', 'Union Square', 'Financial District', 'Silicon Valley',
  'San Jose Downtown', 'Palo Alto',
  // ─── Atlanta ─────────────────────────────────────────────────────────────────
  'Hartsfield-Jackson Airport (ATL)', 'Downtown Atlanta', 'Midtown Atlanta', 'Buckhead',
  // ─── Washington DC ───────────────────────────────────────────────────────────
  'Washington Dulles Airport (IAD)', 'Reagan National Airport (DCA)',
  'DC Union Station', 'Capitol Hill', 'Georgetown', 'Tysons Corner, VA',
  // ─── Seattle ─────────────────────────────────────────────────────────────────
  'Seattle-Tacoma Airport (SEA)', 'Downtown Seattle', 'Bellevue', 'Redmond',
  // ─── Boston ──────────────────────────────────────────────────────────────────
  'Boston Logan Airport (BOS)', 'South Station Boston', 'Back Bay', 'Cambridge',
  // ─── Denver ──────────────────────────────────────────────────────────────────
  'Denver International Airport (DEN)', 'Denver Union Station', 'Downtown Denver',
  // ─── Las Vegas ───────────────────────────────────────────────────────────────
  'Las Vegas Harry Reid Airport (LAS)', 'Las Vegas Strip', 'Las Vegas Convention Center',
  // ─── Other US cities ─────────────────────────────────────────────────────────
  'Orlando International Airport (MCO)', 'Tampa International Airport (TPA)',
  'Phoenix Sky Harbor Airport (PHX)', 'Minneapolis–St. Paul Airport (MSP)',
  'Detroit Metropolitan Airport (DTW)', 'Philadelphia International Airport (PHL)',
  'Portland International Airport (PDX)', 'Austin-Bergstrom Airport (AUS)',
  'Nashville International Airport (BNA)', 'Charlotte Douglas Airport (CLT)',
  'Raleigh-Durham Airport (RDU)', 'San Diego Airport (SAN)',
  'Louis Armstrong New Orleans Airport (MSY)',
  // ─── Canada & International ───────────────────────────────────────────────────
  'Toronto Pearson Airport (YYZ)', 'Vancouver Airport (YVR)',
  'Mexico City Airport (MEX)', 'Cancún Airport (CUN)',
  'London Heathrow Airport (LHR)', 'Paris Charles de Gaulle Airport (CDG)',
  'Amsterdam Schiphol Airport (AMS)', 'Frankfurt Airport (FRA)',
  'Dubai International Airport (DXB)', 'Singapore Changi Airport (SIN)',
  'Tokyo Haneda Airport (HND)', 'Sydney Airport (SYD)',
]
