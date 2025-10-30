// Adaptive VLAT algorithm in JavaScript (no external libs except optional CSV reading)

function normpdf(x: number[], mu: number, sigma: number) {
  const sqrtTwoPi = Math.sqrt(2 * Math.PI);
  return x.map((val) => {
    const exponent = -((val - mu) ** 2) / (2 * sigma ** 2);
    return (1 / (sqrtTwoPi * sigma)) * Math.exp(exponent);
  });
}

function irtLikelihoodCorrect(a: number, b: number, theta: number) {
  return 1 / (1 + Math.exp(-a * (theta + b)));
}

function irtLikelihoodWrong(a: number, b: number, theta: number) {
  return 1 - irtLikelihoodCorrect(a, b, theta);
}

function itemInfoFunc(a: number, b: number, theta: number) {
  const p = irtLikelihoodCorrect(a, b, theta);
  return a ** 2 * p * (1 - p);
}

export type ItemParameters = [number, number, number, string, string];

function dfToDict(dfList: ItemParameters[]) {
  const newDict: Record<string, [number, number, string, string]> = {};
  const unusedChartTaskSet = new Set();

  for (const [id, b, a, chart, task] of dfList) {
    newDict[id] = [b, a, chart, task];
    unusedChartTaskSet.add(chart);
    unusedChartTaskSet.add(task);
  }

  return [newDict, unusedChartTaskSet] as [Record<string, [number, number, string, string]>, Set<string>];
}

function linspace(start: number, stop: number, num: number) {
  const step = (stop - start) / (num - 1);
  return Array.from({ length: num }, (_, i) => start + i * step);
}

