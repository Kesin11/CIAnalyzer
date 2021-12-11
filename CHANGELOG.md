# [4.4.0](https://github.com/Kesin11/CIAnalyzer/compare/v4.3.2...v4.4.0) (2021-12-11)

## Add new columns
workflow

- commitMessage
- actor
- url

job

- url
- executorClass
- executorType
- executorName

### Features

* Add commitMessage and actor columns ([d3fc824](https://github.com/Kesin11/CIAnalyzer/commit/d3fc824469918bbbdf79759a34ccd2ffbea70bba))
* Add exporting job executor info ([0fea4f1](https://github.com/Kesin11/CIAnalyzer/commit/0fea4f1370b9d4b7bfc5cb035b1ec1e2942bc720))
* Add url columns ([fecbe29](https://github.com/Kesin11/CIAnalyzer/commit/fecbe2983947c537f853e4c38030a56b1312819c))



## [4.3.2](https://github.com/Kesin11/CIAnalyzer/compare/v4.3.1...v4.3.2) (2021-12-04)


### Bug Fixes

* npm audit fix ([af48460](https://github.com/Kesin11/CIAnalyzer/commit/af48460ff9ca58720525b612bdbb6caafc86414c))



## [4.3.1](https://github.com/Kesin11/CIAnalyzer/compare/v4.3.0...v4.3.1) (2021-10-10)


### Bug Fixes

* **CircleCI:** Bugfix cannot use API v2 when no CIRCLECI_TOKEN ([9e539fe](https://github.com/Kesin11/CIAnalyzer/commit/9e539feb87bf759f2e251b22b5475c1742bd58de))
* Error log shows appropriate stack trace ([ecf477c](https://github.com/Kesin11/CIAnalyzer/commit/ecf477c94864f97d56b470c06c84e9500c6e85d9))
* Show more better error log ([c1e2f70](https://github.com/Kesin11/CIAnalyzer/commit/c1e2f70ed73d2a4827850049e484833d5b97b953))



# [4.3.0](https://github.com/Kesin11/CIAnalyzer/compare/v4.2.0...v4.3.0) (2021-10-03)

# Support CircleCI API v2 🎉 
So CircleCI v1.1 does not provide API that about pipeline, previously CIAnalyzer reconstruct pipeline structure from each job.

Now, CIAnalyzer uses a pipeline data structure provided by API v2. The exported data will be closer to what you can see on the CircleCI website. 

## How to migrate from v1.1
After upgrade CIAnalzyer version newer than v4.2, do not need any changes in your config YAML if you want to still use CircleCI API v1.1 .

When you want to use CircleCI v2, you have to change the config as below.

```yaml
# before (use API v1.1)
baseUrl: https://circleci.com/api/v1.1

# after (use API v2)
baseUrl: https://circleci.com/api/ # Remove suffix "v1.1" from URL
version: 2 # Add
```

**NOTICE** The first time after you enable v2, CIAnalyzer reset the LastRun build number and will export the last 100 pipeline data. As a result, it may be exporting duplicate data that has already been exported before.
There is no workaround to avoid this problem, sorry.

### Bug Fixes

* **CircleCI:** Add baseUrl config validation ([58ec9e3](https://github.com/Kesin11/CIAnalyzer/commit/58ec9e385b0fcbbfc594b3f5ca5ccd642d96dfdf))
* **CircleCI:** CircleCI v2 FETCH_LIMIT up to 100 ([44dca7e](https://github.com/Kesin11/CIAnalyzer/commit/44dca7e233d63faae535d8f2b6645108fc500574))
* **CircleCI:** Ignore pipelines that has not workflows or has on_hold status workflow ([91afb51](https://github.com/Kesin11/CIAnalyzer/commit/91afb51486b1a019cea463981b1fa89a2d839d6c))
* **CircleCI:** Remediate invalid timestamp in workflows ([117d8fb](https://github.com/Kesin11/CIAnalyzer/commit/117d8fb5360a63a8fa7fd965110de19e2bf5cfd6))
* Fix each parseConfig() overwrite argument object ([d3398ef](https://github.com/Kesin11/CIAnalyzer/commit/d3398ef331f759790fbfc6fa12d283dc910ede62))


### Features

* **CircleCI:** Add CircleCI v1 and v2 lastRunStore migration ([7916cf7](https://github.com/Kesin11/CIAnalyzer/commit/7916cf7080d43e894522fb6008168e1468a9cfb1))
* **CircleCI:** Support CircleCI v2 API ([4fbe2d3](https://github.com/Kesin11/CIAnalyzer/commit/4fbe2d39eef5d6a7a95c9b648535b0a3a340b0a4))

### Documents
* [fix setup command #352](https://github.com/Kesin11/CIAnalyzer/pull/352) by @yamatoya


# [4.2.0](https://github.com/Kesin11/CIAnalyzer/compare/v4.1.0...v4.2.0) (2021-08-16)


### Bug Fixes

* **CircleCI:** Fix detect workflow status ([a8b5264](https://github.com/Kesin11/CIAnalyzer/commit/a8b52642eed62d57b0d686d7ea84caecf7d42be7))
* **CircleCI:** Fix finished workflow filter when CircleCI history has not_run workflows ([c394f9b](https://github.com/Kesin11/CIAnalyzer/commit/c394f9bb04c6333068fcb902f5e89b1e815c27a1))


### Features

* Enable -v option ([3aacab9](https://github.com/Kesin11/CIAnalyzer/commit/3aacab9f37966b198eba24fa21d6b233079205f5))
* Improve log format ([65da4d0](https://github.com/Kesin11/CIAnalyzer/commit/65da4d013ccaa5205d7cde6a4c5f158a67b2d0d7))



# [4.1.0](https://github.com/Kesin11/CIAnalyzer/compare/v4.0.0...v4.1.0) (2021-07-25)


### Bug Fixes

* **Github:** Adopt types that changed by octokit-rest-18.x ([e33ce63](https://github.com/Kesin11/CIAnalyzer/commit/e33ce6336f6010b39bf8dfe67adcc93b01a1dbbd))


### Features

* Add --debug options and Null LastRunStore ([77a143b](https://github.com/Kesin11/CIAnalyzer/commit/77a143ba1938084cfe539ac27fe78bb3be317890))
* Add --only-exporters options ([1abb7ca](https://github.com/Kesin11/CIAnalyzer/commit/1abb7ca7e31a00eff5e55428efe9031d956f754b))
* Add --only-services options ([ff821ff](https://github.com/Kesin11/CIAnalyzer/commit/ff821ffcfeb588b52542da8980508afde42f8554))
* Using local exporter when --debug options ([34deb15](https://github.com/Kesin11/CIAnalyzer/commit/34deb15db394ae4688e9584b4a1507ca46983505))



# [4.0.0](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.5...v4.0.0) (2021-06-18)

### BREAKING CHANGES
* Rename config key typo vsc -> vcs ([7fc19c4](https://github.com/Kesin11/CIAnalyzer/commit/7fc19c450ee244b05f0c28200fe250da39718c22))

### Bug Fixes

* **Github:** Remove vscBaseUrl config from github ([ddec5e8](https://github.com/Kesin11/CIAnalyzer/commit/ddec5e886dcb02369b0ba01b94b72fc9fffef5f7))
* **Bitrise:** Adopt to current bitrise API limit ([1bf6abb](https://github.com/Kesin11/CIAnalyzer/commit/1bf6abb24edd8088e063b51cd0ac1f4aaa0487ac))



## [3.1.5](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.4...v3.1.5) (2021-05-27)

* Bump dependencies and fix security vulnerabilities.

### Bug Fixes

* Fix add await to adopt yargs 7.0 types ([3341d67](https://github.com/Kesin11/CIAnalyzer/commit/3341d672eecc60e380ef71609a937fe87390a333))



## [3.1.4](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.3...v3.1.4) (2021-04-17)

* Bump dependencies
* Migrate craze-max/ghaction-docker-meta v1 to v2 [#264](https://github.com/Kesin11/CIAnalyzer/pull/264)


## [3.1.3](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.2...v3.1.3) (2021-04-06)


### Bug Fixes

* Little improve docker image size ([5ec970a](https://github.com/Kesin11/CIAnalyzer/commit/5ec970a28bed4b3afd62e36ed6f13c264b231be4))
* npm audit fix ([35acf54](https://github.com/Kesin11/CIAnalyzer/commit/35acf54d8437e5982ddb2b35f1e408222a25f82a))



## [3.1.2](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.1...v3.1.2) (2021-03-07)


### Bug Fixes

* Fix type compile error from ts 4.2 ([01011cb](https://github.com/Kesin11/CIAnalyzer/commit/01011cb7b8034338693c80f41dbb3d2d2fd55ba2))
* Update nodejs version inside Docker 12 to 14 ([c8d22fe](https://github.com/Kesin11/CIAnalyzer/commit/c8d22fe641790498b31d19b6d90480d28e24492e))
* **Github:** Bugfix storing last run id each by repo workflows ([1e248a4](https://github.com/Kesin11/CIAnalyzer/commit/1e248a4e458493453ce1e5f506ef37648c6a2e39))



## [3.1.1](https://github.com/Kesin11/CIAnalyzer/compare/v3.1.0...v3.1.1) (2020-12-23)


### Bug Fixes

* **CircleCI:** Fix workflowDurationSec correctly when jobs ran in parallel ([398f1b3](https://github.com/Kesin11/CIAnalyzer/commit/398f1b38daefdec1941203cd71b49ccd4d8f93b9))



# [3.1.0](https://github.com/Kesin11/CIAnalyzer/compare/v3.0.1...v3.1.0) (2020-12-10)

### New
CIAnalyzer support to correct Bitrise build data from v3.1.0 :tada:


### Bug Fixes

* **Bitrise:** Parse steps correctly when summary table is too long ([32dabd7](https://github.com/Kesin11/CIAnalyzer/commit/32dabd75f2fc18d6460fdd8abc96a881881440a6))
* **Github:** Adopt for update octokit types ([2dd67ec](https://github.com/Kesin11/CIAnalyzer/commit/2dd67ecfeccdc39ba9fe8618905551a1dee2aebe))


### Features

* **Bitrise:** Correct custom report from Bitrise artifacts ([87c7fe2](https://github.com/Kesin11/CIAnalyzer/commit/87c7fe23592ab67a89ae527af274af52bcb5bdd9))
* **Bitrise:** Correct JUnit test data from Bitrise artifacts ([217a952](https://github.com/Kesin11/CIAnalyzer/commit/217a952845577a88cf481181f5cd7ff19ceb399e))



## [3.0.1](https://github.com/Kesin11/CIAnalyzer/compare/v3.0.0...v3.0.1) (2020-11-20)


### Bug Fixes

* **Jenkins:** Skip fetch job that has not any build histories ([4e47425](https://github.com/Kesin11/CIAnalyzer/commit/4e474251eb70fc691154847ef8158e63590be424))
* Output error log throws in runner ([16e80d3](https://github.com/Kesin11/CIAnalyzer/commit/16e80d30244af8fd26fbb71b3aa4c92e77b2486c))



# [3.0.0](https://github.com/Kesin11/CIAnalyzer/compare/v2.1.0...v3.0.0) (2020-11-18)

### BREAKING CHANGES
* Return error exitCode when catch some errors ([26d28b5](https://github.com/Kesin11/CIAnalyzer//commit/26d28b5a24c3d4c3414a8dea784a52c5855309ee))

Formerly, CIAnalyzer returns 0 despite of some runner throws error.  
In this case, CIAnalyzer returns error code 1 now.

### Bug Fixes

* npm audit fix ([8210b27](https://github.com/Kesin11/CIAnalyzer/commit/8210b27014deaa0c7ab720ba6640cdfc0340db8a))
* **CircleCI:** Ignore background step ([540496f](https://github.com/Kesin11/CIAnalyzer/commit/540496f2a41c44f564f0f11797eacc2aa9738de1))
* **Jenkins:** Bugfix to allow multibyte Jenkins job name ([f6b09e9](https://github.com/Kesin11/CIAnalyzer/commit/f6b09e93244a48c82308b433bd49049eaed43de1))
* Add axios-retry to retry request automatically ([c6c6d86](https://github.com/Kesin11/CIAnalyzer/commit/c6c6d86a9e17cf9042c6aef1abb7aee4a051e4f0))
* Add retry and throttle request (github actions) ([69b7274](https://github.com/Kesin11/CIAnalyzer/commit/69b72749b4474238f93a2e4ba8091d480ee96af9))
* Bugfix parallel execution aborted when some runner throws error ([eb52da9](https://github.com/Kesin11/CIAnalyzer/commit/eb52da980dff248317a7632ec62e60cb13c53490))
* Extend axios timeout 3s to 5s ([69a984d](https://github.com/Kesin11/CIAnalyzer/commit/69a984d383fefe6a378bbe15a9c0eb0617a822f0))
* Output LocalStore write log ([b0ba8c8](https://github.com/Kesin11/CIAnalyzer/commit/b0ba8c8e859093e5f58c52dee4151f6fd66d04a1))


### Features

* Add queuedDurationSec to BigQuery schema ([78e1aff](https://github.com/Kesin11/CIAnalyzer/commit/78e1affdd720e0d5ad1f18162ae035904a365627))
* **CircleCI:** add queuedDurationSec ([13e5e8c](https://github.com/Kesin11/CIAnalyzer/commit/13e5e8cf4b73268426c951e33c8ad0f0924b0212))
* **Github:** add queuedDurationSec ([c51f075](https://github.com/Kesin11/CIAnalyzer/commit/c51f07504dacff32d7bf5d3efd031b96a313224e))
* **Jenkins:** Add correctAllJobs config ([696dd78](https://github.com/Kesin11/CIAnalyzer/commit/696dd78fb5e6efb6de599af3030d258a96d305c3))
* **Jenkins:** add queuedDurationSec ([c75f400](https://github.com/Kesin11/CIAnalyzer/commit/c75f400df492429690d632a7e4309932c73e50fa))



# [2.1.0](https://github.com/Kesin11/CIAnalyzer/compare/v2.0.2...v2.1.0) (2020-09-20)

Now CIAanalyzer can export any data related to build with `CustomReport`. CIAanalyzer can collect JSON file that has any structure from CI build artifacts. If you want to collect some data and export it to BigQuery(or others), just create JSON that includes your preferred data and store it to CI build artifacts.

If you want to collect CustomReport, please see [sample config YAML](https://github.com/Kesin11/CIAnalyzer/blob/master/ci_analyzer.yaml)

### Bug Fixes

* Bugfix error when test or customReports are undefined in config yaml ([1edb2c4](https://github.com/Kesin11/CIAnalyzer/commit/1edb2c47147ba77a8c2f42a5fbf0b9a8a340ac84))
* Fetch artifacts in parallel ([0214b48](https://github.com/Kesin11/CIAnalyzer/commit/0214b4878bc537bfddc18328c06766751664cbdc))
* Fetch custom report artifacts in parallel ([95311bc](https://github.com/Kesin11/CIAnalyzer/commit/95311bc03343ae75ad4e788b7463581473ce5baa))
* Show more detail in error log ([5eb638e](https://github.com/Kesin11/CIAnalyzer/commit/5eb638e17e64404ed8c4fa09e693181bc268341b))


### Features

* Export CustomReport (CircleCI) ([adc97f0](https://github.com/Kesin11/CIAnalyzer/commit/adc97f00f8e7648f8d066df3f845fac1472715b1))
* Implement BigqueryExporter.exportCustomReports ([0974f3a](https://github.com/Kesin11/CIAnalyzer/commit/0974f3a4a29cabea5fa6c32637047e216d1cf269))
* Support custom reporter in Github Actions ([1f2d44d](https://github.com/Kesin11/CIAnalyzer/commit/1f2d44d5f356c814d30e75cba03d928aee568258))



## [2.0.2](https://github.com/Kesin11/CIAnalyzer/compare/v2.0.1...v2.0.2) (2020-08-15)


### Bug Fixes

* Set default param when exporter.local is null ([da5ed69](https://github.com/Kesin11/CIAnalyzer/commit/da5ed691edae5c78841e36c1b2fde1a940a8207d))
* Bump @octokit/rest to v18 ([9ad8e86](https://github.com/Kesin11/CIAnalyzer/commit/9ad8e869c063e56999c482f651c0598661bc5e68))
* **deps:** update dependency @google-cloud/bigquery to v5.2.0 ([8b0f592](https://github.com/Kesin11/CIAnalyzer/commit/8b0f59234d247aeeacd606e332975ea453e6e09b))
* **deps:** update dependency lodash to v4.17.20 ([d87b8e6](https://github.com/Kesin11/CIAnalyzer/commit/d87b8e6426cea172617e96d6d0e736418f6eb467))




## [2.0.1](https://github.com/Kesin11/CIAnalyzer/compare/v2.0.0...v2.0.1) (2020-08-12)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v5.2.0 ([e20d2d1](https://github.com/Kesin11/CIAnalyzer/commit/e20d2d1b70e3ebcee1d99f63b7227345dfb44176))
* **deps:** update dependency dayjs to v1.8.33 ([8302081](https://github.com/Kesin11/CIAnalyzer/commit/8302081d5993f1622041ae15b47528243c7eb3fb))
* Add more type guard at loadConfig ([1c41aae](https://github.com/Kesin11/CIAnalyzer/commit/1c41aae18876b431caa32d00a100d4afe5a0710a))
* **deps:** update dependency @google-cloud/bigquery to v5 ([3696eaa](https://github.com/Kesin11/CIAnalyzer/commit/3696eaa86c0d3c94a0dfae6de838294aac55e7cb))
* **deps:** update dependency @google-cloud/storage to v5.1.2 ([2eaff1b](https://github.com/Kesin11/CIAnalyzer/commit/2eaff1b40888d85f23e8b69fb3439211006a51f8))
* **deps:** update dependency adm-zip to v0.4.16 ([112e0de](https://github.com/Kesin11/CIAnalyzer/commit/112e0de92ec8438d123463cfd3e6471d9e86b567))
* **deps:** update dependency js-yaml to v3.14.0 ([07c9a93](https://github.com/Kesin11/CIAnalyzer/commit/07c9a937c08745ecc74a8dd47e923d1053ddde83))
* **deps:** update dependency yargs to v15.4.1 ([3a25543](https://github.com/Kesin11/CIAnalyzer/commit/3a25543163209e3d4fd8bb5c274a134305486c70))
* Using async fs function instead of sync ([62a916d](https://github.com/Kesin11/CIAnalyzer/commit/62a916ddcba70b7a538309c7ac1ebc80cb22a4c6))



# [2.0.0](https://github.com/Kesin11/CIAnalyzer/compare/v1.0.0...v2.0.0) (2020-08-10)

Now CIAnalyzer can collect and export test report! It collected from CircleCI test API and JUnit XML inside artifacts.

For exporting test report to BigQuery, config.yaml schema is changed from v1. Please check [sample config yaml](https://github.com/Kesin11/CIAnalyzer/blob/v2.0.0/ci_analyzer.yaml) and update your yaml.

### BREAKING CHANGE
* Change exporter.bigquery yaml schema ([68f8eb7](https://github.com/Kesin11/CIAnalyzer/commit/68f8eb7a8cc4cc9645339b5e07537ca13d891493))

### Bug Fixes

* Bugfix output incorrect table name in BigQueryExporter log ([14e783e](https://github.com/Kesin11/CIAnalyzer/commit/14e783e233a5a7cea52e3078c7cc49fed2b05cee))
* Extend axios timeout ([c2bdd80](https://github.com/Kesin11/CIAnalyzer/commit/c2bdd802b18cfc91d0d700f33f7ce9b8567ba810))
* Remove workaround that fix junit2json type error ([eabd293](https://github.com/Kesin11/CIAnalyzer/commit/eabd2937a61baabd7bbebba74a645db4cc99ac89))
* support skipped testcase ([896303b](https://github.com/Kesin11/CIAnalyzer/commit/896303b4ad1218519f04f2f4eddf09864907fe14))
* Validate CircleCI step end_time ([bb58c92](https://github.com/Kesin11/CIAnalyzer/commit/bb58c92f1c88cfbba675c76403b12b463f2b51bf))


### Features

* Add convertToReportTestSuites() ([8698d88](https://github.com/Kesin11/CIAnalyzer/commit/8698d880844cff3f8e847635a209691f0c969a77))
* Add some columns to test_table ([9a4bed1](https://github.com/Kesin11/CIAnalyzer/commit/9a4bed1b9dffc0acf0b78b343c15a041ec8b59e4))
* Add test status columns ([528bc59](https://github.com/Kesin11/CIAnalyzer/commit/528bc59968eb13805377dd0fe52d07577d3d772a))
* Add testcase.status ([4b1b66c](https://github.com/Kesin11/CIAnalyzer/commit/4b1b66cbd1c681909807857cc7f1fc41b1c5158e))
* BigqueryExporter support loading TestReports ([d991f25](https://github.com/Kesin11/CIAnalyzer/commit/d991f25ab9970010480d0a2cd0b4998559745ec0))
* Fix BigQuery Schema ([5c80280](https://github.com/Kesin11/CIAnalyzer/commit/5c802809915745ea0358478b65b950952acebfc3))
* Omit testcase.skipped ([4b28ce1](https://github.com/Kesin11/CIAnalyzer/commit/4b28ce140df0ac1905dcae467d3f11662f60175c))
* Omit testsuit.properties ([f960d4c](https://github.com/Kesin11/CIAnalyzer/commit/f960d4c56f57e04eeb88923046504d4fb7097bdc))
* Output test result in CircleCI ([61cccf4](https://github.com/Kesin11/CIAnalyzer/commit/61cccf47d94d531ce7c0a43370f3db9b5d32bfeb))
* Output test result in github actions ([82481e7](https://github.com/Kesin11/CIAnalyzer/commit/82481e7862d4d5bf1edefff0858b14efa8261894))
* Output test result in Jenkins ([98acb00](https://github.com/Kesin11/CIAnalyzer/commit/98acb001f4bb706ee8885b73a38d2fb4dfee53e4))
* Support creating test report from testsuit tag root XML ([f00c3cf](https://github.com/Kesin11/CIAnalyzer/commit/f00c3cfdeb3ba65fa63ded373628e0f0a3ebcafc))
* Update test_report table schema ([e1b341a](https://github.com/Kesin11/CIAnalyzer/commit/e1b341a173cbf56b2aed99e1674bc4a42b193065))
* Update test_report table schema ([8575e89](https://github.com/Kesin11/CIAnalyzer/commit/8575e89e3ceb61fa9d7bc972b622086b45013337))



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
