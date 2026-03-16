import type { SNSEvent } from 'aws-lambda';
import { SNS, PublishCommand } from '@aws-sdk/client-sns';

export const handler = async (event: SNSEvent): Promise<{ statusCode: number; body: string }> => {
    console.log('Received SNS event:', JSON.stringify(event, null, 2));

    const targetTopicArn = process.env.TARGET_TOPIC_ARN;
    const targetRegion = process.env.TARGET_REGION;

    if (!targetTopicArn) {
        throw new Error('TARGET_TOPIC_ARN environment variable is required');
    }

    if (!targetRegion) {
        throw new Error('TARGET_REGION environment variable is required');
    }

    // Create SNS client for the target region
    const snsClient = new SNS({ region: targetRegion });
    
    const results: string[] = [];

    for (const record of event.Records) {
        if (record.Sns) {
            try {
                // Convert SNS message attributes to the format expected by PublishCommand
                const messageAttributes: Record<string, { DataType: string; StringValue?: string; BinaryValue?: Uint8Array }> = {};

                if (record.Sns.MessageAttributes) {
                    for (const [key, value] of Object.entries(record.Sns.MessageAttributes)) {
                        if (value.Type === 'String' && value.Value) {
                            messageAttributes[key] = {
                                DataType: 'String',
                                StringValue: value.Value,
                            };
                        } else if (value.Type === 'Binary' && value.Value) {
                            messageAttributes[key] = {
                                DataType: 'Binary',
                                BinaryValue: new Uint8Array(Buffer.from(value.Value, 'base64')),
                            };
                        } else if (value.Type.startsWith('Number') && value.Value) {
                            messageAttributes[key] = {
                                DataType: value.Type,
                                StringValue: value.Value,
                            };
                        }
                    }
                }

                const command = new PublishCommand({
                    TopicArn: targetTopicArn,
                    Message: record.Sns.Message,
                    Subject: record.Sns.Subject || 'Forwarded Message',
                    MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
                });

                const response = await snsClient.send(command);
                const messageId = response.MessageId;
                console.log(`Successfully forwarded message to ${targetRegion} - MessageId: ${messageId}`);
                results.push(`Forwarded: ${messageId}`);
            } catch (error) {
                console.error('Error forwarding message:', error);
                // Re-throw to trigger CloudWatch alarms and enable retry
                throw error;
            }
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Messages forwarded successfully',
            count: results.length,
            results,
        }),
    };
};
