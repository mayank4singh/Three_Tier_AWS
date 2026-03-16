# Three-Tier AWS Architecture with CloudFormation, Docker & Jenkins CI/CD

## Project Overview

This project demonstrates a **production-style three-tier architecture on AWS** deployed using **Infrastructure as Code (IaC) with AWS CloudFormation** and automated through a **Jenkins CI/CD pipeline**.

The application consists of:

- **Frontend application**
- **Backend application**
- **Database layer**

The frontend and backend applications are **containerized using Docker**. The Docker images are built locally and pushed to **Amazon Elastic Container Registry (ECR)**. The **CloudFormation template then pulls these images from ECR and deploys the infrastructure automatically**.

This approach enables **fully automated infrastructure deployment and application delivery**.

---

# High Level Architecture

```mermaid
flowchart TB

User((User))

User --> Internet

Internet --> Jenkins[Jenkins CI/CD Server]

Jenkins --> GitHub[GitHub Repository]

GitHub --> Build[Build Docker Images]

Build --> ECR[Push Images to AWS ECR]

ECR --> CloudFormation

CloudFormation --> AppServer[Application Server]

AppServer --> DB1[MySQL Server 1]

AppServer --> DB2[MySQL Server 2]

DB1 <-- Replication --> DB2
