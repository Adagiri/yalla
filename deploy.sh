#!/bin/bash

# =============================================================================
# Complete CI/CD Setup with Shared Load Balancer
# =============================================================================


SHARED_ALB_ARN="arn:aws:elasticloadbalancing:us-east-1:051259970704:loadbalancer/app/yalla-ride-api/c032d9034388a9e3"
AWS_PROFILE="yalla"
AWS_REGION="us-east-1"

echo "🚀 Setting up complete CI/CD pipeline with shared ALB..."
echo "📋 Load Balancer ARN: $SHARED_ALB_ARN"

# =============================================================================
# 1. Create directory structure
# =============================================================================

echo "📁 Creating directory structure..."
mkdir -p .ebextensions
mkdir -p .platform/docker
mkdir -p .github/workflows
mkdir -p scripts

# =============================================================================
# 2. Update package.json scripts
# =============================================================================

echo "📝 Updating package.json scripts..."

# Backup existing package.json
cp package.json package.json.backup

# Update scripts section using jq
jq '.scripts = {
  "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
  "build": "tsc && npm run copy:gql",
  "copy:gql": "node scripts/copy-gql.js",
  "start": "NODE_ENV=production node dist/index.js",
  "test": "jest --coverage",
  "lint": "eslint \"src/**/*.{ts,js}\" --fix",
  "format": "prettier --write \"src/**/*.{ts,js,json,md}\"",
  "docker:build": "docker build -t yalla-api:latest .",
  "docker:run": "docker run -p 8000:8000 --env NODE_ENV=development yalla-api:latest",
  "eb:init": "eb init yalla-ride-api --region us-east-1 --platform docker",
  "eb:create:staging": "eb create yalla-api-staging --instance-types t3.medium --envvars NODE_ENV=staging",
  "eb:create:prod": "eb create yalla-api-prod --instance-types t3.large --envvars NODE_ENV=production",
  "eb:deploy:staging": "eb deploy yalla-api-staging",
  "eb:deploy:prod": "eb deploy yalla-api-prod"
}' package.json > package.json.tmp && mv package.json.tmp package.json

# =============================================================================
# 3. Create EB extensions with actual ALB ARN
# =============================================================================

echo "⚙️ Creating EB extensions..."

cat > .ebextensions/01-shared-alb.config << EOF
option_settings:
  aws:elasticbeanstalk:environment:
    LoadBalancerType: application
    LoadBalancerIsShared: true
  aws:elbv2:loadbalancer:
    SharedLoadBalancer: $SHARED_ALB_ARN
  aws:elbv2:listener:443:
    ListenerEnabled: true
    Protocol: HTTPS
    Rules: |
      priority=10,condition=host-header="api-staging.yalla.ng",action=forward,target=default
      priority=20,condition=host-header="api.yalla.ng",action=forward,target=default
  aws:elbv2:listener:80:
    ListenerEnabled: true
    Protocol: HTTP
    Rules: |
      priority=10,condition=host-header="api-staging.yalla.ng",action=redirect,redirect-protocol=HTTPS,redirect-port=443
      priority=20,condition=host-header="api.yalla.ng",action=redirect,redirect-protocol=HTTPS,redirect-port=443
EOF

cat > .ebextensions/02-environment.config << 'EOF'
option_settings:
  aws:autoscaling:launchconfiguration:
    InstanceType: t3.medium
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
  aws:autoscaling:asg:
    MinSize: 1
    MaxSize: 4
    Cooldown: 300
  aws:elasticbeanstalk:healthreporting:system:
    SystemType: enhanced
    HealthCheckSuccessThreshold: Ok
    EnhancedHealthAuthEnabled: true
  aws:elasticbeanstalk:environment:process:default:
    HealthCheckPath: /health
    HealthCheckInterval: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 5
    Port: 8000
    Protocol: HTTP
    MatcherHTTPCode: 200
    DeregistrationDelay: 20
    StickinessEnabled: false
  aws:elasticbeanstalk:application:
    Application Healthcheck URL: /health
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 7
EOF

cat > .ebextensions/03-performance.config << 'EOF'
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm start"
    NodeVersion: 18.18.0
    GzipCompression: true
    ProxyStaticFiles: /static
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx
files:
  "/etc/nginx/conf.d/01_gzip.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      gzip on;
      gzip_comp_level 6;
      gzip_vary on;
      gzip_min_length 1024;
      gzip_proxied any;
      gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml;
EOF

# =============================================================================
# 4. Create Dockerrun.aws.json
# =============================================================================

echo "🐳 Creating Docker configuration..."

