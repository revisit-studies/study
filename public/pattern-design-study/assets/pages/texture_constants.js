const filePath = './' //the relative file path points to image and data

/**
 * Data
 */
const fruits = ["carrot", "celery","corn", "eggplant","mushroom", "olive", "tomato"] // fruit categories from csv data
const patternSize = 44

const overlap_ratio = 1.5 //we set the max size value of content in the pattern as pattern_size * overlap_ratio, to allow some degree of overlap

//browser window size
min_window_width = 1200
min_window_height = 600

//image size
const svgWidth = 600
const svgHeight = 600
const barWidth = 400
const barHeight = 300
const pieRadius = 200
const mapWidth = 600
const mapHeight = 500

const defaultDataset = [
    {fruit: 'carrot', value: 22},
    {fruit: 'celery', value: 50},
    {fruit: 'corn', value: 20},
    {fruit:'eggplant', value: 69},
    {fruit:'mushroom',value: 92},
    {fruit: 'olive',value: 42},
    {fruit:'tomato',value: 67}
]

const defaultMapDataset = [
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": "01",
        "NOM_DEPT": "Ain",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 43,
        "NB_COMMUNES": 419,
        "POP": 4
    },
    {
        "CODE_REG": 22,
        "NOM_REGION": "Picardie",
        "CODE_DEPT": "02",
        "NOM_DEPT": "Aisne",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 42,
        "NB_COMMUNES": 816,
        "POP": 1
    },
    {
        "CODE_REG": 83,
        "NOM_REGION": "Auvergne",
        "CODE_DEPT": "03",
        "NOM_DEPT": "Allier",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 320,
        "POP": 6
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": "04",
        "NOM_DEPT": "Alpes-de-Haute-Provence",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 200,
        "POP": 6
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": "05",
        "NOM_DEPT": "Hautes-Alpes",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 177,
        "POP": 6
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": "06",
        "NOM_DEPT": "Alpes-Maritimes",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 52,
        "NB_COMMUNES": 163,
        "POP": 0
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": "07",
        "NOM_DEPT": "Ardèche",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 33,
        "NB_COMMUNES": 339,
        "POP": 1
    },
    {
        "CODE_REG": 21,
        "NOM_REGION": "Champagne-Ardenne",
        "CODE_DEPT": "08",
        "NOM_DEPT": "Ardennes",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 37,
        "NB_COMMUNES": 463,
        "POP": 4
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": "09",
        "NOM_DEPT": "Ariège",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 22,
        "NB_COMMUNES": 332,
        "POP": 2
    },
    {
        "CODE_REG": 21,
        "NOM_REGION": "Champagne-Ardenne",
        "CODE_DEPT": 10,
        "NOM_DEPT": "Aube",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 33,
        "NB_COMMUNES": 433,
        "POP": 6
    },
    {
        "CODE_REG": 91,
        "NOM_REGION": "Languedoc-Roussillon",
        "CODE_DEPT": 11,
        "NOM_DEPT": "Aude",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 438,
        "POP": 3
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 12,
        "NOM_DEPT": "Aveyron",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 46,
        "NB_COMMUNES": 304,
        "POP": 0
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": 13,
        "NOM_DEPT": "Bouches-du-Rhône",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 57,
        "NB_COMMUNES": 119,
        "POP": 1
    },
    {
        "CODE_REG": 25,
        "NOM_REGION": "Basse-Normandie",
        "CODE_DEPT": 14,
        "NOM_DEPT": "Calvados",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 49,
        "NB_COMMUNES": 706,
        "POP": 0
    },
    {
        "CODE_REG": 83,
        "NOM_REGION": "Auvergne",
        "CODE_DEPT": 15,
        "NOM_DEPT": "Cantal",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 27,
        "NB_COMMUNES": 260,
        "POP": 1
    },
    {
        "CODE_REG": 54,
        "NOM_REGION": "Poitou-Charentes",
        "CODE_DEPT": 16,
        "NOM_DEPT": "Charente",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 404,
        "POP": 0
    },
    {
        "CODE_REG": 54,
        "NOM_REGION": "Poitou-Charentes",
        "CODE_DEPT": 17,
        "NOM_DEPT": "Charente-Maritime",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 51,
        "NB_COMMUNES": 472,
        "POP": 1
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 18,
        "NOM_DEPT": "Cher",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 290,
        "POP": 3
    },
    {
        "CODE_REG": 74,
        "NOM_REGION": "Limousin",
        "CODE_DEPT": 19,
        "NOM_DEPT": "Corrèze",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 37,
        "NB_COMMUNES": 286,
        "POP": 1
    },
    {
        "CODE_REG": 94,
        "NOM_REGION": "Corse",
        "CODE_DEPT": "2A",
        "NOM_DEPT": "Corse-du-Sud",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 22,
        "NB_COMMUNES": 124,
        "POP": 0
    },
    {
        "CODE_REG": 94,
        "NOM_REGION": "Corse",
        "CODE_DEPT": "2B",
        "NOM_DEPT": "Haute-Corse",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 236,
        "POP": 6
    },
    {
        "CODE_REG": 26,
        "NOM_REGION": "Bourgogne",
        "CODE_DEPT": 21,
        "NOM_DEPT": "Côte-d'Or",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 43,
        "NB_COMMUNES": 706,
        "POP": 3
    },
    {
        "CODE_REG": 53,
        "NOM_REGION": "Bretagne",
        "CODE_DEPT": 22,
        "NOM_DEPT": "Côtes-d'Armor",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 52,
        "NB_COMMUNES": 373,
        "POP": 6
    },
    {
        "CODE_REG": 74,
        "NOM_REGION": "Limousin",
        "CODE_DEPT": 23,
        "NOM_DEPT": "Creuse",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 27,
        "NB_COMMUNES": 260,
        "POP": 0
    },
    {
        "CODE_REG": 72,
        "NOM_REGION": "Aquitaine",
        "CODE_DEPT": 24,
        "NOM_DEPT": "Dordogne",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 50,
        "NB_COMMUNES": 557,
        "POP": 0
    },
    {
        "CODE_REG": 43,
        "NOM_REGION": "Franche-Comté",
        "CODE_DEPT": 25,
        "NOM_DEPT": "Doubs",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 594,
        "POP": 0
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 26,
        "NOM_DEPT": "Drôme",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 36,
        "NB_COMMUNES": 369,
        "POP": 2
    },
    {
        "CODE_REG": 23,
        "NOM_REGION": "Haute-Normandie",
        "CODE_DEPT": 27,
        "NOM_DEPT": "Eure",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 43,
        "NB_COMMUNES": 675,
        "POP": 3
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 28,
        "NOM_DEPT": "Eure-et-Loir",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 29,
        "NB_COMMUNES": 402,
        "POP": 0
    },
    {
        "CODE_REG": 53,
        "NOM_REGION": "Bretagne",
        "CODE_DEPT": 29,
        "NOM_DEPT": "Finistère",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 54,
        "NB_COMMUNES": 283,
        "POP": 2
    },
    {
        "CODE_REG": 91,
        "NOM_REGION": "Languedoc-Roussillon",
        "CODE_DEPT": 30,
        "NOM_DEPT": "Gard",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 46,
        "NB_COMMUNES": 353,
        "POP": 0
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 31,
        "NOM_DEPT": "Haute-Garonne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 53,
        "NB_COMMUNES": 589,
        "POP": 5
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 32,
        "NOM_DEPT": "Gers",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 463,
        "POP": 3
    },
    {
        "CODE_REG": 72,
        "NOM_REGION": "Aquitaine",
        "CODE_DEPT": 33,
        "NOM_DEPT": "Gironde",
        "NB_ARRONDS": 6,
        "NB_CANTONS": 63,
        "NB_COMMUNES": 542,
        "POP": 4
    },
    {
        "CODE_REG": 91,
        "NOM_REGION": "Languedoc-Roussillon",
        "CODE_DEPT": 34,
        "NOM_DEPT": "Hérault",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 49,
        "NB_COMMUNES": 343,
        "POP": 0
    },
    {
        "CODE_REG": 53,
        "NOM_REGION": "Bretagne",
        "CODE_DEPT": 35,
        "NOM_DEPT": "Ille-et-Vilaine",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 53,
        "NB_COMMUNES": 353,
        "POP": 1
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 36,
        "NOM_DEPT": "Indre",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 26,
        "NB_COMMUNES": 247,
        "POP": 0
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 37,
        "NOM_DEPT": "Indre-et-Loire",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 37,
        "NB_COMMUNES": 277,
        "POP": 3
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 38,
        "NOM_DEPT": "Isère",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 58,
        "NB_COMMUNES": 533,
        "POP": 2
    },
    {
        "CODE_REG": 43,
        "NOM_REGION": "Franche-Comté",
        "CODE_DEPT": 39,
        "NOM_DEPT": "Jura",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 34,
        "NB_COMMUNES": 544,
        "POP": 2
    },
    {
        "CODE_REG": 72,
        "NOM_REGION": "Aquitaine",
        "CODE_DEPT": 40,
        "NOM_DEPT": "Landes",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 331,
        "POP": 1
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 41,
        "NOM_DEPT": "Loir-et-Cher",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 291,
        "POP": 3
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 42,
        "NOM_DEPT": "Loire",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 327,
        "POP": 3
    },
    {
        "CODE_REG": 83,
        "NOM_REGION": "Auvergne",
        "CODE_DEPT": 43,
        "NOM_DEPT": "Haute-Loire",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 35,
        "NB_COMMUNES": 260,
        "POP": 4
    },
    {
        "CODE_REG": 52,
        "NOM_REGION": "Pays de la Loire",
        "CODE_DEPT": 44,
        "NOM_DEPT": "Loire-Atlantique",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 59,
        "NB_COMMUNES": 221,
        "POP": 0
    },
    {
        "CODE_REG": 24,
        "NOM_REGION": "Centre",
        "CODE_DEPT": 45,
        "NOM_DEPT": "Loiret",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 41,
        "NB_COMMUNES": 334,
        "POP": 6
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 46,
        "NOM_DEPT": "Lot",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 340,
        "POP": 3
    },
    {
        "CODE_REG": 72,
        "NOM_REGION": "Aquitaine",
        "CODE_DEPT": 47,
        "NOM_DEPT": "Lot-et-Garonne",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 319,
        "POP": 4
    },
    {
        "CODE_REG": 91,
        "NOM_REGION": "Languedoc-Roussillon",
        "CODE_DEPT": 48,
        "NOM_DEPT": "Lozère",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 25,
        "NB_COMMUNES": 185,
        "POP": 6
    },
    {
        "CODE_REG": 52,
        "NOM_REGION": "Pays de la Loire",
        "CODE_DEPT": 49,
        "NOM_DEPT": "Maine-et-Loire",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 41,
        "NB_COMMUNES": 363,
        "POP": 0
    },
    {
        "CODE_REG": 25,
        "NOM_REGION": "Basse-Normandie",
        "CODE_DEPT": 50,
        "NOM_DEPT": "Manche",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 52,
        "NB_COMMUNES": 601,
        "POP": 2
    },
    {
        "CODE_REG": 21,
        "NOM_REGION": "Champagne-Ardenne",
        "CODE_DEPT": 51,
        "NOM_DEPT": "Marne",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 44,
        "NB_COMMUNES": 620,
        "POP": 0
    },
    {
        "CODE_REG": 21,
        "NOM_REGION": "Champagne-Ardenne",
        "CODE_DEPT": 52,
        "NOM_DEPT": "Haute-Marne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 32,
        "NB_COMMUNES": 438,
        "POP": 0
    },
    {
        "CODE_REG": 52,
        "NOM_REGION": "Pays de la Loire",
        "CODE_DEPT": 53,
        "NOM_DEPT": "Mayenne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 32,
        "NB_COMMUNES": 261,
        "POP": 5
    },
    {
        "CODE_REG": 41,
        "NOM_REGION": "Lorraine",
        "CODE_DEPT": 54,
        "NOM_DEPT": "Meurthe-et-Moselle",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 44,
        "NB_COMMUNES": 594,
        "POP": 4
    },
    {
        "CODE_REG": 41,
        "NOM_REGION": "Lorraine",
        "CODE_DEPT": 55,
        "NOM_DEPT": "Meuse",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 500,
        "POP": 5
    },
    {
        "CODE_REG": 53,
        "NOM_REGION": "Bretagne",
        "CODE_DEPT": 56,
        "NOM_DEPT": "Morbihan",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 42,
        "NB_COMMUNES": 261,
        "POP": 2
    },
    {
        "CODE_REG": 41,
        "NOM_REGION": "Lorraine",
        "CODE_DEPT": 57,
        "NOM_DEPT": "Moselle",
        "NB_ARRONDS": 9,
        "NB_CANTONS": 51,
        "NB_COMMUNES": 730,
        "POP": 1
    },
    {
        "CODE_REG": 26,
        "NOM_REGION": "Bourgogne",
        "CODE_DEPT": 58,
        "NOM_DEPT": "Nièvre",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 32,
        "NB_COMMUNES": 312,
        "POP": 4
    },
    {
        "CODE_REG": 31,
        "NOM_REGION": "Nord-Pas-de-Calais",
        "CODE_DEPT": 59,
        "NOM_DEPT": "Nord",
        "NB_ARRONDS": 6,
        "NB_CANTONS": 79,
        "NB_COMMUNES": 650,
        "POP": 5
    },
    {
        "CODE_REG": 22,
        "NOM_REGION": "Picardie",
        "CODE_DEPT": 60,
        "NOM_DEPT": "Oise",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 41,
        "NB_COMMUNES": 693,
        "POP": 6
    },
    {
        "CODE_REG": 25,
        "NOM_REGION": "Basse-Normandie",
        "CODE_DEPT": 61,
        "NOM_DEPT": "Orne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 505,
        "POP": 3
    },
    {
        "CODE_REG": 31,
        "NOM_REGION": "Nord-Pas-de-Calais",
        "CODE_DEPT": 62,
        "NOM_DEPT": "Pas-de-Calais",
        "NB_ARRONDS": 7,
        "NB_CANTONS": 77,
        "NB_COMMUNES": 895,
        "POP": 3
    },
    {
        "CODE_REG": 83,
        "NOM_REGION": "Auvergne",
        "CODE_DEPT": 63,
        "NOM_DEPT": "Puy-de-Dôme",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 61,
        "NB_COMMUNES": 470,
        "POP": 0
    },
    {
        "CODE_REG": 72,
        "NOM_REGION": "Aquitaine",
        "CODE_DEPT": 64,
        "NOM_DEPT": "Pyrénées-Atlantiques",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 52,
        "NB_COMMUNES": 547,
        "POP": 4
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 65,
        "NOM_DEPT": "Hautes-Pyrénées",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 34,
        "NB_COMMUNES": 474,
        "POP": 4
    },
    {
        "CODE_REG": 91,
        "NOM_REGION": "Languedoc-Roussillon",
        "CODE_DEPT": 66,
        "NOM_DEPT": "Pyrénées-Orientales",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 226,
        "POP": 6
    },
    {
        "CODE_REG": 42,
        "NOM_REGION": "Alsace",
        "CODE_DEPT": 67,
        "NOM_DEPT": "Bas-Rhin",
        "NB_ARRONDS": 7,
        "NB_CANTONS": 44,
        "NB_COMMUNES": 527,
        "POP": 1
    },
    {
        "CODE_REG": 42,
        "NOM_REGION": "Alsace",
        "CODE_DEPT": 68,
        "NOM_DEPT": "Haut-Rhin",
        "NB_ARRONDS": 6,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 377,
        "POP": 3
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 69,
        "NOM_DEPT": "Rhône",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 54,
        "NB_COMMUNES": 293,
        "POP": 3
    },
    {
        "CODE_REG": 43,
        "NOM_REGION": "Franche-Comté",
        "CODE_DEPT": 70,
        "NOM_DEPT": "Haute-Saône",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 32,
        "NB_COMMUNES": 545,
        "POP": 5
    },
    {
        "CODE_REG": 26,
        "NOM_REGION": "Bourgogne",
        "CODE_DEPT": 71,
        "NOM_DEPT": "Saône-et-Loire",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 57,
        "NB_COMMUNES": 573,
        "POP": 5
    },
    {
        "CODE_REG": 52,
        "NOM_REGION": "Pays de la Loire",
        "CODE_DEPT": 72,
        "NOM_DEPT": "Sarthe",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 375,
        "POP": 4
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 73,
        "NOM_DEPT": "Savoie",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 37,
        "NB_COMMUNES": 305,
        "POP": 0
    },
    {
        "CODE_REG": 82,
        "NOM_REGION": "Rhône-Alpes",
        "CODE_DEPT": 74,
        "NOM_DEPT": "Haute-Savoie",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 34,
        "NB_COMMUNES": 294,
        "POP": 3
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 75,
        "NOM_DEPT": "Paris",
        "NB_ARRONDS": 1,
        "NB_CANTONS": 20,
        "NB_COMMUNES": 1,
        "POP": 6
    },
    {
        "CODE_REG": 23,
        "NOM_REGION": "Haute-Normandie",
        "CODE_DEPT": 76,
        "NOM_DEPT": "Seine-Maritime",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 69,
        "NB_COMMUNES": 744,
        "POP": 0
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 77,
        "NOM_DEPT": "Seine-et-Marne",
        "NB_ARRONDS": 5,
        "NB_CANTONS": 43,
        "NB_COMMUNES": 514,
        "POP": 4
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 78,
        "NOM_DEPT": "Yvelines",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 39,
        "NB_COMMUNES": 262,
        "POP": 4
    },
    {
        "CODE_REG": 54,
        "NOM_REGION": "Poitou-Charentes",
        "CODE_DEPT": 79,
        "NOM_DEPT": "Deux-Sèvres",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 33,
        "NB_COMMUNES": 305,
        "POP": 2
    },
    {
        "CODE_REG": 22,
        "NOM_REGION": "Picardie",
        "CODE_DEPT": 80,
        "NOM_DEPT": "Somme",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 46,
        "NB_COMMUNES": 782,
        "POP": 0
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 81,
        "NOM_DEPT": "Tarn",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 46,
        "NB_COMMUNES": 323,
        "POP": 6
    },
    {
        "CODE_REG": 73,
        "NOM_REGION": "Midi-Pyrénées",
        "CODE_DEPT": 82,
        "NOM_DEPT": "Tarn-et-Garonne",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 30,
        "NB_COMMUNES": 195,
        "POP": 5
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": 83,
        "NOM_DEPT": "Var",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 43,
        "NB_COMMUNES": 153,
        "POP": 4
    },
    {
        "CODE_REG": 93,
        "NOM_REGION": "Provence-Alpes-Côte d'Azur",
        "CODE_DEPT": 84,
        "NOM_DEPT": "Vaucluse",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 24,
        "NB_COMMUNES": 151,
        "POP": 6
    },
    {
        "CODE_REG": 52,
        "NOM_REGION": "Pays de la Loire",
        "CODE_DEPT": 85,
        "NOM_DEPT": "Vendée",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 282,
        "POP": 6
    },
    {
        "CODE_REG": 54,
        "NOM_REGION": "Poitou-Charentes",
        "CODE_DEPT": 86,
        "NOM_DEPT": "Vienne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 38,
        "NB_COMMUNES": 281,
        "POP": 1
    },
    {
        "CODE_REG": 74,
        "NOM_REGION": "Limousin",
        "CODE_DEPT": 87,
        "NOM_DEPT": "Haute-Vienne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 42,
        "NB_COMMUNES": 201,
        "POP": 2
    },
    {
        "CODE_REG": 41,
        "NOM_REGION": "Lorraine",
        "CODE_DEPT": 88,
        "NOM_DEPT": "Vosges",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 31,
        "NB_COMMUNES": 515,
        "POP": 6
    },
    {
        "CODE_REG": 26,
        "NOM_REGION": "Bourgogne",
        "CODE_DEPT": 89,
        "NOM_DEPT": "Yonne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 42,
        "NB_COMMUNES": 455,
        "POP": 1
    },
    {
        "CODE_REG": 43,
        "NOM_REGION": "Franche-Comté",
        "CODE_DEPT": 90,
        "NOM_DEPT": "Territoire de Belfort",
        "NB_ARRONDS": 1,
        "NB_CANTONS": 15,
        "NB_COMMUNES": 102,
        "POP": 5
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 91,
        "NOM_DEPT": "Essonne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 42,
        "NB_COMMUNES": 196,
        "POP": 3
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 92,
        "NOM_DEPT": "Hauts-de-Seine",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 45,
        "NB_COMMUNES": 36,
        "POP": 2
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 93,
        "NOM_DEPT": "Seine-Saint-Denis",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 40,
        "POP": 6
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 94,
        "NOM_DEPT": "Val-de-Marne",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 49,
        "NB_COMMUNES": 47,
        "POP": 0
    },
    {
        "CODE_REG": 11,
        "NOM_REGION": "Île-de-France",
        "CODE_DEPT": 95,
        "NOM_DEPT": "Val-d'Oise",
        "NB_ARRONDS": 3,
        "NB_CANTONS": 39,
        "NB_COMMUNES": 185,
        "POP": 4
    },
    {
        "CODE_REG": 1,
        "NOM_REGION": "Guadeloupe",
        "CODE_DEPT": 971,
        "NOM_DEPT": "Guadeloupe",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 40,
        "NB_COMMUNES": 32,
        "POP": 4
    },
    {
        "CODE_REG": 2,
        "NOM_REGION": "Martinique",
        "CODE_DEPT": 972,
        "NOM_DEPT": "Martinique",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 45,
        "NB_COMMUNES": 34,
        "POP": 3
    },
    {
        "CODE_REG": 3,
        "NOM_REGION": "Guyane",
        "CODE_DEPT": 973,
        "NOM_DEPT": "Guyane",
        "NB_ARRONDS": 2,
        "NB_CANTONS": 19,
        "NB_COMMUNES": 22,
        "POP": 0
    },
    {
        "CODE_REG": 4,
        "NOM_REGION": "La Réunion",
        "CODE_DEPT": 974,
        "NOM_DEPT": "La Réunion",
        "NB_ARRONDS": 4,
        "NB_CANTONS": 49,
        "NB_COMMUNES": 24,
        "POP": 4
    }
]
/**
 * Paths of the fruit icon SVGs
 */

