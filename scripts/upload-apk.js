/**
 * Upload APK to S3-compatible object storage (is3.cloudhost.id)
 * and set it as publicly readable.
 */

const { S3Client, PutObjectCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const APK_PATH = path.join(__dirname, '..', '..', 'mobile', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
const BUCKET_NAME = 'zone-mart';
const OBJECT_KEY = 'app-release.apk';

const s3 = new S3Client({
  region: 'us-east-1', // required but ignored by custom endpoints
  endpoint: 'https://is3.cloudhost.id',
  credentials: {
    accessKeyId: 'WHBEHWV772ZO716LNBH2',
    secretAccessKey: 'jGjt52f0AhTTL7tf9BXSBEMsWxB8RLRZD0tL8hsw',
  },
  forcePathStyle: true, // required for non-AWS S3 compatible storage
});

async function uploadAPK() {
  console.log(`Reading APK from: ${APK_PATH}`);

  if (!fs.existsSync(APK_PATH)) {
    console.error('APK file not found at:', APK_PATH);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(APK_PATH);
  const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`APK size: ${fileSizeMB} MB`);
  console.log(`Uploading to: s3://${BUCKET_NAME}/${OBJECT_KEY}`);

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: OBJECT_KEY,
      Body: fileBuffer,
      ContentType: 'application/vnd.android.package-archive',
      ACL: 'public-read',
    });

    const result = await s3.send(command);
    console.log('\n✅ Upload berhasil!');
    console.log(`HTTP Status: ${result.$metadata.httpStatusCode}`);
    console.log(`\n🔗 URL Download APK:`);
    console.log(`https://is3.cloudhost.id/${BUCKET_NAME}/${OBJECT_KEY}`);
  } catch (err) {
    console.error('\n❌ Upload gagal:', err.message);
    if (err.Code) console.error('Error Code:', err.Code);
    if (err.$response) console.error('HTTP Status:', err.$response.statusCode);
    process.exit(1);
  }
}

uploadAPK();
