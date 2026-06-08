import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.AWS_S3_BUCKET;

// Build client config — only pass explicit credentials if both env vars are present.
// Otherwise fall back to SDK default chain: IAM instance role, ~/.aws/credentials, etc.
const clientConfig: ConstructorParameters<typeof S3Client>[0] = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3 = new S3Client(clientConfig);

export function getS3Bucket(): string {
  if (!bucket) throw new Error("AWS_S3_BUCKET environment variable is not set");
  return bucket;
}

export async function uploadToS3(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  const b = getS3Bucket();
  await s3.send(new PutObjectCommand({
    Bucket: b,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return `https://${b}.s3.${region}.amazonaws.com/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key }));
}
