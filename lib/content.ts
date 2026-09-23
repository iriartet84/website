export const profile = {
  name: 'Toribio Iriarte',
  fullName: 'Toribio Iriarte Fernández',
  tagline:
    'Graduate economist with experience in commodity, macroeconomic, financial markets, and geopolitical risk research, including work at the European Commission and the United Nations.',
  email: 'iriartet84@gmail.com',
  phone: '+54 9 11 7019 1591',
  linkedin: 'linkedin.com/in/tiriarte',
  linkedinUrl: 'https://linkedin.com/in/tiriarte',
  nationality: 'Argentina · Spain',
  location: 'Barcelona, Spain',
}

export type ResearchSection = {
  id: string
  index: string
  label: string
  title: string
  description: string
  highlights: string[]
  image: string
}

export const researchSections: ResearchSection[] = [
  {
    id: 'commodity',
    index: '01',
    label: 'Commodity Research',
    title: 'Commodity Research',
    description:
      'As Program Director of London Politica’s Global Commodities Watch, I led a team of eight analysts producing investment-grade reports on BRICS expansion, the lithium triangle, EU–Mercosur dynamics, and European energy infrastructure.',
    highlights: [
      'Directed the Global Commodities Watch program at London Politica',
      'Built a commodity-augmented Dynamic Factor Model to nowcast GDP',
      'Tracked agricultural and energy trade flows at the Argentine Embassy',
    ],
    image: '/research/commodity.png',
  },
  {
    id: 'macroeconomics',
    index: '02',
    label: 'Macroeconomics',
    title: 'Macroeconomic Research',
    description:
      'Trained in DSGE, VAR, and nowcasting methods at the Barcelona GSE, I build structural and time-series models of fiscal transmission, sovereign risk, and mixed-frequency forecasting used by central banks and investment banks.',
    highlights: [
      'State-dependent Local Projections across 29 countries (1974–2024)',
      'Mixed-frequency nowcasting via Kalman filter and maximum likelihood',
      'MSc in Macroeconomic Policy & Financial Markets, Barcelona GSE',
    ],
    image: '/research/macroeconomics.png',
  },
  {
    id: 'financial-markets',
    index: '03',
    label: 'Financial Markets',
    title: 'Financial Markets Research',
    description:
      'I apply machine-learning and state-space methods to financial data — modelling sovereign debt spreads, fiscal vulnerability, and market dynamics, and translating quantitative signals into actionable investor briefs.',
    highlights: [
      'Quantitative framework for EM fuel-import vulnerability and debt spreads',
      'Machine Learning for Finance, text-as-data and sentiment analysis',
      'Macroeconomic outlook briefs for investors on FX and industrial policy',
    ],
    image: '/research/financial-markets.png',
  },
  {
    id: 'geopolitical-risk',
    index: '04',
    label: 'Geopolitical Risk',
    title: 'Geopolitical Risk Research',
    description:
      'I produce geopolitical risk analysis for conflict-affected states and strategic trade corridors, mapping chokepoints and translating fragmentation into concrete supply-chain and investment risk for decision-makers.',
    highlights: [
      'Risk analysis on Libya, the DRC, and Burkina Faso for Africa Watch',
      'Mapped chokepoints — Strait of Hormuz, Suez Canal, IMEC',
      'Scenario-based insight on BRICS expansion and corridor competition',
    ],
    image: '/research/geopolitical-risk.png',
  },
]

export type Skill = {
  index: string
  title: string
  description: string
  tags: string[]
}

