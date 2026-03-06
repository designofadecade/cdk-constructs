import type { SNSEvent } from 'aws-lambda';
import * as https from 'https';
import * as url from 'url';

interface CloudWatchAlarmMessage {
    AlarmName?: string;
    NewStateValue?: string;
    NewStateReason?: string;
    StateChangeTime?: string;
}

export const handler = async (event: SNSEvent): Promise<{ statusCode: number; body: string }> => {
    const webhookUrl = process.env.WEBHOOK_URL;
    const messagePrefix = process.env.MESSAGE_PREFIX || '';

    if (!webhookUrl) {
        throw new Error('WEBHOOK_URL environment variable is required');
    }

    const message = event.Records[0].Sns;
    const body = message.Message;

    let parsedBody: CloudWatchAlarmMessage;
    try {
        parsedBody = JSON.parse(body);
    } catch (e) {
        parsedBody = { AlarmName: body };
    }

    const alarmName = parsedBody.AlarmName || 'Unknown Alarm';
    const newState = parsedBody.NewStateValue || 'ALARM';
    const reason = parsedBody.NewStateReason || 'No reason provided';
    const timestamp = parsedBody.StateChangeTime || new Date().toISOString();

    const chatMessage = {
        text:
            `*${messagePrefix} ${alarmName}*\n\n` +
            `*State:* ${newState}\n` +
            `*Time:* ${timestamp}\n` +
            `*Reason:* ${reason}`,
    };

    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(chatMessage);

    const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => (responseBody += chunk));
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ statusCode: 200, body: 'Sent to Google Chat' });
                } else {
                    reject(new Error(`Failed to send to Google Chat: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
};