const detail_carrot = 'M 28.625 0 C 28.492188 0.00390625 28.359375 0.0351563 28.21875 0.0625 C 27.496094 0.207031 26.996094 0.515625 26.65625 0.84375 C 26.261719 0.734375 25.785156 0.699219 25.28125 0.84375 C 24.8125 0.976563 24.175781 1.316406 23.75 2.25 C 23.351563 3.121094 23.46875 3.839844 23.65625 4.28125 C 23.785156 4.585938 23.980469 4.84375 24.1875 5.0625 C 23.960938 5.296875 23.753906 5.578125 23.625 5.90625 C 23.417969 6.4375 23.441406 7 23.6875 7.53125 C 24.179688 8.585938 25.078125 8.929688 25.90625 8.96875 C 26 9.640625 26.335938 10.113281 26.875 10.3125 C 27.160156 10.421875 27.523438 10.457031 27.875 10.4375 C 27.898438 10.542969 27.925781 10.648438 27.96875 10.75 C 28.132813 11.140625 28.445313 11.4375 28.84375 11.59375 C 29.417969 11.820313 30.054688 11.652344 30.5625 11.40625 C 30.8125 11.734375 31.085938 12.207031 31.28125 12.78125 C 31.769531 11.652344 31.808594 10.714844 31.84375 9.875 C 31.890625 8.714844 31.96875 7.132813 33.3125 5.90625 C 33.757813 5.5 34.273438 5.179688 34.8125 4.96875 C 34.859375 4.820313 34.90625 4.671875 34.96875 4.53125 C 34.949219 4.492188 34.929688 4.445313 34.90625 4.40625 C 34.460938 3.582031 33.820313 3.179688 33.21875 3 C 33.171875 2.441406 33.027344 1.839844 32.59375 1.46875 C 31.996094 0.957031 31.261719 0.902344 30.65625 1 C 30.226563 0.460938 29.546875 -0.0351563 28.625 0 Z M 45.25 1.75 C 44.5625 1.75 44 2.050781 43.5625 2.40625 C 42.949219 1.851563 41.902344 1.554688 40.8125 2 C 40.257813 2.226563 39.851563 2.632813 39.625 3.1875 C 39.5 3.5 39.449219 3.824219 39.4375 4.15625 C 38.769531 4 38.050781 4.085938 37.5 4.46875 C 36.757813 4.988281 36.527344 5.800781 36.59375 6.65625 C 35.902344 6.613281 35.21875 6.863281 34.65625 7.375 C 33.929688 8.039063 33.882813 8.980469 33.84375 9.96875 C 33.769531 11.714844 33.632813 14.332031 29.90625 17.8125 C 26.894531 15.304688 23.488281 14.15625 21.375 14.15625 C 20.230469 14.15625 19.335938 14.460938 18.8125 15.0625 C 17.253906 16.851563 15.554688 19.242188 13.84375 21.84375 C 14.046875 22.394531 14.628906 23.015625 15 23.25 C 15.078125 23.300781 15.304688 23.394531 15.5 23.46875 C 16.617188 23.882813 18.671875 24.640625 20.25 27.875 C 20.492188 28.371094 20.308594 28.976563 19.8125 29.21875 C 19.671875 29.289063 19.523438 29.3125 19.375 29.3125 C 19.003906 29.3125 18.640625 29.105469 18.46875 28.75 C 17.242188 26.234375 15.753906 25.707031 14.78125 25.34375 C 14.449219 25.222656 14.160156 25.101563 13.90625 24.9375 C 13.539063 24.703125 13.046875 24.277344 12.625 23.71875 C 10.472656 27.125 8.382813 30.761719 6.71875 33.875 C 6.621094 34.058594 6.535156 34.226563 6.4375 34.40625 C 6.898438 34.898438 7.304688 35.183594 7.3125 35.1875 C 7.351563 35.214844 7.402344 35.25 7.4375 35.28125 C 7.601563 35.429688 7.890625 35.535156 8.21875 35.6875 C 9.160156 36.125 10.574219 36.800781 11.3125 39 C 11.488281 39.523438 11.210938 40.105469 10.6875 40.28125 C 10.582031 40.316406 10.480469 40.3125 10.375 40.3125 C 9.957031 40.3125 9.546875 40.074219 9.40625 39.65625 C 8.941406 38.269531 8.226563 37.898438 7.375 37.5 C 6.960938 37.304688 6.5 37.105469 6.125 36.78125 C 6.011719 36.703125 5.769531 36.523438 5.46875 36.25 C -0.101563 47.050781 0.941406 48.097656 1.40625 48.5625 C 1.691406 48.851563 2.128906 49 2.65625 49 C 4.945313 49 12.136719 45.828125 21.25 40.3125 C 20.730469 39.871094 20.429688 39.527344 20.40625 39.5 C 19.800781 38.902344 19.441406 38.222656 19.125 37.625 C 18.640625 36.714844 18.3125 36.09375 17.0625 35.65625 C 16.542969 35.472656 16.253906 34.925781 16.4375 34.40625 C 16.621094 33.886719 17.199219 33.59375 17.71875 33.78125 C 19.707031 34.476563 20.324219 35.652344 20.875 36.6875 C 21.152344 37.207031 21.425781 37.707031 21.875 38.15625 C 21.917969 38.207031 22.359375 38.714844 23.0625 39.21875 C 25.613281 37.632813 28.289063 35.851563 31.03125 33.9375 C 30.65625 33.585938 30.371094 33.285156 30.3125 33.21875 C 29.8125 32.71875 29.5 32.109375 29.1875 31.5 C 28.589844 30.328125 28.191406 29.53125 26.625 29.53125 C 26.070313 29.53125 25.625 29.085938 25.625 28.53125 C 25.625 27.976563 26.070313 27.53125 26.625 27.53125 C 29.414063 27.53125 30.3125 29.3125 30.96875 30.59375 C 31.222656 31.089844 31.445313 31.539063 31.75 31.84375 C 31.984375 32.097656 32.359375 32.4375 32.71875 32.75 C 33.429688 32.242188 34.125 31.746094 34.84375 31.21875 C 34.882813 31.1875 34.933594 31.160156 34.96875 31.125 C 35.980469 30.117188 36.117188 28.128906 35.34375 25.6875 C 34.621094 23.410156 33.214844 21.152344 31.40625 19.25 C 34.566406 16.832031 36.496094 16.46875 37.8125 16.46875 C 38.238281 16.46875 38.617188 16.5 38.96875 16.53125 C 39.328125 16.5625 39.652344 16.59375 39.96875 16.59375 C 40.667969 16.59375 41.601563 16.472656 42.5625 15.5625 C 43.191406 14.96875 43.410156 14.226563 43.40625 13.5 C 43.667969 13.558594 43.945313 13.59375 44.21875 13.59375 C 45.003906 13.59375 45.667969 13.296875 46.15625 12.75 C 46.558594 12.300781 46.765625 11.75 46.71875 11.15625 C 46.703125 10.964844 46.652344 10.773438 46.59375 10.59375 C 47.289063 10.449219 47.839844 10.035156 48.15625 9.40625 C 48.476563 8.769531 48.503906 8.101563 48.28125 7.46875 C 48.105469 6.96875 47.804688 6.5625 47.46875 6.25 C 47.742188 5.878906 47.96875 5.421875 48.03125 4.875 C 48.09375 4.34375 48.003906 3.53125 47.25 2.71875 C 46.648438 2.070313 45.972656 1.75 45.25 1.75 Z M 45.90625 15.28125 C 45.617188 15.390625 45.3125 15.480469 45 15.53125 C 44.753906 16.085938 44.394531 16.597656 43.9375 17.03125 C 42.273438 18.609375 40.539063 18.59375 39.96875 18.59375 C 39.582031 18.59375 39.210938 18.570313 38.75 18.53125 C 38.429688 18.5 38.136719 18.46875 37.8125 18.46875 C 37.722656 18.46875 37.601563 18.460938 37.46875 18.46875 C 37.96875 18.753906 38.355469 19.109375 38.625 19.375 C 38.359375 19.890625 38.167969 20.542969 38.40625 21.15625 C 38.5625 21.554688 38.859375 21.867188 39.25 22.03125 C 39.351563 22.074219 39.457031 22.101563 39.5625 22.125 C 39.542969 22.476563 39.582031 22.839844 39.6875 23.125 C 39.886719 23.667969 40.359375 24 41.03125 24.09375 C 41.070313 24.921875 41.414063 25.820313 42.46875 26.3125 C 43 26.5625 43.5625 26.582031 44.09375 26.375 C 44.421875 26.246094 44.703125 26.039063 44.9375 25.8125 C 45.15625 26.015625 45.414063 26.183594 45.71875 26.3125 C 45.953125 26.414063 46.257813 26.5 46.625 26.5 C 46.949219 26.5 47.339844 26.4375 47.75 26.25 C 48.683594 25.824219 49.023438 25.1875 49.15625 24.71875 C 49.300781 24.214844 49.265625 23.738281 49.15625 23.34375 C 49.484375 23.003906 49.792969 22.503906 49.9375 21.78125 C 50.160156 20.648438 49.613281 19.835938 49 19.34375 C 49.09375 18.742188 49.042969 18.007813 48.53125 17.40625 C 48.160156 16.972656 47.558594 16.828125 47 16.78125 C 46.847656 16.261719 46.519531 15.707031 45.90625 15.28125 Z'
const detail_celery = 'M 30.4375 2 C 29.386719 2 28.433594 2.464844 27.78125 3.25 C 26.496094 2.71875 24.929688 3.050781 23.96875 4.03125 C 22.417969 3.789063 20.917969 4.648438 20.28125 6 C 18.425781 6.085938 16.9375 7.625 16.9375 9.5 C 16.9375 9.671875 16.972656 9.859375 17 10.03125 C 16.339844 10.679688 15.9375 11.554688 15.9375 12.5 C 15.9375 13.878906 16.769531 15.089844 17.96875 15.65625 C 18.007813 16.542969 18.375 17.355469 19 17.96875 C 18.972656 18.140625 18.9375 18.328125 18.9375 18.5 C 18.9375 20.375 20.425781 21.914063 22.28125 22 C 22.824219 23.152344 23.96875 23.941406 25.28125 24 C 25.824219 25.152344 26.96875 25.941406 28.28125 26 C 28.824219 27.152344 29.96875 27.941406 31.28125 28 C 31.84375 29.199219 33.054688 30 34.4375 30 C 34.890625 30 35.363281 29.921875 35.78125 29.75 C 36.4375 30.53125 37.386719 31 38.4375 31 C 39.820313 31 41.0625 30.199219 41.625 29 C 43.429688 28.917969 44.855469 27.460938 44.9375 25.65625 C 46.136719 25.089844 46.9375 23.878906 46.9375 22.5 C 46.9375 22.046875 46.859375 21.605469 46.6875 21.1875 C 47.46875 20.535156 47.9375 19.550781 47.9375 18.5 C 47.9375 17.769531 47.722656 17.078125 47.3125 16.5 C 47.71875 15.921875 47.9375 15.230469 47.9375 14.5 C 47.9375 13.449219 47.472656 12.464844 46.6875 11.8125 C 46.859375 11.394531 46.9375 10.953125 46.9375 10.5 C 46.9375 9.121094 46.136719 7.910156 44.9375 7.34375 C 44.84375 5.316406 42.984375 3.707031 40.9375 4.03125 C 39.976563 3.050781 38.410156 2.71875 37.125 3.25 C 36.472656 2.464844 35.488281 2 34.4375 2 C 33.707031 2 33.015625 2.214844 32.4375 2.625 C 31.859375 2.214844 31.167969 2 30.4375 2 Z M 26.9375 10 C 27.492188 10 27.9375 10.449219 27.9375 11 C 27.9375 12.652344 26.589844 14 24.9375 14 C 24.386719 14 23.9375 13.550781 23.9375 13 C 23.9375 12.449219 24.386719 12 24.9375 12 C 25.488281 12 25.9375 11.550781 25.9375 11 C 25.9375 10.449219 26.382813 10 26.9375 10 Z M 37.9375 10 C 38.492188 10 38.9375 10.449219 38.9375 11 C 38.9375 13.207031 37.144531 15 34.9375 15 C 34.382813 15 33.9375 14.550781 33.9375 14 C 33.9375 13.449219 34.382813 13 34.9375 13 C 36.039063 13 36.9375 12.101563 36.9375 11 C 36.9375 10.449219 37.382813 10 37.9375 10 Z M 36.9375 19 C 37.492188 19 37.9375 19.449219 37.9375 20 C 37.9375 21.652344 36.589844 23 34.9375 23 C 34.382813 23 33.9375 22.550781 33.9375 22 C 33.9375 21.449219 34.382813 21 34.9375 21 C 35.488281 21 35.9375 20.550781 35.9375 20 C 35.9375 19.449219 36.382813 19 36.9375 19 Z M 17.09375 19.375 C 16.554688 19.808594 15.945313 20.277344 15.3125 20.78125 C 11.679688 23.671875 7.15625 27.28125 5.21875 29.21875 C 3.140625 31.296875 2 34.0625 2 37 C 2 39.9375 3.140625 42.703125 5.21875 44.78125 C 7.296875 46.859375 10.0625 48 13 48 C 15.9375 48 18.703125 46.859375 20.78125 44.78125 C 23.042969 42.519531 28.753906 35.417969 31.9375 31.375 C 31.226563 31.003906 30.613281 30.457031 30.125 29.8125 C 29.261719 29.589844 28.46875 29.183594 27.8125 28.59375 C 24.089844 32.574219 15.847656 40.941406 13.9375 39.03125 C 13.597656 38.625 21.414063 30.765625 25.28125 26.9375 C 24.84375 26.621094 24.457031 26.25 24.125 25.8125 C 23.402344 25.625 22.738281 25.292969 22.15625 24.84375 C 18.269531 28.449219 10.480469 35.5625 9.9375 35.03125 C 8.316406 33.410156 15.613281 26.714844 19.6875 23.21875 C 18.316406 22.402344 17.355469 21.007813 17.09375 19.375 Z'
const detail_corn = 'M 25 0 C 24.855469 0 24.707031 0.0234375 24.5625 0.03125 C 24.480469 0.0351563 24.394531 0.0234375 24.3125 0.03125 C 17.804688 0.632813 12.699219 9.863281 12.0625 21.9375 C 12.019531 22.769531 12 23.609375 12 24.46875 C 12.6875 24.878906 13.355469 25.304688 14 25.71875 C 15.082031 26.417969 16.132813 27.128906 17.09375 27.84375 C 17.074219 27.355469 17.046875 26.859375 17.03125 26.375 C 15.707031 25.734375 14.710938 24.992188 14 24.3125 C 14.003906 23.28125 14.050781 22.277344 14.125 21.28125 C 14.148438 21.320313 14.199219 21.332031 14.21875 21.375 C 14.265625 21.476563 14.960938 22.863281 17 24.09375 C 17.007813 22.816406 17.058594 21.542969 17.125 20.28125 C 15.949219 19.664063 15.070313 18.976563 14.4375 18.34375 C 14.566406 17.460938 14.726563 16.589844 14.90625 15.75 C 15.109375 16.101563 15.75 17.09375 17.25 18.0625 C 17.355469 16.769531 17.515625 15.511719 17.6875 14.28125 C 16.820313 13.773438 16.160156 13.210938 15.6875 12.71875 C 15.925781 11.953125 16.191406 11.203125 16.46875 10.5 C 16.609375 10.746094 17.039063 11.421875 18 12.125 C 18.234375 10.808594 18.53125 9.539063 18.84375 8.375 C 18.457031 8.117188 18.113281 7.878906 17.84375 7.625 C 18.191406 7.003906 18.554688 6.40625 18.9375 5.875 C 19.074219 6.027344 19.222656 6.195313 19.4375 6.375 C 19.699219 5.617188 19.980469 4.925781 20.28125 4.28125 C 21.722656 2.832031 23.320313 2 25 2 C 26.664063 2 28.257813 2.828125 29.6875 4.25 C 29.996094 4.90625 30.296875 5.601563 30.5625 6.375 C 30.777344 6.195313 30.925781 6.027344 31.0625 5.875 C 31.441406 6.398438 31.8125 6.980469 32.15625 7.59375 C 31.886719 7.847656 31.542969 8.117188 31.15625 8.375 C 31.46875 9.539063 31.734375 10.8125 31.96875 12.125 C 32.929688 11.421875 33.386719 10.75 33.53125 10.5 C 33.808594 11.203125 34.074219 11.953125 34.3125 12.71875 C 33.839844 13.210938 33.179688 13.773438 32.3125 14.28125 C 32.484375 15.511719 32.644531 16.769531 32.75 18.0625 C 34.273438 17.078125 34.902344 16.058594 35.09375 15.71875 C 35.277344 16.566406 35.433594 17.449219 35.5625 18.34375 C 34.929688 18.976563 34.050781 19.664063 32.875 20.28125 C 32.941406 21.546875 32.996094 22.816406 33 24.09375 C 35.039063 22.863281 35.730469 21.480469 35.78125 21.375 C 35.800781 21.335938 35.851563 21.316406 35.875 21.28125 C 35.949219 22.277344 35.996094 23.28125 36 24.3125 C 35.289063 24.992188 34.292969 25.734375 32.96875 26.375 C 32.949219 27.242188 32.910156 28.097656 32.875 28.9375 C 33.617188 28.632813 34.402344 28.398438 35.21875 28.21875 C 36.058594 28.046875 37.855469 27.878906 37.9375 27.875 C 37.984375 26.789063 38 25.667969 38 24.5 C 38 11.191406 32.648438 0.675781 25.6875 0.03125 C 25.605469 0.0234375 25.519531 0.0351563 25.4375 0.03125 C 25.292969 0.0234375 25.144531 0 25 0 Z M 24 2.40625 C 23.078125 3.140625 22.121094 4.875 21.28125 7.40625 C 22.003906 7.679688 22.894531 7.886719 24 7.96875 Z M 26 2.40625 L 26 7.96875 C 27.105469 7.886719 27.996094 7.679688 28.71875 7.40625 C 27.878906 4.875 26.921875 3.140625 26 2.40625 Z M 20.6875 9.3125 C 20.382813 10.464844 20.113281 11.726563 19.875 13.125 C 20.929688 13.546875 22.289063 13.875 24 13.96875 L 24 9.96875 C 22.691406 9.886719 21.589844 9.640625 20.6875 9.3125 Z M 29.3125 9.3125 C 28.410156 9.640625 27.308594 9.882813 26 9.96875 L 26 13.96875 C 27.710938 13.875 29.070313 13.546875 30.125 13.125 C 29.890625 11.726563 29.613281 10.464844 29.3125 9.3125 Z M 19.59375 15.15625 C 19.433594 16.375 19.285156 17.664063 19.1875 19.03125 C 20.4375 19.511719 22.03125 19.875 24 19.96875 L 24 15.96875 C 22.234375 15.882813 20.789063 15.582031 19.59375 15.15625 Z M 30.40625 15.15625 C 29.210938 15.582031 27.769531 15.878906 26 15.96875 L 26 19.96875 C 27.96875 19.875 29.5625 19.511719 30.8125 19.03125 C 30.714844 17.664063 30.566406 16.375 30.40625 15.15625 Z M 19.09375 21.125 C 19.046875 22.21875 19 23.328125 19 24.5 C 19 24.675781 18.996094 24.878906 19 25.0625 C 20.3125 25.542969 21.964844 25.878906 24 25.96875 L 24 21.96875 C 22.0625 21.882813 20.441406 21.578125 19.09375 21.125 Z M 30.90625 21.125 C 29.558594 21.578125 27.941406 21.882813 26 21.96875 L 26 25.96875 C 28.035156 25.878906 29.6875 25.542969 31 25.0625 C 31.003906 24.882813 31 24.679688 31 24.5 C 31 23.328125 30.953125 22.21875 30.90625 21.125 Z M 5.125 23 C 4.765625 22.960938 4.371094 23.121094 4.15625 23.4375 C 3.871094 23.863281 3.953125 24.421875 4.34375 24.75 C 6.90625 26.90625 7.988281 30.722656 9.125 34.75 C 11.144531 41.894531 13.433594 50 25 50 C 25.550781 50 26 49.554688 26 49 C 26 36.164063 19.382813 30.4375 5.46875 23.125 C 5.355469 23.066406 5.246094 23.011719 5.125 23 Z M 30.9375 27.15625 C 29.566406 27.582031 27.933594 27.890625 26 27.96875 L 26 31.96875 C 26.871094 31.929688 27.675781 31.84375 28.40625 31.71875 C 29.164063 31.082031 29.96875 30.488281 30.84375 29.96875 C 30.882813 29.074219 30.910156 28.109375 30.9375 27.15625 Z M 19.0625 27.1875 C 19.089844 27.964844 19.113281 28.742188 19.15625 29.5 C 20 30.21875 20.777344 30.929688 21.5 31.6875 C 22.257813 31.820313 23.09375 31.929688 24 31.96875 L 24 27.96875 C 22.070313 27.890625 20.433594 27.613281 19.0625 27.1875 Z M 38.1875 29.875 C 32.367188 29.875 28.125 34.199219 25.6875 37.625 C 27.214844 40.828125 28 44.523438 28 49 C 28 49.28125 27.949219 49.550781 27.875 49.8125 C 34.816406 48.882813 36.71875 44.546875 38.40625 40.65625 C 39.820313 37.394531 41.0625 34.585938 45.15625 34 C 45.574219 33.941406 45.882813 33.632813 45.96875 33.21875 C 46.054688 32.804688 45.890625 32.378906 45.53125 32.15625 C 43.074219 30.644531 40.597656 29.875 38.1875 29.875 Z'
const detail_eggplant = 'M 46.15625 1.0625 C 45.914063 1.117188 45.679688 1.277344 45.53125 1.5 C 45.507813 1.535156 43.273438 4.902344 40.59375 7.15625 C 40.300781 7.152344 39.992188 7.148438 39.65625 7.125 C 39.164063 7.089844 38.617188 7.03125 38.0625 7.03125 C 36.207031 7.03125 33.460938 7.433594 31 10.75 C 32.382813 11.574219 34.496094 11.660156 38.40625 11 C 36.839844 12.566406 36.40625 16.78125 36.40625 16.78125 C 36.40625 16.78125 39.535156 16.527344 41.5625 14.5 C 41.296875 16.550781 43.4375 19.023438 44.5 20.40625 C 44.546875 20.347656 44.59375 20.289063 44.625 20.21875 C 47.039063 15.078125 45.6875 11.898438 45.03125 10.46875 C 47.882813 7.066406 48.925781 3.441406 48.96875 3.28125 C 49.089844 2.84375 48.890625 2.355469 48.5 2.125 L 46.875 1.1875 C 46.644531 1.050781 46.398438 1.007813 46.15625 1.0625 Z M 29.59375 12.21875 C 28.515625 13.230469 27.402344 14.402344 26.28125 15.625 C 24.441406 17.628906 22.53125 19.695313 20.5 21.21875 C 17.675781 23.335938 14.675781 24.421875 11.75 25.46875 C 6.226563 27.445313 1 29.324219 1 38 C 1 44.066406 5.933594 49 12 49 C 26.734375 49 40.335938 34.183594 43.65625 22.5625 L 42.9375 21.625 L 42.59375 21.21875 C 41.859375 20.28125 40.925781 19.085938 40.28125 17.75 C 38.472656 18.582031 36.824219 18.730469 36.5625 18.75 L 34.1875 18.9375 L 34.40625 16.5625 C 34.449219 16.144531 34.625 14.839844 35.03125 13.40625 C 34.753906 13.417969 34.472656 13.4375 34.21875 13.4375 C 32.449219 13.4375 31.097656 13.140625 29.96875 12.46875 Z M 31.1875 18.75 C 31.4375 18.703125 31.710938 18.777344 31.9375 18.9375 C 32.390625 19.253906 32.503906 19.859375 32.1875 20.3125 C 31.894531 20.734375 24.882813 30.695313 11.59375 33.71875 C 11.519531 33.738281 11.449219 33.75 11.375 33.75 C 10.917969 33.75 10.511719 33.433594 10.40625 32.96875 C 10.285156 32.429688 10.617188 31.902344 11.15625 31.78125 C 23.699219 28.925781 30.496094 19.285156 30.5625 19.1875 C 30.71875 18.960938 30.9375 18.796875 31.1875 18.75 Z'
const detail_mushroom = 'M 26.8125 3 C 26.015625 3 25.207031 3.050781 24.40625 3.125 C 11.128906 4.34375 3 15.464844 3 21.125 C 3 26.292969 8.488281 27 13.84375 27 C 16.597656 27 19.800781 26.78125 23.1875 26.5625 L 24.84375 26.46875 C 38.527344 25.601563 47 23.652344 47 16.6875 C 47 11.234375 38.949219 3 26.8125 3 Z M 34.21875 27.5625 C 31.289063 27.996094 28.140625 28.269531 24.96875 28.46875 L 23.3125 28.5625 C 22.1875 28.636719 21.078125 28.71875 20 28.78125 C 19.53125 33.21875 18.402344 39.214844 15.65625 43.34375 C 14.792969 44.644531 14.945313 45.523438 15.21875 46.03125 C 15.414063 46.394531 15.910156 47 17.09375 47 L 31.65625 47 C 33.230469 47 33.710938 46.066406 33.96875 45.09375 C 34.472656 43.234375 35.835938 36.824219 34.21875 27.5625 Z'
const detail_olive = 'M 25.0625 2 C 24.90625 2.023438 24.757813 2.09375 24.625 2.1875 C 24.359375 2.375 24.1875 2.675781 24.1875 3 C 24.1875 7.292969 25.183594 11.023438 26.34375 13.9375 C 27.644531 15.085938 28.808594 16.417969 29.90625 17.9375 C 31.058594 17.371094 32.21875 16.886719 33.3125 16.46875 C 34.054688 13.238281 33.523438 10.667969 32.8125 8.90625 C 31.53125 5.726563 28.886719 3.226563 25.53125 2.0625 C 25.378906 2.011719 25.21875 1.976563 25.0625 2 Z M 7 10 C 6.667969 10 6.34375 10.164063 6.15625 10.4375 C 5.96875 10.710938 5.941406 11.066406 6.0625 11.375 C 9.816406 20.757813 18.289063 22.15625 23 22.15625 C 23.113281 22.15625 23.203125 22.15625 23.3125 22.15625 C 24.867188 20.875 26.492188 19.789063 28.125 18.875 C 23.507813 12.597656 17.277344 10 7 10 Z M 42.8125 16.03125 C 42.488281 16.066406 37.371094 16.683594 31.625 19.34375 C 31.40625 19.445313 31.191406 19.546875 30.96875 19.65625 C 30.363281 19.949219 29.734375 20.25 29.125 20.59375 C 29 20.664063 28.875 20.742188 28.75 20.8125 C 28.507813 20.953125 28.273438 21.101563 28.03125 21.25 C 27.726563 21.4375 27.425781 21.613281 27.125 21.8125 C 27.160156 21.804688 27.152344 21.820313 27.1875 21.8125 C 26.03125 22.570313 24.894531 23.410156 23.8125 24.375 C 24.335938 24.800781 24.789063 25.269531 25.21875 25.78125 C 32.644531 19.246094 42.921875 18.011719 43.03125 18 C 43.582031 17.9375 44 17.457031 43.9375 16.90625 C 43.875 16.359375 43.371094 15.972656 42.8125 16.03125 Z M 37.375 22 C 36.714844 21.980469 36.070313 22.039063 35.40625 22.1875 C 32.785156 22.765625 30.605469 24.566406 29.28125 27.25 C 27.996094 29.859375 27.65625 33.011719 28.34375 36.125 C 29.625 41.917969 34.117188 46 38.84375 46 C 39.429688 46 40.039063 45.941406 40.625 45.8125 C 43.242188 45.234375 45.394531 43.433594 46.71875 40.75 C 48.003906 38.140625 48.34375 34.988281 47.65625 31.875 C 46.398438 26.179688 42.007813 22.132813 37.375 22 Z M 16.65625 24 C 16.039063 24.019531 15.410156 24.109375 14.78125 24.25 C 11.464844 24.980469 8.390625 27.253906 6.34375 30.46875 C 2.609375 36.335938 3.445313 43.570313 8.21875 46.625 C 9.621094 47.523438 11.269531 48 13 48 C 13.726563 48 14.476563 47.914063 15.21875 47.75 C 18.535156 47.019531 21.609375 44.75 23.65625 41.53125 C 27.390625 35.664063 26.554688 28.425781 21.78125 25.375 C 20.289063 24.417969 18.511719 23.9375 16.65625 24 Z M 35.4375 27.34375 C 35.828125 27.335938 36.175781 27.558594 36.34375 27.9375 C 36.570313 28.441406 36.347656 29.023438 35.84375 29.25 C 35.332031 29.480469 34.949219 29.972656 34.78125 30.625 C 34.589844 31.359375 34.679688 32.183594 35.03125 32.96875 C 35.300781 33.574219 35.703125 34.105469 36.1875 34.46875 C 36.628906 34.800781 36.738281 35.402344 36.40625 35.84375 C 36.210938 36.105469 35.898438 36.25 35.59375 36.25 C 35.382813 36.25 35.179688 36.199219 35 36.0625 C 34.246094 35.496094 33.625 34.691406 33.21875 33.78125 C 32.683594 32.582031 32.570313 31.296875 32.875 30.125 C 33.199219 28.871094 33.953125 27.917969 35.03125 27.4375 C 35.160156 27.378906 35.308594 27.347656 35.4375 27.34375 Z M 14.84375 28.9375 C 15.539063 28.914063 16.214844 29.105469 16.78125 29.46875 C 17.246094 29.765625 17.390625 30.378906 17.09375 30.84375 C 16.796875 31.308594 16.183594 31.453125 15.71875 31.15625 C 15.328125 30.90625 14.890625 30.902344 14.59375 30.96875 C 13.941406 31.113281 13.300781 31.613281 12.875 32.28125 C 12.445313 32.957031 12.253906 33.746094 12.40625 34.40625 C 12.53125 34.945313 12.195313 35.5 11.65625 35.625 C 11.582031 35.644531 11.511719 35.65625 11.4375 35.65625 C 10.984375 35.65625 10.574219 35.335938 10.46875 34.875 C 10.195313 33.6875 10.464844 32.355469 11.1875 31.21875 C 11.902344 30.097656 12.976563 29.292969 14.15625 29.03125 C 14.390625 28.980469 14.613281 28.945313 14.84375 28.9375 Z'
const detail_tomato = 'M 28.96875 0.125 C 28.304688 0.152344 27.78125 0.3125 27.78125 0.3125 C 27.78125 0.3125 24.828125 1.832031 23.78125 6.375 C 18.96875 2.25 15.359375 7.320313 13.40625 2.28125 C 13.40625 10.320313 17.808594 8.390625 20.15625 9.40625 C 12.773438 8.796875 16.734375 15.085938 11.375 16.15625 C 16.457031 18.40625 21.429688 18.753906 23.28125 13.78125 C 22.988281 15.726563 21.710938 19.625 28.0625 23.4375 C 29.640625 18.367188 31.023438 17.421875 28.75 13.0625 C 31.859375 17.054688 34.496094 19.164063 40.03125 15.65625 C 35.59375 14.496094 37.699219 11.453125 32.1875 10.5 C 36.320313 10.671875 37.730469 10.953125 39.59375 6.03125 C 35.535156 7.570313 33.757813 1.382813 27.65625 6.625 C 27.632813 6.640625 27.316406 4.027344 31 0.75 C 30.4375 0.203125 29.632813 0.0976563 28.96875 0.125 Z M 12.09375 6.84375 C 4.273438 9.679688 0 16.507813 0 26.28125 C 0 39.140625 11.449219 50 25 50 C 37.039063 50 50 41.820313 50 23.875 C 50 15.785156 46.820313 10.222656 41 7.875 C 40.160156 9.785156 39.257813 10.996094 38.0625 11.71875 C 38.148438 11.835938 38.234375 11.949219 38.3125 12.0625 C 38.886719 12.890625 39.1875 13.367188 40.53125 13.71875 C 41.300781 13.917969 41.910156 14.558594 42.03125 15.34375 C 42.152344 16.128906 41.796875 16.917969 41.125 17.34375 C 38.898438 18.753906 36.921875 19.4375 35.09375 19.4375 C 33.847656 19.4375 32.734375 19.109375 31.75 18.59375 C 31.5625 19.464844 31.253906 20.371094 30.875 21.40625 C 30.597656 22.164063 30.285156 23.007813 29.96875 24.03125 C 29.785156 24.617188 29.355469 25.09375 28.78125 25.3125 C 28.550781 25.402344 28.300781 25.4375 28.0625 25.4375 C 27.703125 25.4375 27.347656 25.347656 27.03125 25.15625 C 23.5625 23.074219 22.015625 20.882813 21.375 18.90625 C 20.28125 19.449219 19.023438 19.71875 17.625 19.71875 C 15.585938 19.71875 13.1875 19.128906 10.5625 17.96875 C 9.765625 17.617188 9.3125 16.804688 9.40625 15.9375 C 9.5 15.070313 10.144531 14.359375 11 14.1875 C 12.21875 13.945313 12.433594 13.460938 12.9375 12 C 13.175781 11.3125 13.46875 10.457031 14.03125 9.65625 C 13.265625 9.0625 12.570313 8.152344 12.09375 6.84375 Z'

