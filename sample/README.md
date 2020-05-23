# Sample of cron executing CIAnalyzer
You can use any service or environment that supports Docker to execute CIAnalyzer.  
It is nice to you starting with these samples.

## CircleCi
[CircleCI config file](./circleci_cron.yml)

Sample config:

- Export to BigQuery and Local file.
- Store LastRun files to Local file.

CircleCI can share LastRun build number to next build using cache with some hack.  
The hack is changing the cache key every time to save as new cache (ex: `cache-{{ .BuildNum }}`). In the next build restore LastRun files by incompletion cache key (ex: `cache-`), last build cache will be restored.

## Jenkins
[Jenkinsfile](./cron.jenkinsfile)

Sample config:

- Export to BigQuery and Local file.
- Store LastRun files to GCS.

Jenkins can choose cleaning workspace before every build or not. So If you choose don't clean workspace, LastRun files will be shared to next build.  
But in some cases it does not work well. If you allow to run a job with multiple nodes, it is difficult to share LastRun files across each node. 

To resolve this problem, using a GCS backend is recommended. It read/write LastRun files from/to GCS. As a result, LastRun files are shared with each build and each node.
