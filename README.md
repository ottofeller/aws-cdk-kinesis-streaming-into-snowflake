# Streaming real-time data into Snowflake using Kinesis Streams

We will create an AWS CDK stack that will stream data into a Snowflake table using Kinesis Streams and Kinesis Data Firehose. This solution will allow to ingest data from different accounts and regions into a Snowflake table in real-time.

## Snowflake setup

We will need a Snowflake user with permissions to insert data into the table. We will also need to configure key pair authentication for the user. Follow [this guide](https://docs.snowflake.com/en/user-guide/key-pair-auth#configuring-key-pair-authentication), it should be relatively simple.

Next, create a secret in AWS Secrets Manager containing this private key. This secret will be used by the Kinesis Data Firehose delivery stream to authenticate with Snowflake.

```bash
aws secretsmanager create-secret \
  --name Snowflake/PrivateKey \
  --secret-string file://path/to/private-key-file
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
