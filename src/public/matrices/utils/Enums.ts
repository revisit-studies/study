export enum Encoding {
  light = 'light',
  mark = 'mark',
  bars = 'bars',
  rotation = 'mark-rotation',
  colorRotation = 'mark-rotation-color',
  size = 'size',
}

export enum ClusteringMode {
  none = 'none',
  optimal = 'optimal',
  pca = 'pca',
}

export enum ClusteringVar {
  mean = 'mean',
  std = 'std',
  snr = 'snr',
}

export enum ColorScheme {
  viridis = 'viridis',
  cividis = 'cividis',
  warm = 'warm',
  cool = 'cool',
  plasma = 'plasma',
  inferno = 'inferno',
  turbo = 'turbo',
  blues = 'blues',
  oranges = 'oranges',
  reds = 'reds',
}

export enum MarkColor {
  white = 'white',
  black = 'black',
  orange = '#ff6e4a',
}

export enum UserAction {
  clearSelection = 'Clear Selection',
  resetOrdering = 'Reset Ordering',
}
