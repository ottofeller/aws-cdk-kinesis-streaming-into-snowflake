import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class AwsCdkKinesisStreamingIntoSnowflakeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const encryptionKey = new cdk.aws_kms.Key(this, 'Key', {})

    encryptionKey.addToResourcePolicy(new cdk.aws_iam.PolicyStatement({
      sid: 'Allow direct access to key metadata to the account',
      effect: cdk.aws_iam.Effect.ALLOW,
      principals: [new cdk.aws_iam.AccountRootPrincipal()],
      actions: ['kms:Describe*', 'kms:Get*', 'kms:List*'],
      resources: ['*']
    }))

    encryptionKey.addToResourcePolicy(new cdk.aws_iam.PolicyStatement({
      sid: 'Allow use of the key through Amazon Kinesis for principals in the account that are authorized to use Amazon Kinesis',
      effect: cdk.aws_iam.Effect.ALLOW,
      principals: [new cdk.aws_iam.AnyPrincipal()],
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'kms.ViaService': `kinesis.${cdk.Stack.of(this).region}.amazonaws.com`,
          'kms:CallerAccount': cdk.Stack.of(this).account
        },
      }
    }))

    const stream = new cdk.aws_kinesis.Stream(this, 'Stream', {encryptionKey})

    new cdk.custom_resources.AwsCustomResource(this, 'Resource', {
      onUpdate: {
        service: 'Kinesis',
        action: 'PutResourcePolicy',
        parameters: {
          ResourceARN: stream.streamArn,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'Allow cross-account write access to the stream',
                Effect: 'Allow',
                Principal: {AWS: 'arn:aws:iam::123456789012:role/data-producer-example'},
                Action: [
                  'kinesis:PutRecord',
                  'kinesis:PutRecords',
                  'kinesis:DescribeStreamSummary',
                  'kinesis:ListShards',
                ],
                Resource: stream.streamArn
              }
            ]
          })
        },
        physicalResourceId: cdk.custom_resources.PhysicalResourceId.of('Resource')
      },
      policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({resources: [stream.streamArn]})
    })

    const role = new cdk.aws_iam.Role(this, 'Role', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('firehose.amazonaws.com', {
        conditions: {StringEquals: {'sts:ExternalId': cdk.Stack.of(this).account}}
      })
    })

    const secret = cdk.aws_secretsmanager.Secret.fromSecretNameV2(this, 'Secret', 'Snowflake/PrivateKey')

    const deliveryStream = new cdk.aws_kinesisfirehose.CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {kinesisStreamArn: stream.streamArn, roleArn: role.roleArn},
      snowflakeDestinationConfiguration: {
        accountUrl: 'https://account.region.snowflakecomputing.com',
        database: 'database',
        schema: 'schema',
        table: 'table',
        user: 'username',
        snowflakeRoleConfiguration: {snowflakeRole: 'role', enabled: true},
        privateKey: secret.secretValue.toString(),
        roleArn: role.roleArn,
        s3Configuration: {
          bucketArn: 'arn:aws:s3:::your-backup-bucket',
          roleArn: role.roleArn,
        }
      }
    })

    stream.grantReadWrite(role).applyBefore(deliveryStream)
  }
}
