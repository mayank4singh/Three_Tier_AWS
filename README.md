# 🚀 Three-Tier Product Catalog — AWS ECS + CloudFormation + Jenkins CI/CD

[![AWS](https://img.shields.io/badge/AWS-ECS%20Fargate-orange?logo=amazon-aws)](https://aws.amazon.com/ecs/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue?logo=docker)](https://www.docker.com/)
[![Jenkins](https://img.shields.io/badge/Jenkins-CI%2FCD-red?logo=jenkins)](https://www.jenkins.io/)
[![CloudFormation](https://img.shields.io/badge/IaC-CloudFormation-yellow?logo=amazon-aws)](https://aws.amazon.com/cloudformation/)

A **production-style three-tier web application** deployed on **AWS ECS Fargate** using **Infrastructure as Code (CloudFormation)** with a fully automated **Jenkins CI/CD pipeline** triggered by GitHub webhooks.

---

## 📐 Architecture

```
                        ┌─────────────────────────────────┐
                        │        Internet (User)           │
                        └──────────────┬──────────────────┘
                                       │ HTTP
                        ┌──────────────▼──────────────────┐
                        │   Frontend ALB (Public)          │
                        │   internet-facing                │
                        └──────────────┬──────────────────┘
                                       │ Port 3000
                   ┌───────────────────▼─────────────────────┐
                   │         Frontend ECS Service             │
                   │         Node.js / Express                │
                   │         (Public Subnet - Fargate)        │
                   └───────────────────┬─────────────────────┘
                                       │ /api/* proxy
                        ┌──────────────▼──────────────────┐
                        │   Backend ALB (Internal)         │
                        │   VPC-only                       │
                        └──────────────┬──────────────────┘
                                       │ Port 5000
                   ┌───────────────────▼─────────────────────┐
                   │         Backend ECS Service              │
                   │         Node.js / Express REST API       │
                   │         (Private Subnet - Fargate)       │
                   └─────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
Three_Tier_AWS/
├── Frontend/
│   ├── app.js              # Express server with API proxy
│   ├── public/
│   │   └── index.html      # Product Catalog UI
│   ├── package.json
│   └── Dockerfile
├── Backend/
│   ├── app.js              # REST API (products CRUD)
│   ├── package.json
│   └── Dockerfile
├── cloudformation/
│   └── stack.yaml          # Complete AWS infrastructure
├── Jenkinsfile             # CI/CD pipeline definition
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Node.js, Express, HTML/CSS/JS |
| Backend | Node.js, Express REST API |
| Containerization | Docker |
| Container Registry | Amazon ECR |
| Compute | Amazon ECS Fargate |
| Load Balancing | Application Load Balancer (ALB) |
| Networking | VPC, Public/Private Subnets, NAT Gateway |
| Infrastructure | AWS CloudFormation |
| CI/CD | Jenkins (push-based GitHub webhook) |
| Source Control | GitHub |

---

## 🔄 CI/CD Pipeline Flow

```
Developer pushes code
        │
        ▼
    GitHub Repo
        │  webhook POST
        ▼
  Jenkins Server
        │
        ├── Stage 1: Checkout code from GitHub
        ├── Stage 2: Build Frontend Docker image
        ├── Stage 3: Build Backend Docker image
        ├── Stage 4: Push images to Amazon ECR
        ├── Stage 5: Update ECS Frontend Service
        ├── Stage 6: Update ECS Backend Service
        └── Stage 7: Verify deployment stable
```

Every `git push` to the `main` branch **automatically** triggers the full pipeline — no manual steps required.

---

## ☁️ Infrastructure (CloudFormation)

The `cloudformation/stack.yaml` creates all AWS resources in a single deployment:

| Resource | Details |
|---|---|
| VPC | 10.0.0.0/16 with DNS enabled |
| Public Subnets | 2 AZs for Frontend ALB + Frontend ECS |
| Private Subnets | 2 AZs for Backend ECS |
| NAT Gateway | Allows private subnets to pull ECR images |
| Internet Gateway | Public internet access |
| Frontend ALB | Public-facing, routes to Frontend ECS |
| Backend ALB | Internal-only, routes to Backend ECS |
| ECS Cluster | Fargate-based, no EC2 to manage |
| Frontend Service | 1 task, port 3000 |
| Backend Service | 1 task, port 5000 |
| Security Groups | Strict least-privilege rules per tier |
| IAM Role | ECS Task Execution Role |
| CloudWatch Logs | 7-day retention for both services |

### Security Group Rules (Least Privilege)

```
Internet → Frontend ALB SG  (port 80)
Frontend ALB SG → Frontend ECS SG  (port 3000)
Frontend ECS SG → Backend ALB SG   (port 5000)
Backend ALB SG  → Backend ECS SG   (port 5000)
```

Each tier **only accepts traffic from the tier directly above it**.

---

## 🚀 Deployment Guide

### Prerequisites

- AWS CLI configured (`aws configure`)
- Docker installed
- Node.js installed
- Jenkins server running

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/mayank4singh/Three_Tier_AWS.git
cd Three_Tier_AWS
```

---

### Step 2 — Create ECR Repositories

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

aws ecr create-repository --repository-name fullstack-frontend --region $AWS_REGION
aws ecr create-repository --repository-name fullstack-backend  --region $AWS_REGION
```

---

### Step 3 — Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push Frontend
docker build -t fullstack-frontend ./Frontend
docker tag fullstack-frontend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fullstack-frontend:latest
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fullstack-frontend:latest

# Build and push Backend
docker build -t fullstack-backend ./Backend
docker tag fullstack-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fullstack-backend:latest
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/fullstack-backend:latest
```

---

### Step 4 — Deploy CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file cloudformation/stack.yaml \
  --stack-name fullstack-app \
  --region us-east-1 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FrontendImage=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/fullstack-frontend:latest \
    BackendImage=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/fullstack-backend:latest
```

### Get the live URL

```bash
aws cloudformation describe-stacks \
  --stack-name fullstack-app \
  --query 'Stacks[0].Outputs[?OutputKey==`AppURL`].OutputValue' \
  --output text
```

Open the URL in your browser — your app is live! 🎉

---

### Step 5 — Configure Jenkins CI/CD

1. Install plugins: `Git`, `GitHub Integration`, `Pipeline`
2. Add credentials in Jenkins:
   - `aws-access-key-id` — AWS Access Key
   - `aws-secret-access-key` — AWS Secret Key
3. Create a Pipeline job:
   - Definition: `Pipeline script from SCM`
   - SCM: Git → `https://github.com/mayank4singh/Three_Tier_AWS.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
4. Enable: ✅ `GitHub hook trigger for GITScm polling`

---

### Step 6 — Configure GitHub Webhook

1. Go to repo **Settings → Webhooks → Add webhook**
2. Payload URL: `http://YOUR_JENKINS_IP:8080/github-webhook/`
3. Content type: `application/json`
4. Events: ✅ Just the push event

---

## 🌐 How Frontend Connects to Backend

The frontend and backend communicate **through the ALBs**, not directly:

```
Browser
  │  GET /api/products
  ▼
Frontend ALB
  │
  ▼
Frontend ECS (Express server)
  │  proxy: GET http://internal-backend-alb:5000/api/products
  ▼
Backend ALB (internal)
  │
  ▼
Backend ECS (REST API)
  │
  └── returns JSON
```

The `BACKEND_URL` environment variable is **automatically injected** by CloudFormation using `!Sub "http://${BackendALB.DNSName}:5000"`. The frontend Express server proxies all `/api/*` requests to the backend — the browser never directly calls the backend ALB.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Add new product |
| DELETE | `/api/products/:id` | Delete product |

---

## 🧪 Local Development

```bash
# Terminal 1 — Start Backend
cd Backend
npm install
node app.js
# Running on http://localhost:5000

# Terminal 2 — Start Frontend
cd Frontend
npm install
node app.js
# Running on http://localhost:3000
```

Open `http://localhost:3000` in your browser.

---


<p align="center">
  <b>Built with ❤️ and lots of ☕ by <a href="https://github.com/mayank4singh">Mayank Singh</a></b>
</p>