const stroke_carrot = 'M 28.597656 0.0078125 C 28.476563 0.0117188 28.355469 0.0273438 28.230469 0.0507813 C 27.511719 0.191406 27.03125 0.578125 26.679688 0.929688 C 26.480469 0.855469 26.492188 0.796875 26.222656 0.765625 C 25.835938 0.714844 25.34375 0.746094 24.875 0.992188 C 24.402344 1.238281 24 1.683594 23.738281 2.25 L 23.742188 2.25 C 23.472656 2.847656 23.425781 3.488281 23.578125 4.015625 C 23.714844 4.476563 23.988281 4.789063 24.25 5.058594 C 24.027344 5.28125 23.789063 5.507813 23.640625 5.878906 C 23.457031 6.347656 23.449219 6.976563 23.703125 7.519531 C 24.179688 8.546875 25.21875 8.921875 25.953125 8.953125 C 25.964844 9.085938 25.953125 9.199219 26.003906 9.351563 C 26.109375 9.679688 26.378906 10.132813 26.878906 10.316406 C 27.328125 10.484375 27.59375 10.382813 27.902344 10.34375 C 27.917969 10.453125 27.890625 10.535156 27.9375 10.660156 C 28.066406 11.019531 28.40625 11.421875 28.84375 11.59375 C 29.632813 11.902344 30.148438 11.605469 30.546875 11.394531 C 30.828125 11.757813 31.15625 12.273438 31.359375 12.964844 C 31.699219 14.144531 31.679688 15.707031 29.847656 17.765625 C 28.011719 16.246094 26.023438 15.207031 24.234375 14.640625 C 23.136719 14.296875 22.113281 14.121094 21.203125 14.144531 C 20.289063 14.171875 19.425781 14.375 18.828125 15.0625 C 15.121094 19.320313 10.402344 27 6.734375 33.863281 C 4.898438 37.296875 3.332031 40.511719 2.304688 43 C 1.789063 44.242188 1.40625 45.300781 1.191406 46.152344 C 1.082031 46.578125 1.011719 46.949219 1 47.316406 C 0.992188 47.6875 0.980469 48.128906 1.414063 48.566406 C 1.417969 48.566406 1.417969 48.566406 1.417969 48.566406 C 1.753906 48.902344 2.121094 48.96875 2.429688 48.992188 C 2.734375 49.015625 3.027344 48.988281 3.351563 48.933594 C 4.007813 48.824219 4.785156 48.597656 5.71875 48.261719 C 7.589844 47.589844 10.078125 46.472656 13.03125 44.945313 C 18.941406 41.890625 26.703125 37.199219 34.851563 31.207031 C 34.890625 31.179688 34.929688 31.148438 34.96875 31.109375 C 35.59375 30.484375 35.804688 29.625 35.828125 28.707031 C 35.851563 27.792969 35.679688 26.773438 35.332031 25.683594 C 34.679688 23.617188 33.382813 21.308594 31.433594 19.25 C 33.855469 17.511719 35.582031 17.664063 36.859375 18.171875 C 37.742188 18.527344 38.28125 19.003906 38.640625 19.375 C 38.425781 19.78125 38.082031 20.324219 38.40625 21.15625 C 38.578125 21.59375 38.980469 21.933594 39.339844 22.0625 C 39.464844 22.109375 39.546875 22.082031 39.65625 22.097656 C 39.617188 22.40625 39.515625 22.671875 39.683594 23.117188 C 39.867188 23.617188 40.320313 23.890625 40.644531 23.996094 C 40.800781 24.046875 40.914063 24.035156 41.046875 24.046875 C 41.078125 24.78125 41.457031 25.820313 42.480469 26.296875 C 43.023438 26.550781 43.652344 26.539063 44.121094 26.355469 C 44.492188 26.207031 44.71875 25.972656 44.941406 25.75 C 45.210938 26.011719 45.523438 26.285156 45.984375 26.421875 C 46.511719 26.574219 47.152344 26.527344 47.75 26.257813 C 48.316406 25.996094 48.761719 25.597656 49.007813 25.125 C 49.253906 24.652344 49.285156 24.164063 49.234375 23.777344 C 49.203125 23.507813 49.144531 23.519531 49.066406 23.320313 C 49.421875 22.96875 49.808594 22.488281 49.949219 21.769531 C 50.148438 20.765625 49.640625 19.898438 49.160156 19.46875 C 49.089844 19.402344 49.085938 19.425781 49.011719 19.375 C 49.121094 18.8125 49.101563 18.097656 48.519531 17.417969 C 47.980469 16.78125 47.429688 16.789063 46.984375 16.777344 C 46.8125 16.207031 46.394531 15.511719 45.585938 15.078125 C 44.480469 14.480469 43.605469 14.734375 42.96875 15.0625 C 43.285156 14.539063 43.34375 13.960938 43.328125 13.425781 C 43.6875 13.515625 44.042969 13.617188 44.46875 13.582031 C 45.042969 13.535156 45.695313 13.28125 46.164063 12.757813 C 46.609375 12.261719 46.769531 11.574219 46.695313 11.027344 C 46.667969 10.835938 46.5625 10.726563 46.503906 10.5625 C 46.617188 10.542969 46.707031 10.578125 46.828125 10.542969 C 47.332031 10.386719 47.859375 9.992188 48.144531 9.421875 C 48.445313 8.824219 48.492188 8.164063 48.339844 7.628906 C 48.1875 7.09375 47.886719 6.691406 47.59375 6.390625 C 47.5 6.296875 47.488281 6.332031 47.398438 6.253906 C 47.5 6.132813 47.527344 6.171875 47.621094 6.023438 C 47.859375 5.632813 48.066406 5.117188 48.046875 4.515625 C 48.027344 3.910156 47.75 3.265625 47.25 2.726563 C 46.714844 2.148438 46.0625 1.804688 45.417969 1.757813 C 44.773438 1.710938 44.21875 1.945313 43.816406 2.21875 C 43.660156 2.320313 43.707031 2.355469 43.578125 2.46875 C 43.011719 1.945313 41.933594 1.539063 40.824219 1.992188 C 40.1875 2.25 39.738281 2.820313 39.566406 3.355469 C 39.464844 3.675781 39.511719 3.949219 39.515625 4.238281 C 39.363281 4.195313 39.253906 4.121094 39.082031 4.101563 C 38.597656 4.046875 38.003906 4.136719 37.503906 4.484375 C 36.941406 4.878906 36.660156 5.53125 36.609375 6.082031 C 36.582031 6.324219 36.660156 6.511719 36.6875 6.726563 C 36.5625 6.714844 36.480469 6.648438 36.347656 6.652344 C 35.847656 6.671875 35.3125 6.871094 34.84375 7.230469 C 34.84375 7.230469 34.84375 7.226563 34.84375 7.226563 C 35.21875 6.5625 35.566406 5.613281 34.921875 4.414063 C 34.488281 3.605469 33.792969 3.183594 33.21875 3.015625 C 33.210938 2.570313 33.21875 2.019531 32.582031 1.476563 C 31.898438 0.898438 31.183594 0.878906 30.625 0.988281 C 30.570313 0.914063 30.597656 0.910156 30.53125 0.835938 C 30.152344 0.421875 29.441406 -0.0234375 28.597656 0.0078125 Z M 28.617188 2.015625 C 28.878906 1.960938 28.90625 2.023438 29.050781 2.179688 C 29.195313 2.339844 29.269531 2.523438 29.269531 2.523438 C 29.371094 2.792969 29.582031 3.007813 29.851563 3.109375 C 30.121094 3.210938 30.421875 3.195313 30.675781 3.058594 C 30.675781 3.058594 30.980469 2.960938 31.167969 2.96875 C 31.191406 3.03125 31.230469 3.128906 31.234375 3.25 C 31.25 3.523438 31.21875 3.78125 31.21875 3.78125 C 31.183594 4.09375 31.296875 4.40625 31.527344 4.625 C 31.757813 4.839844 32.078125 4.9375 32.390625 4.882813 C 32.390625 4.882813 32.464844 4.867188 32.636719 4.910156 C 32.804688 4.953125 32.96875 5.003906 33.160156 5.359375 C 33.445313 5.886719 32.84375 6.734375 32.84375 6.734375 C 32.664063 6.949219 32.582031 7.226563 32.617188 7.503906 C 32.652344 7.78125 32.804688 8.03125 33.03125 8.191406 C 33.03125 8.191406 33.570313 8.5625 33.707031 9.40625 C 33.730469 9.542969 33.78125 9.675781 33.855469 9.789063 C 33.828125 10.386719 33.8125 11.003906 33.6875 11.710938 C 33.625 12.082031 33.523438 12.480469 33.386719 12.902344 C 33.351563 12.734375 33.324219 12.566406 33.28125 12.410156 C 32.726563 10.492188 31.390625 9.359375 31.390625 9.359375 C 31.027344 9.046875 30.5 9.03125 30.125 9.320313 C 30.125 9.320313 30.011719 9.390625 29.960938 9.425781 C 30.035156 9.082031 29.921875 8.726563 29.667969 8.484375 C 29.410156 8.246094 29.046875 8.15625 28.707031 8.253906 C 28.707031 8.253906 28.441406 8.328125 28.125 8.382813 C 28 8.40625 28.019531 8.410156 27.90625 8.40625 C 27.921875 8.230469 27.953125 8.027344 27.953125 8.027344 C 28.03125 7.667969 27.90625 7.296875 27.628906 7.054688 C 27.351563 6.816406 26.960938 6.746094 26.621094 6.875 C 26.621094 6.875 26.335938 6.972656 26.046875 6.96875 C 25.757813 6.964844 25.664063 6.992188 25.515625 6.671875 C 25.476563 6.589844 25.488281 6.652344 25.5 6.617188 C 25.515625 6.578125 25.589844 6.46875 25.71875 6.355469 C 25.980469 6.132813 26.34375 5.964844 26.34375 5.964844 C 26.726563 5.804688 26.96875 5.429688 26.957031 5.015625 C 26.949219 4.601563 26.683594 4.238281 26.296875 4.101563 C 26.296875 4.101563 25.9375 3.953125 25.703125 3.734375 C 25.582031 3.628906 25.519531 3.527344 25.5 3.453125 C 25.476563 3.378906 25.457031 3.3125 25.5625 3.082031 C 25.675781 2.828125 25.757813 2.789063 25.796875 2.765625 C 25.832031 2.746094 25.882813 2.738281 25.984375 2.75 C 26.183594 2.773438 26.433594 2.914063 26.433594 2.914063 C 26.683594 3.082031 26.996094 3.128906 27.285156 3.039063 C 27.574219 2.949219 27.804688 2.738281 27.917969 2.457031 C 27.917969 2.457031 27.964844 2.144531 28.617188 2.015625 Z M 42.03125 3.742188 C 42.117188 3.769531 42.15625 3.839844 42.242188 3.921875 C 42.410156 4.09375 42.515625 4.34375 42.515625 4.34375 C 42.640625 4.710938 42.972656 4.976563 43.359375 5.015625 C 43.746094 5.054688 44.125 4.863281 44.324219 4.53125 C 44.324219 4.53125 44.617188 4.089844 44.929688 3.878906 C 45.085938 3.773438 45.195313 3.746094 45.277344 3.75 C 45.359375 3.757813 45.5 3.777344 45.785156 4.085938 C 46.027344 4.34375 46.042969 4.472656 46.046875 4.578125 C 46.050781 4.683594 46.011719 4.816406 45.914063 4.976563 C 45.71875 5.300781 45.347656 5.574219 45.347656 5.574219 C 45.046875 5.777344 44.878906 6.125 44.910156 6.488281 C 44.9375 6.847656 45.164063 7.164063 45.492188 7.3125 C 45.492188 7.3125 45.886719 7.511719 46.164063 7.792969 C 46.304688 7.933594 46.386719 8.078125 46.414063 8.171875 C 46.441406 8.265625 46.457031 8.324219 46.359375 8.523438 C 46.308594 8.625 46.316406 8.605469 46.234375 8.632813 C 46.148438 8.660156 45.957031 8.671875 45.738281 8.640625 C 45.308594 8.578125 44.875 8.378906 44.875 8.378906 C 44.421875 8.15625 43.871094 8.3125 43.597656 8.738281 C 43.324219 9.167969 43.414063 9.730469 43.808594 10.050781 C 43.808594 10.050781 44.21875 10.402344 44.488281 10.808594 C 44.625 11.007813 44.699219 11.207031 44.714844 11.296875 C 44.726563 11.382813 44.75 11.339844 44.671875 11.421875 C 44.566406 11.542969 44.492188 11.574219 44.308594 11.589844 C 44.121094 11.601563 43.835938 11.5625 43.554688 11.46875 C 42.988281 11.285156 42.496094 10.957031 42.496094 10.957031 C 42.109375 10.699219 41.597656 10.738281 41.257813 11.050781 C 40.914063 11.363281 40.835938 11.871094 41.0625 12.277344 C 41.0625 12.277344 41.261719 12.648438 41.359375 13.105469 C 41.453125 13.558594 41.433594 13.878906 41.183594 14.117188 C 40.730469 14.546875 40.511719 14.585938 40.035156 14.59375 C 39.5625 14.605469 38.84375 14.476563 37.890625 14.46875 C 36.964844 14.460938 35.832031 14.632813 34.484375 15.152344 C 35.082031 14.027344 35.5 12.957031 35.65625 12.058594 C 35.839844 11.027344 35.832031 10.167969 35.867188 9.59375 C 35.902344 9.019531 35.980469 8.875 36 8.855469 C 36.199219 8.675781 36.304688 8.65625 36.433594 8.648438 C 36.558594 8.644531 36.730469 8.683594 36.910156 8.773438 C 37.277344 8.957031 37.578125 9.273438 37.578125 9.273438 C 37.925781 9.65625 38.503906 9.71875 38.917969 9.410156 C 39.335938 9.105469 39.449219 8.53125 39.183594 8.089844 C 39.183594 8.089844 38.871094 7.558594 38.703125 6.992188 C 38.617188 6.707031 38.582031 6.425781 38.597656 6.277344 C 38.613281 6.128906 38.609375 6.15625 38.65625 6.125 C 38.703125 6.085938 38.734375 6.074219 38.867188 6.089844 C 39 6.105469 39.210938 6.171875 39.417969 6.277344 C 39.828125 6.488281 40.167969 6.789063 40.167969 6.789063 C 40.515625 7.105469 41.039063 7.136719 41.425781 6.863281 C 41.808594 6.585938 41.949219 6.078125 41.753906 5.644531 C 41.753906 5.644531 41.53125 5.105469 41.457031 4.578125 C 41.421875 4.3125 41.441406 4.070313 41.472656 3.964844 C 41.507813 3.859375 41.476563 3.882813 41.578125 3.84375 C 41.828125 3.742188 41.949219 3.71875 42.03125 3.742188 Z M 21.257813 16.144531 C 21.859375 16.128906 22.699219 16.253906 23.636719 16.550781 C 25.507813 17.140625 27.777344 18.398438 29.679688 20.304688 C 29.679688 20.304688 29.679688 20.304688 29.683594 20.304688 C 31.589844 22.210938 32.839844 24.4375 33.425781 26.285156 C 33.722656 27.210938 33.84375 28.042969 33.828125 28.65625 C 33.8125 29.25 33.648438 29.574219 33.5625 29.671875 C 32.820313 30.214844 32.085938 30.738281 31.351563 31.261719 C 31.082031 30.785156 30.792969 30.167969 30.359375 29.5 C 29.710938 28.507813 28.484375 27.546875 26.621094 27.546875 C 26.257813 27.539063 25.921875 27.730469 25.742188 28.039063 C 25.558594 28.351563 25.558594 28.738281 25.742188 29.050781 C 25.921875 29.359375 26.257813 29.550781 26.621094 29.546875 C 27.921875 29.546875 28.242188 29.917969 28.6875 30.59375 C 28.996094 31.074219 29.253906 31.753906 29.6875 32.429688 C 26.878906 34.386719 24.144531 36.175781 21.558594 37.777344 C 21.175781 37.273438 20.933594 36.71875 20.535156 36.050781 C 20.042969 35.214844 19.207031 34.300781 17.726563 33.78125 C 17.601563 33.734375 17.46875 33.714844 17.332031 33.71875 C 16.851563 33.742188 16.457031 34.105469 16.390625 34.582031 C 16.324219 35.058594 16.609375 35.515625 17.0625 35.667969 C 18.148438 36.046875 18.445313 36.441406 18.816406 37.070313 C 19.089844 37.53125 19.359375 38.160156 19.835938 38.824219 C 17.03125 40.511719 14.417969 41.976563 12.113281 43.167969 C 9.210938 44.667969 6.777344 45.757813 5.039063 46.378906 C 4.195313 46.683594 3.527344 46.867188 3.078125 46.945313 C 3.097656 46.835938 3.09375 46.785156 3.132813 46.644531 C 3.304688 45.957031 3.660156 44.960938 4.152344 43.765625 C 4.878906 42.007813 5.914063 39.8125 7.128906 37.425781 C 7.472656 37.589844 7.792969 37.710938 8.066406 37.875 C 8.609375 38.195313 9.050781 38.5625 9.414063 39.640625 C 9.589844 40.164063 10.15625 40.445313 10.679688 40.269531 C 11.203125 40.09375 11.484375 39.527344 11.308594 39.003906 C 10.808594 37.515625 9.90625 36.640625 9.089844 36.15625 C 8.699219 35.921875 8.351563 35.757813 8.070313 35.621094 C 8.214844 35.347656 8.347656 35.082031 8.496094 34.808594 C 10.199219 31.625 12.148438 28.257813 14.09375 25.15625 C 14.320313 25.324219 14.558594 25.429688 14.777344 25.527344 C 15.164063 25.695313 15.554688 25.84375 15.964844 26.054688 C 16.777344 26.480469 17.664063 27.125 18.460938 28.761719 C 18.613281 29.09375 18.929688 29.316406 19.292969 29.34375 C 19.65625 29.375 20.003906 29.203125 20.207031 28.898438 C 20.40625 28.597656 20.425781 28.207031 20.257813 27.886719 C 19.28125 25.882813 17.964844 24.84375 16.890625 24.28125 C 16.355469 24.003906 15.882813 23.828125 15.582031 23.695313 C 15.28125 23.5625 15.238281 23.460938 15.316406 23.597656 C 15.285156 23.539063 15.246094 23.484375 15.199219 23.433594 C 17.019531 20.632813 18.804688 18.136719 20.335938 16.375 C 20.367188 16.34375 20.65625 16.164063 21.257813 16.144531 Z M 37.933594 16.472656 C 38.664063 16.484375 39.316406 16.613281 40.078125 16.59375 C 40.292969 16.589844 40.519531 16.5625 40.746094 16.515625 C 40.773438 16.519531 40.800781 16.527344 40.828125 16.53125 C 41.382813 16.617188 41.917969 17.09375 41.917969 17.09375 C 42.28125 17.464844 42.867188 17.492188 43.265625 17.15625 C 43.265625 17.15625 44.113281 16.558594 44.640625 16.839844 C 44.996094 17.03125 45.046875 17.195313 45.089844 17.363281 C 45.132813 17.535156 45.121094 17.609375 45.121094 17.609375 C 45.066406 17.921875 45.160156 18.242188 45.375 18.46875 C 45.59375 18.699219 45.90625 18.8125 46.21875 18.777344 C 46.21875 18.777344 46.476563 18.75 46.75 18.761719 C 46.871094 18.765625 46.964844 18.808594 47.027344 18.832031 C 47.039063 19.023438 46.941406 19.324219 46.941406 19.324219 C 46.808594 19.578125 46.789063 19.878906 46.890625 20.148438 C 46.996094 20.417969 47.207031 20.628906 47.480469 20.730469 C 47.480469 20.730469 47.660156 20.804688 47.816406 20.949219 C 47.976563 21.09375 48.039063 21.117188 47.984375 21.378906 C 47.855469 22.035156 47.542969 22.078125 47.542969 22.078125 C 47.261719 22.191406 47.050781 22.425781 46.960938 22.714844 C 46.871094 23 46.917969 23.3125 47.085938 23.5625 C 47.085938 23.5625 47.226563 23.816406 47.25 24.015625 C 47.261719 24.117188 47.253906 24.167969 47.234375 24.203125 C 47.210938 24.242188 47.171875 24.320313 46.917969 24.4375 C 46.6875 24.542969 46.621094 24.519531 46.546875 24.5 C 46.472656 24.480469 46.371094 24.414063 46.265625 24.296875 C 46.046875 24.058594 45.902344 23.703125 45.902344 23.703125 C 45.761719 23.316406 45.398438 23.050781 44.984375 23.039063 C 44.570313 23.027344 44.195313 23.273438 44.035156 23.65625 C 44.035156 23.65625 43.867188 24.019531 43.644531 24.277344 C 43.53125 24.40625 43.421875 24.480469 43.386719 24.496094 C 43.347656 24.511719 43.410156 24.523438 43.328125 24.484375 C 43.007813 24.335938 43.035156 24.242188 43.03125 23.953125 C 43.027344 23.664063 43.125 23.378906 43.125 23.378906 C 43.253906 23.035156 43.183594 22.648438 42.945313 22.371094 C 42.703125 22.09375 42.332031 21.96875 41.972656 22.046875 C 41.972656 22.046875 41.769531 22.074219 41.59375 22.09375 C 41.589844 21.976563 41.59375 22 41.613281 21.875 C 41.671875 21.558594 41.746094 21.289063 41.746094 21.289063 C 41.84375 20.953125 41.753906 20.585938 41.515625 20.332031 C 41.273438 20.074219 40.917969 19.964844 40.574219 20.035156 C 40.609375 19.988281 40.675781 19.875 40.675781 19.875 C 40.945313 19.523438 40.953125 19.042969 40.703125 18.6875 C 40.703125 18.6875 39.722656 17.304688 37.933594 16.472656 Z'
const stroke_celery = 'M 30.5 2 C 29.351563 2 28.449219 2.671875 27.8125 3.53125 C 27.375 3.332031 27.011719 3 26.5 3 C 25.519531 3 24.695313 3.472656 24.0625 4.125 C 23.871094 4.089844 23.703125 4 23.5 4 C 22.152344 4 21.144531 4.875 20.5625 6 C 20.539063 6 20.523438 6 20.5 6 C 18.578125 6 17 7.578125 17 9.5 C 17 9.703125 17.089844 9.871094 17.125 10.0625 C 16.472656 10.695313 16 11.519531 16 12.5 C 16 13.847656 16.875 14.855469 18 15.4375 C 18 15.460938 18 15.476563 18 15.5 C 18 16.421875 18.4375 17.195313 19.03125 17.8125 C 17.867188 18.796875 15.15625 20.890625 12.375 23.125 C 9.558594 25.386719 6.703125 27.734375 5.21875 29.21875 C 0.929688 33.507813 0.929688 40.492188 5.21875 44.78125 C 9.507813 49.070313 16.492188 49.070313 20.78125 44.78125 C 23.570313 41.992188 30.734375 32.910156 33.21875 29.6875 C 33.601563 29.875 34.03125 30 34.5 30 C 35.011719 30 35.375 29.667969 35.8125 29.46875 C 36.449219 30.328125 37.351563 31 38.5 31 C 39.847656 31 40.855469 30.125 41.4375 29 C 41.460938 29 41.476563 29 41.5 29 C 43.421875 29 45 27.421875 45 25.5 C 45 25.476563 45 25.460938 45 25.4375 C 46.125 24.855469 47 23.847656 47 22.5 C 47 21.988281 46.667969 21.625 46.46875 21.1875 C 47.328125 20.550781 48 19.648438 48 18.5 C 48 17.734375 47.699219 17.074219 47.28125 16.5 C 47.699219 15.925781 48 15.265625 48 14.5 C 48 13.351563 47.328125 12.449219 46.46875 11.8125 C 46.667969 11.375 47 11.011719 47 10.5 C 47 9.152344 46.125 8.144531 45 7.5625 C 45 7.539063 45 7.523438 45 7.5 C 45 5.578125 43.421875 4 41.5 4 C 41.296875 4 41.128906 4.089844 40.9375 4.125 C 40.304688 3.472656 39.480469 3 38.5 3 C 37.988281 3 37.625 3.332031 37.1875 3.53125 C 36.550781 2.671875 35.648438 2 34.5 2 C 33.734375 2 33.074219 2.300781 32.5 2.71875 C 31.925781 2.300781 31.265625 2 30.5 2 Z M 30.5 4 C 30.996094 4 31.410156 4.25 31.6875 4.625 C 31.875 4.886719 32.179688 5.042969 32.5 5.042969 C 32.820313 5.042969 33.125 4.886719 33.3125 4.625 C 33.589844 4.25 34.003906 4 34.5 4 C 35.15625 4 35.695313 4.421875 35.90625 5 C 36.027344 5.300781 36.289063 5.527344 36.605469 5.601563 C 36.921875 5.675781 37.257813 5.59375 37.5 5.375 C 37.773438 5.128906 38.117188 5 38.5 5 C 39.039063 5 39.480469 5.292969 39.75 5.71875 C 40.011719 6.121094 40.523438 6.277344 40.96875 6.09375 C 41.148438 6.023438 41.324219 6 41.5 6 C 42.339844 6 43 6.660156 43 7.5 C 43 7.601563 42.996094 7.691406 42.96875 7.8125 C 42.902344 8.078125 42.949219 8.359375 43.097656 8.589844 C 43.246094 8.820313 43.480469 8.980469 43.75 9.03125 C 44.453125 9.15625 45 9.753906 45 10.5 C 45 10.882813 44.871094 11.226563 44.625 11.5 C 44.40625 11.742188 44.324219 12.078125 44.398438 12.394531 C 44.472656 12.710938 44.699219 12.972656 45 13.09375 C 45.578125 13.304688 46 13.847656 46 14.5 C 46 14.996094 45.75 15.410156 45.375 15.6875 C 45.113281 15.875 44.957031 16.179688 44.957031 16.5 C 44.957031 16.820313 45.113281 17.125 45.375 17.3125 C 45.75 17.589844 46 18.003906 46 18.5 C 46 19.152344 45.578125 19.695313 45 19.90625 C 44.699219 20.027344 44.472656 20.289063 44.398438 20.605469 C 44.324219 20.921875 44.40625 21.257813 44.625 21.5 C 44.871094 21.773438 45 22.117188 45 22.5 C 45 23.246094 44.453125 23.84375 43.75 23.96875 C 43.480469 24.019531 43.246094 24.179688 43.097656 24.410156 C 42.949219 24.640625 42.902344 24.921875 42.96875 25.1875 C 42.996094 25.308594 43 25.398438 43 25.5 C 43 26.339844 42.339844 27 41.5 27 C 41.398438 27 41.308594 26.996094 41.1875 26.96875 C 40.921875 26.902344 40.640625 26.949219 40.410156 27.097656 C 40.179688 27.246094 40.019531 27.480469 39.96875 27.75 C 39.84375 28.453125 39.246094 29 38.5 29 C 37.847656 29 37.304688 28.578125 37.09375 28 C 36.972656 27.699219 36.710938 27.472656 36.394531 27.398438 C 36.078125 27.324219 35.742188 27.40625 35.5 27.625 C 35.226563 27.871094 34.882813 28 34.5 28 C 34.382813 28 34.265625 27.964844 34.15625 27.9375 C 34.054688 27.484375 33.652344 27.160156 33.1875 27.15625 C 33.125 27.027344 33.054688 26.894531 33.03125 26.75 C 32.980469 26.480469 32.820313 26.246094 32.589844 26.097656 C 32.359375 25.949219 32.078125 25.902344 31.8125 25.96875 C 31.691406 25.996094 31.601563 26 31.5 26 C 30.753906 26 30.15625 25.453125 30.03125 24.75 C 29.980469 24.480469 29.820313 24.246094 29.589844 24.097656 C 29.359375 23.949219 29.078125 23.902344 28.8125 23.96875 C 28.691406 23.996094 28.601563 24 28.5 24 C 27.753906 24 27.15625 23.453125 27.03125 22.75 C 26.980469 22.480469 26.820313 22.246094 26.589844 22.097656 C 26.359375 21.949219 26.078125 21.902344 25.8125 21.96875 C 25.691406 21.996094 25.601563 22 25.5 22 C 24.753906 22 24.15625 21.453125 24.03125 20.75 C 23.980469 20.480469 23.820313 20.246094 23.589844 20.097656 C 23.359375 19.949219 23.078125 19.902344 22.8125 19.96875 C 22.691406 19.996094 22.601563 20 22.5 20 C 21.660156 20 21 19.339844 21 18.5 C 21 18.320313 21.023438 18.144531 21.09375 17.96875 C 21.277344 17.523438 21.121094 17.011719 20.71875 16.75 C 20.292969 16.480469 20 16.039063 20 15.5 C 20 15.398438 20.003906 15.308594 20.03125 15.1875 C 20.097656 14.921875 20.050781 14.640625 19.902344 14.410156 C 19.753906 14.179688 19.519531 14.019531 19.25 13.96875 C 18.546875 13.84375 18 13.246094 18 12.5 C 18 11.960938 18.292969 11.519531 18.71875 11.25 C 19.121094 10.988281 19.277344 10.476563 19.09375 10.03125 C 19.023438 9.855469 19 9.679688 19 9.5 C 19 8.660156 19.660156 8 20.5 8 C 20.601563 8 20.691406 8.003906 20.8125 8.03125 C 21.078125 8.097656 21.359375 8.050781 21.589844 7.902344 C 21.820313 7.753906 21.980469 7.519531 22.03125 7.25 C 22.15625 6.546875 22.753906 6 23.5 6 C 23.675781 6 23.851563 6.023438 24.03125 6.09375 C 24.476563 6.277344 24.988281 6.121094 25.25 5.71875 C 25.519531 5.292969 25.960938 5 26.5 5 C 26.882813 5 27.226563 5.128906 27.5 5.375 C 27.742188 5.59375 28.078125 5.675781 28.394531 5.601563 C 28.710938 5.527344 28.972656 5.300781 29.09375 5 C 29.304688 4.421875 29.84375 4 30.5 4 Z M 26.90625 9.96875 C 26.863281 9.976563 26.820313 9.988281 26.78125 10 C 26.316406 10.105469 25.988281 10.523438 26 11 C 26 11.566406 25.566406 12 25 12 C 24.640625 11.996094 24.304688 12.183594 24.121094 12.496094 C 23.941406 12.808594 23.941406 13.191406 24.121094 13.503906 C 24.304688 13.816406 24.640625 14.003906 25 14 C 26.644531 14 28 12.644531 28 11 C 28.011719 10.710938 27.894531 10.433594 27.6875 10.238281 C 27.476563 10.039063 27.191406 9.941406 26.90625 9.96875 Z M 37.90625 9.96875 C 37.863281 9.976563 37.820313 9.988281 37.78125 10 C 37.316406 10.105469 36.988281 10.523438 37 11 C 37 12.117188 36.117188 13 35 13 C 34.640625 12.996094 34.304688 13.183594 34.121094 13.496094 C 33.941406 13.808594 33.941406 14.191406 34.121094 14.503906 C 34.304688 14.816406 34.640625 15.003906 35 15 C 37.199219 15 39 13.199219 39 11 C 39.011719 10.710938 38.894531 10.433594 38.6875 10.238281 C 38.476563 10.039063 38.191406 9.941406 37.90625 9.96875 Z M 36.90625 18.96875 C 36.863281 18.976563 36.820313 18.988281 36.78125 19 C 36.316406 19.105469 35.988281 19.523438 36 20 C 36 20.566406 35.566406 21 35 21 C 34.640625 20.996094 34.304688 21.183594 34.121094 21.496094 C 33.941406 21.808594 33.941406 22.191406 34.121094 22.503906 C 34.304688 22.816406 34.640625 23.003906 35 23 C 36.644531 23 38 21.644531 38 20 C 38.011719 19.710938 37.894531 19.433594 37.6875 19.238281 C 37.476563 19.039063 37.191406 18.941406 36.90625 18.96875 Z M 19.40625 20.0625 C 19.65625 20.542969 20.003906 20.992188 20.4375 21.3125 C 19.199219 22.335938 17.070313 24.105469 14.59375 26.46875 C 12.890625 28.09375 11.242188 29.8125 10.125 31.3125 C 9.566406 32.0625 9.121094 32.730469 8.875 33.4375 C 8.753906 33.789063 8.6875 34.164063 8.71875 34.5625 C 8.746094 34.921875 8.871094 35.320313 9.125 35.625 C 9.136719 35.636719 9.144531 35.644531 9.15625 35.65625 C 9.175781 35.679688 9.199219 35.699219 9.21875 35.71875 C 9.339844 35.839844 9.492188 35.925781 9.65625 35.96875 C 9.679688 35.976563 9.699219 35.996094 9.71875 36 C 9.730469 36 9.738281 36 9.75 36 C 9.898438 36.035156 10.027344 36.039063 10.125 36.03125 C 10.335938 36.015625 10.46875 35.988281 10.59375 35.9375 C 10.847656 35.835938 11.0625 35.691406 11.3125 35.53125 C 11.8125 35.210938 12.417969 34.753906 13.125 34.1875 C 14.535156 33.054688 16.300781 31.511719 18.0625 29.9375 C 21.28125 27.058594 24.136719 24.363281 24.65625 23.875 C 24.921875 23.953125 25.199219 24 25.5 24 C 25.523438 24 25.539063 24 25.5625 24 C 25.707031 24.28125 25.863281 24.539063 26.0625 24.78125 C 25.257813 25.570313 22.710938 28.0625 19.78125 31.03125 C 18.066406 32.769531 16.382813 34.539063 15.125 35.90625 C 14.496094 36.589844 13.960938 37.164063 13.59375 37.625 C 13.410156 37.855469 13.277344 38.046875 13.15625 38.25 C 13.09375 38.351563 13.023438 38.453125 12.96875 38.625 C 12.933594 38.730469 12.894531 38.917969 12.9375 39.15625 C 12.945313 39.1875 12.957031 39.21875 12.96875 39.25 C 12.976563 39.273438 12.960938 39.289063 12.96875 39.3125 C 13.003906 39.425781 13.054688 39.53125 13.125 39.625 C 13.132813 39.636719 13.144531 39.644531 13.15625 39.65625 C 13.167969 39.667969 13.175781 39.675781 13.1875 39.6875 C 13.242188 39.757813 13.304688 39.820313 13.375 39.875 C 13.402344 39.898438 13.4375 39.917969 13.46875 39.9375 C 13.519531 39.960938 13.570313 39.984375 13.625 40 C 14.230469 40.339844 14.96875 40.332031 15.59375 40.15625 C 16.367188 39.9375 17.15625 39.523438 18 38.96875 C 19.683594 37.855469 21.574219 36.199219 23.40625 34.46875 C 26.773438 31.289063 29.582031 28.160156 30.0625 27.625 C 30.484375 27.859375 30.96875 28 31.5 28 C 31.523438 28 31.539063 28 31.5625 28 C 31.625 28.121094 31.710938 28.230469 31.78125 28.34375 C 29.429688 31.390625 21.855469 40.894531 19.375 43.375 C 15.851563 46.898438 10.148438 46.898438 6.625 43.375 C 3.101563 39.851563 3.101563 34.148438 6.625 30.625 C 7.9375 29.3125 10.820313 26.9375 13.625 24.6875 C 15.929688 22.835938 17.988281 21.214844 19.40625 20.0625 Z M 22.625 22.09375 C 22.738281 22.304688 22.855469 22.5 23 22.6875 C 22.191406 23.445313 19.71875 25.78125 16.75 28.4375 C 15.003906 30 13.230469 31.535156 11.875 32.625 C 11.703125 32.761719 11.566406 32.878906 11.40625 33 C 11.515625 32.835938 11.585938 32.679688 11.71875 32.5 C 12.707031 31.175781 14.308594 29.523438 15.96875 27.9375 C 19.074219 24.972656 22.199219 22.4375 22.625 22.09375 Z M 27.78125 25.90625 C 28.007813 25.964844 28.246094 26 28.5 26 C 28.523438 26 28.539063 26 28.5625 26 C 28.589844 26.054688 28.625 26.105469 28.65625 26.15625 C 28.3125 26.542969 25.402344 29.8125 22.03125 33 C 20.242188 34.691406 18.371094 36.292969 16.875 37.28125 C 16.644531 37.433594 16.457031 37.539063 16.25 37.65625 C 16.386719 37.503906 16.445313 37.414063 16.59375 37.25 C 17.816406 35.917969 19.511719 34.167969 21.21875 32.4375 C 24.382813 29.230469 27.328125 26.347656 27.78125 25.90625 Z'
const stroke_corn = 'M 25 0 C 24.824219 0 24.644531 0.0195313 24.46875 0.03125 C 20.867188 0.289063 17.789063 3.179688 15.625 7.40625 C 13.355469 11.839844 12 17.863281 12 24.5 C 12 25.292969 11.988281 26.058594 12 26.8125 C 10.078125 25.636719 7.972656 24.472656 5.65625 23.25 C 5.582031 23.210938 5.542969 23.164063 5.46875 23.125 C 5.289063 23.023438 5.082031 22.980469 4.875 23 C 4.480469 23.046875 4.15625 23.324219 4.039063 23.703125 C 3.925781 24.082031 4.042969 24.492188 4.34375 24.75 C 7.699219 27.578125 8.535156 33.617188 10.5 39.21875 C 11.484375 42.019531 12.789063 44.738281 15.0625 46.75 C 17.304688 48.734375 20.457031 49.964844 24.8125 50 C 24.875 50 24.9375 50 25 50 C 25.03125 50 25.0625 50 25.09375 50 C 29.097656 49.984375 31.878906 49.023438 33.84375 47.5 C 35.824219 45.964844 36.921875 43.921875 37.8125 41.96875 C 38.703125 40.015625 39.40625 38.128906 40.4375 36.71875 C 41.46875 35.308594 42.769531 34.339844 45.15625 34 C 45.574219 33.9375 45.90625 33.621094 45.992188 33.210938 C 46.074219 32.796875 45.890625 32.375 45.53125 32.15625 C 42.769531 30.457031 40.164063 29.824219 37.78125 29.90625 C 37.902344 28.207031 38 26.425781 38 24.5 C 38 21.402344 37.671875 18.449219 37.125 15.71875 C 36.5 12.597656 35.585938 9.769531 34.375 7.40625 C 32.210938 3.179688 29.132813 0.289063 25.53125 0.03125 C 25.359375 0.00390625 25.179688 0 25 0 Z M 24 2.40625 L 24 7.9375 C 22.878906 7.851563 21.96875 7.65625 21.25 7.375 C 21.800781 5.6875 22.421875 4.3125 23.0625 3.40625 C 23.390625 2.941406 23.707031 2.628906 24 2.40625 Z M 26 2.40625 C 26.292969 2.628906 26.609375 2.941406 26.9375 3.40625 C 27.578125 4.3125 28.199219 5.6875 28.75 7.375 C 28.03125 7.65625 27.121094 7.851563 26 7.9375 Z M 20.375 4.21875 C 20.066406 4.878906 19.769531 5.589844 19.5 6.375 C 19.257813 6.179688 19.078125 6 18.9375 5.84375 C 19.398438 5.214844 19.882813 4.699219 20.375 4.21875 Z M 29.625 4.21875 C 30.117188 4.699219 30.601563 5.214844 31.0625 5.84375 C 30.921875 6 30.742188 6.179688 30.5 6.375 C 30.230469 5.589844 29.933594 4.878906 29.625 4.21875 Z M 17.84375 7.5625 C 18.042969 7.757813 18.238281 7.960938 18.5 8.15625 C 18.613281 8.242188 18.746094 8.324219 18.875 8.40625 C 18.5625 9.558594 18.273438 10.796875 18.03125 12.125 C 18.019531 12.117188 18.011719 12.101563 18 12.09375 C 16.996094 11.355469 16.597656 10.703125 16.46875 10.46875 C 16.765625 9.722656 17.066406 9.003906 17.40625 8.34375 C 17.546875 8.066406 17.695313 7.820313 17.84375 7.5625 Z M 32.15625 7.5625 C 32.304688 7.820313 32.453125 8.066406 32.59375 8.34375 C 32.933594 9.003906 33.234375 9.722656 33.53125 10.46875 C 33.402344 10.703125 33.003906 11.355469 32 12.09375 C 31.988281 12.101563 31.980469 12.117188 31.96875 12.125 C 31.726563 10.796875 31.4375 9.558594 31.125 8.40625 C 31.253906 8.324219 31.386719 8.242188 31.5 8.15625 C 31.761719 7.960938 31.957031 7.757813 32.15625 7.5625 Z M 20.6875 9.3125 C 21.597656 9.644531 22.703125 9.855469 24 9.9375 L 24 13.96875 C 22.292969 13.871094 20.945313 13.542969 19.90625 13.125 C 20.136719 11.75 20.382813 10.484375 20.6875 9.3125 Z M 29.3125 9.3125 C 29.617188 10.484375 29.863281 11.75 30.09375 13.125 C 29.054688 13.542969 27.707031 13.871094 26 13.96875 L 26 9.9375 C 27.296875 9.855469 28.402344 9.644531 29.3125 9.3125 Z M 15.6875 12.71875 C 15.992188 13.046875 16.355469 13.382813 16.8125 13.71875 C 17.070313 13.910156 17.375 14.097656 17.6875 14.28125 C 17.519531 15.476563 17.390625 16.742188 17.28125 18.03125 C 17.09375 17.910156 16.910156 17.808594 16.75 17.6875 C 15.621094 16.84375 15.097656 16.074219 14.90625 15.75 C 15.132813 14.703125 15.394531 13.679688 15.6875 12.71875 Z M 34.3125 12.71875 C 34.605469 13.679688 34.867188 14.703125 35.09375 15.75 C 34.902344 16.074219 34.378906 16.84375 33.25 17.6875 C 33.089844 17.808594 32.90625 17.910156 32.71875 18.03125 C 32.609375 16.742188 32.480469 15.476563 32.3125 14.28125 C 32.625 14.097656 32.929688 13.910156 33.1875 13.71875 C 33.644531 13.382813 34.007813 13.046875 34.3125 12.71875 Z M 19.59375 15.15625 C 20.789063 15.578125 22.257813 15.882813 24 15.96875 L 24 19.96875 C 22.03125 19.875 20.460938 19.511719 19.21875 19.03125 C 19.316406 17.695313 19.433594 16.390625 19.59375 15.15625 Z M 30.40625 15.15625 C 30.566406 16.390625 30.683594 17.695313 30.78125 19.03125 C 29.539063 19.511719 27.96875 19.875 26 19.96875 L 26 15.96875 C 27.742188 15.882813 29.210938 15.578125 30.40625 15.15625 Z M 14.4375 18.34375 C 14.753906 18.664063 15.128906 18.988281 15.5625 19.3125 C 16.011719 19.648438 16.53125 19.972656 17.125 20.28125 C 17.058594 21.523438 17.007813 22.789063 17 24.09375 C 16.726563 23.929688 16.476563 23.761719 16.25 23.59375 C 14.65625 22.417969 14.21875 21.375 14.21875 21.375 C 14.195313 21.308594 14.164063 21.246094 14.125 21.1875 C 14.199219 20.210938 14.300781 19.273438 14.4375 18.34375 Z M 35.5625 18.34375 C 35.699219 19.273438 35.800781 20.210938 35.875 21.1875 C 35.835938 21.246094 35.804688 21.308594 35.78125 21.375 C 35.78125 21.375 35.34375 22.417969 33.75 23.59375 C 33.523438 23.761719 33.273438 23.929688 33 24.09375 C 32.992188 22.789063 32.941406 21.523438 32.875 20.28125 C 33.46875 19.972656 33.988281 19.648438 34.4375 19.3125 C 34.871094 18.988281 35.246094 18.664063 35.5625 18.34375 Z M 19.09375 21.125 C 20.449219 21.574219 22.074219 21.882813 24 21.96875 L 24 25.96875 C 21.945313 25.878906 20.3125 25.511719 19 25.03125 C 19 24.859375 19 24.664063 19 24.5 C 19 23.347656 19.042969 22.230469 19.09375 21.125 Z M 30.90625 21.125 C 30.957031 22.230469 31 23.347656 31 24.5 C 31 24.671875 31 24.855469 31 25.03125 C 29.6875 25.511719 28.054688 25.878906 26 25.96875 L 26 21.96875 C 27.925781 21.882813 29.550781 21.574219 30.90625 21.125 Z M 14 24.3125 C 14.308594 24.613281 14.648438 24.914063 15.0625 25.21875 C 15.609375 25.621094 16.277344 26.015625 17.03125 26.375 C 17.074219 27.660156 17.167969 28.957031 17.25 30.21875 C 16.882813 30.011719 16.539063 29.808594 16.25 29.59375 C 14.65625 28.417969 14.21875 27.375 14.21875 27.375 C 14.171875 27.269531 14.109375 27.175781 14.03125 27.09375 C 14.011719 26.273438 14 25.421875 14 24.5 C 14 24.4375 14 24.375 14 24.3125 Z M 36 24.3125 C 36 24.375 36 24.4375 36 24.5 C 36 25.398438 35.992188 26.246094 35.96875 27.09375 C 35.890625 27.175781 35.828125 27.269531 35.78125 27.375 C 35.78125 27.375 35.34375 28.417969 33.75 29.59375 C 33.476563 29.796875 33.15625 29.988281 32.8125 30.1875 C 32.875 28.945313 32.9375 27.707031 32.96875 26.375 C 33.722656 26.015625 34.390625 25.621094 34.9375 25.21875 C 35.351563 24.914063 35.691406 24.613281 36 24.3125 Z M 19.0625 27.15625 C 20.449219 27.582031 22.074219 27.890625 24 27.96875 L 24 31.96875 C 22.101563 31.886719 20.542969 31.582031 19.28125 31.15625 C 19.1875 29.902344 19.113281 28.566406 19.0625 27.15625 Z M 30.9375 27.15625 C 30.890625 28.558594 30.84375 29.863281 30.78125 31.125 C 29.511719 31.5625 27.929688 31.882813 26 31.96875 L 26 27.96875 C 27.925781 27.890625 29.550781 27.582031 30.9375 27.15625 Z M 8.59375 27.25 C 13.164063 29.886719 16.960938 32.449219 19.375 35.25 C 22.296875 38.636719 23.714844 42.511719 23.90625 47.84375 C 20.523438 47.644531 18.097656 46.746094 16.40625 45.25 C 14.511719 43.574219 13.304688 41.210938 12.375 38.5625 C 11.082031 34.878906 10.324219 30.695313 8.59375 27.25 Z M 37.78125 31.90625 C 39.160156 31.914063 40.660156 32.296875 42.25 32.9375 C 40.839844 33.597656 39.652344 34.425781 38.84375 35.53125 C 37.578125 37.261719 36.847656 39.296875 36 41.15625 C 35.152344 43.015625 34.214844 44.675781 32.625 45.90625 C 31.179688 47.027344 29.144531 47.832031 25.96875 47.96875 C 25.90625 45.929688 25.652344 44.046875 25.21875 42.3125 C 25.457031 41.8125 27.25 38.175781 30.40625 35.28125 C 32.101563 33.730469 34.121094 32.464844 36.4375 32.03125 C 36.867188 31.949219 37.320313 31.902344 37.78125 31.90625 Z M 20.53125 33.53125 C 21.574219 33.753906 22.710938 33.917969 24 33.96875 L 24 38.71875 C 23.210938 36.992188 22.179688 35.414063 20.90625 33.9375 C 20.789063 33.800781 20.65625 33.664063 20.53125 33.53125 Z M 29.3125 33.59375 C 29.230469 33.667969 29.144531 33.738281 29.0625 33.8125 C 27.851563 34.921875 26.839844 36.117188 26 37.25 L 26 33.96875 C 27.222656 33.917969 28.3125 33.796875 29.3125 33.59375 Z'
const stroke_eggplant = 'M 46.21875 1.03125 C 45.933594 1.082031 45.679688 1.25 45.53125 1.5 C 45.53125 1.5 43.191406 4.921875 40.53125 7.15625 C 38.648438 7.125 34.394531 6.171875 31 10.75 C 30.945313 10.835938 30.902344 10.929688 30.875 11.03125 C 29.554688 12.0625 28.296875 13.433594 26.96875 14.875 C 24.90625 17.105469 22.746094 19.535156 20.5 21.21875 C 16.429688 24.269531 11.808594 25.195313 7.9375 26.9375 C 6 27.808594 4.234375 28.925781 2.96875 30.6875 C 1.703125 32.449219 1 34.816406 1 38 C 1 44.0625 5.9375 49 12 49 C 20.355469 49 28.152344 44.292969 34 38.25 C 39.253906 32.820313 42.96875 26.308594 44.0625 20.75 C 44.3125 20.65625 44.515625 20.464844 44.625 20.21875 C 46.03125 17.222656 46.179688 14.824219 45.875 13.0625 C 45.722656 12.183594 45.445313 11.472656 45.21875 10.9375 C 45.09375 10.636719 45.078125 10.578125 45 10.40625 C 47.871094 6.953125 48.96875 3.28125 48.96875 3.28125 C 49.101563 2.832031 48.90625 2.355469 48.5 2.125 L 46.875 1.1875 C 46.707031 1.082031 46.511719 1.027344 46.3125 1.03125 C 46.28125 1.03125 46.25 1.03125 46.21875 1.03125 Z M 46.65625 3.375 L 46.75 3.4375 C 46.453125 4.332031 45.542969 6.894531 43.125 9.59375 C 42.898438 9.847656 42.8125 10.203125 42.90625 10.53125 C 43.035156 11 43.1875 11.273438 43.375 11.71875 C 43.5625 12.164063 43.785156 12.714844 43.90625 13.40625 C 44.082031 14.414063 43.894531 15.832031 43.40625 17.5 C 42.851563 16.5625 42.4375 15.59375 42.5625 14.625 C 42.632813 14.191406 42.414063 13.757813 42.015625 13.566406 C 41.621094 13.371094 41.144531 13.457031 40.84375 13.78125 C 39.835938 14.789063 38.632813 15.222656 37.65625 15.46875 C 37.714844 15.140625 37.683594 15.125 37.78125 14.71875 C 38.0625 13.546875 38.59375 12.21875 39.09375 11.71875 C 39.394531 11.429688 39.484375 10.980469 39.316406 10.597656 C 39.148438 10.214844 38.761719 9.976563 38.34375 10 C 36.558594 10.0625 35.589844 10.136719 34.40625 10.21875 C 36.722656 8.523438 38.898438 9.246094 41 9.15625 C 41.207031 9.144531 41.402344 9.066406 41.5625 8.9375 C 44.15625 6.851563 45.984375 4.347656 46.65625 3.375 Z M 36.53125 12.09375 C 36.21875 12.8125 36.011719 13.558594 35.84375 14.25 C 35.523438 15.566406 35.40625 16.65625 35.40625 16.65625 C 35.378906 16.949219 35.480469 17.238281 35.683594 17.449219 C 35.890625 17.660156 36.175781 17.769531 36.46875 17.75 C 36.46875 17.75 38.644531 17.582031 40.71875 16.34375 C 41.011719 17.5625 41.632813 18.625 42.25 19.5 C 41.511719 24.589844 37.886719 31.371094 32.5625 36.875 C 26.976563 42.648438 19.597656 47 12 47 C 7.015625 47 3 42.984375 3 38 C 3 35.105469 3.613281 33.246094 4.59375 31.875 C 5.574219 30.503906 6.976563 29.578125 8.75 28.78125 C 12.292969 27.183594 17.230469 26.210938 21.71875 22.84375 C 24.203125 20.980469 26.398438 18.457031 28.4375 16.25 C 29.886719 14.679688 31.273438 13.28125 32.5 12.375 C 33.804688 12.386719 35.148438 12.207031 36.53125 12.09375 Z M 31.375 18.71875 C 31.3125 18.722656 31.25 18.734375 31.1875 18.75 C 30.929688 18.808594 30.703125 18.964844 30.5625 19.1875 C 30.5625 19.1875 23.820313 28.898438 11.15625 31.78125 C 10.773438 31.820313 10.445313 32.078125 10.316406 32.441406 C 10.1875 32.804688 10.28125 33.210938 10.550781 33.484375 C 10.824219 33.753906 11.230469 33.847656 11.59375 33.71875 C 25.058594 30.652344 32.1875 20.3125 32.1875 20.3125 C 32.414063 20.007813 32.445313 19.601563 32.273438 19.265625 C 32.101563 18.925781 31.753906 18.714844 31.375 18.71875 Z'
const stroke_mushroom = 'M 26.78125 3 C 26 3.007813 25.214844 3.050781 24.40625 3.125 C 17.910156 3.722656 12.582031 6.734375 8.875 10.3125 C 5.167969 13.890625 3 17.929688 3 21.125 C 3 22.871094 3.765625 24.34375 5.03125 25.25 C 6.296875 26.15625 7.949219 26.585938 9.90625 26.8125 C 12.742188 27.136719 16.257813 27.019531 20.1875 26.78125 C 19.851563 31.367188 18.757813 38.679688 15.65625 43.34375 C 15.117188 44.152344 14.792969 44.941406 15.09375 45.78125 C 15.242188 46.199219 15.601563 46.5625 15.96875 46.75 C 16.335938 46.9375 16.707031 47 17.09375 47 L 31.65625 47 C 32.230469 47 32.824219 46.871094 33.25 46.46875 C 33.675781 46.066406 33.824219 45.585938 33.9375 45.15625 C 34.007813 44.898438 34.660156 42.640625 34.90625 39.125 C 35.140625 35.773438 35.03125 31.160156 33.84375 25.59375 C 36.628906 25.1875 38.996094 24.664063 40.9375 23.9375 C 42.820313 23.230469 44.320313 22.328125 45.375 21.125 C 46.429688 19.921875 47 18.382813 47 16.6875 C 47 13.433594 44.5 9.871094 40.5 7.125 C 37.5 5.066406 33.59375 3.496094 29.09375 3.09375 C 28.34375 3.027344 27.5625 2.992188 26.78125 3 Z M 26.8125 5 C 31.867188 5 36.195313 6.601563 39.375 8.78125 C 43.007813 11.273438 45 14.550781 45 16.6875 C 45 17.972656 44.628906 18.953125 43.875 19.8125 C 43.121094 20.671875 41.9375 21.429688 40.25 22.0625 C 36.875 23.324219 31.625 24.03125 24.71875 24.46875 C 18.890625 24.839844 13.6875 25.222656 10.125 24.8125 C 8.34375 24.609375 7 24.207031 6.1875 23.625 C 5.375 23.042969 5 22.359375 5 21.125 C 5 18.921875 6.828125 15.050781 10.25 11.75 C 13.671875 8.449219 18.613281 5.644531 24.59375 5.09375 C 25.34375 5.023438 26.089844 5 26.8125 5 Z M 31.84375 25.875 C 33.011719 31.304688 33.128906 35.789063 32.90625 39 C 32.671875 42.34375 32.113281 44.226563 32 44.65625 C 31.914063 44.980469 31.832031 45.039063 31.875 45 C 31.847656 45.003906 31.792969 45 31.65625 45 L 17.09375 45 C 17.070313 45 17.082031 45 17.0625 45 C 17.078125 44.988281 17.015625 44.882813 17.3125 44.4375 C 20.878906 39.074219 21.902344 31.371094 22.21875 26.65625 C 23.085938 26.601563 23.945313 26.527344 24.84375 26.46875 C 27.398438 26.308594 29.722656 26.125 31.84375 25.875 Z'
const stroke_olive = 'M 25.03125 2 C 24.539063 2.078125 24.179688 2.503906 24.1875 3 C 24.1875 12.015625 28.542969 18.5625 29.78125 20.25 C 29.558594 20.367188 29.347656 20.5 29.125 20.625 C 29.128906 20.425781 29.074219 20.230469 28.96875 20.0625 C 24.832031 13.773438 18.8125 10 7 10 C 6.96875 10 6.9375 10 6.90625 10 C 6.589844 10.027344 6.300781 10.203125 6.136719 10.472656 C 5.96875 10.746094 5.941406 11.078125 6.0625 11.375 C 8.921875 18.519531 14.640625 21.171875 19.46875 21.90625 C 22.777344 22.410156 25.625 22.050781 27.15625 21.78125 C 25.554688 22.832031 24 24.074219 22.5625 25.53125 C 22.488281 25.605469 22.425781 25.6875 22.375 25.78125 C 22.183594 25.636719 21.984375 25.503906 21.78125 25.375 C 20.558594 24.59375 19.203125 24.152344 17.8125 24.03125 C 13.644531 23.671875 9.101563 26.136719 6.34375 30.46875 C 2.667969 36.242188 3.332031 43.5 8.21875 46.625 C 13.105469 49.75 19.980469 47.304688 23.65625 41.53125 C 26.757813 36.660156 26.757813 30.734375 23.75 27.125 C 23.84375 27.074219 23.925781 27.011719 24 26.9375 C 31.496094 19.355469 43.03125 18.03125 43.03125 18.03125 C 43.582031 17.972656 43.984375 17.472656 43.921875 16.921875 C 43.863281 16.371094 43.363281 15.96875 42.8125 16.03125 C 42.8125 16.03125 38.066406 16.523438 32.53125 18.90625 C 34.054688 15.0625 33.953125 11.523438 32.75 8.6875 C 31.375 5.449219 28.628906 3.136719 25.53125 2.0625 C 25.371094 2 25.199219 1.976563 25.03125 2 Z M 26.4375 4.84375 C 28.332031 5.894531 30.019531 7.378906 30.90625 9.46875 C 31.871094 11.738281 31.949219 14.59375 30.71875 17.875 C 29.53125 16.199219 26.96875 11.90625 26.4375 4.84375 Z M 8.78125 12.15625 C 17.949219 12.492188 22.765625 15.210938 26.28125 19.90625 C 24.847656 20.136719 22.675781 20.351563 19.75 19.90625 C 15.777344 19.300781 11.488281 17.316406 8.78125 12.15625 Z M 37.4375 22 C 36.765625 21.980469 36.085938 22.039063 35.40625 22.1875 C 29.957031 23.390625 26.929688 29.722656 28.34375 36.125 C 29.757813 42.527344 35.144531 47.015625 40.59375 45.8125 C 46.042969 44.609375 49.070313 38.277344 47.65625 31.875 C 46.417969 26.273438 42.140625 22.140625 37.4375 22 Z M 36.59375 24.03125 C 40.5 23.6875 44.535156 27.101563 45.6875 32.3125 C 46.917969 37.871094 44.316406 42.933594 40.1875 43.84375 C 36.058594 44.753906 31.542969 41.246094 30.3125 35.6875 C 29.082031 30.128906 31.683594 25.066406 35.8125 24.15625 C 36.070313 24.097656 36.332031 24.054688 36.59375 24.03125 Z M 16.96875 26 C 17.179688 26 17.386719 26.015625 17.59375 26.03125 C 18.707031 26.117188 19.75 26.464844 20.6875 27.0625 C 24.433594 29.460938 25.179688 35.421875 21.96875 40.46875 C 18.757813 45.515625 13.058594 47.335938 9.3125 44.9375 C 5.566406 42.539063 4.820313 36.578125 8.03125 31.53125 C 10.289063 27.984375 13.789063 26.019531 16.96875 26 Z M 35.28125 27.34375 C 35.195313 27.363281 35.109375 27.394531 35.03125 27.4375 C 32.773438 28.445313 32.125 31.335938 33.21875 33.78125 C 33.636719 34.710938 34.261719 35.503906 35 36.0625 C 35.28125 36.324219 35.6875 36.402344 36.042969 36.265625 C 36.402344 36.125 36.652344 35.796875 36.679688 35.410156 C 36.710938 35.027344 36.519531 34.664063 36.1875 34.46875 C 35.730469 34.125 35.3125 33.597656 35.03125 32.96875 C 34.289063 31.3125 34.816406 29.707031 35.84375 29.25 C 36.3125 29.050781 36.558594 28.535156 36.414063 28.046875 C 36.269531 27.558594 35.78125 27.253906 35.28125 27.34375 Z M 14.71875 28.9375 C 13.359375 29.039063 12.019531 29.910156 11.1875 31.21875 C 10.453125 32.371094 10.195313 33.6875 10.46875 34.875 C 10.527344 35.246094 10.789063 35.554688 11.148438 35.671875 C 11.507813 35.789063 11.902344 35.691406 12.167969 35.425781 C 12.433594 35.160156 12.523438 34.765625 12.40625 34.40625 C 12.269531 33.8125 12.410156 33.011719 12.875 32.28125 C 13.679688 31.019531 14.988281 30.6875 15.71875 31.15625 C 16.019531 31.378906 16.421875 31.417969 16.757813 31.25 C 17.097656 31.082031 17.3125 30.742188 17.316406 30.367188 C 17.320313 29.992188 17.113281 29.644531 16.78125 29.46875 C 16.3125 29.171875 15.828125 28.984375 15.3125 28.9375 C 15.121094 28.917969 14.914063 28.921875 14.71875 28.9375 Z'
const stroke_tomato = 'M 28.65625 0.0625 C 27.902344 0.09375 27.3125 0.28125 27.3125 0.28125 C 27.144531 0.335938 26.992188 0.433594 26.875 0.5625 C 26.875 0.5625 24.855469 2.847656 23.625 6.34375 C 21.8125 4.710938 19.804688 4.417969 18.3125 4.375 C 17.394531 4.347656 16.675781 4.320313 16.1875 4.125 C 15.699219 3.929688 15.347656 3.664063 14.96875 2.6875 C 14.800781 2.234375 14.332031 1.96875 13.855469 2.050781 C 13.382813 2.136719 13.035156 2.546875 13.03125 3.03125 C 13.03125 4.402344 13.167969 5.519531 13.4375 6.4375 C 8.753906 7.800781 5.375 10.382813 3.21875 13.75 C 0.941406 17.304688 0 21.667969 0 26.28125 C 0 38.765625 11.195313 50 25 50 C 31.09375 50 37.324219 47.945313 42.0625 43.625 C 46.800781 39.304688 50 32.710938 50 23.875 C 50 20.171875 49.328125 16.476563 47.5 13.40625 C 45.808594 10.566406 43.078125 8.328125 39.21875 7.28125 C 39.277344 7.136719 39.347656 7.027344 39.40625 6.875 C 39.554688 6.507813 39.472656 6.082031 39.195313 5.796875 C 38.917969 5.515625 38.496094 5.421875 38.125 5.5625 C 37.40625 5.835938 36.929688 5.808594 36.3125 5.625 C 35.695313 5.441406 34.976563 5.058594 34.09375 4.78125 C 33.210938 4.503906 32.101563 4.351563 30.875 4.6875 C 30.269531 4.855469 29.667969 5.15625 29 5.5625 C 29.378906 4.605469 29.957031 3.496094 31.21875 2.375 C 31.425781 2.191406 31.550781 1.925781 31.554688 1.648438 C 31.5625 1.367188 31.449219 1.101563 31.25 0.90625 C 30.4375 0.113281 29.410156 0.03125 28.65625 0.0625 Z M 28.75 2.0625 C 28.800781 2.058594 28.824219 2.09375 28.875 2.09375 C 27.816406 3.355469 27.085938 4.628906 26.78125 5.65625 C 26.582031 6.335938 26.5 6.921875 26.46875 7.34375 C 26.453125 7.554688 26.433594 7.710938 26.4375 7.84375 C 26.4375 7.910156 26.464844 7.976563 26.46875 8.03125 C 26.472656 8.058594 26.460938 8.074219 26.46875 8.125 C 26.472656 8.152344 26.472656 8.195313 26.5 8.28125 C 26.507813 8.304688 26.53125 8.34375 26.53125 8.34375 C 26.53125 8.34375 26.625 8.53125 26.625 8.53125 C 26.625 8.53125 26.96875 8.84375 26.96875 8.84375 C 26.96875 8.84375 27.96875 8.84375 27.96875 8.84375 C 28.023438 8.808594 28.078125 8.765625 28.125 8.71875 C 29.53125 7.433594 30.589844 6.847656 31.40625 6.625 C 32.222656 6.402344 32.835938 6.476563 33.5 6.6875 C 34.164063 6.898438 34.878906 7.273438 35.75 7.53125 C 36.074219 7.625 36.441406 7.65625 36.8125 7.6875 C 36.332031 8.585938 35.886719 9.195313 35.4375 9.40625 C 34.765625 9.722656 33.640625 9.675781 31.71875 9.59375 C 31.167969 9.53125 30.667969 9.933594 30.609375 10.484375 C 30.546875 11.035156 30.949219 11.535156 31.5 11.59375 C 33.839844 12 34.21875 12.582031 34.84375 13.46875 C 35.222656 14.007813 35.828125 14.675781 36.65625 15.28125 C 35.253906 15.878906 34.097656 16.085938 33.1875 15.78125 C 31.921875 15.359375 30.679688 14.136719 29.28125 12.34375 C 28.953125 11.960938 28.390625 11.882813 27.96875 12.160156 C 27.550781 12.4375 27.402344 12.984375 27.625 13.4375 C 28.617188 15.339844 28.730469 16.21875 28.53125 17.3125 C 28.386719 18.097656 27.859375 19.480469 27.375 20.84375 C 25.570313 19.503906 24.621094 18.253906 24.34375 17.1875 C 24.011719 15.902344 24.316406 14.789063 24.46875 13.78125 C 24.605469 13.246094 24.285156 12.699219 23.75 12.5625 C 23.214844 12.425781 22.667969 12.746094 22.53125 13.28125 C 21.785156 15.289063 20.640625 16.023438 19 16.21875 C 17.886719 16.351563 16.488281 16.046875 15.03125 15.59375 C 15.285156 15.363281 15.574219 15.164063 15.75 14.90625 C 16.328125 14.050781 16.558594 13.160156 16.8125 12.46875 C 17.066406 11.777344 17.28125 11.304688 17.71875 11 C 18.15625 10.695313 18.933594 10.464844 20.5 10.59375 C 20.984375 10.636719 21.429688 10.320313 21.550781 9.851563 C 21.675781 9.378906 21.441406 8.890625 21 8.6875 C 20.882813 8.636719 20.769531 8.664063 20.65625 8.625 L 20.65625 8.59375 C 20.621094 8.589844 20.597656 8.597656 20.5625 8.59375 C 19.953125 8.40625 19.316406 8.28125 18.75 8.21875 C 18.042969 8.140625 17.417969 8.035156 16.90625 7.8125 C 16.394531 7.589844 15.972656 7.285156 15.625 6.59375 C 15.566406 6.476563 15.582031 6.140625 15.53125 6 C 16.46875 6.347656 17.390625 6.347656 18.25 6.375 C 20.03125 6.429688 21.53125 6.410156 23.21875 8.78125 C 23.445313 9.097656 23.835938 9.25 24.21875 9.179688 C 24.601563 9.105469 24.90625 8.816406 25 8.4375 C 25.832031 4.820313 27.859375 2.488281 28.15625 2.15625 C 28.292969 2.121094 28.421875 2.078125 28.75 2.0625 Z M 14.3125 8.25 C 14.820313 8.921875 15.449219 9.375 16.09375 9.65625 C 16.160156 9.683594 16.214844 9.664063 16.28125 9.6875 C 15.589844 10.3125 15.191406 11.089844 14.9375 11.78125 C 14.644531 12.585938 14.425781 13.292969 14.09375 13.78125 C 13.761719 14.269531 13.367188 14.609375 12.34375 14.8125 C 11.90625 14.886719 11.570313 15.242188 11.519531 15.683594 C 11.472656 16.125 11.714844 16.546875 12.125 16.71875 C 14.554688 17.792969 16.988281 18.453125 19.21875 18.1875 C 20.363281 18.050781 21.433594 17.609375 22.34375 16.875 C 22.378906 17.15625 22.328125 17.390625 22.40625 17.6875 C 22.882813 19.523438 24.269531 21.527344 27.34375 23.375 C 27.605469 23.53125 27.929688 23.558594 28.214844 23.449219 C 28.5 23.339844 28.722656 23.105469 28.8125 22.8125 C 29.519531 20.542969 30.222656 19.195313 30.5 17.6875 C 30.574219 17.289063 30.480469 16.851563 30.46875 16.4375 C 31.109375 16.945313 31.761719 17.429688 32.53125 17.6875 C 34.472656 18.335938 36.753906 17.886719 39.4375 16.1875 C 39.773438 15.972656 39.953125 15.582031 39.890625 15.1875 C 39.828125 14.796875 39.542969 14.476563 39.15625 14.375 C 37.359375 13.90625 37.167969 13.308594 36.46875 12.3125 C 36.257813 12.011719 35.863281 11.691406 35.53125 11.375 C 35.777344 11.308594 36.042969 11.332031 36.28125 11.21875 C 37.132813 10.820313 37.78125 10.152344 38.375 9.125 C 41.957031 10.003906 44.28125 11.917969 45.78125 14.4375 C 47.355469 17.082031 48 20.421875 48 23.875 C 48 32.238281 45.042969 38.214844 40.71875 42.15625 C 36.394531 46.097656 30.644531 48 25 48 C 12.285156 48 2 37.5625 2 26.28125 C 2 21.941406 2.894531 17.984375 4.90625 14.84375 C 6.855469 11.796875 9.859375 9.46875 14.3125 8.25 Z'

