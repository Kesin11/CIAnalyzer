pipeline {
  agent none
  options {
    timestamps()
    ansiColor('xterm')
    timeout(time: 20, unit: 'MINUTES') 
  }
  stages {
    // stage('lint') {
    //   agent {
    //     docker {
    //       image 'node:lts'
    //       args '-u root:sudo'
    //     }
    //   }
    //   steps {
    //     checkout scm
    //     sh "npm ci"
    //     sh "npm run lint"
    //   }
    // }
    stage('build and test') {
      agent {
        docker {
          image 'node:lts'
          args '-u root:sudo'
        }
      }
      steps {
        checkout scm
        sh "npm ci"
        sh "npm run build"
        sh "npm run test:ci"
      }
      post {
        always {
          archiveArtifacts artifacts: 'junit/*.xml'

          // Output custom JSON
          script {
            def uname = sh(script: 'uname', returnStdout: true).trim()
            def props = [
              job: STAGE_NAME,
              node: NODE_NAME,
              os: uname,
              container: ""
            ]
            writeJSON file: 'custom.json', json: props, pretty: 4
          }
          archiveArtifacts artifacts: 'custom.json'
        }
      }
    }
    stage('docker build') {
      agent any
      environment {
        DOCKER_BUILDKIT = '1'
      }
      steps {
        checkout scm
        sh "docker build -t ci_analyzer ."
      }
    }
  }
}