function adaptiveVLATAlt(responseHistoryDict: Record<number, number>) {
  const dflist: ItemParameters[] = [[1, 2.8483115, 1.27221185, 'Line', 'RV'], [2, 3.040871, 1.499349129, 'Line', 'FE'], [3, 0.25584395, 1.374537045, 'Line', 'DR'], [4, 3.4258115, 1.468088919, 'Line', 'FCT'], [5, 1.3189766, 1.137137131, 'Line', 'MC'], [6, 2.2163635, 1.087065104, 'Bar', 'RV'], [7, 3.3441315, 1.370983684, 'Bar', 'FE'], [8, 0.1907385, 1.072558537, 'Bar', 'DR'], [9, -0.766119, 0.565435838, 'Bar', 'MC'], [10, -0.483896, 1.308078217, 'Stacked', 'RV'], [11, -0.878004, 0.748876272, 'Stacked', 'RV'], [12, 1.011948, 0.892274374, 'Stacked', 'FE'], [14, 0.498654, 0.864483077, 'Stacked', 'MC'], [15, -0.2163795, 0.63115109, 'Stacked', 'MC'], [16, -0.021748, 1.061661146, '100%', 'RV'], [17, 2.1735685, 1.260906618, '100%', 'FE'], [18, 0.1964695, 1.006552927, '100%', 'MC'], [19, 1.1781005, 0.952170323, 'Pie', 'RV'], [20, 3.4990835, 1.266495326, 'Pie', 'FE'], [21, 4.577599, 1.955349598, 'Pie', 'MC'], [22, 1.8068275, 1.103396903, 'Histogram', 'RV'], [23, 2.825006, 1.162700946, 'Histogram', 'FE'], [25, 2.1723395, 0.945254699, 'Histogram', 'MC'], [27, 1.85473395, 1.128140859, 'Scatterplot', 'RV'], [28, 1.226966, 1.183203925, 'Scatterplot', 'FE'], [29, 0.184373, 0.910403565, 'Scatterplot', 'DR'], [31, -0.568358, 0.598194995, 'Scatterplot', 'FA'], [32, 2.1477415, 1.293432284, 'Scatterplot', 'FC'], [33, 0.093807, 1.159459154, 'Scatterplot', 'FCT'], [34, 1.818106, 0.805688047, 'Scatterplot', 'MC'], [35, 1.3666385, 0.964108248, 'Area', 'RV'], [36, -0.4578085, 0.596634966, 'Area', 'FE'], [37, -0.945452, 0.576156905, 'Area', 'DR'], [38, 2.5183945, 1.352297435, 'Area', 'FCT'], [40, -2.567331, 0.727247878, 'Stacked Area', 'RV'], [41, -1.6333105, 0.721289353, 'Stacked Area', 'RV'], [42, 3.0243125, 1.39970206, 'Stacked Area', 'FE'], [44, 2.808996, 1.391714903, 'Stacked Area', 'FCT'], [45, -2.898462, 0.485882721, 'Stacked Area', 'MC'], [46, -2.1752885, 0.564928587, 'Stacked Area', 'MC'], [47, -0.5241995, 0.741666943, 'Bubble', 'RV'], [48, 1.0380654, 0.89755236, 'Bubble', 'FE'], [49, -1.1506875, 0.851390316, 'Bubble', 'DR'], [51, 0.210506, 0.576817469, 'Bubble', 'FA'], [52, 0.455853, 0.993160348, 'Bubble', 'FC'], [53, -2.5113305, 0.431845454, 'Bubble', 'FCT'], [54, 1.4998025, 1.154025598, 'Bubble', 'MC'], [55, -3.2260095, 0.367490725, 'Map', 'RV'], [56, 3.1477645, 1.401881342, 'Map', 'FE'], [57, 2.6187185, 1.101469613, 'Map', 'MC'], [59, 0.9082805, 0.949041643, 'Tree', 'FE'], [60, -0.5345505, 0.671887408, 'Tree', 'MC'], [61, 2.5394745, 1.109762274, 'Tree', 'ID']];

  const [itemParameters, unusedChartTaskSet] = dfToDict(dflist);
  const usedChartTaskCombo = new Set();

  const abilityTestTryout = [[2.98530963], [2.26547287], [0.47080041], [0.96055864], [0.97129651], [0.85147839], [0.49167494], [0.32598163], [0.23617328], [0.75140709], [0.4379747], [0.89021346], [1.95678745], [0.46671114], [0.43121635], [0.48382087], [0.7061291], [0.25740084], [0.57526741], [0.41269657], [0.44926689], [0.34097188], [0.6853534], [2.06499294], [0.35356854], [0.5014103], [0.60471721], [0.35648783], [0.55006742], [0.7328309], [0.58740872], [0.07316467], [0.37773089], [0.25774662], [1.67778516], [0.37425087], [0.00468991], [0.09117124], [-0.072024], [0.27787841], [0.50850991], [0.26712845], [0.23313045], [0.17836876], [-0.06713018], [2.52157004], [0.2163555], [0.19764337], [0.16053735], [0.01037715], [0.49067257], [0.37890493], [0.14471502], [-0.15786205], [0.37664253], [-0.12646154], [1.48456846], [0.11995221], [0.45500459], [0.06510908], [0.30381369], [0.23628236], [-0.0132403], [0.12346196], [-0.16156058], [-0.11441727], [-0.09874702], [2.06170801], [0.03819284], [-0.33842136], [-0.299268], [-0.18361791], [-0.27032307], [-0.36719226], [-0.63351759], [-0.13235381], [-0.32526859], [-0.75094893], [2.00068807], [-0.21555599], [-0.29719866], [-0.73570516], [-0.96429984], [-0.62994905], [-0.5959251], [-0.75414598], [-0.91139529], [-0.23647941], [-1.15477916], [2.13079529], [-1.19334718], [-1.17815316], [-0.3703066], [-0.86774687], [-0.62753559], [-1.24836742], [-0.73756034], [-0.57090316], [-1.36838053], [-1.10974556], [1.79120327], [-0.99938515], [-1.8725358], [2.81432538], [1.95511785], [1.82598207], [1.91495919], [1.64615882], [1.73761896], [1.74653664], [1.51736399], [1.48752685], [1.97221306], [1.19522668], [2.34740724], [1.54242075], [1.95637583], [1.65824094], [1.68725777], [1.97725808], [1.58887618], [1.51179316], [1.44743075], [1.63524539], [1.34980521], [2.94575102], [1.50590524], [1.58325844], [1.33751502], [0.97699839], [1.17390674], [1.45071628], [0.89705259], [1.26159178], [1.28050271], [1.2415599], [2.4859962], [1.52956813], [0.9266179], [1.55897714], [1.66185973], [1.39525797], [1.02554983], [1.56911437], [1.08589595], [1.2344817], [1.0596063], [2.3289334], [0.9177088], [0.91794547], [1.03755144], [1.35990785], [1.13449186], [0.97657427], [0.61813711], [0.94747231], [0.83248912], [1.15351712], [2.19894252], [1.29781779], [1.0320319], [0.95034002], [1.17618522], [0.97588753], [0.87400339], [1.08163796], [0.94947705], [1.11457895], [0.63173389], [2.29482725], [0.90212167], [0.87044902], [0.22467558], [0.79733281], [0.31442579], [0.38325478], [0.70994584], [1.06667696], [0.89253087], [0.34143484], [2.14695731], [0.84056897], [0.88750332], [1.08639498], [0.88874537], [0.7858341], [0.7279417], [0.12745017], [0.29013591], [0.4602226], [0.74735825]];

  const initialPriorMean = abilityTestTryout.reduce((a, b) => a + b[0], 0) / abilityTestTryout.length;
  const variance = abilityTestTryout.reduce((sum, val) => sum + (val[0] - initialPriorMean) ** 2, 0) / abilityTestTryout.length;
  const initialPriorStd = Math.sqrt(variance);

  const gridData = linspace(-5, 5, 200);
  let prior = normpdf(gridData, initialPriorMean, initialPriorStd);
  let currentAbility = initialPriorMean;

  if (Object.keys(responseHistoryDict).length > 0) {
    for (const [keyStr, itemCorrectness] of Object.entries(responseHistoryDict)) {
      const key = parseInt(keyStr, 10);
      const [b, a, chart, task] = itemParameters[key];

      unusedChartTaskSet.delete(chart);
      unusedChartTaskSet.delete(task);
      usedChartTaskCombo.add(`${chart}::${task}`);

      const likelihood = gridData.map((theta) => (itemCorrectness === 0
        ? irtLikelihoodWrong(a, b, theta)
        : irtLikelihoodCorrect(a, b, theta)));

      const unnormalizedPosterior = prior.map((p, i) => p * likelihood[i]);
      const normFactor = unnormalizedPosterior.reduce((sum, val) => sum + val, 0);
      const posterior = unnormalizedPosterior.map((val) => val / normFactor);
      prior = posterior;
    }

    currentAbility = gridData.reduce((acc, val, i) => acc + val * prior[i], 0);
  }

  const itemInfoDict: Record<number, number> = {};
  const numLeft = 27 - Object.keys(responseHistoryDict).length;

  const isUsed = (chart: string, task: string) => usedChartTaskCombo.has(`${chart}::${task}`);

  for (const [key, value] of Object.entries(itemParameters)) {
    const id = parseInt(key, 10);
    const [b, a, chart, task] = value;
    const unused = unusedChartTaskSet.has(chart) || unusedChartTaskSet.has(task);

    if (!Object.hasOwn(responseHistoryDict, id)) {
      if (unusedChartTaskSet.size === 0
                || (numLeft > unusedChartTaskSet.size && !isUsed(chart, task))
                || (numLeft <= unusedChartTaskSet.size && unused)) {
        itemInfoDict[id] = itemInfoFunc(a, b, currentAbility);
      }
    }
  }

  const nextItem = Object.entries(itemInfoDict).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return [parseInt(nextItem, 10), currentAbility];
}

export function getVLATnextqid(qid: string[], correct: number[]) {
  const responseHistoryDict: Record<number, number> = {};
  for (let i = 0; i < qid.length; i += 1) {
    responseHistoryDict[parseInt(qid[i], 10)] = correct[i];
  }

  const [itemId, score] = adaptiveVLATAlt(responseHistoryDict);
  return [itemId, score];
}
