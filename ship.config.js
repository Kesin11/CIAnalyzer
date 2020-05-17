module.exports = {
  mergeStrategy: { toSameBranch: ['master'] },
  // Don't pubilsh to npm
  publishCommand: ({ _isYarn, _tag, _defaultCommand, _dir }) => "true",
}