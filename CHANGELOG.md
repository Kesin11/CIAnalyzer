# [1.0.0](https://github.com/Kesin11/CIAnalyzer/compare/v0.2.0...v1.0.0) (2020-05-24)

CIAnalyzer reached version 1.0.0 :tada::tada:  
It will be follow [Semantic Versioning](https://semver.org/)

### Features

* Add 'ci_analyzer' command alias it can use inside docker ([b967e34](https://github.com/Kesin11/CIAnalyzer/commit/b967e343916cc1a7406adc97f7d945fa7be7875f))
* Change dir structure inside docker for improve mouting volume ([69c4cc9](https://github.com/Kesin11/CIAnalyzer/commit/69c4cc936d2ba4532c14d180640c42800ccd1321))



# [0.2.0](https://github.com/Kesin11/CIAnalyzer/compare/v0.1.2...v0.2.0) (2020-05-21)


### Features

* Add Jenkins job parameter to workflow report ([7c8578f](https://github.com/Kesin11/CIAnalyzer/commit/7c8578fe465a6bdc7b5a8cce8fab880eb61c8579))



## [0.1.2](https://github.com/Kesin11/CIAnalyzer/compare/v0.1.1...v0.1.2) (2020-05-19)


### Bug Fixes

* Bugfix how to detect in_progress run ([fd27b9a](https://github.com/Kesin11/CIAnalyzer/commit/fd27b9a5823e39708d68ca450b28cae07dbb299e)), closes [#13](https://github.com/Kesin11/CIAnalyzer/issues/13)



## [0.1.1](https://github.com/Kesin11/CIAnalyzer/compare/v0.1.0...v0.1.1) (2020-05-19)


### Bug Fixes

* (CircleciClient) Filter runs that after in_progress run ([a063f9f](https://github.com/Kesin11/CIAnalyzer/commit/a063f9f328479679be246ec5f7fbbb304653e654))
* (GithubClient) Filter runs that after in_progress run ([38b1751](https://github.com/Kesin11/CIAnalyzer/commit/38b1751af526a52feaaf2233dd7c5140761029f3))
* (JenkinsClient) Filter runs that after in_progress or not_executed run ([f16d333](https://github.com/Kesin11/CIAnalyzer/commit/f16d333fa19a8b0370b898e00763ad108a22d280))



# 0.1.0 (2020-05-17)

Initial release! :tada:

**CIAnalyzer still beta versoin until v1.0.0. This means config yaml schema or other features will be affected BREAKING CHANGES.**

### Features
#### Supported CI services
  - Github Actions
  - CircleCI
  - Jenkins
  
#### Supported exporters
  - LocalFile
  - BigQuery
  
#### Supported LastRunStore backends
  - LocalFile
  - Google Cloud Storage