const simple_fill_carrot = 'M26.54,1.68c-.09,0-2.2.34-2.75,2a3.55,3.55,0,0,0,2.12,4.2,3.1,3.1,0,0,0,4.64,3.53A4.77,4.77,0,0,1,31.36,13c.34,1.18.32,2.75-1.51,4.81a17.21,17.21,0,0,0-5.62-3.13,9.68,9.68,0,0,0-3-.5,3.1,3.1,0,0,0-2.37.92C15.12,19.32,10.4,27,6.73,33.86,4.9,37.3,3.33,40.51,2.3,43a25.59,25.59,0,0,0-1.11,3.15A5.26,5.26,0,0,0,1,47.32a1.51,1.51,0,0,0,.41,1.25h0a1.47,1.47,0,0,0,1,.42,3.22,3.22,0,0,0,.92-.06,13.57,13.57,0,0,0,2.37-.67A64.32,64.32,0,0,0,13,45,170.87,170.87,0,0,0,34.85,31.21l.12-.1a3.45,3.45,0,0,0,.86-2.4,9.35,9.35,0,0,0-.5-3,17.09,17.09,0,0,0-3.9-6.43c2.43-1.74,4.15-1.59,5.43-1.08a5.08,5.08,0,0,1,1.78,1.2,3.39,3.39,0,0,0-.13,2.7,3.52,3.52,0,0,0,2.54,2c.86,2.57,3.54,3.58,5.21,2.74a3.79,3.79,0,0,0,1.71-4,3.1,3.1,0,0,0-1-6A2.8,2.8,0,0,0,45.65,15a2.93,2.93,0,0,0-2.68.05,2.92,2.92,0,0,0,.36-1.63,3.22,3.22,0,0,0,1.14.15,2.54,2.54,0,0,0,1.69-.82A2.24,2.24,0,0,0,46.7,11a2.46,2.46,0,0,0-.2-.47,3.1,3.1,0,0,0,1.38-2,3.15,3.15,0,0,0-.48-2.31A3.07,3.07,0,0,0,43,2.8a4.52,4.52,0,0,0-4.19.26,4.5,4.5,0,0,0-1.94,3.6,4.33,4.33,0,0,0-.52,0,2.86,2.86,0,0,0-1.51.58h0a2.75,2.75,0,0,0,.4-2.54,2.77,2.77,0,0,0-2-1.67,3.91,3.91,0,0,0-3-2.91A3.65,3.65,0,0,0,26.54,1.68Z'
const simple_fill_celery = 'M36.94,31.16a5.78,5.78,0,0,1-3.72-1.47l-1.75-2.34a4.52,4.52,0,0,1-3.42-.44,4.77,4.77,0,0,1-2.15-3.86A6.17,6.17,0,0,1,21,21.69a6,6,0,0,1-2-3.88,4.73,4.73,0,0,1-3-3.25,4.88,4.88,0,0,1,1.62-4.45,5.25,5.25,0,0,1,1.43-4.49,4.81,4.81,0,0,1,2.94-1.24l2-.25,1.62-1.46A5.2,5.2,0,0,1,28.25,1.5,5.61,5.61,0,0,1,32.5,2.72a5.76,5.76,0,0,1,8,2.12A5.78,5.78,0,0,1,46,7.57a5.65,5.65,0,0,1,.47,4.24,6.78,6.78,0,0,1,0,9.38,6.76,6.76,0,0,1-.92,5.26c-.19.28-1.81,2.53-4,2.55h-.06A6,6,0,0,1,36.94,31.16Zm-5,0L31.75,31l-1.16-1.55h-.32A6.33,6.33,0,0,1,27,28.62a6.22,6.22,0,0,1-2.77-3.55,7.75,7.75,0,0,1-4.56-1.88,7.86,7.86,0,0,1-2.43-4c-1.34,1.07-3.1,2.45-4.9,3.9-2.82,2.26-5.68,4.6-7.16,6.09A11,11,0,0,0,20.78,44.78C23.2,42.36,28.91,35.21,32,31.25Z'
const simple_fill_corn = 'M5.12,23a1,1,0,0,0-1,.44,1,1,0,0,0,.18,1.31c2.57,2.16,3.65,6,4.78,10C11.14,41.89,13.43,50,25,50a1,1,0,0,0,1-1c0-12.84-6.62-18.56-20.53-25.88A1,1,0,0,0,5.12,23Zm19.5,12.72C22,31.39,17.76,27.94,12,24.5A38.42,38.42,0,0,1,15.62,7.41C17.79,3.18,20.87.29,24.47,0c.17,0,.35,0,.53,0a3.08,3.08,0,0,1,.53,0c3.6.26,6.68,3.15,8.85,7.38a32.05,32.05,0,0,1,2.74,8.31A44.51,44.51,0,0,1,38,24.5c0,1.19,0,2.31-.1,3.4C31.85,28,27.42,32,24.62,35.72Zm13.57-5.85c-5.82,0-10.07,4.33-12.5,7.75A26,26,0,0,1,28,49a3.11,3.11,0,0,1-.12.81c6.94-.93,8.84-5.26,10.53-9.15,1.41-3.27,2.65-6.07,6.75-6.66a1,1,0,0,0,.81-.78,1,1,0,0,0-.44-1.06A14,14,0,0,0,38.19,29.87Z'
const simple_fill_eggplant = 'M43.7,22.26c-1.41,5.2-4.91,11-9.7,16C28.15,44.29,20.36,49,12,49A11,11,0,0,1,1,38a12.15,12.15,0,0,1,2-7.31,11.75,11.75,0,0,1,5-3.75c3.87-1.74,8.49-2.67,12.56-5.72A52.1,52.1,0,0,0,27,14.88c.87-1,1.7-1.85,2.55-2.65l.59.29a15.09,15.09,0,0,0,6.63,1.63h.16a15.34,15.34,0,0,0,1.79-.1,10.46,10.46,0,0,0,.46,2.42,10.68,10.68,0,0,0,4.25,5.59ZM46.88,1.19l1.62.93A1.06,1.06,0,0,1,49,3.28,21.29,21.29,0,0,1,45,10.47c.66,1.43,2,4.61-.41,9.75a.76.76,0,0,1-.12.19A8.76,8.76,0,0,1,41,15.87a8.63,8.63,0,0,1-.22-4.31,12.91,12.91,0,0,1-4.06.61A13.1,13.1,0,0,1,31,10.75,8.23,8.23,0,0,1,38.06,7c.56,0,1.1.06,1.6.09.33,0,.64,0,.93,0A30.66,30.66,0,0,0,45.53,1.5a1.16,1.16,0,0,1,.63-.44A1,1,0,0,1,46.88,1.19Z'
const simple_fill_mushroom = 'M 26.8125 3 C 26.015625 3 25.207031 3.050781 24.40625 3.125 C 11.128906 4.34375 3 15.464844 3 21.125 C 3 26.292969 8.488281 27 13.84375 27 C 16.597656 27 19.800781 26.78125 23.1875 26.5625 L 24.84375 26.46875 C 38.527344 25.601563 47 23.652344 47 16.6875 C 47 11.234375 38.949219 3 26.8125 3 Z M 34.21875 27.5625 C 31.289063 27.996094 28.140625 28.269531 24.96875 28.46875 L 23.3125 28.5625 C 22.1875 28.636719 21.078125 28.71875 20 28.78125 C 19.53125 33.21875 18.402344 39.214844 15.65625 43.34375 C 14.792969 44.644531 14.945313 45.523438 15.21875 46.03125 C 15.414063 46.394531 15.910156 47 17.09375 47 L 31.65625 47 C 33.230469 47 33.710938 46.066406 33.96875 45.09375 C 34.472656 43.234375 35.835938 36.824219 34.21875 27.5625 Z'
const simple_fill_olive = 'M25.11,20.71A25.15,25.15,0,0,1,20.5,18.6,16.57,16.57,0,0,1,12.2,3.7a.91.91,0,0,1,.4-.8,1.41,1.41,0,0,1,.9-.1h.1c9.66,4.08,14,9.1,15.81,15.35l-.6.28a6.72,6.72,0,0,0-.83.47l-2,1.2-.1.06ZM42.8,16a39.74,39.74,0,0,0-10.3,2.9l-2.8,1.3a5.74,5.74,0,0,0-.7.4l-2,1.2a33.9,33.9,0,0,0-3.29,2.53,10.31,10.31,0,0,1,1.42,1.38C32.83,19.24,43,18,43,18a1,1,0,0,0-.2-2Zm4.8,15.9c1.4,6.4-1.7,12.7-7.1,13.9s-10.8-3.3-12.2-9.7S30,23.4,35.4,22.2a6.48,6.48,0,0,1,2-.2C42.1,22.1,46.4,26.3,47.6,31.9ZM21.78,25.37c4.77,3.06,5.61,10.29,1.88,16.16a13.79,13.79,0,0,1-8.44,6.22A10.57,10.57,0,0,1,13,48a8.81,8.81,0,0,1-4.78-1.38c-4.77-3-5.61-10.28-1.88-16.15a13.79,13.79,0,0,1,8.44-6.22A10.21,10.21,0,0,1,16.66,24,9,9,0,0,1,21.78,25.37Z'
const simple_fill_tomato = 'M50,23.88c0,8.83-3.2,15.42-7.94,19.74A25.27,25.27,0,0,1,25,50C11.2,50,0,38.77,0,26.28A23,23,0,0,1,3.22,13.75a17,17,0,0,1,8.15-6.59,9.23,9.23,0,0,0,3.24,5A9.13,9.13,0,0,0,20.24,14l.55,0A10.3,10.3,0,0,0,24.2,19.7,10.34,10.34,0,0,0,30.77,22a11.5,11.5,0,0,0,5.52-1.43,2,2,0,0,0,.4-3.19,9.49,9.49,0,0,1-1.4-1.64,8.79,8.79,0,0,1-.78-1.44c-.09-.21-.19-.42-.31-.65a10,10,0,0,0,1.66-.6A10.5,10.5,0,0,0,41,7.89a13.18,13.18,0,0,1,6.51,5.52A20.38,20.38,0,0,1,50,23.88ZM31,.75C27.32,4,27.63,6.64,27.66,6.62c6.1-5.24,7.88,1,11.93-.59A8.71,8.71,0,0,1,35,11.25a8.64,8.64,0,0,1-6.26.29,6.55,6.55,0,0,1,3.28,2.38c.61.9.7,1.62,1.58,2.92a11.46,11.46,0,0,0,1.69,2,8.86,8.86,0,0,1-9.86-.66,8.83,8.83,0,0,1-3-6.44,7.84,7.84,0,0,1-6.67-1.15,7.59,7.59,0,0,1-2.41-8.3c1.95,5,5.56,0,10.37,4.09,1-4.54,4-6.06,4-6.06A5.29,5.29,0,0,1,29,.12,2.73,2.73,0,0,1,31,.75Z'

