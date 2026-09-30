"""
Category map for records the original taxonomy left unclassified.

Keys are `sub_group` values, normalised (lowercase, punctuation collapsed) so that
whitespace and casing drift in the registry does not cause a miss. Each maps to
(Macro_Sector, Primary_Business_Type, Business_Specialty).

Three macro sectors are added to the original five (Retail, Services, Other, Hospitality,
Manufacturing): Construction, Agriculture, Extractive. These name industries that were
previously dumped into "Other", which held 11.5% of the registry.
"""
import re, unicodedata

_DROP = re.compile(r"[\x00-\x1f'’`´ʼ]")

def nkey(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = _DROP.sub("", s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# ---------------------------------------------------------------- CONSTRUCTION
_CONSTRUCTION = {
    "building works contractor":                                  "Building Contractor",
    "general contractor except water work":                       "General Contractor",
    "road works contractor":                                      "Road Works",
    "51212 construction completing finishing contractor":          "Finishing & Fit-Out",
    "water works contractor":                                     "Water Works",
    "51213 electrical contracting electromechanical work contractur": "Electrical & Electromechanical",
    "construction site preparation contractor":                   "Site Preparation",
}

# ------------------------------------------------------------------ AGRICULTURE
_AGRICULTURE = {
    "cattleand pack animals husbandery":                          "Livestock & Poultry",
    "raising birds and poultry":                                  "Livestock & Poultry",
    "sea animals hatcheries breeding and growing activities":     "Aquaculture",
    "bee keeping":                                                "Beekeeping",
    "silkworm development":                                       "Beekeeping",
    "supply of agricultural products":                            "Agricultural Supply",
    "supply of coffee and tea":                                   "Agricultural Supply",
    "growing of cereals":                                         "Crop Growing",
    "growing of pulses":                                          "Crop Growing",
    "growing of oil seeds":                                       "Crop Growing",
    "growing of animal feed fodder":                              "Crop Growing",
    "growing of pepper and spices":                               "Crop Growing",
    "growing of coffee and tea":                                  "Crop Growing",
    "growing sugar cane":                                         "Crop Growing",
    "floriculture":                                               "Floriculture",
    "vegetable fruit plant and plant seed production":            "Crop Growing",
    "11212 forestry and briquettes forming charcoal and related activities": "Forestry & Charcoal",
    "hunting trapping game propagation and related activities":   "Hunting & Game",
}

# ------------------------------------------------------- AGRICULTURAL WHOLESALE
_AG_WHOLESALE = {
    "wholesale of cereals":                    "Bulk Grains & Pulses",
    "wholesale of pulses":                     "Bulk Grains & Pulses",
    "wholesale of coffee and tea":             "Coffee & Tea Wholesale",
    "wholesale of fruits vegetables":          "Fresh Produce Wholesale",
    "wholesale of pepper andspices":           "Spices & Oilseeds Wholesale",
    "wholesale of oilseeds":                   "Spices & Oilseeds Wholesale",
    "wholesale of plant seed":                 "Seeds & Plants Wholesale",
    "wholesale of cut flowers and other plants": "Seeds & Plants Wholesale",
    "66214 export of bee wax":                 "Honey & Bee Products",
}

# --------------------------------------------------------------------- SERVICES
# (Macro_Sector, Primary_Business_Type, Business_Specialty)
_SERVICES = {
    "immoveable and special moveable properties commission brokers business activities":
        ("Real Estate & Property", "Property Brokerage"),
    "fixed property subletting renting activities":
        ("Real Estate & Property", "Property Rental & Leasing"),
    "real estate development distribution and industry parks development into lots activities":
        ("Real Estate & Property", "Property Development"),
    "printing and related activities":
        ("Printing & Media", "Printing"),
    "newspapers journals and related periodicals distribution activities":
        ("Printing & Media", "Publishing & Distribution"),
    "local labor recruitment and linkage activities":
        ("Employment Services", "Local Recruitment"),
    "abroad labor recruitment and linkage activities":
        ("Employment Services", "Overseas Recruitment"),
    "consultancy activity on advertising":
        ("Marketing & Events", "Advertising"),
    "special event organization activities":
        ("Marketing & Events", "Event Management"),
    "dry waste removing":
        ("Waste & Sanitation", "Waste Collection"),
    "sewage disposal":
        ("Waste & Sanitation", "Sewage & Drainage"),
    "bleach and contaminants removing":
        ("Waste & Sanitation", "Decontamination"),
    "veterinary activities":
        ("Healthcare Services", "Veterinary Practice"),
    "authorized accountant":
        ("Accounting & Audit", "Accounting"),
    "authorized auditor":
        ("Accounting & Audit", "Audit"),
    "computer network design and cable installation":
        ("IT & Software Services", "Network & Infrastructure"),
    "software installation commissioning monitoring and erection activity":
        ("IT & Software Services", "Software Implementation"),
    "software development including design enrichment and implementation":
        ("IT & Software Services", "Software Development"),
    "data base activities and data processing":
        ("IT & Software Services", "Data Services"),
    "electronic commerce platform operator":
        ("IT & Software Services", "E-Commerce Platform"),
    "electronic commerce intra platform operator":
        ("IT & Software Services", "E-Commerce Platform"),
    "international bids restricted to the specific won bid":
        ("Professional & General Services", "Consulting / Support"),
}

# ---------------------------------------------------------------- MANUFACTURING
_MANUFACTURING = {
    "manufacture of wood and wood products":
        ("Furniture, Wood & Paper Manufacturing", "Heavy Manufacturing"),
    "recycling of waste and scraps":
        ("Industrial & Materials Manufacturing", "Recycling & Materials Recovery"),
    "manufacture of brushes and brooms":
        ("Consumer Goods Manufacturing", "Light Manufacturing"),
    "manufacture of buttons buckles slide fasteners etc":
        ("Consumer Goods Manufacturing", "Light Manufacturing"),
    "manufacture of stationeries except paper and paper products":
        ("Consumer Goods Manufacturing", "Light Manufacturing"),
    "manufacture of number plates signs and advertising displays non electrical":
        ("Consumer Goods Manufacturing", "Light Manufacturing"),
    "manufacture of motor vehicles":
        ("Transport Equipment Manufacturing", "Heavy Manufacturing"),
    "manufacture of motorcycles":
        ("Transport Equipment Manufacturing", "Heavy Manufacturing"),
    "manufacture of bicycles and carriages":
        ("Transport Equipment Manufacturing", "Heavy Manufacturing"),
    "manufacture of instruments and appliances for measuring and checking":
        ("Electronics & Equipment Manufacturing", "Heavy Manufacturing"),
}

# -------------------------------------------------------------------- EXTRACTIVE
_EXTRACTIVE = {
    "21211 stone carvings clay sand and similar mining and quarrying": "Stone, Clay & Sand",
    "quarrying of minerals":                        "Stone, Clay & Sand",
    "excavation of minerals":                       "Mineral Extraction",
    "digging of chemicals and fertilizers":         "Mineral Extraction",
    "extraction and evaporation of salt":           "Salt Extraction",
    "exploration of minerals":                      "Mineral Exploration",
    "mining supportive activities":                 "Mining Support Services",
    "extraction of crude petroleum and natural gas": "Oil & Gas Extraction",
    "activities related to oil and gas extraction": "Oil & Gas Extraction",
}

# ------------------------------------------------------------------- UTILITIES
_UTILITIES = {
    "extending electric lines":  ("Utilities", "Electricity Distribution"),
    "generating electricity":    ("Utilities", "Power Generation"),
    "import of electricity":     ("Utilities", "Electricity Distribution"),
}

# --------------------------------------------------------------------- TOURISM
_TOURISM = {
    "travel agency representation and online travel agency activity":
        ("Tourism and Arts", "Travel Agency"),
}

# ----------------------------------------------------------------- EXPORT TRADE
_EXPORT = {
    "export of musical recreational craft and souvenir goods":
        ("Retail", "General Consumer Goods", "Standard Retail"),
}


def build():
    """sub_group key -> (Macro_Sector, Primary_Business_Type, Business_Specialty)"""
    m = {}
    for k, spec in _CONSTRUCTION.items():
        m[k] = ("Construction", "Construction Contracting", spec)
    for k, spec in _AGRICULTURE.items():
        m[k] = ("Agriculture", "Agricultural Production", spec)
    for k, spec in _AG_WHOLESALE.items():
        m[k] = ("Retail", "Agricultural Wholesale", spec)
    for k, (pbt, spec) in _SERVICES.items():
        m[k] = ("Services", pbt, spec)
    for k, (pbt, spec) in _MANUFACTURING.items():
        m[k] = ("Manufacturing", pbt, spec)
    for k, spec in _EXTRACTIVE.items():
        m[k] = ("Extractive", "Mining & Quarrying", spec)
    for k, (pbt, spec) in _UTILITIES.items():
        m[k] = ("Services", pbt, spec)
    for k, (pbt, spec) in _TOURISM.items():
        m[k] = ("Services", pbt, spec)
    for k, v in _EXPORT.items():
        m[k] = v
    return m

CATEGORY_MAP = build()