export const skills: Skill[] = [
  {
    index: '01',
    title: 'Quantitative Modelling',
    description:
      'Structural and time-series macroeconomic modeling, from DSGE calibration to mixed-frequency nowcasting. Applied to fiscal transmission, commodity markets, and sovereign risk, with experience developing state-space forecasting models, VARs, high-frequency dynamic factor models, and machine-learning methods for financial and macroeconomic data.',
    tags: ['DSGE', 'Nowcasting', 'MATLAB', 'Dynare', 'R'],
  },
  {
    index: '02',
    title: 'Data & Engineering',
    description:
      'Experience embedding LLMs into data pipelines from source to model: statistical APIs through to estimation, in Python, R, and SQL. Techniques in text-as-data, sentiment analysis, and machine learning for finance.',
    tags: ['Python', 'SQL', 'LLMs', 'Machine Learning'],
  },
  {
    index: '03',
    title: 'Delivery & Communication',
    description:
      'Five years of research and policy work across European institutions, multilateral bodies, and a distributed analyst team. I translate quantitative results into briefs that decision-makers can act on in five languages.',
    tags: ['Drafting', 'LaTeX', 'Power BI'],
  },
]

export const paperCategories = [
  'Macroeconomics',
  'Geopolitical Risk',
  'Commodity Research',
  'Financial Markets',
] as const

export type PaperCategory = (typeof paperCategories)[number]

export type Paper = {
  title: string
  category: PaperCategory
  year: string
  type: 'Paper' | 'Brief' | 'Report'
  abstract: string
  methods: string[]
}

export const papers: Paper[] = [
  {
    title: 'Oil Supply Shocks: Institutional Thresholds & Fiscal Transmission',
    category: 'Macroeconomics',
    year: '2025',
    type: 'Paper',
    abstract:
      'State-dependent Local Projections applied to a panel of 29 countries (1974–2024) using Känzig oil supply news shocks, tracing fiscal impulse responses across institutional regimes. Identifies property rights and rule of law as near-discrete thresholds for capital-market access during oil-price spikes.',
    methods: ['Local Projections', 'Python', 'R', 'WEO / ICRG / V-DEM'],
  },
  {
    title: 'Oil, Institutions & Growth in Developing Countries',
    category: 'Macroeconomics',
    year: '2025',
    type: 'Paper',
    abstract:
      'Thesis research presented at the CIVICA–LSE research exchange on how oil endowments condition institutional quality and long-run growth. Uses two-stage least squares in R, instrumenting oil with a 10-year lag within an augmented Solow framework.',
    methods: ['2SLS / IV', 'PCA', 'R', 'Solow framework'],
  },
  {
    title: 'Nowcasting with Mixed-Frequency & Commodity Data',
    category: 'Commodity Research',
    year: '2025',
    type: 'Paper',
    abstract:
      'A commodity-augmented Dynamic Factor Model (Stock–Watson framework) in MATLAB to nowcast Australian GDP, casting 8 mixed-frequency indicators into state-space form and estimating 34 parameters via the Kalman filter and maximum likelihood. Achieved 96% correlation with observed GDP growth.',
    methods: ['Dynamic Factor Model', 'Kalman Filter', 'MATLAB', 'MLE'],
  },
  {
    title: 'BRICS Expansion: Geopolitical Shifts in Global Commodity Markets',
    category: 'Geopolitical Risk',
    year: '2024',
    type: 'Report',
    abstract:
      'Flagship report analyzing the implications of BRICS expansion for developing-country commodity exporters and investment flows. Maps strategic corridors and chokepoints (Strait of Hormuz, Suez Canal, IMEC) and quantifies geopolitical risk across energy and agricultural trade.',
    methods: ['Scenario analysis', 'Supply-chain mapping', 'Data visualization'],
  },
  {
    title: 'EU Agricultural Reform for Water Stress in Cyprus',
    category: 'Commodity Research',
    year: '2024',
    type: 'Brief',
    abstract:
      'Incentive-compatible economic mechanisms — tiered pricing, elasticity-based incentives, behavioural nudges — to encourage crop diversification in a water-stressed economy. Quantified a 20–33.5% evaporation reduction and pitched the pilot to the European Commission.',
    methods: ['Mechanism design', 'Elasticity modelling', 'Policy pitch'],
  },
  {
    title: 'Africa Watch: Food Insecurity in Conflict-Affected States',
    category: 'Geopolitical Risk',
    year: '2024',
    type: 'Brief',
    abstract:
      'Geopolitical risk analysis for conflict-affected states including Libya, the DRC, and Burkina Faso, examining the humanitarian and development dimensions of food insecurity for client-ready policy insight.',
    methods: ['Country risk', 'Qualitative synthesis', 'Policy briefing'],
  },
  {
    title: 'EM Fuel-Import Vulnerability & Sovereign Debt Spreads',
    category: 'Financial Markets',
    year: '2025',
    type: 'Paper',
    abstract:
      'A quantitative framework predicting emerging-market fuel-import vulnerability and sovereign debt spreads under oil-price stress, implemented in Python and R using WEO, ICRG, and V-DEM panel data.',
    methods: ['Panel econometrics', 'Sovereign spreads', 'Python / R'],
  },
  {
    title: 'Text-as-Data & Sentiment Signals for Financial Markets',
    category: 'Financial Markets',
    year: '2025',
    type: 'Brief',
    abstract:
      'Applied LLM-based text-as-data and sentiment analysis to financial and macroeconomic corpora, embedding language models into estimation pipelines from statistical APIs through to model output.',
    methods: ['LLMs', 'Sentiment analysis', 'Python', 'SQL'],
  },
]

