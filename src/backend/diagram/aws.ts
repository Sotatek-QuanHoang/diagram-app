/**
 * AWS service icons.
 *
 * draw.io ships the official AWS architecture icon set, so a generated file can
 * reference the real artwork by name instead of approximating it. Every
 * `resIcon` below was confirmed to render in the actual editor — a wrong name
 * produces a silently blank tile, which is worse than a plain box.
 *
 * Fill colours are AWS's own 2023 category palette, the same one the editor's
 * shape library uses, so a generated diagram matches one drawn by hand.
 */

export type AwsCategory =
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

export const AWS_CATEGORY_COLOR: Record<AwsCategory, string> = {
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

export interface AwsService {
  /** Short service name, drawn inside the tile in the preview. */
  name: string;
  /** draw.io shape id, without the `mxgraph.aws4.` prefix. */
  resIcon: string;
  category: AwsCategory;
}

export const AWS_SERVICES: Record<string, AwsService> = {
  // Compute and containers
  lambda: { name: 'Lambda', resIcon: 'lambda', category: 'compute' },
  ec2: { name: 'EC2', resIcon: 'ec2', category: 'compute' },
  ecs: { name: 'ECS', resIcon: 'ecs', category: 'compute' },
  eks: { name: 'EKS', resIcon: 'eks', category: 'compute' },
  fargate: { name: 'Fargate', resIcon: 'fargate', category: 'compute' },
  batch: { name: 'Batch', resIcon: 'batch', category: 'compute' },
  lightsail: { name: 'Lightsail', resIcon: 'lightsail', category: 'compute' },
  'app-runner': { name: 'App Runner', resIcon: 'app_runner', category: 'compute' },
  ecr: { name: 'ECR', resIcon: 'ecr', category: 'compute' },

  // Storage
  s3: { name: 'S3', resIcon: 's3', category: 'storage' },
  efs: { name: 'EFS', resIcon: 'elastic_file_system', category: 'storage' },
  ebs: { name: 'EBS', resIcon: 'elastic_block_store', category: 'storage' },
  fsx: { name: 'FSx', resIcon: 'fsx', category: 'storage' },
  glacier: { name: 'S3 Glacier', resIcon: 'glacier', category: 'storage' },
  'storage-gateway': { name: 'Storage Gateway', resIcon: 'storage_gateway', category: 'storage' },

  // Database
  dynamodb: { name: 'DynamoDB', resIcon: 'dynamodb', category: 'database' },
  rds: { name: 'RDS', resIcon: 'rds', category: 'database' },
  aurora: { name: 'Aurora', resIcon: 'aurora', category: 'database' },
  elasticache: { name: 'ElastiCache', resIcon: 'elasticache', category: 'database' },
  redshift: { name: 'Redshift', resIcon: 'redshift', category: 'database' },
  documentdb: {
    name: 'DocumentDB',
    resIcon: 'documentdb_with_mongodb_compatibility',
    category: 'database',
  },
  neptune: { name: 'Neptune', resIcon: 'neptune', category: 'database' },

  // Networking and content delivery
  cloudfront: { name: 'CloudFront', resIcon: 'cloudfront', category: 'networking' },
  route53: { name: 'Route 53', resIcon: 'route_53', category: 'networking' },
  vpc: { name: 'VPC', resIcon: 'vpc', category: 'networking' },
  elb: { name: 'ELB', resIcon: 'elastic_load_balancing', category: 'networking' },
  'api-gateway': { name: 'API Gateway', resIcon: 'api_gateway', category: 'networking' },
  'direct-connect': { name: 'Direct Connect', resIcon: 'direct_connect', category: 'networking' },
  'internet-gateway': {
    name: 'Internet Gateway',
    resIcon: 'internet_gateway',
    category: 'networking',
  },
  'nat-gateway': { name: 'NAT Gateway', resIcon: 'nat_gateway', category: 'networking' },

  // Security, identity and compliance
  cognito: { name: 'Cognito', resIcon: 'cognito', category: 'security' },
  iam: { name: 'IAM', resIcon: 'identity_and_access_management', category: 'security' },
  kms: { name: 'KMS', resIcon: 'key_management_service', category: 'security' },
  'secrets-manager': { name: 'Secrets Manager', resIcon: 'secrets_manager', category: 'security' },
  waf: { name: 'WAF', resIcon: 'waf', category: 'security' },
  shield: { name: 'Shield', resIcon: 'shield', category: 'security' },
  acm: { name: 'ACM', resIcon: 'certificate_manager', category: 'security' },

  // Application integration
  sqs: { name: 'SQS', resIcon: 'sqs', category: 'integration' },
  sns: { name: 'SNS', resIcon: 'sns', category: 'integration' },
  eventbridge: { name: 'EventBridge', resIcon: 'eventbridge', category: 'integration' },
  'step-functions': { name: 'Step Functions', resIcon: 'step_functions', category: 'integration' },
  appsync: { name: 'AppSync', resIcon: 'appsync', category: 'integration' },
  mq: { name: 'Amazon MQ', resIcon: 'mq', category: 'integration' },

  // Analytics
  kinesis: { name: 'Kinesis', resIcon: 'kinesis', category: 'analytics' },
  athena: { name: 'Athena', resIcon: 'athena', category: 'analytics' },
  glue: { name: 'Glue', resIcon: 'glue', category: 'analytics' },
  emr: { name: 'EMR', resIcon: 'emr', category: 'analytics' },
  quicksight: { name: 'QuickSight', resIcon: 'quicksight', category: 'analytics' },
  opensearch: { name: 'OpenSearch', resIcon: 'elasticsearch_service', category: 'analytics' },

  // Machine learning
  sagemaker: { name: 'SageMaker', resIcon: 'sagemaker', category: 'ml' },
  bedrock: { name: 'Bedrock', resIcon: 'bedrock', category: 'ml' },
  comprehend: { name: 'Comprehend', resIcon: 'comprehend', category: 'ml' },
  rekognition: { name: 'Rekognition', resIcon: 'rekognition', category: 'ml' },
  textract: { name: 'Textract', resIcon: 'textract', category: 'ml' },

  // Management and governance
  cloudwatch: { name: 'CloudWatch', resIcon: 'cloudwatch', category: 'management' },
  cloudtrail: { name: 'CloudTrail', resIcon: 'cloudtrail', category: 'management' },
  cloudformation: { name: 'CloudFormation', resIcon: 'cloudformation', category: 'management' },
  'systems-manager': {
    name: 'Systems Manager',
    resIcon: 'systems_manager',
    category: 'management',
  },

  // Developer tools
  codepipeline: { name: 'CodePipeline', resIcon: 'codepipeline', category: 'devtools' },
  codebuild: { name: 'CodeBuild', resIcon: 'codebuild', category: 'devtools' },

  // General resources
  user: { name: 'User', resIcon: 'user', category: 'general' },
  users: { name: 'Users', resIcon: 'users', category: 'general' },
  client: { name: 'Client', resIcon: 'client', category: 'general' },
  'mobile-client': { name: 'Mobile Client', resIcon: 'mobile_client', category: 'general' },
};

export const AWS_SERVICE_KEYS = Object.keys(AWS_SERVICES).sort();

/** Edge length of the square icon tile, matching the editor's own AWS shapes. */
export const AWS_TILE = 78;
/** Gap between the tile and the label beneath it. */
export const AWS_LABEL_GAP = 6;

export function awsService(key: string): AwsService | undefined {
  return AWS_SERVICES[key];
}

/** The mxGraph style for one AWS resource icon with its label underneath. */
export function awsIconStyle(service: AwsService): string {
  return (
    'sketch=0;outlineConnect=0;gradientColor=none;strokeColor=none;dashed=0;' +
    'verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;' +
    `aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${service.resIcon};`
  );
}