const simple_stroke_carrot = 'M48,22.8a3.79,3.79,0,0,1-1.71,4c-1.67.84-4.35-.17-5.21-2.74a3.52,3.52,0,0,1-2.54-2,3.35,3.35,0,0,1,.13-2.69,5,5,0,0,0-1.78-1.21c-1.28-.51-3-.66-5.43,1.08a17.09,17.09,0,0,1,3.9,6.43,9.35,9.35,0,0,1,.5,3,3.45,3.45,0,0,1-.86,2.4l-.12.1A170.87,170.87,0,0,1,13,45a64.32,64.32,0,0,1-7.31,3.31,13.57,13.57,0,0,1-2.37.67,3.22,3.22,0,0,1-.92.06,1.47,1.47,0,0,1-1-.42h0A1.51,1.51,0,0,1,1,47.32a5.26,5.26,0,0,1,.19-1.17A25.59,25.59,0,0,1,2.3,43c1-2.49,2.6-5.7,4.43-9.14,3.67-6.86,8.39-14.54,12.1-18.8a3.13,3.13,0,0,1,2.37-.92,9.68,9.68,0,0,1,3,.5,17.21,17.21,0,0,1,5.62,3.13c1.83-2.06,1.85-3.63,1.51-4.81a4.77,4.77,0,0,0-.81-1.57,3.1,3.1,0,0,1-4.64-3.53,3.55,3.55,0,0,1-2.12-4.2c.55-1.64,2.66-2,2.75-2A3.65,3.65,0,0,1,30.21.11a3.91,3.91,0,0,1,3,2.91,2.77,2.77,0,0,1,2,1.67,2.75,2.75,0,0,1-.4,2.54h0a2.86,2.86,0,0,1,1.51-.58,4.33,4.33,0,0,1,.52,0,4.5,4.5,0,0,1,1.94-3.6A4.52,4.52,0,0,1,43,2.8a3.07,3.07,0,0,1,4.4,3.45,3.15,3.15,0,0,1,.48,2.31,3.1,3.1,0,0,1-1.38,2,2.46,2.46,0,0,1,.2.47,2.24,2.24,0,0,1-.54,1.73,2.54,2.54,0,0,1-1.69.82,3.22,3.22,0,0,1-1.14-.15A2.92,2.92,0,0,1,43,15.06,2.93,2.93,0,0,1,45.65,15,2.8,2.8,0,0,1,47,16.78a3.1,3.1,0,0,1,1,6Zm-3,2.3a.9.9,0,0,0,.39-.08A2,2,0,0,0,46,23.09,2,2,0,0,1,47.24,21a1.12,1.12,0,0,0-.37-2.19,2,2,0,0,1-1.81-1.51.88.88,0,0,0-.36-.5.64.64,0,0,0-.28-.07,1.21,1.21,0,0,0-.47.11,2.05,2.05,0,0,1-1,.26,2,2,0,0,1-1.7-3,1.14,1.14,0,0,0,.07-.56,2,2,0,0,1,.79-1.59,2,2,0,0,1,1.26-.43,2.22,2.22,0,0,1,.51.06,2.21,2.21,0,0,0,.41.08h0a.6.6,0,0,0,.38-.17,0,0,0,0,0,0,0c0-.05,0-.11-.07-.17a2,2,0,0,1,.82-2.35,1.06,1.06,0,0,0,.31-1.5,2,2,0,0,1-.29-1.57,1.14,1.14,0,0,0-.34-1.1,1.07,1.07,0,0,0-.71-.26,1.21,1.21,0,0,0-.53.12,1.93,1.93,0,0,1-.88.21,2,2,0,0,1-.86-.19,3,3,0,0,0-1.08-.21,2.09,2.09,0,0,0-1.18.34,2.5,2.5,0,0,0-1,1.93,2.05,2.05,0,0,1-.74,1.49,2.08,2.08,0,0,1-1.38.51l-.24,0a.9.9,0,0,0-.47.19,2,2,0,0,1-1.18.39A2,2,0,0,1,34,9a2,2,0,0,1-1.09-1.77,2.18,2.18,0,0,1,.4-1.2.76.76,0,0,0,.12-.65.79.79,0,0,0-.5-.41h0a2,2,0,0,1-1.59-1.49,1.92,1.92,0,0,0-1.48-1.43l-.28,0a2,2,0,0,0-1.42.87,2,2,0,0,1-1.24.75c-.51.09-1.1.36-1.2.66a1.6,1.6,0,0,0,1.06,1.75,2,2,0,0,1,1.08,2.38,1.17,1.17,0,0,0,.42,1.28,1.13,1.13,0,0,0,.62.19,1.19,1.19,0,0,0,.64-.18,2,2,0,0,1,1.06-.31,2,2,0,0,1,1.57.77,6.91,6.91,0,0,1,1.15,2.24,5.92,5.92,0,0,1-.13,3.74,6.78,6.78,0,0,1,2-.31,6.44,6.44,0,0,1,2.45.48A7,7,0,0,1,40.07,18a2,2,0,0,1,.34,2.28,1.38,1.38,0,0,0-.06,1.05,1.49,1.49,0,0,0,1,.77,2,2,0,0,1,1.57,1.33,2.34,2.34,0,0,0,2,1.68ZM3,47a11.55,11.55,0,0,0,2-.58,61.74,61.74,0,0,0,7.07-3.21A166.33,166.33,0,0,0,33.61,29.66a1.78,1.78,0,0,0,.23-1,7.21,7.21,0,0,0-.4-2.38A15,15,0,0,0,30,20.66l-1.49-1.4a15.33,15.33,0,0,0-4.9-2.73,7.76,7.76,0,0,0-2.27-.4h-.11a1.52,1.52,0,0,0-.94.24C17.15,20,12.61,27.08,8.48,34.8c-1.85,3.47-3.36,6.57-4.34,9a21.53,21.53,0,0,0-1,2.89C3.08,46.77,3.06,46.88,3,47Z'
const simple_stroke_celery = 'M28.25,1.5a5.2,5.2,0,0,0-2.57,1.17L24.06,4.12l-2,.26a4.81,4.81,0,0,0-2.94,1.24,5.25,5.25,0,0,0-1.43,4.49,4.88,4.88,0,0,0-1.62,4.45,4.73,4.73,0,0,0,3,3.25c-1.16,1-3.87,3.08-6.65,5.31s-5.68,4.61-7.16,6.1A11,11,0,0,0,20.78,44.78c2.79-2.79,10-11.87,12.44-15.09a5.78,5.78,0,0,0,3.72,1.47A6,6,0,0,0,41.44,29h.06c2.24,0,3.86-2.27,4-2.55a6.76,6.76,0,0,0,.92-5.26,6.78,6.78,0,0,0,0-9.38A5.65,5.65,0,0,0,46,7.57a5.78,5.78,0,0,0-5.49-2.73,5.76,5.76,0,0,0-8-2.12A5.61,5.61,0,0,0,28.25,1.5ZM37,29.18a3.69,3.69,0,0,1-2.28-.86l-2.42-3.24-1.3.36a3.1,3.1,0,0,1-.69.08,2.35,2.35,0,0,1-1.21-.32A2.8,2.8,0,0,1,27.88,23l-.07-2.28-2.24.35a4.59,4.59,0,0,1-.61,0A3.81,3.81,0,0,1,21,17.62l-.13-1.28-1.22-.41A2.77,2.77,0,0,1,18,14.12a3,3,0,0,1,1-2.55l.81-.73-.18-1.06a3.27,3.27,0,0,1,.82-2.71,2.85,2.85,0,0,1,1.73-.71h.11L24.93,6,27,4.14a3.26,3.26,0,0,1,1.54-.68,2.35,2.35,0,0,1,.45,0,3.76,3.76,0,0,1,2.24.84l1.09.88,1.2-.72a3.92,3.92,0,0,1,2-.55,3.5,3.5,0,0,1,.91.12,3.94,3.94,0,0,1,2.36,1.82l.62,1.11,1.26-.1H41a3.75,3.75,0,0,1,3.28,1.74,3.75,3.75,0,0,1,.28,2.73l-.31,1.08.78.82a4.78,4.78,0,0,1,0,6.64l-.74.77.24,1a4.77,4.77,0,0,1-.6,3.68c-.41.59-1.45,1.7-2.45,1.71h-.94l-.65.73A3.93,3.93,0,0,1,37,29.18ZM32,28l-.34.44C28.76,32.23,22,40.8,19.38,43.38A9,9,0,0,1,6.62,30.62c1.5-1.49,4.52-4,7-5.95L17,22l2.6-2.07A5.83,5.83,0,0,0,21,21.69a6.17,6.17,0,0,0,4.89,1.36,4.77,4.77,0,0,0,2.15,3.86,4.52,4.52,0,0,0,3.42.44Z'
const simple_stroke_corn = 'M25,0c-.18,0-.36,0-.53,0-3.6.26-6.68,3.15-8.85,7.38A38.42,38.42,0,0,0,12,24.5c0,.79,0,1.56,0,2.31-1.92-1.17-4-2.34-6.34-3.56-.08,0-.12-.09-.19-.13A1,1,0,0,0,4.88,23a1,1,0,0,0-.54,1.75c3.36,2.83,4.2,8.87,6.16,14.47a17.36,17.36,0,0,0,4.56,7.53c2.24,2,5.4,3.21,9.75,3.25h.28c4,0,6.79-1,8.75-2.5a13.93,13.93,0,0,0,4-5.53,31.29,31.29,0,0,1,2.63-5.25A6.42,6.42,0,0,1,45.16,34a1,1,0,0,0,.37-1.84,13.68,13.68,0,0,0-7.75-2.25c.12-1.7.22-3.48.22-5.41a44.51,44.51,0,0,0-.88-8.78,32.05,32.05,0,0,0-2.74-8.31C32.21,3.18,29.13.29,25.53,0A3.08,3.08,0,0,0,25,0ZM8.59,27.25c4.57,2.64,8.37,5.2,10.79,8,2.92,3.39,4.33,7.26,4.53,12.59-3.39-.2-5.81-1.09-7.5-2.59a15.41,15.41,0,0,1-4-6.69C11.08,34.88,10.32,30.7,8.59,27.25ZM24.37,39.72A19.75,19.75,0,0,0,20.88,34c-1.66-1.92-7-5.32-6.9-5.72V24.5A36.32,36.32,0,0,1,17.39,8.31c2-3.87,4.55-6.11,7.22-6.3h.16L25,2h.22l.17,0c2.67.19,5.24,2.43,7.22,6.3a30.37,30.37,0,0,1,2.57,7.8A43.17,43.17,0,0,1,36,24.5c0,2-.12,3.87-.22,5.27a2.29,2.29,0,0,0,0,.37,14.45,14.45,0,0,0-6.74,3.68A26.17,26.17,0,0,0,24.37,39.72Zm13.41-7.81a12.24,12.24,0,0,1,4.47,1,8.69,8.69,0,0,0-3.41,2.59A31.29,31.29,0,0,0,36,41.16a11.88,11.88,0,0,1-3.38,4.75A11.2,11.2,0,0,1,26,48a26.8,26.8,0,0,0-.75-5.66,25,25,0,0,1,5.19-7,12.41,12.41,0,0,1,6-3.25A6.55,6.55,0,0,1,37.78,31.91Z'
const simple_stroke_eggplant = 'M48.5,2.1l-1.6-0.9C46.7,1.1,46.5,1,46.3,1h-0.1c-0.3,0-0.5,0.2-0.7,0.5c-1.4,2.1-3.1,4-5,5.7c-1.9,0-6.1-1-9.5,3.6 c-0.1,0.1-0.1,0.2-0.1,0.3c-1.4,1.2-2.7,2.5-3.9,3.9c-2,2.3-4.1,4.4-6.5,6.3c-4.1,3.1-8.7,4-12.6,5.7c-2,0.8-3.7,2.1-5,3.8 c-1.4,2.2-2.1,4.7-2,7.3c0,6.1,4.9,11,11,11c8.4,0,16.2-4.7,22-10.8c5.2-5.4,9-11.9,10.1-17.5c0.2-0.1,0.5-0.3,0.6-0.5 c1.2-2.2,1.6-4.7,1.3-7.2c-0.1-0.7-0.4-1.4-0.7-2.1c-0.1-0.3-0.1-0.4-0.2-0.5c1.8-2.1,3.1-4.5,4-7.1C49.1,2.8,48.9,2.3,48.5,2.1z M42.2,20.3c-1,5.2-4.6,11.4-9.6,16.5C28.9,40.7,21.4,47,12,47c-5,0-9-4-9-9c-0.1-2.2,0.4-4.3,1.6-6.2c1.1-1.4,2.5-2.5,4.2-3.1 c1.2-0.5,2.4-1,3.8-1.5c3.3-1,6.4-2.5,9.2-4.5c2.2-1.8,4.3-3.8,6.1-5.9l0.6-0.7c1.1-1.3,2.3-2.5,3.6-3.6c1.5,0.5,3.1,0.8,4.7,0.8H37 c0.8,0,1.7-0.1,2.5-0.2c0,2.6,1,5.1,2.8,6.9l0,0C42.2,20.2,42.2,20.3,42.2,20.3z M43.4,9.1c-0.5,0.6-0.6,1.4-0.3,2.1l0.2,0.5 c0.2,0.5,0.4,1.1,0.5,1.7c0.3,1.7,0,3.4-0.6,5l0,0l0,0l0,0c-0.7-0.8-1.2-1.7-1.5-2.7c-0.2-0.8-0.4-1.6-0.4-2.4 c0-0.6-0.3-1.1-0.7-1.5c-0.4-0.3-0.8-0.5-1.3-0.5c-0.1,0-0.2,0-0.4,0c-0.7,0.1-1.4,0.2-2.1,0.2h-0.1c-1.1,0-2.3-0.1-3.4-0.4 c1.3-1.3,3-2.1,4.8-2c0.5,0,0.9,0,1.3,0.1c0.4,0.1,0.6,0,0.9,0c0.5,0,0.9-0.2,1.3-0.5c1.8-1.6,3.4-3.4,4.8-5.3l0.2,0.1 C46,5.4,44.8,7.3,43.4,9.1z'
const simple_stroke_mushroom = 'M 26.78125 3 C 26 3.007813 25.214844 3.050781 24.40625 3.125 C 17.910156 3.722656 12.582031 6.734375 8.875 10.3125 C 5.167969 13.890625 3 17.929688 3 21.125 C 3 22.871094 3.765625 24.34375 5.03125 25.25 C 6.296875 26.15625 7.949219 26.585938 9.90625 26.8125 C 12.742188 27.136719 16.257813 27.019531 20.1875 26.78125 C 19.851563 31.367188 18.757813 38.679688 15.65625 43.34375 C 15.117188 44.152344 14.792969 44.941406 15.09375 45.78125 C 15.242188 46.199219 15.601563 46.5625 15.96875 46.75 C 16.335938 46.9375 16.707031 47 17.09375 47 L 31.65625 47 C 32.230469 47 32.824219 46.871094 33.25 46.46875 C 33.675781 46.066406 33.824219 45.585938 33.9375 45.15625 C 34.007813 44.898438 34.660156 42.640625 34.90625 39.125 C 35.140625 35.773438 35.03125 31.160156 33.84375 25.59375 C 36.628906 25.1875 38.996094 24.664063 40.9375 23.9375 C 42.820313 23.230469 44.320313 22.328125 45.375 21.125 C 46.429688 19.921875 47 18.382813 47 16.6875 C 47 13.433594 44.5 9.871094 40.5 7.125 C 37.5 5.066406 33.59375 3.496094 29.09375 3.09375 C 28.34375 3.027344 27.5625 2.992188 26.78125 3 Z M 26.8125 5 C 31.867188 5 36.195313 6.601563 39.375 8.78125 C 43.007813 11.273438 45 14.550781 45 16.6875 C 45 17.972656 44.628906 18.953125 43.875 19.8125 C 43.121094 20.671875 41.9375 21.429688 40.25 22.0625 C 36.875 23.324219 31.625 24.03125 24.71875 24.46875 C 18.890625 24.839844 13.6875 25.222656 10.125 24.8125 C 8.34375 24.609375 7 24.207031 6.1875 23.625 C 5.375 23.042969 5 22.359375 5 21.125 C 5 18.921875 6.828125 15.050781 10.25 11.75 C 13.671875 8.449219 18.613281 5.644531 24.59375 5.09375 C 25.34375 5.023438 26.089844 5 26.8125 5 Z M 31.84375 25.875 C 33.011719 31.304688 33.128906 35.789063 32.90625 39 C 32.671875 42.34375 32.113281 44.226563 32 44.65625 C 31.914063 44.980469 31.832031 45.039063 31.875 45 C 31.847656 45.003906 31.792969 45 31.65625 45 L 17.09375 45 C 17.070313 45 17.082031 45 17.0625 45 C 17.078125 44.988281 17.015625 44.882813 17.3125 44.4375 C 20.878906 39.074219 21.902344 31.371094 22.21875 26.65625 C 23.085938 26.601563 23.945313 26.527344 24.84375 26.46875 C 27.398438 26.308594 29.722656 26.125 31.84375 25.875 Z'
const simple_stroke_olive = 'M43,18a1,1,0,0,0-.2-2,39.74,39.74,0,0,0-10.3,2.9l-2.8,1.3a5.74,5.74,0,0,0-.7.4l-2,1.2a27.31,27.31,0,0,0-4.6,3.8c-.1.1-.1.2-.2.2s-.4-.3-.6-.4a8.24,8.24,0,0,0-4-1.3c-4.2-.4-8.7,2.1-11.5,6.4-3.7,5.8-3,13,1.9,16.2s11.8.7,15.4-5.1c3.1-4.9,3.1-10.8.1-14.4.1-.1.2-.1.2-.2C31.5,19.4,43,18,43,18Zm-5.6,4a6.48,6.48,0,0,0-2,.2c-5.4,1.2-8.5,7.5-7.1,13.9S35.1,47,40.5,45.8s8.5-7.5,7.1-13.9C46.4,26.3,42.1,22.1,37.4,22Zm-.8,2c3.9-.3,7.9,3.1,9.1,8.3,1.2,5.6-1.4,10.6-5.5,11.5s-8.6-2.6-9.9-8.2S31.7,25,35.8,24.1A2.2,2.2,0,0,0,36.6,24ZM17,26h.6a6.68,6.68,0,0,1,3.1,1c3.7,2.4,4.5,8.4,1.3,13.4s-8.9,6.9-12.7,4.5S4.8,36.6,8,31.5C10.3,28,13.8,26,17,26Zm13-5.4C28.6,13.2,24.5,7.4,13.6,2.8h-.1a1.41,1.41,0,0,0-.9.1.91.91,0,0,0-.4.8,16.57,16.57,0,0,0,8.3,14.9,24,24,0,0,0,7.1,2.8l2.3-.3A.75.75,0,0,0,30,20.6ZM14.4,5.6c8.3,3.8,11.7,8.2,13.2,13.9a20.11,20.11,0,0,1-6-2.5A14.35,14.35,0,0,1,14.4,5.6Z'
const simple_stroke_tomato = 'M47.5,13.41a13.44,13.44,0,0,0-8.28-6.13c.06-.14.13-.25.19-.4s0-.14.05-.21v0h0a1,1,0,0,0-.26-.83,1,1,0,0,0-1.08-.24,2.43,2.43,0,0,1-1.81.06c-.61-.18-1.33-.56-2.22-.84a5.55,5.55,0,0,0-3.21-.09A7.81,7.81,0,0,0,29,5.56a8,8,0,0,1,2.22-3.18,1,1,0,0,0,.33-.73,1,1,0,0,0-.3-.74A3.34,3.34,0,0,0,28.66.06a5.6,5.6,0,0,0-1.35.22,1,1,0,0,0-.43.28,16.37,16.37,0,0,0-1.33,1.85,10,10,0,0,0-1.28,2.36c-.22.47-.43,1-.62,1.5A7.39,7.39,0,0,0,21.55,5a8.76,8.76,0,0,0-3.24-.64,6.78,6.78,0,0,1-2.12-.26c-.49-.19-.84-.46-1.22-1.43a1,1,0,0,0-1.11-.64A1,1,0,0,0,13,3c0,.41,0,.79,0,1.16a8,8,0,0,0,.2,2.3h0a17.48,17.48,0,0,0-10,7.26A23,23,0,0,0,0,26.28C0,38.77,11.2,50,25,50a25.27,25.27,0,0,0,17.06-6.38C46.8,39.3,50,32.71,50,23.88A20.38,20.38,0,0,0,47.5,13.41ZM15.45,6a8.32,8.32,0,0,0,2.8.39,7.06,7.06,0,0,1,2.53.49,5.42,5.42,0,0,1,1.61,1,2,2,0,0,0,1.26.46,1.89,1.89,0,0,0,.53-.08,2,2,0,0,0,1.34-1.24c.15-.42.33-.85.56-1.35,0,0,0-.07,0-.11a8.24,8.24,0,0,1,1-1.9l.07-.11c.4-.62.74-1.09,1-1.36a2.93,2.93,0,0,1,.57-.06h0a10,10,0,0,0-1.62,2.79A2,2,0,0,0,29,7.55a2,2,0,0,0,1-.29,5.52,5.52,0,0,1,1.38-.66,3.3,3.3,0,0,1,.89-.12,4.34,4.34,0,0,1,1.2.19c.4.13.76.28,1.09.42a11.6,11.6,0,0,0,1.16.44,4.6,4.6,0,0,0,.83.18,8.78,8.78,0,0,1-3.73,2.55c-2.8,1-5.46.08-5.63.69s1.35.93,2.62,2.76a8.25,8.25,0,0,1,.91,1.76c.19.41.37.83.56,1.24L32,17.93a7.06,7.06,0,0,1-1.21.1,6.32,6.32,0,0,1-4-1.39,6.88,6.88,0,0,1-2.26-5,2,2,0,0,0-.81-1.56,1.94,1.94,0,0,0-1.17-.39,2.24,2.24,0,0,0-.57.08,5.92,5.92,0,0,1-1.68.22A5.11,5.11,0,0,1,17,9a5.17,5.17,0,0,1-1.9-3.18ZM40.73,42.16A23.2,23.2,0,0,1,25,48c-12.48,0-23-10-23-21.74A21,21,0,0,1,4.89,14.82,15.54,15.54,0,0,1,14,8.35a6.9,6.9,0,0,0,1.86,2.23,7.84,7.84,0,0,0,6.67,1.15,8.83,8.83,0,0,0,3,6.44,8.86,8.86,0,0,0,9.86.66,25.91,25.91,0,0,1-2.43-3c-.87-1.31-.84-3.07-2.67-3.75.59.2,1.85.48,4.81-.87a8.64,8.64,0,0,0,3.1-2.32,1.93,1.93,0,0,0,.56.27,11.36,11.36,0,0,1,7.09,5.22A18.3,18.3,0,0,1,48,23.88C48,31.49,45.5,37.81,40.73,42.16Z'