export type Project = {
  title: string
  category: string
  summary: string
  tags: string[]
  status: 'Live' | 'In progress' | 'Coming soon'
  kind: 'map' | 'chart' | 'dashboard' | 'model'
}

export const projects: Project[] = [
  {
    title: 'Global Commodity Chokepoints — Interactive Map',
    category: 'Interactive Maps',
    summary:
      'An interactive map of strategic trade corridors and maritime chokepoints, layering energy and agricultural flows with geopolitical risk indicators across the Strait of Hormuz, Suez Canal, and IMEC.',
    tags: ['Mapbox', 'D3', 'Risk indices'],
    status: 'Coming soon',
    kind: 'map',
  },
  {
    title: 'Australian GDP Nowcast — Live Factor Model',
    category: 'Forecasting',
    summary:
      'A live dashboard of the commodity-augmented Dynamic Factor Model, streaming mixed-frequency indicators into a state-space nowcast with the factor-implied fitted series against observed GDP.',
    tags: ['Kalman Filter', 'State-space', 'MATLAB'],
    status: 'In progress',
    kind: 'model',
  },
  {
    title: 'Oil Shock Fiscal Transmission — Impulse Explorer',
    category: 'Dashboards',
    summary:
      'An interactive explorer of state-dependent fiscal impulse responses to oil supply shocks across institutional regimes, with country selectors and confidence bands.',
    tags: ['Local Projections', 'Panel data', 'Recharts'],
    status: 'In progress',
    kind: 'chart',
  },
  {
    title: 'Sovereign Risk Monitor — Spread Dashboard',
    category: 'Dashboards',
    summary:
      'A monitor of emerging-market sovereign debt spreads and fuel-import vulnerability, combining WEO, ICRG, and V-DEM signals into a single risk score.',
    tags: ['Sovereign spreads', 'Python', 'SQL'],
    status: 'Coming soon',
    kind: 'dashboard',
  },
]

export const languages = [
  { name: 'Spanish', level: 'Native' },
  { name: 'English', level: 'Proficient' },
  { name: 'Portuguese', level: 'Fluent' },
  { name: 'French', level: 'B1' },
  { name: 'German', level: 'A2' },
  { name: 'Italian', level: 'A2' },
]

