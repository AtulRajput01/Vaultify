require('dotenv').config();  // Load environment variables from the .env file

const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');

// Initialize express app
const app = express();

// Set up AWS SDK to access Secrets Manager
const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION  // AWS Region from .env
});

// Function to fetch AWS credentials from Secrets Manager
const getAwsCredentials = async () => {
  try {
    const data = await secretsManager.getSecretValue({ SecretId: 'AWS-keys2' }).promise();
    
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      
      // Return the AWS credentials from the secret
      return {
        accessKeyId: secrets.AWS_ACCESS_KEY_ID,
        secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY,
      };
    } else {
      throw new Error('Secret not found');
    }
  } catch (error) {
    throw new Error(`Unable to retrieve secrets: ${error.message}`);
  }
};

// Set up multer storage engine to handle file uploads
const storage = multer.memoryStorage();  // Store files in memory
const upload = multer({ storage: storage });

// Define the PUT route to upload an image to S3
app.put('/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    // Fetch AWS credentials from Secrets Manager
    const credentials = await getAwsCredentials();

    // Update AWS SDK configuration with retrieved credentials
    AWS.config.update({
      accessKeyId: credentials.accessKeyId, 
      secretAccessKey: credentials.secretAccessKey, 
      region: process.env.AWS_REGION  
    });

    const s3 = new AWS.S3();

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,  // Use the bucket name from .env
      Key: `${Date.now()}-${req.file.originalname}`,  // Use current timestamp and original file name
      Body: req.file.buffer,  // File data
      ContentType: req.file.mimetype  // Mime type
    };

    // Upload to S3
    const data = await s3.upload(params).promise();
    res.status(200).send({
      message: 'File uploaded successfully!',
      fileUrl: data.Location  // URL of the uploaded file in S3
    });
  } catch (error) {
    res.status(500).send({
      message: 'Error uploading file.',
      error: error.message
    });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
