/**
 * Cloud provider service icons.
 *
 * draw.io ships the official AWS, Azure and Google Cloud architecture icon sets,
 * so a generated file references real artwork by name rather than approximating
 * it. `set` + `shape` identify the stencil; a wrong name renders a silently
 * blank tile, so every entry here is confirmed in the editor.
 *
 * Keys are provider-prefixed because service names collide across clouds —
 * "functions" alone means three different things.
 */

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export type CloudCategory =
  | 'compute'
  | 'storage'
  | 'database'
  | 'networking'
  | 'security'
  | 'integration'
  | 'analytics'
  | 'ml'
  | 'management'
  | 'devtools'
  | 'general';

/**
 * AWS colours its tiles by service category; Azure and Google draw the glyph
 * itself, so those providers use one brand tint (Google's glyphs carry their own
 * colours and ignore it).
 */
export const AWS_CATEGORY_COLOR: Record<CloudCategory, string> = {
  compute: '#ED7100',
  storage: '#7AA116',
  database: '#C925D1',
  networking: '#8C4FFF',
  security: '#DD344C',
  integration: '#E7157B',
  analytics: '#8C4FFF',
  ml: '#01A88D',
  management: '#E7157B',
  devtools: '#C925D1',
  general: '#232F3E',
};

export const PROVIDER_TINT: Record<CloudProvider, string> = {
  aws: '#ED7100',
  azure: '#0078D4',
  gcp: '#4285F4',
};

export interface CloudService {
  provider: CloudProvider;
  /** Short service name, shown when no glyph is available. */
  name: string;
  /** draw.io stencil set, e.g. `mxgraph.aws4`. */
  set: string;
  /** Stencil shape name as it appears in that set. */
  shape: string;
  category: CloudCategory;
}