const detailPathsList = [detail_carrot, detail_celery, detail_corn, detail_eggplant, detail_mushroom, detail_olive, detail_tomato]
const strokePathsList = [stroke_carrot, stroke_celery, stroke_corn, stroke_eggplant, stroke_mushroom, stroke_olive, stroke_tomato]
const simple_fill_paths_list = [simple_fill_carrot, simple_fill_celery, simple_fill_corn, simple_fill_eggplant, simple_fill_mushroom, simple_fill_olive, simple_fill_tomato]
const simple_stroke_paths_list = [simple_stroke_carrot, simple_stroke_celery, simple_stroke_corn, simple_stroke_eggplant, simple_stroke_mushroom, simple_stroke_olive, simple_stroke_tomato]

const detail_paths_object  = {
    'carrot':detail_carrot,
    'celery':detail_celery,
    'corn':detail_corn,
    'eggplant': detail_eggplant,
    'mushroom': detail_mushroom,
    'olive': detail_olive,
    'tomato': detail_tomato
}

const stroke_paths_object  = {
    'carrot':stroke_carrot,
    'celery':stroke_celery,
    'corn':stroke_corn,
    'eggplant': stroke_eggplant,
    'mushroom': stroke_mushroom,
    'olive': stroke_olive,
    'tomato': stroke_tomato
}

