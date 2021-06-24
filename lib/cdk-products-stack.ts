import * as cdk from '@aws-cdk/core';
import * as cognito from "@aws-cdk/aws-cognito";
import * as appsync from "@aws-cdk/aws-appsync";
import * as ddb from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda";

export class CdkProductsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const userPoolApp = new cognito.UserPool(this, "cdk-products-user-pool-app", {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolAppClient = new cognito.UserPoolClient(this, "UserPoolAppClient", { userPool: userPoolApp })

    const userPoolWeb = new cognito.UserPool(this, "cdk-products-user-pool-web", {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolWebClient = new cognito.UserPoolClient(this, "UserPoolClient", { userPool: userPoolWeb })

    const api = new appsync.GraphqlApi(this, "cdk-product-app", {
      name: "cdk-product-api",
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      schema: appsync.Schema.fromAsset("./graphql/schema.graphql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: userPoolApp
            }
          },
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: userPoolWeb
            }
          }]
      }
    })

    const productLambda = new lambda.Function(this, "AppSyncProductHandler", {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "main.handler",
      code: lambda.Code.fromAsset("lambda-fns"),
      memorySize: 1024
    })

    const lambdaDs = api.addLambdaDataSource("lambdaDatasource", productLambda)

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "getProductById"
    })

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "listProducts"
    })

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "productsByCategory"
    })

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "createProduct"
    })

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "deleteProduct"
    })

    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "updateProduct"
    })

    const productTable = new ddb.Table(this, "CDKProductTable", {
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "id",
        type: ddb.AttributeType.STRING
      }
    })

    productTable.addGlobalSecondaryIndex({
      indexName: "productsByCategory",
      partitionKey: {
        name: "category",
        type: ddb.AttributeType.STRING
      }
    })

    productTable.grantFullAccess(productLambda)

    productLambda.addEnvironment("PRODUCT_TABLE", productTable.tableName)

    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl
    })

    new cdk.CfnOutput(this, "AppSyncAPIKey", {
      value: api.apiKey || ""
    })

    new cdk.CfnOutput(this, "ProjectRegion", {
      value: this.region
    })

    new cdk.CfnOutput(this, "UserPoolAppId", {
      value: userPoolApp.userPoolId
    })

    new cdk.CfnOutput(this, "UserPoolAppClientId", {
      value: userPoolAppClient.userPoolClientId
    })

    new cdk.CfnOutput(this, "UserPoolWebId", {
      value: userPoolWeb.userPoolId
    })

    new cdk.CfnOutput(this, "UserPoolWebClientId", {
      value: userPoolWebClient.userPoolClientId
    })
  }
}