export const CLOUD_SERVICES: Record<string, CloudService> = {
  'aws-acm': {
    provider: 'aws',
    name: 'ACM',
    set: 'mxgraph.aws4',
    shape: 'certificate manager',
    category: 'security',
  },
  'aws-api-gateway': {
    provider: 'aws',
    name: 'API Gateway',
    set: 'mxgraph.aws4',
    shape: 'api gateway',
    category: 'networking',
  },
  'aws-app-runner': {
    provider: 'aws',
    name: 'App Runner',
    set: 'mxgraph.aws4',
    shape: 'app runner',
    category: 'compute',
  },
  'aws-appsync': {
    provider: 'aws',
    name: 'AppSync',
    set: 'mxgraph.aws4',
    shape: 'appsync',
    category: 'integration',
  },
  'aws-athena': {
    provider: 'aws',
    name: 'Athena',
    set: 'mxgraph.aws4',
    shape: 'athena',
    category: 'analytics',
  },
  'aws-aurora': {
    provider: 'aws',
    name: 'Aurora',
    set: 'mxgraph.aws4',
    shape: 'aurora',
    category: 'database',
  },
  'aws-batch': {
    provider: 'aws',
    name: 'Batch',
    set: 'mxgraph.aws4',
    shape: 'batch',
    category: 'compute',
  },
  'aws-bedrock': {
    provider: 'aws',
    name: 'Bedrock',
    set: 'mxgraph.aws4',
    shape: 'bedrock',
    category: 'ml',
  },
  'aws-client': {
    provider: 'aws',
    name: 'Client',
    set: 'mxgraph.aws4',
    shape: 'client',
    category: 'general',
  },
  'aws-cloudformation': {
    provider: 'aws',
    name: 'CloudFormation',
    set: 'mxgraph.aws4',
    shape: 'cloudformation',
    category: 'management',
  },
  'aws-cloudfront': {
    provider: 'aws',
    name: 'CloudFront',
    set: 'mxgraph.aws4',
    shape: 'cloudfront',
    category: 'networking',
  },
  'aws-cloudtrail': {
    provider: 'aws',
    name: 'CloudTrail',
    set: 'mxgraph.aws4',
    shape: 'cloudtrail',
    category: 'management',
  },
  'aws-cloudwatch': {
    provider: 'aws',
    name: 'CloudWatch',
    set: 'mxgraph.aws4',
    shape: 'cloudwatch',
    category: 'management',
  },
  'aws-codebuild': {
    provider: 'aws',
    name: 'CodeBuild',
    set: 'mxgraph.aws4',
    shape: 'codebuild',
    category: 'devtools',
  },
  'aws-codepipeline': {
    provider: 'aws',
    name: 'CodePipeline',
    set: 'mxgraph.aws4',
    shape: 'codepipeline',
    category: 'devtools',
  },
  'aws-cognito': {
    provider: 'aws',
    name: 'Cognito',
    set: 'mxgraph.aws4',
    shape: 'cognito',
    category: 'security',
  },
  'aws-comprehend': {
    provider: 'aws',
    name: 'Comprehend',
    set: 'mxgraph.aws4',
    shape: 'comprehend',
    category: 'ml',
  },
  'aws-direct-connect': {
    provider: 'aws',
    name: 'Direct Connect',
    set: 'mxgraph.aws4',
    shape: 'direct connect',
    category: 'networking',
  },
  'aws-documentdb': {
    provider: 'aws',
    name: 'DocumentDB',
    set: 'mxgraph.aws4',
    shape: 'documentdb with mongodb compatibility',
    category: 'database',
  },
  'aws-dynamodb': {
    provider: 'aws',
    name: 'DynamoDB',
    set: 'mxgraph.aws4',
    shape: 'dynamodb',
    category: 'database',
  },
  'aws-ebs': {
    provider: 'aws',
    name: 'EBS',
    set: 'mxgraph.aws4',
    shape: 'elastic block store',
    category: 'storage',
  },
  'aws-ec2': {
    provider: 'aws',
    name: 'EC2',
    set: 'mxgraph.aws4',
    shape: 'ec2',
    category: 'compute',
  },
  'aws-ecr': {
    provider: 'aws',
    name: 'ECR',
    set: 'mxgraph.aws4',
    shape: 'ecr',
    category: 'compute',
  },
  'aws-ecs': {
    provider: 'aws',
    name: 'ECS',
    set: 'mxgraph.aws4',
    shape: 'ecs',
    category: 'compute',
  },
  'aws-efs': {
    provider: 'aws',
    name: 'EFS',
    set: 'mxgraph.aws4',
    shape: 'elastic file system',
    category: 'storage',
  },
  'aws-eks': {
    provider: 'aws',
    name: 'EKS',
    set: 'mxgraph.aws4',
    shape: 'eks',
    category: 'compute',
  },
  'aws-elasticache': {
    provider: 'aws',
    name: 'ElastiCache',
    set: 'mxgraph.aws4',
    shape: 'elasticache',
    category: 'database',
  },
  'aws-elb': {
    provider: 'aws',
    name: 'ELB',
    set: 'mxgraph.aws4',
    shape: 'elastic load balancing',
    category: 'networking',
  },
  'aws-emr': {
    provider: 'aws',
    name: 'EMR',
    set: 'mxgraph.aws4',
    shape: 'emr',
    category: 'analytics',
  },
  'aws-eventbridge': {
    provider: 'aws',
    name: 'EventBridge',
    set: 'mxgraph.aws4',
    shape: 'eventbridge',
    category: 'integration',
  },
  'aws-fargate': {
    provider: 'aws',
    name: 'Fargate',
    set: 'mxgraph.aws4',
    shape: 'fargate',
    category: 'compute',
  },
  'aws-fsx': {
    provider: 'aws',
    name: 'FSx',
    set: 'mxgraph.aws4',
    shape: 'fsx',
    category: 'storage',
  },
  'aws-glacier': {
    provider: 'aws',
    name: 'S3 Glacier',
    set: 'mxgraph.aws4',
    shape: 'glacier',
    category: 'storage',
  },
  'aws-glue': {
    provider: 'aws',
    name: 'Glue',
    set: 'mxgraph.aws4',
    shape: 'glue',
    category: 'analytics',
  },
  'aws-iam': {
    provider: 'aws',
    name: 'IAM',
    set: 'mxgraph.aws4',
    shape: 'identity and access management',
    category: 'security',
  },
  'aws-internet-gateway': {
    provider: 'aws',
    name: 'Internet Gateway',
    set: 'mxgraph.aws4',
    shape: 'internet gateway',
    category: 'networking',
  },
  'aws-kinesis': {
    provider: 'aws',
    name: 'Kinesis',
    set: 'mxgraph.aws4',
    shape: 'kinesis',
    category: 'analytics',
  },
  'aws-kms': {
    provider: 'aws',
    name: 'KMS',
    set: 'mxgraph.aws4',
    shape: 'key management service',
    category: 'security',
  },
  'aws-lambda': {
    provider: 'aws',
    name: 'Lambda',
    set: 'mxgraph.aws4',
    shape: 'lambda',
    category: 'compute',
  },
  'aws-lightsail': {
    provider: 'aws',
    name: 'Lightsail',
    set: 'mxgraph.aws4',
    shape: 'lightsail',
    category: 'compute',
  },
  'aws-mobile-client': {
    provider: 'aws',
    name: 'Mobile Client',
    set: 'mxgraph.aws4',
    shape: 'mobile client',
    category: 'general',
  },
  'aws-mq': {
    provider: 'aws',
    name: 'Amazon MQ',
    set: 'mxgraph.aws4',
    shape: 'mq',
    category: 'integration',
  },
  'aws-nat-gateway': {
    provider: 'aws',
    name: 'NAT Gateway',
    set: 'mxgraph.aws4',
    shape: 'nat gateway',
    category: 'networking',
  },
  'aws-neptune': {
    provider: 'aws',
    name: 'Neptune',
    set: 'mxgraph.aws4',
    shape: 'neptune',
    category: 'database',
  },
  'aws-opensearch': {
    provider: 'aws',
    name: 'OpenSearch',
    set: 'mxgraph.aws4',
    shape: 'elasticsearch service',
    category: 'analytics',
  },
  'aws-quicksight': {
    provider: 'aws',
    name: 'QuickSight',
    set: 'mxgraph.aws4',
    shape: 'quicksight',
    category: 'analytics',
  },
  'aws-rds': {
    provider: 'aws',
    name: 'RDS',
    set: 'mxgraph.aws4',
    shape: 'rds',
    category: 'database',
  },
  'aws-redshift': {
    provider: 'aws',
    name: 'Redshift',
    set: 'mxgraph.aws4',
    shape: 'redshift',
    category: 'database',
  },
  'aws-rekognition': {
    provider: 'aws',
    name: 'Rekognition',
    set: 'mxgraph.aws4',
    shape: 'rekognition',
    category: 'ml',
  },
  'aws-route53': {
    provider: 'aws',
    name: 'Route 53',
    set: 'mxgraph.aws4',
    shape: 'route 53',
    category: 'networking',
  },
  'aws-s3': {
    provider: 'aws',
    name: 'S3',
    set: 'mxgraph.aws4',
    shape: 's3',
    category: 'storage',
  },
  'aws-sagemaker': {
    provider: 'aws',
    name: 'SageMaker',
    set: 'mxgraph.aws4',
    shape: 'sagemaker',
    category: 'ml',
  },
  'aws-secrets-manager': {
    provider: 'aws',
    name: 'Secrets Manager',
    set: 'mxgraph.aws4',
    shape: 'secrets manager',
    category: 'security',
  },
  'aws-shield': {
    provider: 'aws',
    name: 'Shield',
    set: 'mxgraph.aws4',
    shape: 'shield',
    category: 'security',
  },
  'aws-sns': {
    provider: 'aws',
    name: 'SNS',
    set: 'mxgraph.aws4',
    shape: 'sns',
    category: 'integration',
  },
  'aws-sqs': {
    provider: 'aws',
    name: 'SQS',
    set: 'mxgraph.aws4',
    shape: 'sqs',
    category: 'integration',
  },
  'aws-step-functions': {
    provider: 'aws',
    name: 'Step Functions',
    set: 'mxgraph.aws4',
    shape: 'step functions',
    category: 'integration',
  },
  'aws-storage-gateway': {
    provider: 'aws',
    name: 'Storage Gateway',
    set: 'mxgraph.aws4',
    shape: 'storage gateway',
    category: 'storage',
  },
  'aws-systems-manager': {
    provider: 'aws',
    name: 'Systems Manager',
    set: 'mxgraph.aws4',
    shape: 'systems manager',
    category: 'management',
  },
  'aws-textract': {
    provider: 'aws',
    name: 'Textract',
    set: 'mxgraph.aws4',
    shape: 'textract',
    category: 'ml',
  },
  'aws-user': {
    provider: 'aws',
    name: 'User',
    set: 'mxgraph.aws4',
    shape: 'user',
    category: 'general',
  },
  'aws-users': {
    provider: 'aws',
    name: 'Users',
    set: 'mxgraph.aws4',
    shape: 'users',
    category: 'general',
  },
  'aws-vpc': {
    provider: 'aws',
    name: 'VPC',
    set: 'mxgraph.aws4',
    shape: 'vpc',
    category: 'networking',
  },
  'aws-waf': {
    provider: 'aws',
    name: 'WAF',
    set: 'mxgraph.aws4',
    shape: 'waf',
    category: 'security',
  },

  'azure-app-service': {
    provider: 'azure',
    name: 'App Service',
    set: 'mxgraph.mscae.cloud',
    shape: 'App Service',
    category: 'compute',
  },
  'azure-functions': {
    provider: 'azure',
    name: 'Functions',
    set: 'mxgraph.mscae.cloud',
    shape: 'Functions',
    category: 'compute',
  },
  'azure-container-registry': {
    provider: 'azure',
    name: 'Container Registry',
    set: 'mxgraph.mscae.cloud',
    shape: 'Container Registry',
    category: 'compute',
  },
  'azure-container-service': {
    provider: 'azure',
    name: 'Container Service',
    set: 'mxgraph.mscae.cloud',
    shape: 'Container Service',
    category: 'compute',
  },
  'azure-batch': {
    provider: 'azure',
    name: 'Batch',
    set: 'mxgraph.mscae.cloud',
    shape: 'Batch',
    category: 'compute',
  },
  'azure-vm': {
    provider: 'azure',
    name: 'Virtual Machine',
    set: 'mxgraph.mscae.cloud',
    shape: 'Virtual Machine Container',
    category: 'compute',
  },
  'azure-storage': {
    provider: 'azure',
    name: 'Storage',
    set: 'mxgraph.mscae.cloud',
    shape: 'Azure Storage',
    category: 'storage',
  },
  'azure-files': {
    provider: 'azure',
    name: 'Files',
    set: 'mxgraph.mscae.cloud',
    shape: 'Azure Files Service',
    category: 'storage',
  },
  'azure-data-lake': {
    provider: 'azure',
    name: 'Data Lake',
    set: 'mxgraph.mscae.cloud',
    shape: 'Data Lake',
    category: 'storage',
  },
  'azure-cosmos-db': {
    provider: 'azure',
    name: 'Cosmos DB',
    set: 'mxgraph.mscae.cloud',
    shape: 'Cosmos DB',
    category: 'database',
  },
  'azure-sql-database': {
    provider: 'azure',
    name: 'SQL Database',
    set: 'mxgraph.mscae.cloud',
    shape: 'SQL Database Premium',
    category: 'database',
  },
  'azure-sql-data-warehouse': {
    provider: 'azure',
    name: 'SQL Data Warehouse',
    set: 'mxgraph.mscae.cloud',
    shape: 'SQL DataWarehouse',
    category: 'database',
  },
  'azure-data-factory': {
    provider: 'azure',
    name: 'Data Factory',
    set: 'mxgraph.mscae.cloud',
    shape: 'Data Factory',
    category: 'analytics',
  },
  'azure-databricks': {
    provider: 'azure',
    name: 'Databricks',
    set: 'mxgraph.mscae.cloud',
    shape: 'Data Bricks',
    category: 'analytics',
  },
  'azure-hdinsight': {
    provider: 'azure',
    name: 'HDInsight',
    set: 'mxgraph.mscae.cloud',
    shape: 'HDInsight',
    category: 'analytics',
  },
  'azure-stream-analytics': {
    provider: 'azure',
    name: 'Stream Analytics',
    set: 'mxgraph.mscae.cloud',
    shape: 'Stream Analytics',
    category: 'analytics',
  },
  'azure-data-catalog': {
    provider: 'azure',
    name: 'Data Catalog',
    set: 'mxgraph.mscae.cloud',
    shape: 'Data Catalog',
    category: 'analytics',
  },
  'azure-application-gateway': {
    provider: 'azure',
    name: 'Application Gateway',
    set: 'mxgraph.mscae.cloud',
    shape: 'Application Gateway',
    category: 'networking',
  },
  'azure-load-balancer': {
    provider: 'azure',
    name: 'Load Balancer',
    set: 'mxgraph.mscae.cloud',
    shape: 'Azure Load Balancer feature',
    category: 'networking',
  },
  'azure-cdn': {
    provider: 'azure',
    name: 'CDN',
    set: 'mxgraph.mscae.cloud',
    shape: 'Content Delivery Network',
    category: 'networking',
  },
  'azure-dns': {
    provider: 'azure',
    name: 'DNS',
    set: 'mxgraph.mscae.cloud',
    shape: 'Azure DNS',
    category: 'networking',
  },
  'azure-expressroute': {
    provider: 'azure',
    name: 'ExpressRoute',
    set: 'mxgraph.mscae.cloud',
    shape: 'ExpressRoute',
    category: 'networking',
  },
  'azure-network-watcher': {
    provider: 'azure',
    name: 'Network Watcher',
    set: 'mxgraph.mscae.cloud',
    shape: 'Network Watcher',
    category: 'networking',
  },
  'azure-active-directory': {
    provider: 'azure',
    name: 'Active Directory',
    set: 'mxgraph.mscae.cloud',
    shape: 'Active Directory',
    category: 'security',
  },
  'azure-key-vault': {
    provider: 'azure',
    name: 'Key Vault',
    set: 'mxgraph.mscae.cloud',
    shape: 'Key Vault',
    category: 'security',
  },
  'azure-event-hubs': {
    provider: 'azure',
    name: 'Event Hubs',
    set: 'mxgraph.mscae.cloud',
    shape: 'Event Hubs',
    category: 'integration',
  },
  'azure-event-grid': {
    provider: 'azure',
    name: 'Event Grid',
    set: 'mxgraph.mscae.cloud',
    shape: 'Event Grid',
    category: 'integration',
  },
  'azure-service-bus': {
    provider: 'azure',
    name: 'Service Bus',
    set: 'mxgraph.mscae.cloud',
    shape: 'Service Bus',
    category: 'integration',
  },
  'azure-logic-apps': {
    provider: 'azure',
    name: 'Logic Apps',
    set: 'mxgraph.mscae.cloud',
    shape: 'Logic Apps',
    category: 'integration',
  },
  'azure-api-management': {
    provider: 'azure',
    name: 'API Management',
    set: 'mxgraph.mscae.cloud',
    shape: 'API Management',
    category: 'integration',
  },
  'azure-iot': {
    provider: 'azure',
    name: 'IoT Hub',
    set: 'mxgraph.mscae.cloud',
    shape: 'IoT',
    category: 'integration',
  },
  'azure-machine-learning': {
    provider: 'azure',
    name: 'Machine Learning',
    set: 'mxgraph.mscae.cloud',
    shape: 'Machine Learning',
    category: 'ml',
  },
  'azure-cognitive-services': {
    provider: 'azure',
    name: 'Cognitive Services',
    set: 'mxgraph.mscae.cloud',
    shape: 'Cognitive Services',
    category: 'ml',
  },
  'azure-bot-services': {
    provider: 'azure',
    name: 'Bot Services',
    set: 'mxgraph.mscae.cloud',
    shape: 'Bot Services',
    category: 'ml',
  },
  'azure-search': {
    provider: 'azure',
    name: 'Search',
    set: 'mxgraph.mscae.cloud',
    shape: 'Azure Search',
    category: 'analytics',
  },
  'azure-monitor': {
    provider: 'azure',
    name: 'Monitor',
    set: 'mxgraph.mscae.cloud',
    shape: 'Monitor',
    category: 'management',
  },
  'azure-application-insights': {
    provider: 'azure',
    name: 'Application Insights',
    set: 'mxgraph.mscae.cloud',
    shape: 'Application Insights',
    category: 'management',
  },
  'azure-advisor': {
    provider: 'azure',
    name: 'Advisor',
    set: 'mxgraph.mscae.cloud',
    shape: 'Advisor',
    category: 'management',
  },

  'gcp-compute-engine': {
    provider: 'gcp',
    name: 'Compute Engine',
    set: 'mxgraph.gcp2',
    shape: 'Compute Engine',
    category: 'compute',
  },
  'gcp-app-engine': {
    provider: 'gcp',
    name: 'App Engine',
    set: 'mxgraph.gcp2',
    shape: 'App Engine',
    category: 'compute',
  },
  'gcp-cloud-functions': {
    provider: 'gcp',
    name: 'Cloud Functions',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Functions',
    category: 'compute',
  },
  'gcp-cloud-run': {
    provider: 'gcp',
    name: 'Cloud Run',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Run',
    category: 'compute',
  },
  'gcp-gke': {
    provider: 'gcp',
    name: 'Kubernetes Engine',
    set: 'mxgraph.gcp2',
    shape: 'Kubernetes logo',
    category: 'compute',
  },
  'gcp-container-registry': {
    provider: 'gcp',
    name: 'Container Registry',
    set: 'mxgraph.gcp2',
    shape: 'Container Registry',
    category: 'compute',
  },
  'gcp-cloud-storage': {
    provider: 'gcp',
    name: 'Cloud Storage',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Storage',
    category: 'storage',
  },
  'gcp-filestore': {
    provider: 'gcp',
    name: 'Filestore',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Filestore',
    category: 'storage',
  },
  'gcp-cloud-sql': {
    provider: 'gcp',
    name: 'Cloud SQL',
    set: 'mxgraph.gcp2',
    shape: 'Cloud SQL',
    category: 'database',
  },
  'gcp-bigtable': {
    provider: 'gcp',
    name: 'Bigtable',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Bigtable',
    category: 'database',
  },
  'gcp-spanner': {
    provider: 'gcp',
    name: 'Spanner',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Spanner',
    category: 'database',
  },
  'gcp-firestore': {
    provider: 'gcp',
    name: 'Firestore',
    set: 'mxgraph.gcp2',
    shape: 'cloud firestore',
    category: 'database',
  },
  'gcp-datastore': {
    provider: 'gcp',
    name: 'Datastore',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Datastore',
    category: 'database',
  },
  'gcp-memorystore': {
    provider: 'gcp',
    name: 'Memorystore',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Memorystore',
    category: 'database',
  },
  'gcp-bigquery': {
    provider: 'gcp',
    name: 'BigQuery',
    set: 'mxgraph.gcp2',
    shape: 'BigQuery',
    category: 'analytics',
  },
  'gcp-dataflow': {
    provider: 'gcp',
    name: 'Dataflow',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Dataflow',
    category: 'analytics',
  },
  'gcp-dataproc': {
    provider: 'gcp',
    name: 'Dataproc',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Dataproc',
    category: 'analytics',
  },
  'gcp-composer': {
    provider: 'gcp',
    name: 'Composer',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Composer',
    category: 'analytics',
  },
  'gcp-pubsub': {
    provider: 'gcp',
    name: 'Pub/Sub',
    set: 'mxgraph.gcp2',
    shape: 'Cloud PubSub',
    category: 'integration',
  },
  'gcp-cloud-tasks': {
    provider: 'gcp',
    name: 'Cloud Tasks',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Tasks',
    category: 'integration',
  },
  'gcp-cloud-scheduler': {
    provider: 'gcp',
    name: 'Cloud Scheduler',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Scheduler',
    category: 'integration',
  },
  'gcp-cloud-endpoints': {
    provider: 'gcp',
    name: 'Cloud Endpoints',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Endpoints',
    category: 'integration',
  },
  'gcp-cloud-cdn': {
    provider: 'gcp',
    name: 'Cloud CDN',
    set: 'mxgraph.gcp2',
    shape: 'Cloud CDN',
    category: 'networking',
  },
  'gcp-load-balancing': {
    provider: 'gcp',
    name: 'Load Balancing',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Load Balancing',
    category: 'networking',
  },
  'gcp-cloud-dns': {
    provider: 'gcp',
    name: 'Cloud DNS',
    set: 'mxgraph.gcp2',
    shape: 'Cloud DNS',
    category: 'networking',
  },
  'gcp-cloud-nat': {
    provider: 'gcp',
    name: 'Cloud NAT',
    set: 'mxgraph.gcp2',
    shape: 'Cloud NAT',
    category: 'networking',
  },
  'gcp-cloud-armor': {
    provider: 'gcp',
    name: 'Cloud Armor',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Armor',
    category: 'security',
  },
  'gcp-cloud-iam': {
    provider: 'gcp',
    name: 'Cloud IAM',
    set: 'mxgraph.gcp2',
    shape: 'Cloud IAM',
    category: 'security',
  },
  'gcp-kms': {
    provider: 'gcp',
    name: 'Key Management Service',
    set: 'mxgraph.gcp2',
    shape: 'Key Management Service',
    category: 'security',
  },
  'gcp-logging': {
    provider: 'gcp',
    name: 'Logging',
    set: 'mxgraph.gcp2',
    shape: 'Logging',
    category: 'management',
  },
  'gcp-monitoring': {
    provider: 'gcp',
    name: 'Monitoring',
    set: 'mxgraph.gcp2',
    shape: 'cloud monitoring',
    category: 'management',
  },
  'gcp-container-builder': {
    provider: 'gcp',
    name: 'Cloud Build',
    set: 'mxgraph.gcp2',
    shape: 'Container Builder',
    category: 'devtools',
  },
  'gcp-vision-api': {
    provider: 'gcp',
    name: 'Vision API',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Vision API',
    category: 'ml',
  },
  'gcp-natural-language': {
    provider: 'gcp',
    name: 'Natural Language API',
    set: 'mxgraph.gcp2',
    shape: 'Cloud Natural Language API',
    category: 'ml',
  },
  'gcp-dialogflow': {
    provider: 'gcp',
    name: 'Dialogflow',
    set: 'mxgraph.gcp2',
    shape: 'Dialogflow Enterprise Edition',
    category: 'ml',
  },
};

export const CLOUD_SERVICE_KEYS = Object.keys(CLOUD_SERVICES).sort();

/** Edge length of the square icon tile, matching the editor's own shapes. */
export const ICON_TILE = 78;
/** Gap between the tile and the label beneath it. */
export const ICON_LABEL_GAP = 6;

export function cloudService(key: string): CloudService | undefined {
  return CLOUD_SERVICES[key];
}

/** draw.io shape id: the set plus the lowercased, underscored shape name. */
export function shapeId(service: CloudService): string {
  return `${service.set}.${service.shape.toLowerCase().replace(/ /g, '_')}`;
}

/** The mxGraph style for one service icon with its label underneath. */
export function cloudIconStyle(service: CloudService): string {
  const common =
    'sketch=0;outlineConnect=0;gradientColor=none;strokeColor=none;dashed=0;' +
    'verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;aspect=fixed;';
  if (service.provider === 'aws') {
    // AWS wraps its glyph in a category-coloured tile.
    return `${common}shape=mxgraph.aws4.resourceIcon;resIcon=${shapeId(service)};`;
  }
  return `${common}shape=${shapeId(service)};`;
}