const simple_fill_paths_object  = {
    'carrot':simple_fill_carrot,
    'celery':simple_fill_celery,
    'corn':simple_fill_corn,
    'eggplant': simple_fill_eggplant,
    'mushroom': simple_fill_mushroom,
    'olive': simple_fill_olive,
    'tomato': simple_fill_tomato
}

const simple_stroke_paths_object  = {
    'carrot':simple_stroke_carrot,
    'celery':simple_stroke_celery,
    'corn':simple_stroke_corn,
    'eggplant': simple_stroke_eggplant,
    'mushroom': simple_stroke_mushroom,
    'olive': simple_stroke_olive,
    'tomato': simple_stroke_tomato
}
/**
 * Bertin texture sets
 */
const bertin150 = {
    dotPattern0Background: 0,
    dotPattern0Density: "8",
    dotPattern0Primitive: 0,
    dotPattern0PrimitiveStrokeWidth: "1",
    dotPattern0PrimitiveStrokeWidthMax: "2",
    dotPattern0Rotate: "0",
    dotPattern0Size: "1",
    dotPattern0SizeDot: "1",
    dotPattern0SizeMax: "4",
    dotPattern1Background: 0,
    dotPattern1Density: "12",
    dotPattern1Primitive: 1,
    dotPattern1PrimitiveStrokeWidth: "1",
    dotPattern1PrimitiveStrokeWidthMax: "4",
    dotPattern1Rotate: "45",
    dotPattern1Size: "2",
    dotPattern1SizeDot: "2",
    dotPattern1SizeMax: "6",
    dotPattern2Background: 0,
    dotPattern2Density: "12",
    dotPattern2Primitive: 1,
    dotPattern2PrimitiveStrokeWidth: "2",
    dotPattern2PrimitiveStrokeWidthMax: "4",
    dotPattern2Rotate: "45",
    dotPattern2Size: "2",
    dotPattern2SizeDot: "2",
    dotPattern2SizeMax: "6",
    gridPattern4Angle: "45",
    gridPattern4Background: 0,
    gridPattern4Density: "10",
    gridPattern4Rotate: "45",
    gridPattern4StrokeWidth: "1",
    gridPattern4StrokeWidthMax: "10",
    gridPattern6Angle: "45",
    gridPattern6Background: 0,
    gridPattern6Density: "10",
    gridPattern6Rotate: "0",
    gridPattern6StrokeWidth: "2",
    gridPattern6StrokeWidthMax: "10",
    linePattern3Background: 0,
    linePattern3Density: "7",
    linePattern3StrokeWidth: "1",
    linePattern3StrokeWidthMax: "7",
    linePattern5Background: 0,
    linePattern5Density: "11",
    linePattern5Rotate: "45",
    linePattern5StrokeWidth: "2",
    linePattern5StrokeWidthMax: "11",
    patternType0: 1,
    patternType1: 1,
    patternType2: 1,
    patternType3: 0,
    patternType4: 2,
    patternType5: 0,
    patternType6: 2
}

