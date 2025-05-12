export enum EncodingType {
  Bivariate = 'bivariate',
  Mark = 'mark',
  Bars = 'bars',
  MarkRotation45 = 'mark-rotation-45',
  MarkRotation90 = 'mark-rotation-90',
  ColoredRotation45 = 'colored-rotation-45',
  ColoredRotation90 = 'colored-rotation-90',
  Size = 'size',
  Mean = 'mean',
}

export enum ClusteringMode {
  None = 'none',
  Optimal = 'optimal',
  PCA = 'pca',
}

export enum ClusteringVariable {
  Mean = 'mean',
  StandardDeviation = 'std',
  SignalToNoiseRatio = 'snr',
}

export enum ColorScheme {
  Viridis = 'viridis',
  Cividis = 'cividis',
  Warm = 'warm',
  Cool = 'cool',
  Plasma = 'plasma',
  Inferno = 'inferno',
  Turbo = 'turbo',
  Blues = 'blues',
  Oranges = 'oranges',
  Reds = 'reds',
}

export enum MarkColor {
  White = '#ffffff',
  Black = '#000000',
  Orange = '#ff6e4a',
}

export enum UserActionType {
  ClearNodeSelection = 'Clear State Selection',
  ClearLinkSelection = 'Clear Flight Selection',
  ResetOrdering = 'reset_ordering',
}
