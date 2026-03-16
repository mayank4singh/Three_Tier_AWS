// CI/CD pipeline: build Docker images, push to ECR, deploy to ECS Fargate.
// Runs entirely on the slave node (least-privilege IAM role on the slave EC2).
// Triggered automatically by a GitHub webhook on every push.

pipeline {

  agent any

  // ── Push-based trigger (configure the matching GitHub webhook in your repo) ──
  triggers {
    githubPush()
  }

  environment {
    AWS_REGION       = 'us-east-1'                          // change to your region
    AWS_ACCOUNT_ID   = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
    ECR_REGISTRY     = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    FRONTEND_REPO    = 'fullstack-frontend'
    BACKEND_REPO     = 'fullstack-backend'
    ECS_CLUSTER      = 'fullstack-cluster'
    FRONTEND_SERVICE = 'fullstack-frontend'
    BACKEND_SERVICE  = 'fullstack-backend'
    IMAGE_TAG        = "${BUILD_NUMBER}"
  }

  stages {

    // ── 1. Checkout ─────────────────────────────────────────────────────────────
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // ── 2. Build Docker images in parallel ──────────────────────────────────────
    stage('Build') {
      parallel {
        stage('Build Frontend') {
          steps {
            script {
              env.FRONTEND_IMAGE = "${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
              sh "docker build -t ${env.FRONTEND_IMAGE} ./Frontend"
            }
          }
        }
        stage('Build Backend') {
          steps {
            script {
              env.BACKEND_IMAGE = "${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
              sh "docker build -t ${env.BACKEND_IMAGE} ./Backend"
            }
          }
        }
      }
    }

    // ── 3. Authenticate to ECR and push images ───────────────────────────────────
    stage('Push to ECR') {
      steps {
        script {
          // Use --no-cli-pager and redirect docker login output to suppress
          // any verbose lines that could appear in build logs
          sh(script: "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}", label: 'ECR Login')
          sh "docker push ${env.FRONTEND_IMAGE}"
          sh "docker push ${env.BACKEND_IMAGE}"
          // Also tag as latest so task definitions using :latest pick up the new build
          sh "docker tag ${env.FRONTEND_IMAGE} ${ECR_REGISTRY}/${FRONTEND_REPO}:latest && docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:latest"
          sh "docker tag ${env.BACKEND_IMAGE}  ${ECR_REGISTRY}/${BACKEND_REPO}:latest  && docker push ${ECR_REGISTRY}/${BACKEND_REPO}:latest"
        }
      }
    }

    // ── 4. Register new ECS task definition revisions with the build-tagged image ─
    stage('Register Task Definitions') {
      parallel {
        stage('Frontend Task Definition') {
          steps {
            script {
              // Use BUILD_NUMBER-scoped temp files to prevent collisions when
              // multiple builds run concurrently on the same slave
              def frontendCurrent = "/tmp/frontend-current-${BUILD_NUMBER}.json"
              def frontendNew     = "/tmp/frontend-task-def-${BUILD_NUMBER}.json"
              sh """
                aws ecs describe-task-definition \
                  --task-definition fullstack-frontend \
                  --region ${AWS_REGION} \
                  --query 'taskDefinition' \
                  --output json > ${frontendCurrent}
              """
              sh """
                python3 - <<'PYEOF'
import json
with open('${frontendCurrent}') as f:
    d = json.load(f)
for c in d.get('containerDefinitions', []):
    if c['name'] == 'frontend':
        c['image'] = '${env.FRONTEND_IMAGE}'
for k in ['taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy','deregisteredAt']:
    d.pop(k, None)
with open('${frontendNew}', 'w') as f:
    json.dump(d, f)
PYEOF
              """
              env.FRONTEND_TASK_ARN = sh(
                script: """
                  aws ecs register-task-definition \
                    --region ${AWS_REGION} \
                    --cli-input-json file://${frontendNew} \
                    --query 'taskDefinition.taskDefinitionArn' \
                    --output text
                """,
                returnStdout: true
              ).trim()
              sh "rm -f ${frontendCurrent} ${frontendNew}"
            }
          }
        }
        stage('Backend Task Definition') {
          steps {
            script {
              def backendCurrent = "/tmp/backend-current-${BUILD_NUMBER}.json"
              def backendNew     = "/tmp/backend-task-def-${BUILD_NUMBER}.json"
              sh """
                aws ecs describe-task-definition \
                  --task-definition fullstack-backend \
                  --region ${AWS_REGION} \
                  --query 'taskDefinition' \
                  --output json > ${backendCurrent}
              """
              sh """
                python3 - <<'PYEOF'
import json
with open('${backendCurrent}') as f:
    d = json.load(f)
for c in d.get('containerDefinitions', []):
    if c['name'] == 'backend':
        c['image'] = '${env.BACKEND_IMAGE}'
for k in ['taskDefinitionArn','revision','status','requiresAttributes',
          'compatibilities','registeredAt','registeredBy','deregisteredAt']:
    d.pop(k, None)
with open('${backendNew}', 'w') as f:
    json.dump(d, f)
PYEOF
              """
              env.BACKEND_TASK_ARN = sh(
                script: """
                  aws ecs register-task-definition \
                    --region ${AWS_REGION} \
                    --cli-input-json file://${backendNew} \
                    --query 'taskDefinition.taskDefinitionArn' \
                    --output text
                """,
                returnStdout: true
              ).trim()
              sh "rm -f ${backendCurrent} ${backendNew}"
            }
          }
        }
      }
    }

    // ── 5. Update ECS services to use the new task definition revisions ──────────
    stage('Deploy to ECS') {
      parallel {
        stage('Deploy Frontend') {
          steps {
            sh """
              aws ecs update-service \
                --cluster ${ECS_CLUSTER} \
                --service ${FRONTEND_SERVICE} \
                --task-definition ${env.FRONTEND_TASK_ARN} \
                --region ${AWS_REGION}
            """
          }
        }
        stage('Deploy Backend') {
          steps {
            sh """
              aws ecs update-service \
                --cluster ${ECS_CLUSTER} \
                --service ${BACKEND_SERVICE} \
                --task-definition ${env.BACKEND_TASK_ARN} \
                --region ${AWS_REGION}
            """
          }
        }
      }
    }

    // ── 6. Wait for services to reach a steady state ─────────────────────────────
    stage('Verify Deployment') {
      steps {
        sh """
          aws ecs wait services-stable \
            --cluster ${ECS_CLUSTER} \
            --services ${FRONTEND_SERVICE} ${BACKEND_SERVICE} \
            --region ${AWS_REGION}
        """
      }
    }

  } // end stages

  post {
    success {
      echo "Deployment of build #${BUILD_NUMBER} completed successfully."
    }
    failure {
      echo "Deployment of build #${BUILD_NUMBER} failed. Check the logs above."
    }
    always {
      // Clean up dangling local images to keep the slave disk tidy
      sh 'docker image prune -f || true'
    }
  }

}