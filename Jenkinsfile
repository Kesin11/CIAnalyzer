pipeline {
  agent any
  stages {
    stage('lint') {
      agent any
      docker { image 'node:lts' }
      steps {
        checkout scm
        sh "npm ci"
        sh "npm run lint"
      }
    }
    stage('build and test') {
      docker { image 'node:lts' }
      steps {
        checkout scm
        sh "npm ci"
        sh "npm run build"
        sh "npm run test:ci"
      }
    }
    stage('docker build') {
      agent any
      steps {
        checkout scm
        sh "docker build -t ci_analyzer ."
      }
    }
  }
}
