export enum Encoding {
  light = 'light',
  mark = 'mark',
  bars = 'bars',
  rotation45 = 'mark-rotation-45',
  rotation90 = 'mark-rotation-90',
  colorRotation45 = 'mark-rotation-45-colored',
  colorRotation90 = 'mark-rotation-90-colored',
  size = 'size',
  mean = 'mean',
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
  clearNodeSelection = 'Clear States Selection',
  clearLinkSelection = 'Clear Flights Selection',
  resetOrdering = 'Reset Ordering',
}