export const education = [
  {
    school: 'Barcelona Graduate School of Economics',
    location: 'Barcelona, Spain',
    degree: 'MSc in Macroeconomic Policy and Financial Markets — GPA 8.7/10',
    period: '09/2025 – 2026',
    details: [
      'Trains DSGE, VAR, nowcasting/forecasting, and data-science / ML methods for macroeconomic and market forecasting used by central banks and investment banks.',
      'Coursework: Macroeconomics DSGE (9.9), Nowcasting & Forecasting (8.8), Monetary Policy (8.7), International Macroeconomics (9), Machine Learning for Finance (9.5), Time Series Econometrics / VAR (8.1).',
    ],
  },
  {
    school: 'Maastricht University',
    location: 'Maastricht, Netherlands',
    degree: 'BSc in Economics and Business Economics (Honours, Cum Laude) — GPA 4.0',
    period: '07/2022 – 05/2025',
    details: [
      'International Trade, International Economic Relations, Empirical Econometrics.',
      'Honours programme (+40 ECTS): Mathematical Statistics, Time Series Econometrics.',
    ],
  },
  {
    school: 'SciencesPo Paris',
    location: 'Paris, France',
    degree: 'Economics and Political Economy — GPA 17/20',
    period: '01/2025 – 05/2025',
    details: [
      'Development Economics, European Policy, Populism.',
      'Selected for the CIVICA–LSE research exchange.',
    ],
  },
]

export const experience = [
  {
    role: 'Program Director',
    org: 'London Politica',
    location: 'London, UK',
    period: '06/2023 – 07/2025',
    summary: 'Directed the Global Commodities Watch program',
    details: [
      'Led a team of 8 analysts producing investment-grade reports and client briefs spanning BRICS expansion, the lithium triangle, EU–Mercosur dynamics, and European energy infrastructure.',
      'Directed research on institutional and geopolitical constraints on industrial development in the DRC, Argentina, and Libya, translating cross-regional risk data into client-ready policy insight.',
      'Produced geopolitical risk analysis for conflict-affected states in Africa and contributed to Africa Watch reports on food insecurity.',
    ],
  },
  {
    role: 'Policy Proposal',
    org: 'European Commission',
    location: 'Brussels, Belgium',
    period: '11/2024',
    summary: 'Designed agricultural reform for water stress in Cyprus',
    details: [
      'Designed incentive-compatible economic mechanisms — tiered pricing, elasticity-based incentives, behavioural nudges — to encourage crop diversification.',
      'Quantified outcomes (20% evaporation reduction through destratification, 33.5% via monomolecular films) and presented the pilot to European Commission and Cyprus representatives.',
      'Collaborated with an international team to design and pitch feasible agricultural investment.',
    ],
  },
  {
    role: 'Intern — G77 Secretariat',
    org: 'United Nations',
    location: 'Vienna, Austria',
    period: '01/2020 – 02/2020',
    summary: 'Assisted the Group of 77 at UNIDO & IAEA on industrial development',
    details: [
      'Worked within the G77’s Vienna Chapter Secretariat on international cooperation for industrial development.',
      'Liaised with delegates from Brazil, Angola, and Argentina, preparing briefs and presentations for weekly meetings.',
      'Drafted high-level policy briefs on energy security (IAEA) and supported G77 negotiating positions on sovereign financing across 10+ member states.',
    ],
  },
  {
    role: 'Trade Intern',
    org: 'Argentine Embassy',
    location: 'Vienna, Austria',
    period: '01/2020 – 02/2020',
    summary: 'Commodity trade intern for development',
    details: [
      'Supported bilateral trade and investment promotion between Argentina and Austria, Slovenia, and Slovakia.',
      'Built an Excel database of commercial opportunities, tracking agricultural (soybeans, corn) and energy (oil, gas) trade flows.',
      'Drafted macroeconomic outlook briefs sourcing World Bank API data in R and Python for fiscal surveillance reports.',
    ],
  },
]

export const cvSkills = {
  programming: [
    'Dynare',
    'MATLAB',
    'Python',
    'R',
    'Stata',
    'SQL',
    'Excel (VBA / Macros)',
    'Power BI',
  ],
  methods: [
    'DSGE calibration & simulation',
    'SVAR',
    '2SLS / IV',
    'Local Projections',
    'Gaussian Process Regression',
    'XGBoost',
    'Ridge Regression',
    'LLM-based text-as-data',
    'Monte Carlo simulation & variance reduction',
  ],
}