const bertin183 = {
    dotPattern0Background: 0,
    dotPattern0Density: "15",
    dotPattern0Primitive: 0,
    dotPattern0PrimitiveStrokeWidth: "1",
    dotPattern0PrimitiveStrokeWidthMax: "2",
    dotPattern0Rotate: "45",
    dotPattern0Size: "1",
    dotPattern0SizeDot: "1",
    dotPattern0SizeMax: "7.5",
    dotPattern3Background: 0,
    dotPattern3Density: "9",
    dotPattern3Primitive: 0,
    dotPattern3PrimitiveStrokeWidth: "1",
    dotPattern3PrimitiveStrokeWidthMax: "6",
    dotPattern3Rotate: "0",
    dotPattern3Size: "3",
    dotPattern3SizeDot: "3",
    dotPattern3SizeMax: "4.5",
    dotPattern5Background: 1,
    dotPattern5Density: "12",
    dotPattern5Primitive: 0,
    dotPattern5PrimitiveStrokeWidth: "1",
    dotPattern5PrimitiveStrokeWidthMax: "2",
    dotPattern5Rotate: "45",
    dotPattern5Size: "2",
    dotPattern5SizeDot: "1",
    dotPattern5SizeMax: "6",
    linePattern1Background: 0,
    linePattern1Density: "8",
    linePattern1Rotate: "135",
    linePattern1StrokeWidth: "1",
    linePattern1StrokeWidthMax: "8",
    linePattern2Background: 0,
    linePattern2Density: "7",
    linePattern2Rotate: "45",
    linePattern2StrokeWidth: "2",
    linePattern2StrokeWidthMax: "7",
    linePattern4Background: 0,
    linePattern4Density: "12",
    linePattern4StrokeWidth: "9",
    linePattern4StrokeWidthMax: "12",
    linePattern6Background: 0,
    linePattern6Density: "2",
    linePattern6StrokeWidth: "2",
    linePattern6StrokeWidthMax: "2",
    patternType0: 1,
    patternType1: 0,
    patternType2: 0,
    patternType3: 1,
    patternType4: 0,
    patternType5: 1,
    patternType6: 0
}

const bertin397 = {
    dotPattern2Background: 0,
    dotPattern2Density: "5",
    dotPattern2Primitive: 0,
    dotPattern2PrimitiveStrokeWidth: "1",
    dotPattern2PrimitiveStrokeWidthMax: "2",
    dotPattern2Rotate: "45",
    dotPattern2Size: "1",
    dotPattern2SizeDot: "1",
    dotPattern2SizeMax: "2.5",
    dotPattern3Background: 0,
    dotPattern3Density: "10",
    dotPattern3Primitive: 0,
    dotPattern3PrimitiveStrokeWidth: "1",
    dotPattern3PrimitiveStrokeWidthMax: "2",
    dotPattern3Rotate: "45",
    dotPattern3Size: "1",
    dotPattern3SizeDot: "1",
    dotPattern3SizeMax: "5",
    dotPattern4Background: 0,
    dotPattern4Density: "11",
    dotPattern4Primitive: 0,
    dotPattern4PrimitiveStrokeWidth: "1",
    dotPattern4PrimitiveStrokeWidthMax: "4",
    dotPattern4Rotate: "45",
    dotPattern4Size: "2",
    dotPattern4SizeDot: "2",
    dotPattern4SizeMax: "5.5",
    dotPattern5Background: 0,
    dotPattern5Density: "9",
    dotPattern5Primitive: 0,
    dotPattern5PrimitiveStrokeWidth: "1",
    dotPattern5PrimitiveStrokeWidthMax: "6",
    dotPattern5Rotate: "45",
    dotPattern5Size: "3",
    dotPattern5SizeDot: "3",
    dotPattern5SizeMax: "4.5",
    gridPattern1Angle: "45",
    gridPattern1Background: 0,
    gridPattern1Density: "24",
    gridPattern1Rotate: "0",
    gridPattern1StrokeWidth: "1",
    gridPattern1StrokeWidthMax: "24",
    linePattern0Background: 0,
    linePattern0Density: "4",
    linePattern0StrokeWidth: "1",
    linePattern0StrokeWidthMax: "4",
    linePattern6Background: 0,
    linePattern6Density: "2",
    linePattern6StrokeWidth: "2",
    linePattern6StrokeWidthMax: "2",
    patternType0: 0,
    patternType1: 2,
    patternType2: 1,
    patternType3: 1,
    patternType4: 1,
    patternType5: 1,
    patternType6: 0
}

const bertin231 = {
    dotPattern0Background: 0,
    dotPattern0Density: "15",
    dotPattern0Primitive: 0,
    dotPattern0PrimitiveStrokeWidth: "1",
    dotPattern0PrimitiveStrokeWidthMax: "2",
    dotPattern0Rotate: "45",
    dotPattern0Size: "1",
    dotPattern0SizeDot: "1",
    dotPattern0SizeMax: "7.5",
    dotPattern1Background: 0,
    dotPattern1Density: "7",
    dotPattern1Primitive: 0,
    dotPattern1PrimitiveStrokeWidth: "1",
    dotPattern1PrimitiveStrokeWidthMax: "2",
    dotPattern1Rotate: "45",
    dotPattern1Size: "1",
    dotPattern1SizeDot: "1",
    dotPattern1SizeMax: "3.5",
    dotPattern2Background: 0,
    dotPattern2Density: "5",
    dotPattern2Primitive: 0,
    dotPattern2PrimitiveStrokeWidth: "1",
    dotPattern2PrimitiveStrokeWidthMax: "2",
    dotPattern2Rotate: "45",
    dotPattern2Size: "1",
    dotPattern2SizeDot: "1",
    dotPattern2SizeMax: "2.5",
    dotPattern3Background: "0",
    dotPattern3Density: "10",
    dotPattern3Primitive: "0",
    dotPattern3PrimitiveStrokeWidth: "1",
    dotPattern3PrimitiveStrokeWidthMax: "3.2",
    dotPattern3Rotate: "45",
    dotPattern3Size:"2",
    dotPattern3SizeDot:"1",
    dotPattern3SizeMax: "5",
    gridPattern6Angle: "45",
    gridPattern6Background: 0,
    gridPattern6Density: "4",
    gridPattern6Rotate: "45",
    gridPattern6StrokeWidth: "1",
    gridPattern6StrokeWidthMax: "4",
    linePattern4Background: 0,
    linePattern4Density: "3",
    linePattern4StrokeWidth: "1",
    linePattern4StrokeWidthMax: "2",
    linePattern4Rotate: "0",
    linePattern5Background: 0,
    linePattern5Density: "3",
    linePattern5StrokeWidth: "1",
    linePattern5StrokeWidthMax: "2",
    linePattern5Rotate: "90",
    patternType0: 1,
    patternType1: 1,
    patternType2: 1,
    patternType3: 1,
    patternType4: 0,
    patternType5: 0,
    patternType6: 2
}

const bertin333 = {
    dotPattern4Background: 0,
    dotPattern4Density: "7",
    dotPattern4Primitive: 0,
    dotPattern4PrimitiveStrokeWidth: "1",
    dotPattern4PrimitiveStrokeWidthMax: "2",
    dotPattern4Rotate: "45",
    dotPattern4Size: "1",
    dotPattern4SizeDot: "1",
    dotPattern4SizeMax: "3.5",
    dotPattern5Background: 0,
    dotPattern5Density: "6",
    dotPattern5Primitive: 0,
    dotPattern5PrimitiveStrokeWidth: "1",
    dotPattern5PrimitiveStrokeWidthMax: "2",
    dotPattern5Rotate: "0",
    dotPattern5Size: "1",
    dotPattern5SizeDot: "1",
    dotPattern5SizeMax: "3",
    gridPattern3Angle: "65",
    gridPattern3Background: 1,
    gridPattern3Density: "10",
    gridPattern3Rotate: "0",
    gridPattern3StrokeWidth: "2",
    gridPattern3StrokeWidthMax: "10",
    gridPattern6Angle: "45",
    gridPattern6Background: 0,
    gridPattern6Density: "5",
    gridPattern6Rotate: "45",
    gridPattern6StrokeWidth: "3",
    gridPattern6StrokeWidthMax: "5",
    linePattern0Background: 0,
    linePattern0Density: "4",
    linePattern0StrokeWidth: "1",
    linePattern0StrokeWidthMax: "4",
    linePattern0Rotate: "45",
    linePattern1Background: 0,
    linePattern1Density: "4",
    linePattern1StrokeWidth: "1",
    linePattern1StrokeWidthMax: "4",
    linePattern1Rotate: "90",
    linePattern2Background: 0,
    linePattern2Density: "5",
    linePattern2StrokeWidth: "1",
    linePattern2StrokeWidthMax: "5",
    linePattern2Rotate: "135",
    patternType0: 0,
    patternType1: 0,
    patternType2: 0,
    patternType3: 2,
    patternType4: 1,
    patternType5: 1,
    patternType6: 2
}


const bertinTextures = [bertin150, bertin183, bertin397, bertin231, bertin333]