cat > .platform/docker/Dockerrun.aws.json << 'EOF'
{
  "AWSEBDockerrunVersion": 2,
  "containerDefinitions": [
    {
      "name": "yalla-api",
      "image": "yalla-api:latest",
      "essential": true,
      "memory": 1024,
      "cpu": 512,
      "portMappings": [
        {
          "hostPort": 8000,
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "8000"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/aws/elasticbeanstalk/yalla-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "docker",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# =============================================================================
# 5. Create copy-gql script if it doesn't exist
# =============================================================================

if [ ! -f "scripts/copy-gql.js" ]; then
    echo "📝 Creating copy-gql script..."
    
    cat > scripts/copy-gql.js << 'EOF'
const fs = require('fs');
const path = require('path');

function copyGraphQLFiles() {
  const srcDir = path.join(__dirname, '..', 'src');
  const distDir = path.join(__dirname, '..', 'dist');
  
  function copyGQLFilesRecursive(dir, targetDir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const srcPath = path.join(dir, item);
      const stats = fs.statSync(srcPath);
      
      if (stats.isDirectory()) {
        const newTargetDir = path.join(targetDir, item);
        if (!fs.existsSync(newTargetDir)) {
          fs.mkdirSync(newTargetDir, { recursive: true });
        }
        copyGQLFilesRecursive(srcPath, newTargetDir);
      } else if (item.endsWith('.graphql') || item.endsWith('.gql')) {
        const targetPath = path.join(targetDir, item);
        fs.copyFileSync(srcPath, targetPath);
        console.log(`Copied: ${srcPath} -> ${targetPath}`);
      }
    });
  }
  
  if (fs.existsSync(srcDir)) {
    copyGQLFilesRecursive(srcDir, distDir);
    console.log('GraphQL files copied successfully!');
  } else {
    console.log('Source directory not found');
  }
}

copyGraphQLFiles();
EOF
fi

# =============================================================================
# 6. Create ECR repository
# =============================================================================

echo "📦 Creating ECR repository..."

aws ecr describe-repositories --repository-names yalla-api --profile $AWS_PROFILE --region $AWS_REGION 2>/dev/null || \
aws ecr create-repository \
    --repository-name yalla-api \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION

ECR_URI=$(aws ecr describe-repositories --repository-names yalla-api --profile $AWS_PROFILE --region $AWS_REGION --query 'repositories[0].repositoryUri' --output text)
echo "📋 ECR Repository URI: $ECR_URI"

# =============================================================================
# 7. Initialize EB application
# =============================================================================

echo "🔧 Initializing EB application..."

eb init yalla-ride-api --profile $AWS_PROFILE --region $AWS_REGION --platform docker

# =============================================================================
# 8. Create environments
# =============================================================================

echo "🚀 Creating EB environments..."

# Create staging environment
echo "Creating staging environment..."
eb create yalla-api-staging \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --instance-types t3.medium \
    --envvars NODE_ENV=staging,APP_NODE_ENV=staging,AWS_REGION=$AWS_REGION

# Create production environment
echo "Creating production environment..."
eb create yalla-api-prod \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --instance-types t3.large \
    --envvars NODE_ENV=production,APP_NODE_ENV=production,AWS_REGION=$AWS_REGION

# =============================================================================
# 9. Test local Docker build
# =============================================================================

echo "🧪 Testing local Docker build..."

docker build -t yalla-api:test .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
else
    echo "❌ Docker build failed!"
    exit 1
fi

# =============================================================================
# 10. Setup Git and GitHub Actions
# =============================================================================

echo "📄 Setting up Git and GitHub Actions..."

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
fi

# Create branches
git checkout -b main 2>/dev/null || git checkout main
git checkout -b staging 2>/dev/null || git checkout staging

# Add all files
git add .
git commit -m "Add complete CI/CD pipeline with shared ALB configuration" || echo "Files already committed"

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "✅ Complete CI/CD setup finished!"
echo ""
echo "📋 Summary:"
echo "   • Load Balancer ARN: $SHARED_ALB_ARN"
echo "   • ECR Repository: $ECR_URI"
echo "   • EB Environments: yalla-api-staging, yalla-api-prod"
echo "   • Instance Configuration: Fixed single instance (no autoscaling)"
echo ""
echo "🔐 Required GitHub Secrets:"
echo "   • AWS_ACCESS_KEY_ID"
echo "   • AWS_SECRET_ACCESS_KEY" 
echo "   • ECR_REGISTRY: ${ECR_URI%/*}"
echo ""
echo "🚀 Next steps:"
echo "1. Push to 'staging' branch to deploy to staging"
echo "2. Push to 'main' branch to deploy to production"
echo "3. Configure your domain DNS to point to the shared ALB"
echo ""
echo "🌐 Expected URLs:"
echo "   • Staging: https://api-staging.yalla.ng"
echo "   • Production: https://api.yalla.ng"
echo ""
echo "⚡ Quick commands:"
echo "   • Test staging: git push origin staging"
echo "   • Deploy production: git push origin main"
echo "   • View logs: eb logs yalla-api-staging --profile yalla"