pipeline {
  agent any
  stages {
    stage('lint') {
      agent {
        docker {
          image 'node:lts'
          args '-u root:sudo'
        }
      }
      steps {
        checkout scm
        sh "npm ci"
        sh "npm run lint"
      }
    }
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
